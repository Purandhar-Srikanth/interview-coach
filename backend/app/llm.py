"""The only module that talks to OpenAI.

Everything else calls `structured()` or `stream_text()` with a *role* ("main" or "fast"),
never a model name, so swapping models is a one-line change in .env.

Safety features:
- timeout + automatic retries with exponential backoff (built into the OpenAI client)
- a per-session Budget: each call is refused up front if its worst-case cost could exceed the cap
- every call's real token usage and cost is recorded on the Budget
- the API key is never logged; responses are not stored on OpenAI's side (store=False)
"""

import logging
from collections.abc import Iterator
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal, Protocol, TypeVar

import openai
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.pricing import cost_usd

log = logging.getLogger(__name__)

Role = Literal["main", "fast"]
T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    """A failure with a message that is safe to show to the user."""


class CostCapExceeded(LLMError):
    pass


@dataclass
class CallUsage:
    purpose: str
    model: str
    input_tokens: int
    cached_tokens: int
    output_tokens: int
    cost_usd: float


@dataclass
class Budget:
    """Tracks spend for one interview session and enforces its cap."""

    cap_usd: float
    spent_usd: float = 0.0
    calls: list[CallUsage] = field(default_factory=list)

    def ensure_room(self, worst_case_usd: float) -> None:
        if self.spent_usd + worst_case_usd > self.cap_usd:
            raise CostCapExceeded(
                f"This session reached its ${self.cap_usd:.2f} cost limit. "
                "Please start a new interview."
            )

    def record(self, usage: CallUsage) -> None:
        self.spent_usd += usage.cost_usd
        self.calls.append(usage)


class LLM(Protocol):
    """What the rest of the app needs from a language model. Tests use a fake version."""

    def model_for(self, role: Role) -> str: ...

    def structured(
        self,
        *,
        purpose: str,
        role: Role,
        instructions: str,
        input: str,
        schema: type[T],
        budget: Budget,
        max_output_tokens: int = 4000,
    ) -> T: ...

    def stream_text(
        self,
        *,
        purpose: str,
        role: Role,
        instructions: str,
        input: str,
        budget: Budget,
        max_output_tokens: int = 2000,
    ) -> Iterator[str]: ...


class OpenAILLM:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = None
        if settings.openai_api_key:
            self.client = openai.OpenAI(
                api_key=settings.openai_api_key.get_secret_value(),
                timeout=settings.llm_timeout_seconds,
                max_retries=settings.llm_max_retries,  # retries 429 / 5xx / timeouts with backoff
            )

    def model_for(self, role: Role) -> str:
        return self.settings.model_main if role == "main" else self.settings.model_fast

    def structured(
        self, *, purpose, role, instructions, input, schema, budget, max_output_tokens=4000
    ):
        """Ask for JSON matching a Pydantic schema; returns a validated instance of it."""
        model = self._prepare(role, instructions, input, budget, max_output_tokens)
        with _friendly_errors():
            response = self.client.responses.parse(
                model=model,
                instructions=instructions,
                input=input,
                text_format=schema,
                reasoning={"effort": self.settings.reasoning_effort},
                max_output_tokens=max_output_tokens,
                store=False,
            )
        self._record(purpose, model, response.usage, budget)
        if response.status == "incomplete" or response.output_parsed is None:
            raise LLMError("The AI's reply was cut off. Please try again.")
        return response.output_parsed

    def stream_text(self, *, purpose, role, instructions, input, budget, max_output_tokens=2000):
        """Yield the reply piece by piece (for the typing effect)."""
        model = self._prepare(role, instructions, input, budget, max_output_tokens)
        with _friendly_errors():
            with self.client.responses.stream(
                model=model,
                instructions=instructions,
                input=input,
                reasoning={"effort": self.settings.reasoning_effort},
                max_output_tokens=max_output_tokens,
                store=False,
            ) as stream:
                for event in stream:
                    if event.type == "response.output_text.delta":
                        yield event.delta
                final = stream.get_final_response()
        self._record(purpose, model, final.usage, budget)

    # --- helpers ---

    def _prepare(self, role, instructions, input, budget, max_output_tokens) -> str:
        if self.client is None:
            raise LLMError("The OpenAI API key is not configured on the server.")
        model = self.model_for(role)
        # Rough upper bound: ~3 characters per token, and assume every output token is used.
        est_input_tokens = (len(instructions) + len(input)) // 3
        budget.ensure_room(cost_usd(model, est_input_tokens, 0, max_output_tokens))
        return model

    def _record(self, purpose, model, usage, budget) -> None:
        cached = usage.input_tokens_details.cached_tokens if usage.input_tokens_details else 0
        cost = cost_usd(model, usage.input_tokens, cached, usage.output_tokens)
        budget.record(
            CallUsage(purpose, model, usage.input_tokens, cached, usage.output_tokens, cost)
        )
        log.info(
            "llm %s model=%s in=%d out=%d cost=$%.5f",
            purpose,
            model,
            usage.input_tokens,
            usage.output_tokens,
            cost,
        )


class _friendly_errors:
    """Turn OpenAI exceptions into LLMError with a message that's fine to show users."""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, _tb):
        if exc is None or not isinstance(exc, openai.OpenAIError):
            return False
        log.warning("OpenAI call failed: %s", type(exc).__name__)  # never log the key/request
        if isinstance(exc, openai.APITimeoutError):
            raise LLMError("The AI took too long to respond. Please try again.") from exc
        if isinstance(exc, openai.RateLimitError):
            raise LLMError("The AI service is busy right now. Please try again shortly.") from exc
        if isinstance(exc, openai.AuthenticationError):
            raise LLMError("The server's OpenAI API key was rejected.") from exc
        raise LLMError("The AI service returned an error. Please try again.") from exc


@lru_cache
def get_llm() -> LLM:
    """FastAPI dependency. LLM_MODE=mock gives canned answers (offline tests, CI)."""
    settings = get_settings()
    if settings.llm_mode == "mock":
        from app.mock_llm import MockLLM

        return MockLLM(delay_s=1.0)
    return OpenAILLM(settings)
