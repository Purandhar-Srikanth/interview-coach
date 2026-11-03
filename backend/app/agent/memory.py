"""Long-term memory: a per-topic moving average of the visitor's scores."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TopicStat

# How much a new score moves the average. 0.4 = recent answers matter more than old ones,
# so the coach notices when you improve.
ALPHA = 0.4


def updated_average(old_avg: float, attempts: int, new_score: int) -> float:
    """Exponential moving average; the first score is taken as-is."""
    if attempts == 0:
        return float(new_score)
    return ALPHA * new_score + (1 - ALPHA) * old_avg


def record_score(db: Session, visitor_id: str, topic: str, score: int) -> TopicStat:
    stat = db.get(TopicStat, (visitor_id, topic))
    if stat is None:
        stat = TopicStat(visitor_id=visitor_id, topic=topic, attempts=0, avg_score=0.0)
        db.add(stat)
    stat.avg_score = updated_average(stat.avg_score, stat.attempts, score)
    stat.attempts += 1
    stat.last_score = score
    stat.last_seen = datetime.now(UTC)
    return stat


def topic_averages(db: Session, visitor_id: str) -> dict[str, float]:
    rows = db.scalars(select(TopicStat).where(TopicStat.visitor_id == visitor_id))
    return {row.topic: row.avg_score for row in rows}
