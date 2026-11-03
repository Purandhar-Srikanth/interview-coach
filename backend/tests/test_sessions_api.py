import uuid

from sqlalchemy import select

from app.db import SessionLocal
from app.llm import LLMError
from app.models import UsageLog
from tests.test_parsing import RESUME_LINE, make_docx

JD = "We are hiring a Junior Data Scientist with strong Python, SQL and scikit-learn skills. " * 2
RESUME = RESUME_LINE * 3


def create(client, **overrides):
    body = {"jd_text": JD, "resume_text": RESUME, "difficulty": "easy"} | overrides
    return client.post("/api/sessions", json=body)


def test_create_session_returns_profile(client, fake_llm):
    response = create(client)
    assert response.status_code == 201
    body = response.json()
    assert body["role_title"] == "Junior Data Scientist"
    assert body["difficulty"] == "easy"
    assert body["status"] == "analyzed"
    # duplicate topic in the fake LLM output is removed
    assert body["profile"]["jd_topics"] == ["sql_basics", "ml_fundamentals", "model_evaluation"]
    assert body["cost_usd"] > 0
    assert fake_llm.calls == ["analyze_profile"]


def test_usage_is_logged_per_call(client):
    session_id = create(client).json()["id"]
    with SessionLocal() as db:
        rows = db.scalars(select(UsageLog).where(UsageLog.session_id == session_id)).all()
    assert [row.purpose for row in rows] == ["analyze_profile"]


def test_session_is_private_to_its_visitor(client):
    session_id = create(client).json()["id"]
    assert client.get(f"/api/sessions/{session_id}").status_code == 200
    other = {"X-Visitor-Id": str(uuid.uuid4())}
    assert client.get(f"/api/sessions/{session_id}", headers=other).status_code == 404


def test_rejects_too_short_job_description(client):
    assert create(client, jd_text="short").status_code == 422


def test_rejects_bad_visitor_id(client):
    response = client.get("/api/sessions/x", headers={"X-Visitor-Id": "not-a-uuid"})
    assert response.status_code == 400


def test_llm_failure_returns_friendly_503(client, fake_llm):
    fake_llm.fail_with = LLMError("The AI service is busy right now.")
    response = create(client)
    assert response.status_code == 503
    assert "busy" in response.json()["detail"]


def test_resume_upload_returns_text(client):
    files = {"file": ("cv.docx", make_docx(RESUME), "application/octet-stream")}
    response = client.post("/api/resume/parse", files=files)
    assert response.status_code == 200
    assert "OpenCV" in response.json()["text"]


def test_resume_upload_rejects_bad_type(client):
    files = {"file": ("cv.png", b"\x89PNG", "image/png")}
    response = client.post("/api/resume/parse", files=files)
    assert response.status_code == 422
