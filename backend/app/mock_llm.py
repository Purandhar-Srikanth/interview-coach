"""A stand-in LLM with canned answers (LLM_MODE=mock).

Used for browser tests, CI and working offline: same interface as OpenAILLM, zero cost.
"""

import itertools
import re
import time

from app.llm import Budget, CallUsage
from app.schemas import (
    AnswerScore,
    DimensionScore,
    ProfileAnalysis,
    QuestionDraft,
    ResumeProject,
)

MOCK_PROFILE = ProfileAnalysis(
    role_title="Junior Data Scientist",
    seniority="entry",
    jd_key_skills=["Python", "SQL", "pandas", "scikit-learn", "Statistics", "A/B testing"],
    jd_topics=["sql_advanced", "model_evaluation", "ml_fundamentals", "statistics", "pandas"],
    resume_skills=["Python", "SQL", "pandas", "scikit-learn", "Flask", "OpenCV", "OpenAI API"],
    resume_projects=[
        ResumeProject(
            name="Customer Churn Predictor",
            summary="Churn classifier served through a Flask API.",
            technologies=["scikit-learn", "Flask"],
        ),
        ResumeProject(
            name="Face Mask Detection",
            summary="Real-time webcam detector using transfer learning.",
            technologies=["OpenCV", "TensorFlow"],
        ),
    ],
    skill_gaps=["A/B testing", "Docker", "Cloud deployment"],
)

MOCK_QUESTIONS = [
    "In your **Customer Churn Predictor**, you handled class imbalance with SMOTE. "
    "Why did you choose SMOTE over class weights, and how did you check it helped?",
    "Write a SQL query that returns each customer's **3 most recent transactions**. "
    "Which window function would you use, and why?",
    "Your churn model has 95% accuracy but the business is unhappy. "
    "Which metrics would you look at instead, and why?",
    "Explain the **bias-variance trade-off** and how cross-validation helps you manage it.",
    "Tell me about a time you had to explain a technical result to a non-technical audience. "
    "What did you do, and what was the outcome?",
]

MOCK_SUMMARY = (
    "Solid round overall. Your project answer was the strongest: specific and grounded in "
    "real numbers. SQL window functions and model evaluation need more practice; focus on "
    "precision/recall trade-offs and `ROW_NUMBER()` vs `RANK()`. Next round will start there."
)


def _mock_score(input_text: str) -> AnswerScore:
    """Longer answers get higher scores, so the UI shows a realistic spread."""
    match = re.search(r"<answer>\n?(.*?)\n?</answer>", input_text, re.S)
    length = len(match.group(1)) if match else 0
    level = 1 if length < 20 else 2 if length < 80 else 3 if length < 250 else 4

    def dim(score, why):
        return DimensionScore(justification=why, score=max(1, min(5, score)))

    return AnswerScore(
        correctness=dim(level, "Covers the main idea but misses one key detail."),
        depth=dim(level - 1, "Explains what, but not enough of why or the trade-offs."),
        clarity=dim(level + 1, "Clear and easy to follow."),
        relevance=dim(level, "Connects partly to the role's focus on churn and risk models."),
        strengths=["Clear structure", "Uses a concrete example"],
        improvements=[
            "Name the trade-off explicitly (e.g. precision vs recall)",
            "Quantify the result with a metric",
        ],
        sample_answer=(
            "I'd start by checking the class balance. With only 5% churners, accuracy is "
            "misleading, so I'd report **precision, recall and ROC-AUC**, then pick a "
            "threshold based on the cost of a missed churner versus a wasted retention offer. "
            "In my churn project, moving the threshold from 0.5 to 0.3 raised recall from "
            "0.61 to 0.78 at a small precision cost, which the business preferred."
        ),
    )


class MockLLM:
    def __init__(self, delay_s: float = 0.0):
        self.delay_s = delay_s  # small pause so loading states are visible in the UI
        self.responses: dict[type, object] = {ProfileAnalysis: MOCK_PROFILE}
        self._questions = itertools.cycle(MOCK_QUESTIONS)

    def model_for(self, role):
        return f"mock-{role}"

    def structured(self, *, purpose, role, instructions, input, schema, budget: Budget, **kwargs):
        budget.ensure_room(0.001)
        time.sleep(self.delay_s)
        if schema is QuestionDraft:
            result = QuestionDraft(
                question=next(self._questions),
                expected_points=["Defines the concept", "Gives an example", "Names a trade-off"],
            )
        elif schema is AnswerScore:
            result = _mock_score(input)
        else:
            result = schema.model_validate(self.responses[schema].model_dump())

        on_text = kwargs.get("on_text")
        if on_text:  # imitate token streaming of the chosen field
            for word in re.findall(r"\S+\s*", getattr(result, kwargs["stream_field"])):
                time.sleep(self.delay_s / 25)
                on_text(word)
        budget.record(CallUsage(purpose, self.model_for(role), 1000, 0, 200, 0.001))
        return result

    def stream_text(self, *, purpose, role, instructions, input, budget: Budget, **_):
        budget.ensure_room(0.0005)
        for word in re.findall(r"\S+\s*", MOCK_SUMMARY):
            time.sleep(self.delay_s / 25)
            yield word
        budget.record(CallUsage(purpose, self.model_for(role), 500, 0, 100, 0.0005))
