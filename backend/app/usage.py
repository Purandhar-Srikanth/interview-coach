"""Save LLM spend from a Budget into the database (per call, and per session)."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.llm import Budget, CallUsage
from app.models import InterviewSession, UsageLog


def log_calls(db: Session, visitor_id: str, session_id: str | None, calls: list[CallUsage]) -> None:
    """One usage_log row per LLM call. These rows feed the daily spending cap."""
    for call in calls:
        db.add(
            UsageLog(
                visitor_id=visitor_id,
                session_id=session_id,
                day=datetime.now(UTC).date(),
                purpose=call.purpose,
                model=call.model,
                tokens_in=call.input_tokens,
                tokens_out=call.output_tokens,
                cost_usd=call.cost_usd,
            )
        )


def save_usage(db: Session, session: InterviewSession, budget: Budget, already_saved: int) -> None:
    """Store the calls made since `already_saved`, and the session's running total."""
    new_calls = budget.calls[already_saved:]
    log_calls(db, session.visitor_id, session.id, new_calls)
    for call in new_calls:
        session.tokens_in += call.input_tokens
        session.tokens_out += call.output_tokens
    session.cost_usd = budget.spent_usd
