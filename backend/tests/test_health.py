from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "llm_configured" in body


def test_health_never_exposes_the_api_key():
    assert "sk-" not in client.get("/api/health").text
