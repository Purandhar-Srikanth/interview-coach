"""App settings, loaded once from the root .env file and environment variables."""

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
    # Lower effort = faster, cheaper and more consistent; enough for this app's tasks.
    reasoning_effort: str = "low"
    # "openai" for real calls, "mock" for canned answers (no key or cost needed).
    llm_mode: str = "openai"

    session_cost_cap_usd: float = 0.25
    daily_cost_cap_usd: float = 1.00

    # Public demo protection (only active when DEMO_MODE=true).
    demo_mode: bool = False
    demo_rounds_per_visitor_per_day: int = 2
    demo_rounds_per_ip_per_day: int = 6  # visitor IDs are easy to reset; IPs less so
    demo_requests_per_minute: int = 20  # per IP, for endpoints that call the LLM
    demo_data_retention_days: int = 7

    database_url: str = f"sqlite:///{ROOT_DIR / 'interview_coach.db'}"

    @classmethod
    def settings_customise_sources(
        cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings
    ):
        # The project's .env wins over machine-wide environment variables, so an old key set
        # in Windows can't silently override this project's key. On the live server there is
        # no .env file, so its secrets come from environment variables as usual.
        return init_settings, dotenv_settings, env_settings, file_secret_settings


@lru_cache
def get_settings() -> Settings:
    return Settings()
