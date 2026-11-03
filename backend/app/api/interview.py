"""Interview actions. Each one runs the agent graph and streams its events to the browser
as Server-Sent Events (SSE): one `data: {json}` line per event.

Checks (ownership, order of actions) happen first as normal HTTP errors; only then does
the streaming response start.
"""

import json
import logging
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agent.graph import build_graph
from app.agent.nodes import Action, AgentContext
from app.api.deps import CurrentVisitor, DbSession
from app.api.sessions import LLMDep, get_own_session
from app.config import get_settings
from app.db import SessionLocal
from app.llm import LLM, Budget, LLMError
from app.models import Answer, InterviewSession, Question
from app.schemas import AnswerCreate, SkipCreate
from app.usage import save_usage

router = APIRouter(prefix="/api/sessions/{session_id}", tags=["interview"])
log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3  # first answer + 2 retries


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def run_agent(session_id: str, llm: LLM, action: Action, answer_id: str | None = None):
    """Run the graph for one action and stream its events. Uses its own DB session because
    the request's session is closed by the time the stream is consumed."""

    def events() -> Iterator[str]:
        with SessionLocal() as db:
            session = db.get(InterviewSession, session_id)
            budget = Budget(cap_usd=get_settings().session_cost_cap_usd, spent_usd=session.cost_usd)
            ctx = AgentContext(db=db, llm=llm, budget=budget, session=session)
            try:
                for event in build_graph().stream(
                    {"action": action, "answer_id": answer_id},
                    {"configurable": {"ctx": ctx}},
                    stream_mode="custom",
                ):
                    yield _sse(event)
            except LLMError as exc:
                db.rollback()
                _undo_unscored_answer(db, answer_id)
                yield _sse({"type": "error", "message": str(exc)})
            except Exception:
                log.exception("Agent run failed")
                db.rollback()
                _undo_unscored_answer(db, answer_id)
                yield _sse({"type": "error", "message": "Something went wrong. Please try again."})
            finally:
                # Always record what was spent, even if a later step failed.
                save_usage(db, db.get(InterviewSession, session_id), budget, already_saved=0)
                db.commit()
            yield _sse({"type": "done"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _undo_unscored_answer(db, answer_id: str | None) -> None:
    """If scoring failed, remove the answer so the user can simply submit again."""
    if answer_id:
        answer = db.get(Answer, answer_id)
        if answer and answer.score is None:
            db.delete(answer)
            db.commit()


def _current_question(session: InterviewSession, question_id: str) -> Question:
    if session.status != "in_progress" or not session.questions:
        raise HTTPException(409, "This interview isn't in progress.")
    current = session.questions[-1]
    if current.id != question_id:
        raise HTTPException(409, "You can only answer the current question.")
    return current


@router.post("/start")
def start(session_id: str, visitor: CurrentVisitor, db: DbSession, llm: LLMDep):
    session = get_own_session(db, visitor, session_id)
    if session.status != "analyzed":
        raise HTTPException(409, "This interview has already started.")
    return run_agent(session.id, llm, "start")


@router.post("/answer")
def answer(
    session_id: str, body: AnswerCreate, visitor: CurrentVisitor, db: DbSession, llm: LLMDep
):
    session = get_own_session(db, visitor, session_id)
    question = _current_question(session, body.question_id)
    if any(a.skipped for a in question.answers):
        raise HTTPException(409, "This question was skipped.")
    if len(question.answers) >= MAX_ATTEMPTS:
        raise HTTPException(409, f"You can answer a question at most {MAX_ATTEMPTS} times.")

    new_answer = Answer(
        question=question,
        attempt=len(question.answers) + 1,
        text=body.text.strip(),
        time_taken_s=body.time_taken_s,
    )
    db.add(new_answer)
    db.commit()
    return run_agent(session.id, llm, "answer", answer_id=new_answer.id)


@router.post("/skip")
def skip(session_id: str, body: SkipCreate, visitor: CurrentVisitor, db: DbSession, llm: LLMDep):
    """Skip the current question (not counted in memory) and move on."""
    session = get_own_session(db, visitor, session_id)
    question = _current_question(session, body.question_id)
    if question.answers:
        raise HTTPException(409, "This question already has an answer; use Next instead.")
    db.add(Answer(question=question, attempt=1, skipped=True))
    db.commit()
    return run_agent(session.id, llm, "next")


@router.post("/next")
def next_question(session_id: str, visitor: CurrentVisitor, db: DbSession, llm: LLMDep):
    session = get_own_session(db, visitor, session_id)
    if session.status != "in_progress" or not session.questions:
        raise HTTPException(409, "This interview isn't in progress.")
    if not session.questions[-1].answers:
        raise HTTPException(409, "Answer or skip the current question first.")
    return run_agent(session.id, llm, "next")
