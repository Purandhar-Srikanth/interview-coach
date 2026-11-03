"""The scoring rubric: 4 dimensions, each scored 1-5 against written level descriptions.

Anchored levels (what a 1, 3 and 5 look like) are the main tool for consistent scores:
the model compares the answer to fixed descriptions instead of inventing its own scale.
"""

from app.schemas import AnswerScore

# Behavioural questions are judged on STAR structure instead of technical correctness.
FIRST_DIMENSION = {"behavioural": "star"}

DIMENSIONS = {
    "correctness": {
        1: "Wrong, or has major factual errors.",
        3: "Mostly correct, with minor errors or omissions.",
        5: "Fully correct and precise, using the right terms.",
    },
    "star": {
        1: "No clear situation or result; generic or hypothetical.",
        3: "Some STAR parts present, but the action or result is vague.",
        5: "Clear Situation, Task, Action and a measurable Result.",
    },
    "depth": {
        1: "Surface-level definition only.",
        3: "Explains how/why, with at least one example.",
        5: "Discusses trade-offs, edge cases or real-world nuance.",
    },
    "clarity": {
        1: "Hard to follow or very disorganised.",
        3: "Understandable, with some rambling or gaps.",
        5: "Concise, well-structured and easy to follow.",
    },
    "relevance": {
        1: "Ignores the role and the question's context.",
        3: "Some connection to the role's needs.",
        5: "Clearly ties the answer to this job's tools and needs.",
    },
}

# Weights for the overall score. Correctness/STAR matters most.
WEIGHTS = {"first": 0.40, "depth": 0.25, "clarity": 0.15, "relevance": 0.20}


def rubric_text(qtype: str) -> str:
    """The rubric as plain text for the scoring prompt."""
    first = FIRST_DIMENSION.get(qtype, "correctness")
    lines = []
    for field, name in [
        ("correctness", first),
        ("depth", "depth"),
        ("clarity", "clarity"),
        ("relevance", "relevance"),
    ]:
        levels = DIMENSIONS[name]
        label = "STAR structure" if name == "star" else name.capitalize()
        lines.append(f"{field} — {label}:")
        lines.append(f"  1 = {levels[1]}")
        lines.append("  2 = between 1 and 3")
        lines.append(f"  3 = {levels[3]}")
        lines.append("  4 = between 3 and 5")
        lines.append(f"  5 = {levels[5]}")
    return "\n".join(lines)


def overall_score(score: AnswerScore) -> int:
    """Weighted average of the four 1-5 scores, mapped to 0-100 (1 -> 0, 5 -> 100)."""
    weighted = (
        WEIGHTS["first"] * score.correctness.score
        + WEIGHTS["depth"] * score.depth.score
        + WEIGHTS["clarity"] * score.clarity.score
        + WEIGHTS["relevance"] * score.relevance.score
    )
    return round((weighted - 1) / 4 * 100)
