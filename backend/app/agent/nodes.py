"""The agent's steps (graph nodes). Each node reads/writes the database and can push live
events to the browser with the stream writer (question text as it's typed, scores, ...).

Nodes get their tools (db session, LLM, budget) from `config["configurable"]["ctx"]`.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import memory, planner, prompts, scoring
from app.agent.topics import topic_label, topic_qtype
from app.llm import LLM, Budget
from app.models import Answer, InterviewSession, Question, Score
from app.schemas import QuestionDraft
from app.serializers import answer_out, question_out

Action = Literal["start", "answer", "next"]


class InterviewState(TypedDict, total=False):
    action: Action  # what the user just did
    answer_id: str | None  # set when action == "answer"
    next_step: str  # set by decide_next


@dataclass
class AgentContext:
    db: Session
    llm: LLM
    budget: Budget
    session: InterviewSession


def _ctx(config: RunnableConfig) -> AgentContext:
    return config["configurable"]["ctx"]


# Suggested answer time (soft timer), by question type; hard questions get an extra minute.
TIME_LIMITS = {"sql_python": 180, "project": 180, "behavioural": 180}


def plan_round(state: InterviewState, config: RunnableConfig) -> dict:
    """Pick a topic for each question slot, using memory of past weak areas."""
    ctx = _ctx(config)
    session = ctx.session
    profile = session.profile or {}
    session.plan = planner.plan_round(
        jd_topics=profile.get("jd_topics", []),
        stats=memory.topic_averages(ctx.db, session.visitor_id),
        has_projects=bool(profile.get("resume_projects")),
        focus_topic=session.focus_topic,
    )
    session.status = "in_progress"
    ctx.db.commit()
    get_stream_writer()(
        {"type": "plan", "topics": [{"topic": t, "label": topic_label(t)} for t in session.plan]}
    )
    return {}


def generate_question(state: InterviewState, config: RunnableConfig) -> dict:
    """Write the next question, streaming its text to the browser as it's generated."""
    ctx = _ctx(config)
    session = ctx.session
    profile = session.profile or {}
    write = get_stream_writer()

    index = len(session.questions)
    topic = session.plan[index]
    qtype = topic_qtype(topic)
    write({"type": "question_start", "index": index, "topic": topic, "qtype": qtype})

    # For project questions, rotate through the resume's projects.
    projects = profile.get("resume_projects") or []
    project_count = sum(1 for q in session.questions if q.qtype == "project")
    project = projects[project_count % len(projects)] if qtype == "project" and projects else None

    draft = ctx.llm.structured(
        purpose="generate_question",
        role="fast",
        instructions=prompts.QUESTION_INSTRUCTIONS,
        input=prompts.question_input(
            role_title=session.role_title,
            difficulty=session.difficulty,
            topic_label=topic_label(topic),
            qtype=qtype,
            number=index + 1,
            total=len(session.plan),
            jd_skills=profile.get("jd_key_skills", []),
            project=project,
            already_asked=_already_asked(ctx.db, session, topic),
        ),
        schema=QuestionDraft,
        budget=ctx.budget,
        stream_field="question",
        on_text=lambda text: write({"type": "question_delta", "text": text}),
    )

    time_limit = TIME_LIMITS.get(qtype, 120) + (60 if session.difficulty == "hard" else 0)
    question = Question(
        index=index,
        qtype=qtype,
        topic=topic,
        difficulty=session.difficulty,
        text=draft.question.strip(),
        expected_points=draft.expected_points[:5],
        time_limit_s=time_limit,
    )
    session.questions.append(question)
    ctx.db.commit()
    write({"type": "question", "question": question_out(question).model_dump()})
    return {}


def _already_asked(db: Session, session: InterviewSession, topic: str) -> list[str]:
    """This round's questions plus the visitor's recent questions on the same topic."""
    recent = db.scalars(
        select(Question.text)
        .join(InterviewSession)
        .where(InterviewSession.visitor_id == session.visitor_id, Question.topic == topic)
        .order_by(Question.created_at.desc())
        .limit(10)
    ).all()
    return list(dict.fromkeys([q.text for q in session.questions] + list(recent)))


def score_answer(state: InterviewState, config: RunnableConfig) -> dict:
    """Grade the answer against the rubric (main model, structured output)."""
    ctx = _ctx(config)
    write = get_stream_writer()
    answer = ctx.db.get(Answer, state["answer_id"])
    question = answer.question
    write({"type": "scoring"})

    result, overall = scoring.score_answer(
        ctx.llm,
        question=question.text,
        qtype=question.qtype,
        role_title=ctx.session.role_title,
        jd_skills=(ctx.session.profile or {}).get("jd_key_skills", []),
        expected_points=question.expected_points,
        answer=answer.text,
        budget=ctx.budget,
    )
    answer.score = Score(
        correctness=result.correctness.score,
        depth=result.depth.score,
        clarity=result.clarity.score,
        relevance=result.relevance.score,
        overall=overall,
        justifications={
            name: getattr(result, name).justification
            for name in ("correctness", "depth", "clarity", "relevance")
        },
        feedback={"strengths": result.strengths[:3], "improvements": result.improvements[:3]},
        sample_answer=result.sample_answer,
        model=ctx.llm.model_for("main"),
    )
    ctx.db.commit()
    write(
        {
            "type": "score",
            "question_id": question.id,
            "expected_points": question.expected_points,
            "answer": answer_out(answer).model_dump(),
        }
    )
    return {}


def update_memory(state: InterviewState, config: RunnableConfig) -> dict:
    """Update the per-topic weak-area memory.

    Only the FIRST attempt counts: retries are practice, and counting them would make
    weak areas look better than they really are.
    """
    ctx = _ctx(config)
    answer = ctx.db.get(Answer, state["answer_id"])
    if answer.attempt == 1 and answer.score:
        topic = answer.question.topic
        stat = memory.record_score(ctx.db, ctx.session.visitor_id, topic, answer.score.overall)
        ctx.db.commit()
        get_stream_writer()(
            {
                "type": "memory",
                "topic": topic,
                "average": round(stat.avg_score),
                "attempts": stat.attempts,
            }
        )
    return {}


def decide_next(state: InterviewState, config: RunnableConfig) -> dict:
    session = _ctx(config).session
    more = len(session.questions) < len(session.plan)
    return {"next_step": "generate_question" if more else "summarize_round"}


def summarize_round(state: InterviewState, config: RunnableConfig) -> dict:
    """Stream a short coach's summary of the round and mark the session complete."""
    ctx = _ctx(config)
    session = ctx.session
    write = get_stream_writer()

    results = []
    for question in session.questions:
        first = question.answers[0] if question.answers else None
        scored = first.score if first and first.score else None
        results.append(
            {
                "topic": topic_label(question.topic),
                "score": scored.overall if scored else None,
                "improvements": (scored.feedback or {}).get("improvements", []) if scored else [],
            }
        )

    write({"type": "summary_start"})
    parts = []
    for text in ctx.llm.stream_text(
        purpose="summarize_round",
        role="fast",
        instructions=prompts.SUMMARY_INSTRUCTIONS,
        input=prompts.summary_input(session.role_title, results),
        budget=ctx.budget,
    ):
        parts.append(text)
        write({"type": "summary_delta", "text": text})

    scores = [r["score"] for r in results if r["score"] is not None]
    session.summary = "".join(parts).strip()
    session.status = "completed"
    session.finished_at = datetime.now(UTC)
    ctx.db.commit()
    write(
        {
            "type": "round_complete",
            "summary": session.summary,
            "average": round(sum(scores) / len(scores)) if scores else None,
        }
    )
    return {}
