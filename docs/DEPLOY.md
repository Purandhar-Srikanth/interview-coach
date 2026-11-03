# Deploying the live demo

The demo runs on **Render** (free web service, built from the `Dockerfile`) with a **Neon**
Postgres database (free tier). `render.yaml` describes the service, and Render redeploys
automatically on every push to `main`.

```
GitHub (push to main) ──▶ Render builds the Dockerfile ──▶ https://interview-coach-xxxx.onrender.com
                                                                   │
                                                   OpenAI API ◀────┤────▶ Neon Postgres
```

> Why not Hugging Face Spaces? It was the original plan, but in 2026 Hugging Face made Docker
> Spaces a paid (PRO) feature. Render runs the same Docker image for free.

## One-time setup

### 1. OpenAI
- Set a **monthly budget limit** at <https://platform.openai.com/settings/organization/limits>.
  This is the last safety net; the app also enforces its own caps (see below).

### 2. Neon (database, optional but recommended)
1. Sign up at <https://neon.tech> and create a project named `interview-coach`.
   Pick the region closest to your Render region (e.g. **AWS US East** with Render's Oregon/Ohio,
   or **AWS Singapore** with Render's Singapore).
2. Click **Connect** and copy the connection string (`postgresql://...sslmode=require`).

Without Neon the demo uses a SQLite file inside the container, which is wiped whenever Render
restarts or redeploys the service. Fine for a first try, not for keeping history.

### 3. Render (hosting)
1. Sign up at <https://render.com> with **GitHub** and allow it to see the `interview-coach` repo.
2. **New → Blueprint**, pick `Purandhar-Srikanth/interview-coach`, branch `main`.
3. Render reads `render.yaml` and asks for the two secret values:
   - `OPENAI_API_KEY` = your OpenAI key
   - `DATABASE_URL` = the Neon connection string (or leave empty)
4. Click **Apply**. The first build takes about 5 minutes; watch it under the service's **Logs**.
   The live URL is shown at the top of the service page.

After this, every `git push` to `main` deploys automatically.

## How the demo protects the API key and the bill

| Layer | Default | Setting |
|---|---|---|
| Key only on the server (Render secret), never sent to the browser | – | – |
| Requests per minute per IP (LLM endpoints) | 20 | `DEMO_REQUESTS_PER_MINUTE` |
| Free rounds per visitor per day | 2 | `DEMO_ROUNDS_PER_VISITOR_PER_DAY` |
| Free rounds per IP per day | 6 | `DEMO_ROUNDS_PER_IP_PER_DAY` |
| Global AI spend per day (all visitors) | $1.00 | `DAILY_COST_CAP_USD` |
| AI spend per interview session | $0.25 | `SESSION_COST_CAP_USD` |
| Input size limits (JD, resume, answers) | 15k / 20k / 6k chars | in `schemas.py` |
| Monthly limit in the OpenAI dashboard | you choose | OpenAI settings |

Demo data is deleted automatically 7 days after a visitor's last visit (`DEMO_DATA_RETENTION_DAYS`).

## Notes and trade-offs
- The free service sleeps after 15 minutes without visitors; the first visit then takes
  about 30–60 seconds while it wakes up (the UI shows "server isn't responding, try again").
- 512 MB RAM on the free plan is enough: the app is a FastAPI server; the AI runs at OpenAI.
- Per-IP limits are kept in memory and reset when the service restarts, and IP addresses can
  be shared or spoofed behind proxies. They're a speed bump; the **database-backed daily
  budget** is the real cap (with Neon; without Neon it resets on restart too).
- Tables are created on startup (`create_all`). There is no migration tool yet, so changing
  a table's columns in production means resetting the Neon database (fine for a demo).
