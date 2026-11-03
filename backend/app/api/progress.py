"""Progress, history and the visitor's own data (including "delete my data")."""

from datetime import UTC, datetime

from fastapi import APIRouter, Response
from sqlalchemy import func, select

from app import progress as progress_service
from app.api.deps import CurrentVisitor, DbSession
from app.models import Answer, InterviewSession, Question, UsageLog
from app.schemas import MyDataOut, ProgressOut, SessionSummary

router = APIRouter(prefix="/api", tags=["progress"])


@router.get("/progress")
def get_progress(visitor: CurrentVisitor, db: DbSession) -> ProgressOut:
    return progress_service.progress(db, visitor.id)


@router.get("/history")
def get_history(visitor: CurrentVisitor, db: DbSession) -> list[SessionSummary]:
    return progress_service.history(db, visitor.id)


@router.get("/me")
def my_data(visitor: CurrentVisitor, db: DbSession) -> MyDataOut:
    """What we store about this visitor, for the Settings page."""
    sessions = db.scalar(select(func.count()).where(InterviewSession.visitor_id == visitor.id))
    answers = db.scalar(
        select(func.count(Answer.id))
        .join(Question)
        .join(InterviewSession)
        .where(InterviewSession.visitor_id == visitor.id)
    )

    def spent(*conditions) -> float:
        total = db.scalar(
            select(func.coalesce(func.sum(UsageLog.cost_usd), 0.0)).where(
                UsageLog.visitor_id == visitor.id, *conditions
            )
        )
        return round(total, 4)

    return MyDataOut(
        sessions=sessions,
        answers=answers,
        total_cost_usd=spent(),
        today_cost_usd=spent(UsageLog.day == datetime.now(UTC).date()),
    )


@router.delete("/me", status_code=204)
def delete_my_data(visitor: CurrentVisitor, db: DbSession) -> Response:
    """Delete the visitor and everything linked to them: sessions, questions, answers,
    scores and memory (the database cascades the delete). Anonymous cost rows are kept,
    unlinked, so the daily spending cap still counts them."""
    db.delete(visitor)
    db.commit()
    return Response(status_code=204)
