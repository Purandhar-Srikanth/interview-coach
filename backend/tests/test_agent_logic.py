"""Unit tests for the plain-Python parts of the agent (no LLM involved)."""

import json

from app.agent.memory import ALPHA, updated_average
from app.agent.planner import plan_round
from app.agent.rubric import overall_score, rubric_text
from app.llm import partial_json_string
from app.schemas import AnswerScore, DimensionScore

JD_TOPICS = ["sql_advanced", "model_evaluation", "ml_fundamentals", "statistics"]


# --- planner ---


def test_plan_shape_project_then_technical_then_behavioural():
    plan = plan_round(JD_TOPICS, stats={}, has_projects=True)
    assert plan == [
        "project_deep_dive",
        "sql_advanced",
        "model_evaluation",
        "ml_fundamentals",
        "behavioural",
    ]


def test_plan_puts_weakest_topics_first():
    stats = {"pandas": 40.0, "python": 65.0, "statistics": 90.0}
    plan = plan_round(JD_TOPICS, stats, has_projects=True)
    assert plan[1:3] == ["pandas", "python"]  # weakest first; statistics (90) isn't weak
    assert plan[3] == "sql_advanced"


def test_plan_without_projects_still_has_five_questions():
    plan = plan_round(JD_TOPICS, stats={}, has_projects=False)
    assert len(plan) == 5
    assert "project_deep_dive" not in plan
    assert plan[-1] == "behavioural"


def test_plan_fills_from_fallback_topics_when_jd_is_thin():
    plan = plan_round(["nlp_llms"], stats={}, has_projects=True)
    assert len(plan) == 5
    assert len(set(plan)) == 5  # no duplicates


def test_focused_round_uses_one_topic():
    assert plan_round(JD_TOPICS, {}, True, focus_topic="pandas") == ["pandas"] * 5


# --- memory ---


def test_first_score_is_taken_as_is():
    assert updated_average(0.0, attempts=0, new_score=55) == 55


def test_moving_average_weights_recent_scores():
    assert updated_average(50.0, attempts=3, new_score=100) == ALPHA * 100 + (1 - ALPHA) * 50


# --- rubric ---


def make_score(c, d, cl, r) -> AnswerScore:
    def dim(n):
        return DimensionScore(justification="x", score=n)

    return AnswerScore(
        correctness=dim(c),
        depth=dim(d),
        clarity=dim(cl),
        relevance=dim(r),
        strengths=[],
        improvements=[],
        sample_answer="",
    )


def test_overall_score_range():
    assert overall_score(make_score(1, 1, 1, 1)) == 0
    assert overall_score(make_score(5, 5, 5, 5)) == 100
    assert overall_score(make_score(3, 3, 3, 3)) == 50


def test_correctness_weighs_most():
    assert overall_score(make_score(5, 1, 1, 1)) > overall_score(make_score(1, 1, 5, 1))


def test_behavioural_rubric_uses_star():
    assert "STAR" in rubric_text("behavioural")
    assert "STAR" not in rubric_text("ml_concept")


# --- partial JSON streaming ---


def test_partial_json_string_reads_growing_field():
    full = json.dumps({"question": 'Use "ROW_NUMBER()"\nwhy?', "expected_points": ["a"]})
    seen = [partial_json_string(full[:n], "question") for n in range(len(full) + 1)]
    assert seen[-1] == 'Use "ROW_NUMBER()"\nwhy?'
    # Text only ever grows, and every partial is a prefix of the final text.
    assert all(seen[-1].startswith(s) for s in seen)


def test_partial_json_string_before_field_arrives():
    assert partial_json_string('{"quest', "question") == ""
    assert partial_json_string('{"question"', "question") == ""
