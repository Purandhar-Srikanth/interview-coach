"""Protects the OpenAI bill on the public demo (all checks are off unless DEMO_MODE=true).

Layers, from outermost in:
1. Per-IP rate limit on endpoints that call the LLM (stops scripts hammering the API).
2. Free allowance: N rounds per visitor per day, and a higher limit per IP (visitor IDs
   are easy to reset by clearing the browser, IPs are not).
3. Global daily budget: once today's total spend reaches the cap, no new LLM calls.
4. Per-session budget (always on): every LLM call is refused up front if its worst-case
   cost could exceed what's left. In demo mode, "what's left" also includes the daily cap.
Plus the final safety net outside the code: a monthly limit in the OpenAI dashboard.
"""

import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.llm import Budget
from app.models import InterviewSession, UsageLog, Visitor

DAILY_LIMIT_MESSAGE = (
    "The live demo has used its AI budget for today. Please come back tomorrow, "
    "or run the project locally with your own API key."
)


class RateLimiter:
    """Sliding-window counter kept in memory. Good enough for one small server; it resets
    when the server restarts, which is why the database-backed daily budget is the real cap."""

    def __init__(self):
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_s: float) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - window_s:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


request_limiter = RateLimiter()
round_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # Hugging Face (like most hosts) puts a proxy in front of the app; the real client
    # address is the first entry of X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def spent_today(db: Session) -> float:
    today = datetime.now(UTC).date()
    return db.scalar(
        select(func.coalesce(func.sum(UsageLog.cost_usd), 0.0)).where(UsageLog.day == today)
    )


def rounds_today(db: Session, visitor_id: str) -> int:
    start_of_day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return db.scalar(
        select(func.count()).where(
            InterviewSession.visitor_id == visitor_id,
            InterviewSession.created_at >= start_of_day,
        )
    )


def rate_limit(request: Request) -> None:
    """FastAPI dependency for endpoints that call the LLM."""
    settings = get_settings()
    if settings.demo_mode and not request_limiter.allow(
        client_ip(request), settings.demo_requests_per_minute, 60
    ):
        raise HTTPException(429, "Too many requests. Please wait a minute and try again.")


RateLimited = Annotated[None, Depends(rate_limit)]


def check_new_round(db: Session, visitor_id: str, request: Request) -> None:
    """Call before creating a new interview session (each one costs money)."""
    settings = get_settings()
    if not settings.demo_mode:
        return
    if spent_today(db) >= settings.daily_cost_cap_usd:
        raise HTTPException(503, DAILY_LIMIT_MESSAGE)
    limit = settings.demo_rounds_per_visitor_per_day
    if rounds_today(db, visitor_id) >= limit:
        raise HTTPException(
            429,
            f"You've used your {limit} free demo rounds for today. Come back tomorrow, "
            "or run the project locally with your own API key.",
        )
    if not round_limiter.allow(
        f"ip:{client_ip(request)}", settings.demo_rounds_per_ip_per_day, 24 * 3600
    ):
        raise HTTPException(429, "This network has used today's free demo rounds.")


def make_budget(db: Session, session: InterviewSession | None = None) -> Budget:
    """The spending limit for the next LLM calls of one session."""
    settings = get_settings()
    already_spent = session.cost_usd if session else 0.0
    budget = Budget(cap_usd=settings.session_cost_cap_usd, spent_usd=already_spent)
    if settings.demo_mode:
        daily_left = max(settings.daily_cost_cap_usd - spent_today(db), 0.0)
        if already_spent + daily_left < budget.cap_usd:
            budget.cap_usd = already_spent + daily_left
            budget.limit_message = DAILY_LIMIT_MESSAGE
    return budget


def demo_status(db: Session, visitor_id: str) -> dict:
    settings = get_settings()
    if not settings.demo_mode:
        return {"demo_mode": False, "rounds_left_today": None, "daily_budget_exhausted": False}
    used = rounds_today(db, visitor_id)
    return {
        "demo_mode": True,
        "rounds_left_today": max(settings.demo_rounds_per_visitor_per_day - used, 0),
        "daily_budget_exhausted": spent_today(db) >= settings.daily_cost_cap_usd,
    }


_last_purge = 0.0


def purge_old_data(db: Session, force: bool = False) -> None:
    """Demo privacy: delete visitors (and, by cascade, all their data) not seen for N days,
    and anonymous cost rows older than 30 days. Runs at most once an hour."""
    global _last_purge
    settings = get_settings()
    if not settings.demo_mode or (not force and time.monotonic() - _last_purge < 3600):
        return
    _last_purge = time.monotonic()
    now = datetime.now(UTC)
    db.execute(
        delete(Visitor).where(
            Visitor.last_seen < now - timedelta(days=settings.demo_data_retention_days)
        )
    )
    db.execute(delete(UsageLog).where(UsageLog.day < (now - timedelta(days=30)).date()))
    db.commit()
