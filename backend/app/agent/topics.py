"""The fixed list of interview topics.

A fixed list (instead of free-text topics from the LLM) is what makes long-term memory work:
"window functions" asked today and "SQL window functions" asked next week count as the same
topic, so weak areas can be averaged across sessions.
"""

from enum import StrEnum


class Topic(StrEnum):
    PYTHON = "python"
    SQL_BASICS = "sql_basics"
    SQL_ADVANCED = "sql_advanced"
    PANDAS = "pandas"
    STATISTICS = "statistics"
    ML_FUNDAMENTALS = "ml_fundamentals"
    SUPERVISED = "supervised_learning"
    UNSUPERVISED = "unsupervised_learning"
    MODEL_EVALUATION = "model_evaluation"
    FEATURE_ENGINEERING = "feature_engineering"
    DEEP_LEARNING = "deep_learning"
    NLP_LLMS = "nlp_llms"
    COMPUTER_VISION = "computer_vision"
    MLOPS = "mlops"
    DATA_VISUALIZATION = "data_visualization"
    PROJECT = "project_deep_dive"
    BEHAVIOURAL = "behavioural"


# Display names and the question type each topic belongs to.
TOPIC_INFO: dict[Topic, tuple[str, str]] = {
    Topic.PYTHON: ("Python", "sql_python"),
    Topic.SQL_BASICS: ("SQL joins & aggregation", "sql_python"),
    Topic.SQL_ADVANCED: ("SQL window functions & CTEs", "sql_python"),
    Topic.PANDAS: ("pandas & data wrangling", "sql_python"),
    Topic.STATISTICS: ("Statistics & probability", "ml_concept"),
    Topic.ML_FUNDAMENTALS: ("ML fundamentals", "ml_concept"),
    Topic.SUPERVISED: ("Supervised learning", "ml_concept"),
    Topic.UNSUPERVISED: ("Unsupervised learning", "ml_concept"),
    Topic.MODEL_EVALUATION: ("Model evaluation", "ml_concept"),
    Topic.FEATURE_ENGINEERING: ("Feature engineering", "technical"),
    Topic.DEEP_LEARNING: ("Deep learning", "technical"),
    Topic.NLP_LLMS: ("NLP & LLMs", "technical"),
    Topic.COMPUTER_VISION: ("Computer vision", "technical"),
    Topic.MLOPS: ("MLOps & deployment", "technical"),
    Topic.DATA_VISUALIZATION: ("Data visualisation", "technical"),
    Topic.PROJECT: ("Project deep-dive", "project"),
    Topic.BEHAVIOURAL: ("Behavioural", "behavioural"),
}


def topic_label(topic: str) -> str:
    return TOPIC_INFO[Topic(topic)][0]


def topic_qtype(topic: str) -> str:
    return TOPIC_INFO[Topic(topic)][1]
