"""HTTP-level security for every request (an ASGI middleware, so it also covers streaming).

- Security headers: Content-Security-Policy, HSTS, no framing, no MIME sniffing, a strict
  referrer policy, and a permissions policy that allows only the microphone (voice answers).
- Request size limit: bodies over MAX_BODY_BYTES get 413 before they're read; POSTs must say
  how big they are (Content-Length), so a client can't stream an endless body.
- Demo mode: a general per-IP limit on all /api requests, on top of the stricter per-IP
  limit on the endpoints that call the LLM (see guard.py).
- API responses are marked no-store: they contain personal interview data.
"""

import json

from app.config import get_settings
from app.guard import RateLimiter, client_ip_from_headers

MAX_BODY_BYTES = 6 * 1024 * 1024  # resume uploads are capped at 5 MB, plus form overhead
API_REQUESTS_PER_MINUTE = 120

CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",  # no inline scripts: the main defence against XSS
        # 'unsafe-inline' for styles only: animations and charts set inline style attributes.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",  # also stops tracking pixels in LLM-written markdown
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]
)

SECURITY_HEADERS = [
    (b"content-security-policy", CONTENT_SECURITY_POLICY.encode()),
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"permissions-policy", b"camera=(), geolocation=(), microphone=(self)"),
    (b"cross-origin-opener-policy", b"same-origin"),
]

api_limiter = RateLimiter()


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        headers = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
        is_api = scope["path"].startswith("/api/")

        # 1. Request size: refuse oversized or unsized bodies before reading them.
        if scope["method"] in ("POST", "PUT", "PATCH"):
            length = headers.get("content-length")
            if length is None:
                return await _error(send, 411, "Content-Length is required.")
            if not length.isdigit() or int(length) > MAX_BODY_BYTES:
                return await _error(send, 413, "Request is too large (limit 6 MB).")

        # 2. Demo: general rate limit on the API, per real client IP.
        settings = get_settings()
        if is_api and settings.demo_mode:
            ip = client_ip_from_headers(headers, scope.get("client"))
            if not api_limiter.allow(f"api:{ip}", API_REQUESTS_PER_MINUTE, 60):
                return await _error(send, 429, "Too many requests. Please slow down.")

        # 3. Add security headers (and no-store for API data) to every response.
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                extra = list(SECURITY_HEADERS)
                if is_api:
                    extra.append((b"cache-control", b"no-store"))
                message["headers"] = [*message.get("headers", []), *extra]
            await send(message)

        await self.app(scope, receive, send_with_headers)


async def _error(send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), *SECURITY_HEADERS],
        }
    )
    await send({"type": "http.response.body", "body": body})
