"""End-to-end interview flow through the API, with the fake LLM."""

import json

from app.llm import LLMError
from tests.test_sessions_api import create


def events(response) -> list[dict]:
    """Parse an SSE response body into a list of event dicts."""
    assert response.status_code == 200, response.text
    return [
        json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")
    ]


def types(evts) -> list[str]:
    return [e["type"] for e in evts]


def start(client):
    session_id = create(client).json()["id"]
    evts = events(client.post(f"/api/sessions/{session_id}/start"))
    question = next(e["question"] for e in evts if e["type"] == "question")
    return session_id, question, evts


def test_start_plans_round_and_streams_first_question(client):
    _, question, evts = start(client)
    assert types(evts)[:2] == ["plan", "question_start"]
    assert "question_delta" in types(evts)
    assert types(evts)[-1] == "done"
    streamed = "".join(e["text"] for e in evts if e["type"] == "question_delta")
    assert streamed.strip() == question["text"]
    assert question["index"] == 0
    assert question["expected_points"] is None  # hidden until answered


def test_answer_is_scored_and_updates_memory(client):
    session_id, question, _ = start(client)
    body = {"question_id": question["id"], "text": "A detailed answer " * 20, "time_taken_s": 42}
    evts = events(client.post(f"/api/sessions/{session_id}/answer", json=body))
    assert types(evts) == ["scoring", "score", "memory", "done"]
    score = evts[1]["answer"]["score"]
    assert 0 <= score["overall"] <= 100
    assert set(score["justifications"]) == {"correctness", "depth", "clarity", "relevance"}
    assert evts[1]["expected_points"]  # revealed after answering


def test_retry_is_scored_but_not_added_to_memory(client):
    session_id, question, _ = start(client)
    body = {"question_id": question["id"], "text": "short", "time_taken_s": 5}
    events(client.post(f"/api/sessions/{session_id}/answer", json=body))
    retry = events(
        client.post(f"/api/sessions/{session_id}/answer", json=body | {"text": "x" * 300})
    )
    assert "score" in types(retry)
    assert "memory" not in types(retry)
    assert retry[1]["answer"]["attempt"] == 2


def test_full_round_ends_with_summary(client):
    session_id, question, _ = start(client)
    for i in range(5):
        body = {"question_id": question["id"], "text": f"answer {i} " * 30, "time_taken_s": 30}
        events(client.post(f"/api/sessions/{session_id}/answer", json=body))
        evts = events(client.post(f"/api/sessions/{session_id}/next"))
        if i < 4:
            question = next(e["question"] for e in evts if e["type"] == "question")
            assert question["index"] == i + 1
    assert "summary_delta" in types(evts)
    complete = next(e for e in evts if e["type"] == "round_complete")
    assert complete["summary"]
    assert complete["average"] is not None

    session = client.get(f"/api/sessions/{session_id}").json()
    assert session["status"] == "completed"
    assert len(session["questions"]) == 5
    assert session["cost_usd"] > 0


def test_skip_moves_on_without_scoring(client):
    session_id, question, _ = start(client)
    evts = events(
        client.post(f"/api/sessions/{session_id}/skip", json={"question_id": question["id"]})
    )
    assert "score" not in types(evts)
    assert next(e for e in evts if e["type"] == "question")["question"]["index"] == 1


def test_cannot_skip_ahead_or_answer_old_questions(client):
    session_id, question, _ = start(client)
    assert client.post(f"/api/sessions/{session_id}/next").status_code == 409
    client.post(f"/api/sessions/{session_id}/skip", json={"question_id": question["id"]})
    old = {"question_id": question["id"], "text": "late", "time_taken_s": 1}
    assert client.post(f"/api/sessions/{session_id}/answer", json=old).status_code == 409


def test_cannot_start_twice(client):
    session_id, _, _ = start(client)
    assert client.post(f"/api/sessions/{session_id}/start").status_code == 409


def test_scoring_failure_sends_error_and_allows_resubmit(client, fake_llm):
    session_id, question, _ = start(client)
    fake_llm.fail_with = LLMError("The AI service is busy right now.")
    body = {"question_id": question["id"], "text": "my answer", "time_taken_s": 9}
    evts = events(client.post(f"/api/sessions/{session_id}/answer", json=body))
    assert {"type": "error", "message": "The AI service is busy right now."} in evts

    fake_llm.fail_with = None
    evts = events(client.post(f"/api/sessions/{session_id}/answer", json=body))
    assert evts[1]["answer"]["attempt"] == 1  # the failed attempt didn't count


def test_cost_cap_stops_the_interview(client, monkeypatch):
    from app.config import get_settings

    session_id = create(client).json()["id"]
    monkeypatch.setattr(get_settings(), "session_cost_cap_usd", 0.0015)
    evts = events(client.post(f"/api/sessions/{session_id}/start"))
    error = next(e for e in evts if e["type"] == "error")
    assert "cost limit" in error["message"]


def test_other_visitors_cannot_use_the_session(client):
    import uuid

    session_id, question, _ = start(client)
    other = {"X-Visitor-Id": str(uuid.uuid4())}
    body = {"question_id": question["id"], "text": "hi", "time_taken_s": 1}
    assert (
        client.post(f"/api/sessions/{session_id}/answer", json=body, headers=other).status_code
        == 404
    )


def test_practice_round_reuses_profile_and_focuses_topic(client, fake_llm):
    session_id = create(client).json()["id"]
    response = client.post(
        f"/api/sessions/{session_id}/practice", json={"focus_topic": "pandas", "difficulty": "hard"}
    )
    assert response.status_code == 201
    new = response.json()
    assert new["id"] != session_id
    assert new["focus_topic"] == "pandas"
    assert new["difficulty"] == "hard"
    assert fake_llm.calls == ["analyze_profile"]  # no second analysis

    evts = events(client.post(f"/api/sessions/{new['id']}/start"))
    plan = next(e for e in evts if e["type"] == "plan")
    assert [t["topic"] for t in plan["topics"]] == ["pandas"] * 5


def test_practice_rejects_unknown_topic(client):
    session_id = create(client).json()["id"]
    response = client.post(f"/api/sessions/{session_id}/practice", json={"focus_topic": "cooking"})
    assert response.status_code == 422
