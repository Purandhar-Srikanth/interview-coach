"""Step 1 of the agent: understand the job and the candidate."""

from app.agent.prompts import PROFILE_INSTRUCTIONS, profile_input
from app.llm import LLM, Budget
from app.schemas import ProfileAnalysis


def analyze_profile(llm: LLM, jd_text: str, resume_text: str, budget: Budget) -> ProfileAnalysis:
    profile = llm.structured(
        purpose="analyze_profile",
        role="fast",
        instructions=PROFILE_INSTRUCTIONS,
        input=profile_input(jd_text, resume_text),
        schema=ProfileAnalysis,
        budget=budget,
    )
    # The schema can't enforce list lengths, so trim here to keep the UI and prompts tidy.
    profile.jd_key_skills = profile.jd_key_skills[:8]
    profile.jd_topics = list(dict.fromkeys(profile.jd_topics))[:6]  # also removes duplicates
    profile.resume_skills = profile.resume_skills[:10]
    profile.resume_projects = profile.resume_projects[:3]
    profile.skill_gaps = profile.skill_gaps[:5]
    return profile
