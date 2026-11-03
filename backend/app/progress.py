"""Progress and history: turns stored sessions + memory into the numbers the charts show.

As everywhere else, the FIRST attempt at a question is "the" score; retries are practice.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.agent.planner import WEAK_THRESHOLD
from app.agent.topics import topic_label
from app.models import Answer, InterviewSession, Question, TopicStat
from app.schemas import ProgressOut, SessionSummary, TopicProgress
from app.serializers import utc

DIMENSIONS = ("correctness", "depth", "clarity", "relevance")


def _visitor_sessions(db: Session, visitor_id: str) -> list[InterviewSession]:
    """All started sessions, oldest first, with questions/answers/scores loaded in one go."""
    return list(
        db.scalars(
            select(InterviewSession)
            .where(InterviewSession.visitor_id == visitor_id, InterviewSession.status != "analyzed")
            .options(
                selectinload(InterviewSession.questions)
                .selectinload(Question.answers)
                .selectinload(Answer.score)
            )
            .order_by(InterviewSession.created_at)
        )
    )


def _first_answers(session: InterviewSession) -> list[Answer]:
    return [q.answers[0] for q in session.questions if q.answers]


def session_summary(session: InterviewSession) -> SessionSummary:
    firsts = _first_answers(session)
    scores = [a.score.overall for a in firsts if a.score]
    return SessionSummary(
        id=session.id,
        created_at=utc(session.created_at),
        finished_at=utc(session.finished_at),
        status=session.status,
        role_title=session.role_title,
        difficulty=session.difficulty,
        focus_topic=session.focus_topic,
        average=round(sum(scores) / len(scores)) if scores else None,
        answered=len(scores),
        skipped=sum(1 for a in firsts if a.skipped),
        total=len(session.plan) if session.plan else 5,
    )


def history(db: Session, visitor_id: str) -> list[SessionSummary]:
    """Newest first, for the History page."""
    return [session_summary(s) for s in reversed(_visitor_sessions(db, visitor_id))]


def progress(db: Session, visitor_id: str) -> ProgressOut:
    sessions = _visitor_sessions(db, visitor_id)
    summaries = [session_summary(s) for s in sessions]
    scored_firsts = [a for s in sessions for a in _first_answers(s) if a.score]

    stats = db.scalars(select(TopicStat).where(TopicStat.visitor_id == visitor_id)).all()
    topics = sorted(
        (
            TopicProgress(
                topic=stat.topic,
                label=topic_label(stat.topic),
                avg_score=round(stat.avg_score),
                attempts=stat.attempts,
                last_score=stat.last_score,
                last_seen=utc(stat.last_seen),
                weak=stat.avg_score < WEAK_THRESHOLD,
            )
            for stat in stats
        ),
        key=lambda t: t.avg_score,
    )

    dimensions = None
    if scored_firsts:
        dimensions = {
            name: round(sum(getattr(a.score, name) for a in scored_firsts) / len(scored_firsts), 2)
            for name in DIMENSIONS
        }

    overall = [a.score.overall for a in scored_firsts]
    latest_with_profile = next((s for s in reversed(sessions) if s.profile), None)
    return ProgressOut(
        rounds_completed=sum(1 for s in sessions if s.status == "completed"),
        questions_answered=len(scored_firsts),
        overall_average=round(sum(overall) / len(overall)) if overall else None,
        # Only rounds with at least one score belong on the trend chart.
        sessions=[s for s in summaries if s.average is not None],
        topics=topics,
        dimensions=dimensions,
        latest_session_id=latest_with_profile.id if latest_with_profile else None,
    )
