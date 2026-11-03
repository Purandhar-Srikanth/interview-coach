"""Save LLM spend from a Budget into the database (per session and per call)."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.llm import Budget
from app.models import InterviewSession, UsageLog


def save_usage(db: Session, session: InterviewSession, budget: Budget, already_saved: int) -> None:
    """Store the calls made since `already_saved`, and the session's running total."""
    for call in budget.calls[already_saved:]:
        db.add(
            UsageLog(
                visitor_id=session.visitor_id,
                session_id=session.id,
                day=datetime.now(UTC).date(),
                purpose=call.purpose,
                model=call.model,
                tokens_in=call.input_tokens,
                tokens_out=call.output_tokens,
                cost_usd=call.cost_usd,
            )
        )
        session.tokens_in += call.input_tokens
        session.tokens_out += call.output_tokens
    session.cost_usd = budget.spent_usd
