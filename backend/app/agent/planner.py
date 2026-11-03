"""Round planner: decides which topic each question slot covers. Plain Python, no LLM.

Shape of a normal 5-question round (like a real interview):
  1. warm-up: a deep-dive into one of your projects
  2-4. technical: your weakest topics first (memory), then the JD's most important topics
  5. behavioural
A "focused" round (from clicking a weak-area chip) uses one topic for every slot.
"""

from app.agent.topics import Topic

WEAK_THRESHOLD = 70  # topics averaging below this (0-100) count as weak
MAX_WEAK_SLOTS = 2
# Used when the JD gives too few topics.
FALLBACK_TOPICS = [Topic.ML_FUNDAMENTALS, Topic.PYTHON, Topic.SQL_BASICS, Topic.STATISTICS]
NON_TECHNICAL = {Topic.PROJECT, Topic.BEHAVIOURAL}


def weakest_topics(stats: dict[str, float], limit: int) -> list[str]:
    """Technical topics with a below-threshold average, weakest first."""
    weak = [t for t, avg in stats.items() if avg < WEAK_THRESHOLD and t not in NON_TECHNICAL]
    return sorted(weak, key=lambda t: stats[t])[:limit]


def plan_round(
    jd_topics: list[str],
    stats: dict[str, float],
    has_projects: bool,
    focus_topic: str | None = None,
    num_questions: int = 5,
) -> list[str]:
    """Return one topic per question slot.

    stats maps topic -> average score (0-100) from earlier sessions (the agent's memory).
    """
    if focus_topic:
        return [focus_topic] * num_questions

    # Every round ends with a behavioural question; it opens with a project when there is one.
    technical_slots = max(num_questions - 1 - int(has_projects), 1)
    technical: list[str] = []
    for topic in weakest_topics(stats, MAX_WEAK_SLOTS):
        technical.append(topic)
    for topic in [*jd_topics, *FALLBACK_TOPICS]:
        if len(technical) >= technical_slots:
            break
        if topic not in technical and topic not in NON_TECHNICAL:
            technical.append(str(topic))

    opener = [str(Topic.PROJECT)] if has_projects else []
    plan = [*opener, *technical, str(Topic.BEHAVIOURAL)]
    return plan[:num_questions]
