"""Convert database rows into API/stream output models."""

from app.models import Answer, InterviewSession, Question
from app.schemas import AnswerOut, ProfileAnalysis, QuestionOut, ScoreOut, SessionOut


def answer_out(answer: Answer) -> AnswerOut:
    score = None
    if answer.score:
        s = answer.score
        feedback = s.feedback or {}
        score = ScoreOut(
            correctness=s.correctness,
            depth=s.depth,
            clarity=s.clarity,
            relevance=s.relevance,
            overall=s.overall,
            justifications=s.justifications,
            strengths=feedback.get("strengths", []),
            improvements=feedback.get("improvements", []),
            sample_answer=s.sample_answer,
        )
    return AnswerOut(
        id=answer.id,
        attempt=answer.attempt,
        text=answer.text,
        skipped=answer.skipped,
        time_taken_s=answer.time_taken_s,
        score=score,
    )


def question_out(question: Question) -> QuestionOut:
    answered = len(question.answers) > 0
    return QuestionOut(
        id=question.id,
        index=question.index,
        qtype=question.qtype,
        topic=question.topic,
        difficulty=question.difficulty,
        text=question.text,
        time_limit_s=question.time_limit_s,
        # Hidden until answered, so the candidate can't peek at the marking points.
        expected_points=question.expected_points if answered else None,
        answers=[answer_out(a) for a in question.answers],
    )


def session_out(session: InterviewSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        status=session.status,
        role_title=session.role_title,
        difficulty=session.difficulty,
        profile=ProfileAnalysis.model_validate(session.profile) if session.profile else None,
        cost_usd=round(session.cost_usd, 5),
        num_questions=len(session.plan) if session.plan else 5,
        questions=[question_out(q) for q in session.questions],
        summary=session.summary,
    )
