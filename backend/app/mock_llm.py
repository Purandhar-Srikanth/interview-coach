"""A stand-in LLM with canned answers (LLM_MODE=mock).

Used for browser tests, CI and working offline: same interface as OpenAILLM, zero cost.
"""

import time

from app.llm import Budget, CallUsage
from app.schemas import ProfileAnalysis, ResumeProject

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


class MockLLM:
    def __init__(self, delay_s: float = 0.0):
        self.delay_s = delay_s  # small pause so loading states are visible in the UI
        self.responses: dict[type, object] = {ProfileAnalysis: MOCK_PROFILE}

    def model_for(self, role):
        return f"mock-{role}"

    def structured(self, *, purpose, role, instructions, input, schema, budget: Budget, **_):
        budget.ensure_room(0.001)
        time.sleep(self.delay_s)
        budget.record(CallUsage(purpose, self.model_for(role), 1000, 0, 200, 0.001))
        return schema.model_validate(self.responses[schema].model_dump())

    def stream_text(self, *, purpose, role, instructions, input, budget: Budget, **_):
        budget.ensure_room(0.0005)
        for word in "This is a mock streamed reply.".split(" "):
            time.sleep(self.delay_s / 10)
            yield word + " "
        budget.record(CallUsage(purpose, self.model_for(role), 500, 0, 100, 0.0005))
