"""Demo protection: rate limits, free allowance, daily budget and data retention."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.guard import RateLimiter, purge_old_data, request_limiter, round_limiter
from app.models import UsageLog, Visitor
from tests.test_interview_api import events
from tests.test_sessions_api import create


@pytest.fixture
def demo(monkeypatch):
    """Turn on demo mode with small limits, and start every test with empty counters."""
    settings = get_settings()
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "demo_rounds_per_visitor_per_day", 2)
    monkeypatch.setattr(settings, "demo_rounds_per_ip_per_day", 3)
    monkeypatch.setattr(settings, "demo_requests_per_minute", 100)
    monkeypatch.setattr(settings, "daily_cost_cap_usd", 1.0)
    request_limiter.reset()
    round_limiter.reset()
    with SessionLocal() as db:  # today's spend from earlier tests shouldn't count here
        db.query(UsageLog).delete()
        db.commit()
    yield settings
    request_limiter.reset()
    round_limiter.reset()


def add_spend(amount: float, day=None) -> None:
    with SessionLocal() as db:
        db.add(
            UsageLog(
                visitor_id=None,
                day=day or datetime.now(UTC).date(),
                purpose="test",
                model="m",
                tokens_in=0,
                tokens_out=0,
                cost_usd=amount,
            )
        )
        db.commit()


def test_rate_limiter_sliding_window():
    limiter = RateLimiter()
    assert all(limiter.allow("ip", 3, 60) for _ in range(3))
    assert not limiter.allow("ip", 3, 60)
    assert limiter.allow("other-ip", 3, 60)  # limits are per key


def test_guard_is_off_outside_demo_mode(client):
    for _ in range(4):
        assert create(client).status_code == 201


def test_free_rounds_per_visitor(client, demo):
    assert client.get("/api/demo").json() == {
        "demo_mode": True,
        "rounds_left_today": 2,
        "daily_budget_exhausted": False,
    }
    assert create(client).status_code == 201
    assert create(client).status_code == 201
    response = create(client)
    assert response.status_code == 429
    assert "free demo rounds" in response.json()["detail"]
    assert client.get("/api/demo").json()["rounds_left_today"] == 0


def test_free_rounds_per_ip_even_with_new_visitor_ids(client, demo):
    codes = []
    for _ in range(4):
        client.headers["X-Visitor-Id"] = str(uuid.uuid4())  # "clearing the browser"
        codes.append(create(client).status_code)
    assert codes == [201, 201, 201, 429]


def test_practice_rounds_count_too(client, demo):
    session_id = create(client).json()["id"]
    assert client.post(f"/api/sessions/{session_id}/practice", json={}).status_code == 201
    assert client.post(f"/api/sessions/{session_id}/practice", json={}).status_code == 429


def test_daily_budget_blocks_new_rounds(client, demo):
    add_spend(1.0)
    response = create(client)
    assert response.status_code == 503
    assert "budget" in response.json()["detail"]
    assert client.get("/api/demo").json()["daily_budget_exhausted"] is True


def test_daily_budget_also_stops_a_running_interview(client, demo):
    session_id = create(client).json()["id"]
    add_spend(0.9995)  # almost all of today's $1 budget used by others
    evts = events(client.post(f"/api/sessions/{session_id}/start"))
    error = next(e for e in evts if e["type"] == "error")
    assert "daily" in error["message"] or "today" in error["message"]


def test_request_rate_limit(client, demo, monkeypatch):
    monkeypatch.setattr(demo, "demo_requests_per_minute", 2)
    session_id = create(client).json()["id"]  # request 1
    assert client.post(f"/api/sessions/{session_id}/start").status_code == 200  # request 2
    response = client.post(f"/api/sessions/{session_id}/next")  # request 3
    assert response.status_code == 429


def test_purge_deletes_old_visitors_and_old_cost_rows(demo):
    old_id, recent_id = str(uuid.uuid4()), str(uuid.uuid4())
    with SessionLocal() as db:
        db.add(Visitor(id=old_id, last_seen=datetime.now(UTC) - timedelta(days=8)))
        db.add(Visitor(id=recent_id, last_seen=datetime.now(UTC) - timedelta(days=1)))
        db.commit()
    add_spend(0.5, day=(datetime.now(UTC) - timedelta(days=31)).date())

    with SessionLocal() as db:
        purge_old_data(db, force=True)
        assert db.get(Visitor, old_id) is None
        assert db.get(Visitor, recent_id) is not None
        assert db.query(UsageLog).filter(UsageLog.cost_usd == 0.5).count() == 0
