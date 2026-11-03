from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.agent.profile import analyze_profile
from app.api.deps import CurrentVisitor, DbSession
from app.guard import RateLimited, check_new_round, make_budget, purge_old_data
from app.llm import LLM, LLMError, get_llm
from app.models import InterviewSession
from app.schemas import PracticeCreate, SessionCreate, SessionOut
from app.serializers import session_out
from app.usage import log_calls, save_usage

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

LLMDep = Annotated[LLM, Depends(get_llm)]


def get_own_session(db, visitor, session_id: str) -> InterviewSession:
    session = db.get(InterviewSession, session_id)
    # Same 404 for "doesn't exist" and "not yours", so IDs can't be probed.
    if session is None or session.visitor_id != visitor.id:
        raise HTTPException(404, "Interview not found.")
    return session


@router.post("", status_code=201)
def create_session(
    body: SessionCreate,
    request: Request,
    visitor: CurrentVisitor,
    db: DbSession,
    llm: LLMDep,
    _: RateLimited,
) -> SessionOut:
    """Create an interview session and analyse the JD + resume."""
    purge_old_data(db)
    check_new_round(db, visitor.id, request)
    session = InterviewSession(
        visitor_id=visitor.id,
        jd_text=body.jd_text.strip(),
        resume_text=body.resume_text.strip(),
        difficulty=body.difficulty,
    )
    db.add(session)
    db.flush()  # assigns session.id

    budget = make_budget(db)
    try:
        profile = analyze_profile(llm, session.jd_text, session.resume_text, budget)
    except LLMError as exc:
        db.rollback()
        # A failed analysis may still have cost money; log it so the daily cap stays accurate.
        log_calls(db, visitor.id, None, budget.calls)
        db.commit()
        raise HTTPException(503, str(exc)) from exc

    session.profile = profile.model_dump(mode="json")
    session.role_title = profile.role_title[:200]
    session.status = "analyzed"
    save_usage(db, session, budget, already_saved=0)
    db.commit()
    return session_out(session)


@router.get("/{session_id}")
def get_session(session_id: str, visitor: CurrentVisitor, db: DbSession) -> SessionOut:
    return session_out(get_own_session(db, visitor, session_id))


@router.post("/{session_id}/practice", status_code=201)
def practice_again(
    session_id: str,
    body: PracticeCreate,
    request: Request,
    visitor: CurrentVisitor,
    db: DbSession,
    _: RateLimited,
) -> SessionOut:
    """Start a new round from an earlier session's JD + resume, optionally focused on one topic.

    The profile analysis is reused, so this makes no LLM call.
    """
    source = get_own_session(db, visitor, session_id)
    check_new_round(db, visitor.id, request)
    if source.profile is None:
        raise HTTPException(409, "That interview was never analysed.")
    session = InterviewSession(
        visitor_id=visitor.id,
        role_title=source.role_title,
        jd_text=source.jd_text,
        resume_text=source.resume_text,
        profile=source.profile,
        difficulty=body.difficulty or source.difficulty,
        focus_topic=body.focus_topic.value if body.focus_topic else None,
        status="analyzed",
    )
    db.add(session)
    db.commit()
    return session_out(session)
