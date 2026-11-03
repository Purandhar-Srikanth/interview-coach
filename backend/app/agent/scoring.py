"""Score one answer against the rubric.

Shared by the agent (score_answer node) and the evals in evals/, so the evals measure
exactly the scoring code that runs in production.
"""

from app.agent import prompts
from app.agent.rubric import overall_score, rubric_text
from app.llm import LLM, Budget
from app.schemas import AnswerScore


def score_answer(
    llm: LLM,
    *,
    question: str,
    qtype: str,
    role_title: str,
    jd_skills: list[str],
    expected_points: list[str],
    answer: str,
    budget: Budget,
) -> tuple[AnswerScore, int]:
    """Returns the model's rubric scores and the weighted overall score (0-100)."""
    result = llm.structured(
        purpose="score_answer",
        role="main",
        instructions=prompts.SCORING_INSTRUCTIONS.format(rubric=rubric_text(qtype)),
        input=prompts.scoring_input(
            question=question,
            qtype=qtype,
            role_title=role_title,
            jd_skills=jd_skills,
            expected_points=expected_points,
            answer=answer,
        ),
        schema=AnswerScore,
        budget=budget,
    )
    return result, overall_score(result)
