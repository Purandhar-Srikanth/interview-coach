# Deploying the live demo

The demo runs on **Hugging Face Spaces** (free Docker Space) with a **Neon** Postgres database
(free tier). Every push to `main` that passes CI is deployed automatically by
`.github/workflows/deploy-hf.yml`.

```
GitHub (push to main) ──CI passes──▶ deploy workflow ──git push──▶ Hugging Face Space
                                                                    (builds Dockerfile)
                                                                         │
                                                         OpenAI API ◀────┤────▶ Neon Postgres
```

## One-time setup

### 1. OpenAI
- Put a valid key in your local `.env` (only needed for running locally).
- Set a **monthly budget limit** at <https://platform.openai.com/settings/organization/limits>.
  This is the last safety net; the app also enforces its own caps (see below).

### 2. GitHub
1. Create an **empty** public repository named `interview-coach` at <https://github.com/new>
   (no README, licence or .gitignore; the project already has them).
2. Push the code (a browser window may ask you to sign in to GitHub):
   ```powershell
   git remote add origin https://github.com/<your-github-username>/interview-coach.git
   git push -u origin main
   ```

### 3. Neon (database)
1. Sign up at <https://neon.tech> and create a project named `interview-coach`.
   Pick the **AWS US East (N. Virginia)** region, close to Hugging Face's servers.
2. Click **Connect** and copy the connection string (`postgresql://...sslmode=require`).

### 4. Hugging Face (hosting)
1. Sign up at <https://huggingface.co> and create a Space at <https://huggingface.co/new-space>:
   name `interview-coach`, SDK **Docker**, template **Blank**, hardware **CPU basic (free)**, public.
2. In the Space: **Settings → Variables and secrets**
   - Secret `OPENAI_API_KEY` = your OpenAI key
   - Secret `DATABASE_URL` = the Neon connection string
   - Variable `DEMO_MODE` = `true`
3. Create an access token at <https://huggingface.co/settings/tokens> with **Write** permission.

### 5. Connect GitHub to the Space
In the GitHub repo: **Settings → Secrets and variables → Actions**
- **Secrets** tab: `HF_TOKEN` = the Hugging Face write token
- **Variables** tab: `HF_SPACE` = `<your-hf-username>/interview-coach`

Then deploy: **Actions → Deploy to Hugging Face → Run workflow** (later pushes deploy by themselves).
The first build takes about 5 minutes; watch it in the Space's **Logs** tab.

## How the demo protects the API key and the bill

| Layer | Default | Setting |
|---|---|---|
| Key only on the server (Space secret), never sent to the browser | – | – |
| Requests per minute per IP (LLM endpoints) | 20 | `DEMO_REQUESTS_PER_MINUTE` |
| Free rounds per visitor per day | 2 | `DEMO_ROUNDS_PER_VISITOR_PER_DAY` |
| Free rounds per IP per day | 6 | `DEMO_ROUNDS_PER_IP_PER_DAY` |
| Global AI spend per day (all visitors) | $1.00 | `DAILY_COST_CAP_USD` |
| AI spend per interview session | $0.25 | `SESSION_COST_CAP_USD` |
| Input size limits (JD, resume, answers) | 15k / 20k / 6k chars | in `schemas.py` |
| Monthly limit in the OpenAI dashboard | you choose | OpenAI settings |

Demo data is deleted automatically 7 days after a visitor's last visit (`DEMO_DATA_RETENTION_DAYS`).

## Notes and trade-offs
- The free Space sleeps after a period without visitors; the first visit then takes about a
  minute while it wakes up (the UI shows "server isn't responding, try again").
- Per-IP limits are kept in memory and reset when the Space restarts, and IP addresses can
  be shared or spoofed behind proxies. They're a speed bump; the **database-backed daily
  budget** is the real cap.
- Tables are created on startup (`create_all`). There is no migration tool yet, so changing
  a table's columns in production means resetting the Neon database (fine for a demo).
