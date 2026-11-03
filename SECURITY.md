# Security

Interview Coach has **no accounts**: each browser gets a random anonymous ID (a 122-bit UUID
kept in `localStorage` and sent as the `X-Visitor-Id` header). That ID is the only credential,
so there are no passwords to hash or leak and no admin area. Reporting a problem: open a GitHub
issue (without exploit details) or contact the repository owner.

## Security review (2026-11-03)

| Area | How it's handled | Where |
|---|---|---|
| API keys | Only in environment variables (`.env`, git-ignored, locally; a Render secret in production). Never in frontend code, the build, the Docker image or git history (all commits scanned) | `config.py`, `.gitignore`, `.dockerignore` |
| Admin / docs | No admin routes. Interactive API docs (`/docs`, `/redoc`, `/openapi.json`) are **disabled in production** | `main.py` |
| Identity on every route | All data endpoints require a valid visitor UUID; only `/api/health` is open | `api/deps.py` |
| Own data only | Every session is loaded through an ownership check that returns the same 404 for "missing" and "not yours"; lists and deletes filter by visitor | `api/sessions.py` (`get_own_session`), tests in `test_sessions_api.py`, `test_interview_api.py` |
| Input validation | Pydantic length limits on every field, UUID and topic/difficulty validation, PDF/DOCX type and 5 MB size checks, whole-request limit of 6 MB (`413`) with `Content-Length` required. Markdown is rendered without raw HTML, so model or user text can't inject scripts | `schemas.py`, `parsing.py`, `security.py` |
| Rate limits (demo) | 120 API requests/min per IP; 20 AI requests/min per IP; 2 rounds per visitor and 6 per IP per day; a $1/day global AI budget; $0.25 per session | `security.py`, `guard.py` |
| Real client IP | Taken from Cloudflare's `CF-Connecting-IP` or the **last** `X-Forwarded-For` entry, so a client can't fake its IP to dodge limits | `guard.client_ip_from_headers` |
| HTTPS + headers | HTTPS enforced by Render (HTTP redirects). Every response sets a strict **Content-Security-Policy** (no inline scripts, no framing), HSTS, `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a permissions policy (microphone only); API responses are `no-store` | `security.py`, `frontend/public/theme-init.js` |
| CSRF | The API needs a custom header, which browsers won't send cross-site without a CORS preflight, and no CORS is enabled | `lib/api.ts` |
| Passwords | None stored (no accounts) | n/a |
| Database | SQLite inside the container (not reachable from the internet). With Neon Postgres: TLS-only connections with a password in a Render secret. Backups: use Neon's point-in-time restore once `DATABASE_URL` is set | `db.py`, `docs/DEPLOY.md` |
| Errors / debug | No debug mode or auto-reload in production; users see short, friendly messages; logs record error types and codes, never keys or request bodies | `llm.py`, `api/interview.py` |
| Dependencies | `pip-audit` and `npm audit` run in CI (0 known issues at review time); Dependabot opens PRs for security updates | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| Privacy | Uploaded files never stored; OpenAI storage off; voice audio stays in the browser's speech service; "Delete my data"; demo data purged after 7 days | see README |

## Known limits

- The anonymous ID is a bearer secret: anyone who copies it from a browser can read that
  visitor's practice history. Acceptable for a demo; real accounts would replace it.
- Per-IP limits live in memory and reset on restart; the database-backed daily budget is the
  real spending cap. Several servers would need a shared store such as Redis.
- `style-src` allows inline styles because the animation and chart libraries set them;
  scripts remain strictly same-origin.
