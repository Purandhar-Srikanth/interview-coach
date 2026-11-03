"""App settings, loaded once from environment variables (and the root .env file)."""

from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    # SecretStr hides the key when settings are printed or logged.
    openai_api_key: SecretStr | None = None
    model_main: str = "gpt-6.1-terra"
    model_fast: str = "gpt-6-luna"
    llm_timeout_seconds: float = 30
    llm_max_retries: int = 2

    session_cost_cap_usd: float = 0.25
    daily_cost_cap_usd: float = 1.00

    demo_mode: bool = False
    demo_rounds_per_visitor_per_day: int = 2

    database_url: str = f"sqlite:///{ROOT_DIR / 'interview_coach.db'}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
