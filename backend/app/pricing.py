"""OpenAI prices in US dollars per 1 million tokens (standard tier, checked 2026-11-03).

Source: https://developers.openai.com/api/docs/pricing — update here if prices change.
"""

# model: (input, cached input, output)
PRICES_PER_MILLION: dict[str, tuple[float, float, float]] = {
    "gpt-6.1-terra": (1.00, 0.05, 5.00),
    "gpt-6-luna": (0.10, 0.01, 0.50),
    "gpt-6.1-sol": (2.00, 0.10, 10.00),
    "gpt-5.4-mini": (0.75, 0.075, 4.50),
    "gpt-5-mini": (0.25, 0.025, 2.00),
}

# Unknown model? Assume an expensive price so the cost caps stay on the safe side.
FALLBACK_PRICE = (10.00, 1.00, 50.00)


def cost_usd(model: str, input_tokens: int, cached_tokens: int, output_tokens: int) -> float:
    """Dollar cost of one call. Output tokens include the model's hidden reasoning tokens."""
    price_in, price_cached, price_out = PRICES_PER_MILLION.get(model, FALLBACK_PRICE)
    uncached = max(input_tokens - cached_tokens, 0)
    return (uncached * price_in + cached_tokens * price_cached + output_tokens * price_out) / 1e6
