"""Database tables. See docs/PLAN.md section 5 for what each table is for."""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(UTC)


def _uuid() -> str:
    return str(uuid.uuid4())


class Visitor(Base):
    """An anonymous browser. No name, email or password is ever stored."""

    __tablename__ = "visitors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class InterviewSession(Base):
    """One interview round: the JD + resume it was based on, the plan, and its total cost."""

    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    visitor_id: Mapped[str] = mapped_column(
        ForeignKey("visitors.id", ondelete="CASCADE"), index=True
    )
    role_title: Mapped[str] = mapped_column(String(200), default="")
    jd_text: Mapped[str] = mapped_column(Text)
    resume_text: Mapped[str] = mapped_column(Text)
    profile: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # ProfileAnalysis
    difficulty: Mapped[str] = mapped_column(String(10), default="medium")
    focus_topic: Mapped[str | None] = mapped_column(String(50), nullable=True)
    plan: Mapped[list | None] = mapped_column(JSON, nullable=True)  # planned question slots
    status: Mapped[str] = mapped_column(String(20), default="created")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    questions: Mapped[list["Question"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="Question.index"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    index: Mapped[int] = mapped_column(Integer)
    qtype: Mapped[str] = mapped_column(String(20))
    topic: Mapped[str] = mapped_column(String(50))
    difficulty: Mapped[str] = mapped_column(String(10))
    text: Mapped[str] = mapped_column(Text)
    expected_points: Mapped[list] = mapped_column(JSON, default=list)  # hidden from the user
    time_limit_s: Mapped[int] = mapped_column(Integer, default=120)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    session: Mapped[InterviewSession] = relationship(back_populates="questions")
    answers: Mapped[list["Answer"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="Answer.attempt"
    )


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    text: Mapped[str] = mapped_column(Text, default="")
    time_taken_s: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    question: Mapped[Question] = relationship(back_populates="answers")
    score: Mapped["Score | None"] = relationship(
        back_populates="answer", cascade="all, delete-orphan", uselist=False
    )


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    answer_id: Mapped[str] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE"), unique=True
    )
    correctness: Mapped[int] = mapped_column(Integer)  # holds STAR score for behavioural Qs
    depth: Mapped[int] = mapped_column(Integer)
    clarity: Mapped[int] = mapped_column(Integer)
    relevance: Mapped[int] = mapped_column(Integer)
    overall: Mapped[int] = mapped_column(Integer)  # 0-100
    justifications: Mapped[dict] = mapped_column(JSON, default=dict)
    feedback: Mapped[list] = mapped_column(JSON, default=list)
    sample_answer: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str] = mapped_column(String(50))

    answer: Mapped[Answer] = relationship(back_populates="score")


class TopicStat(Base):
    """The agent's long-term memory: how well a visitor does on each topic."""

    __tablename__ = "topic_stats"

    visitor_id: Mapped[str] = mapped_column(
        ForeignKey("visitors.id", ondelete="CASCADE"), primary_key=True
    )
    topic: Mapped[str] = mapped_column(String(50), primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)  # moving average, 0-100
    last_score: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UsageLog(Base):
    """One row per LLM call, used for cost caps and transparency."""

    __tablename__ = "usage_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visitor_id: Mapped[str] = mapped_column(
        ForeignKey("visitors.id", ondelete="CASCADE"), index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    purpose: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(50))
    tokens_in: Mapped[int] = mapped_column(Integer)
    tokens_out: Mapped[int] = mapped_column(Integer)
    cost_usd: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
