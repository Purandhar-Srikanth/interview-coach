"""Test setup: a throwaway SQLite database and a fake LLM, so tests are free and offline."""

import os
import tempfile
import uuid
from pathlib import Path

# Must be set before the app is imported, because the DB engine is created at import time.
_tmp_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp_dir) / 'test.db'}"
os.environ["IGNORE_DOTENV"] = "1"  # never use a real key or database from .env in tests

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.llm import LLMError, get_llm  # noqa: E402
from app.main import app  # noqa: E402
from app.mock_llm import MockLLM  # noqa: E402
from app.schemas import ProfileAnalysis, ResumeProject  # noqa: E402

SAMPLE_PROFILE = ProfileAnalysis(
    role_title="Junior Data Scientist",
    seniority="entry",
    jd_key_skills=["Python", "SQL", "scikit-learn"],
    jd_topics=["sql_basics", "ml_fundamentals", "model_evaluation", "sql_basics"],
    resume_skills=["Python", "Flask", "OpenCV"],
    resume_projects=[
        ResumeProject(name="Face Mask Detector", summary="CNN app.", technologies=["OpenCV"])
    ],
    skill_gaps=["Airflow"],
)


class FakeLLM(MockLLM):
    """MockLLM plus failure injection and a record of calls, for assertions in tests."""

    def __init__(self):
        super().__init__()
        self.responses[ProfileAnalysis] = SAMPLE_PROFILE
        self.fail_with: LLMError | None = None
        self.calls: list[str] = []

    def structured(self, *, purpose, **kwargs):
        if self.fail_with:
            raise self.fail_with
        self.calls.append(purpose)
        return super().structured(purpose=purpose, **kwargs)


@pytest.fixture
def fake_llm():
    llm = FakeLLM()
    app.dependency_overrides[get_llm] = lambda: llm
    yield llm
    app.dependency_overrides.clear()


@pytest.fixture
def client(fake_llm):
    with TestClient(app) as test_client:  # `with` runs startup (creates tables)
        test_client.headers["X-Visitor-Id"] = str(uuid.uuid4())
        yield test_client
