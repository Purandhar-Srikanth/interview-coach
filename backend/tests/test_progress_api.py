from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import InterviewSession, Question, TopicStat, UsageLog
from tests.test_interview_api import events, start


def play_round(client, answers: list[str | None]) -> str:
    """Play a full round; None means skip. Returns the session id."""
    session_id, question, _ = start(client)
    for i, text in enumerate(answers):
        if text is None:
            evts = events(
                client.post(
                    f"/api/sessions/{session_id}/skip", json={"question_id": question["id"]}
                )
            )
        else:
            body = {"question_id": question["id"], "text": text, "time_taken_s": 20}
            events(client.post(f"/api/sessions/{session_id}/answer", json=body))
            evts = events(client.post(f"/api/sessions/{session_id}/next"))
        if i < len(answers) - 1:
            question = next(e["question"] for e in evts if e["type"] == "question")
    return session_id


def test_progress_is_empty_for_a_new_visitor(client):
    body = client.get("/api/progress").json()
    assert body["rounds_completed"] == 0
    assert body["sessions"] == [] and body["topics"] == []
    assert body["dimensions"] is None and body["overall_average"] is None


def test_progress_after_two_rounds(client):
    long = "a detailed answer " * 20
    play_round(client, [long, "short", None, long, long])
    play_round(client, [long] * 5)

    body = client.get("/api/progress").json()
    assert body["rounds_completed"] == 2
    assert body["questions_answered"] == 9  # one skip
    assert len(body["sessions"]) == 2
    assert body["sessions"][0]["created_at"] <= body["sessions"][1]["created_at"]  # oldest first
    assert body["sessions"][0]["skipped"] == 1

    averages = [t["avg_score"] for t in body["topics"]]
    assert averages == sorted(averages)  # weakest first
    assert all(t["weak"] == (t["avg_score"] < 70) for t in body["topics"])
    assert set(body["dimensions"]) == {"correctness", "depth", "clarity", "relevance"}
    assert body["latest_session_id"] == body["sessions"][1]["id"]


def test_history_is_newest_first_and_hides_unstarted_sessions(client):
    first = play_round(client, ["answer " * 30] * 5)
    client.post(
        "/api/sessions", json={"jd_text": "x" * 60, "resume_text": "y" * 120}
    )  # never started
    second, _, _ = start(client)  # in progress

    history = client.get("/api/history").json()
    assert [h["id"] for h in history] == [second, first]
    assert history[0]["status"] == "in_progress"


def test_my_data_counts(client):
    play_round(client, ["answer " * 30] * 5)
    body = client.get("/api/me").json()
    assert body["sessions"] == 1
    assert body["answers"] == 5
    assert body["total_cost_usd"] > 0
    assert body["today_cost_usd"] == body["total_cost_usd"]


def test_delete_my_data_removes_everything_but_anonymous_costs(client):
    session_id = play_round(client, ["answer " * 30] * 5)
    visitor_id = client.headers["X-Visitor-Id"]

    assert client.delete("/api/me").status_code == 204

    with SessionLocal() as db:
        assert db.get(InterviewSession, session_id) is None
        assert (
            db.scalar(
                select(func.count()).select_from(Question).where(Question.session_id == session_id)
            )
            == 0
        )
        assert db.scalars(select(TopicStat).where(TopicStat.visitor_id == visitor_id)).all() == []
        costs = db.scalars(select(UsageLog).where(UsageLog.session_id == session_id)).all()
        assert costs and all(row.visitor_id is None for row in costs)

    assert client.get(f"/api/sessions/{session_id}").status_code == 404
    assert client.get("/api/progress").json()["topics"] == []
