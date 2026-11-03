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


def test_postgres_urls_get_the_psycopg_driver():
    from app.db import normalize_url

    assert normalize_url("postgres://u:p@host/db?sslmode=require") == (
        "postgresql+psycopg://u:p@host/db?sslmode=require"
    )
    assert normalize_url("postgresql://u:p@host/db").startswith("postgresql+psycopg://")
    assert normalize_url("sqlite:///x.db") == "sqlite:///x.db"


def test_unknown_api_paths_return_404_not_the_web_page():
    assert client.get("/api/does-not-exist").status_code == 404
