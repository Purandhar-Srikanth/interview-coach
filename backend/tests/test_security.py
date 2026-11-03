"""HTTP security: headers, request size limits, real client IP, demo API rate limit."""

import uuid

from app.config import get_settings
from app.db import SessionLocal
from app.guard import client_ip_from_headers
from app.models import Visitor
from app.security import MAX_BODY_BYTES, api_limiter
from tests.test_guard import demo  # noqa: F401  (fixture)


def test_security_headers_on_every_response(client):
    response = client.get("/api/health")
    csp = response.headers["content-security-policy"]
    assert "script-src 'self'" in csp and "frame-ancestors 'none'" in csp
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "max-age=" in response.headers["strict-transport-security"]
    assert "microphone=(self)" in response.headers["permissions-policy"]
    assert response.headers["cache-control"] == "no-store"  # API data is personal


def test_headers_also_on_error_responses(client):
    response = client.get("/api/sessions/nope")
    assert response.status_code == 404
    assert "content-security-policy" in response.headers


def test_oversized_request_rejected_before_reading(client):
    response = client.post(
        "/api/sessions",
        content=b"{}",
        headers={"Content-Length": str(MAX_BODY_BYTES + 1), "Content-Type": "application/json"},
    )
    assert response.status_code == 413


def test_client_ip_cannot_be_spoofed_with_x_forwarded_for():
    # The client sends a fake first entry; the proxy appends the real address at the end.
    headers = {"x-forwarded-for": "1.2.3.4, 49.37.1.1"}
    assert client_ip_from_headers(headers, ("10.0.0.1", 1)) == "49.37.1.1"
    # Cloudflare's own header wins when present.
    headers["cf-connecting-ip"] = "49.37.9.9"
    assert client_ip_from_headers(headers, None) == "49.37.9.9"
    assert client_ip_from_headers({}, ("10.0.0.1", 1)) == "10.0.0.1"


def test_reads_with_unknown_visitor_ids_do_not_create_rows(client):
    new_id = str(uuid.uuid4())
    assert client.get("/api/history", headers={"X-Visitor-Id": new_id}).json() == []
    with SessionLocal() as db:
        assert db.get(Visitor, new_id) is None


def test_demo_api_rate_limit(client, demo, monkeypatch):  # noqa: F811
    monkeypatch.setattr("app.security.API_REQUESTS_PER_MINUTE", 3)
    api_limiter.reset()
    codes = [client.get("/api/health").status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    api_limiter.reset()


def test_api_docs_are_hidden_in_demo_mode():
    # The app object is built once at import, so check the rule the app uses.
    import app.main as main

    assert (main.app.docs_url is None) == get_settings().demo_mode
