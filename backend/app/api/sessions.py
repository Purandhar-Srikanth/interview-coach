from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.agent.profile import analyze_profile
from app.api.deps import CurrentVisitor, DbSession
from app.config import get_settings
from app.llm import LLM, Budget, LLMError, get_llm
from app.models import InterviewSession
from app.schemas import SessionCreate, SessionOut
from app.serializers import session_out
from app.usage import save_usage

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
    body: SessionCreate, visitor: CurrentVisitor, db: DbSession, llm: LLMDep
) -> SessionOut:
    """Create an interview session and analyse the JD + resume."""
    session = InterviewSession(
        visitor_id=visitor.id,
        jd_text=body.jd_text.strip(),
        resume_text=body.resume_text.strip(),
        difficulty=body.difficulty,
    )
    db.add(session)
    db.flush()  # assigns session.id

    budget = Budget(cap_usd=get_settings().session_cost_cap_usd)
    try:
        profile = analyze_profile(llm, session.jd_text, session.resume_text, budget)
    except LLMError as exc:
        db.rollback()
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
