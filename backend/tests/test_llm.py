import pytest
from pydantic import BaseModel, SecretStr

from app.config import Settings
from app.llm import Budget, CallUsage, CostCapExceeded, LLMError, OpenAILLM
from app.pricing import cost_usd


class Dummy(BaseModel):
    x: int


def test_cost_uses_model_prices():
    # gpt-6-luna: $0.10 in, $0.50 out per 1M tokens
    assert cost_usd("gpt-6-luna", 1_000_000, 0, 1_000_000) == pytest.approx(0.60)


def test_cached_tokens_are_cheaper():
    full = cost_usd("gpt-6.1-terra", 10_000, 0, 0)
    cached = cost_usd("gpt-6.1-terra", 10_000, 10_000, 0)
    assert cached < full


def test_unknown_model_uses_expensive_fallback_price():
    assert cost_usd("mystery-model", 1000, 0, 1000) > cost_usd("gpt-6.1-terra", 1000, 0, 1000)


def test_budget_blocks_calls_that_could_exceed_cap():
    budget = Budget(cap_usd=0.01)
    budget.record(CallUsage("x", "m", 0, 0, 0, 0.009))
    with pytest.raises(CostCapExceeded):
        budget.ensure_room(0.002)


def test_cap_is_checked_before_any_network_call():
    # A fake key and a tiny cap: the call must be refused before contacting OpenAI.
    llm = OpenAILLM(Settings(openai_api_key=SecretStr("sk-test-not-real")))
    with pytest.raises(CostCapExceeded):
        llm.structured(
            purpose="t",
            role="main",
            instructions="hi",
            input="hi",
            schema=Dummy,
            budget=Budget(cap_usd=0.000001),
        )


def test_missing_key_gives_friendly_error():
    llm = OpenAILLM(Settings(openai_api_key=None))
    with pytest.raises(LLMError, match="not configured"):
        llm.structured(
            purpose="t", role="fast", instructions="", input="", schema=Dummy, budget=Budget(1)
        )


def test_roles_map_to_configured_models():
    llm = OpenAILLM(Settings(model_main="big", model_fast="small"))
    assert llm.model_for("main") == "big"
    assert llm.model_for("fast") == "small"


def _openai_error(cls, status: int, code: str | None):
    import httpx2

    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx2.Response(status, request=request)
    return cls("error", response=response, body={"code": code} if code else None)


def test_no_credit_is_reported_separately_from_busy():
    import openai

    from app.llm import _friendly_errors

    with pytest.raises(LLMError, match="no credit"):
        with _friendly_errors():
            raise _openai_error(openai.RateLimitError, 429, "insufficient_quota")
    with pytest.raises(LLMError, match="busy"):
        with _friendly_errors():
            raise _openai_error(openai.RateLimitError, 429, "rate_limit_exceeded")
    with pytest.raises(LLMError, match="model"):
        with _friendly_errors():
            raise _openai_error(openai.NotFoundError, 404, "model_not_found")
