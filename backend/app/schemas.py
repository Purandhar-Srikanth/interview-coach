"""Pydantic models: API request/response bodies and the JSON shapes we ask the LLM for."""

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


# --- API bodies ---


class ResumeParseOut(BaseModel):
    filename: str
    text: str
    chars: int


class SessionCreate(BaseModel):
    jd_text: str = Field(min_length=50, max_length=15_000)
    resume_text: str = Field(min_length=100, max_length=20_000)
    difficulty: Difficulty = "medium"


class SessionOut(BaseModel):
    id: str
    status: str
    role_title: str
    difficulty: Difficulty
    profile: ProfileAnalysis | None
    cost_usd: float
