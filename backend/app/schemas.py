"""Pydantic models: API request/response bodies and the JSON shapes we ask the LLM for."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.agent.topics import Topic

Difficulty = Literal["easy", "medium", "hard"]

# --- LLM output schemas (sent to OpenAI as JSON schema via structured outputs) ---


class ResumeProject(BaseModel):
    name: str = Field(description="Short project name")
    summary: str = Field(description="One sentence: what it does and the candidate's role")
    technologies: list[str]


class ProfileAnalysis(BaseModel):
    role_title: str = Field(description="Job title from the JD, e.g. 'Junior Data Scientist'")
    seniority: Literal["intern", "entry", "mid", "senior"]
    jd_key_skills: list[str] = Field(description="Up to 8 most important skills in the JD")
    jd_topics: list[Topic] = Field(description="3 to 6 interview topics the JD needs most")
    resume_skills: list[str] = Field(description="Up to 10 skills shown in the resume")
    resume_projects: list[ResumeProject] = Field(description="Up to 3 projects worth deep-diving")
    skill_gaps: list[str] = Field(description="Up to 5 JD skills not evident in the resume")


class QuestionDraft(BaseModel):
    # `question` must stay the first field: the UI streams it while the rest is generated.
    question: str = Field(description="The interview question, as the interviewer would say it")
    expected_points: list[str] = Field(
        description="3 to 5 key points a strong answer would cover (hidden from the candidate)"
    )


ScoreLevel = Literal[1, 2, 3, 4, 5]


class DimensionScore(BaseModel):
    # Justification comes before the score so the model reasons first, then commits.
    justification: str = Field(description="One sentence explaining the score")
    score: ScoreLevel


class AnswerScore(BaseModel):
    correctness: DimensionScore = Field(description="Correctness, or STAR for behavioural")
    depth: DimensionScore
    clarity: DimensionScore
    relevance: DimensionScore
    strengths: list[str] = Field(description="1 to 3 specific things the answer did well")
    improvements: list[str] = Field(description="1 to 3 specific, actionable improvements")
    sample_answer: str = Field(
        description="A stronger answer of about 120-200 words, in the candidate's voice"
    )


# --- API bodies ---


class ResumeParseOut(BaseModel):
    filename: str
    text: str
    chars: int


class SessionCreate(BaseModel):
    jd_text: str = Field(min_length=50, max_length=15_000)
    resume_text: str = Field(min_length=100, max_length=20_000)
    difficulty: Difficulty = "medium"


class PracticeCreate(BaseModel):
    # None = a normal mixed round; a topic = a focused round on that topic.
    focus_topic: Topic | None = None
    difficulty: Difficulty | None = None  # None = same as the original session


class AnswerCreate(BaseModel):
    question_id: str
    text: str = Field(min_length=1, max_length=6_000)
    time_taken_s: int = Field(ge=0, le=3_600)


class SkipCreate(BaseModel):
    question_id: str


class ScoreOut(BaseModel):
    correctness: int
    depth: int
    clarity: int
    relevance: int
    overall: int
    justifications: dict[str, str]
    strengths: list[str]
    improvements: list[str]
    sample_answer: str


class AnswerOut(BaseModel):
    id: str
    attempt: int
    text: str
    skipped: bool
    time_taken_s: int
    score: ScoreOut | None


class QuestionOut(BaseModel):
    id: str
    index: int
    qtype: str
    topic: str
    difficulty: Difficulty
    text: str
    time_limit_s: int
    expected_points: list[str] | None  # only revealed once the question is answered
    answers: list[AnswerOut]


class SessionOut(BaseModel):
    id: str
    status: str
    role_title: str
    difficulty: Difficulty
    profile: ProfileAnalysis | None
    cost_usd: float
    num_questions: int
    focus_topic: str | None = None
    created_at: datetime
    finished_at: datetime | None = None
    questions: list[QuestionOut] = []
    summary: str | None = None
