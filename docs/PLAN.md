# Interview Coach — Phase 2 Plan

Status: **complete** (M0–M8). Live: https://interview-coach-tgse.onrender.com

## 1. Decisions (from Phase 1)

| Area | Decision |
|---|---|
| Stack | React (Vite + TypeScript + Tailwind + Recharts + Framer Motion) frontend, FastAPI backend. FastAPI serves the built React app → one deployable unit |
| Layout / style | Hybrid: sidebar + chat-style interview + dashboards. Clean light theme (dark toggle), one blue accent, Inter + JetBrains Mono |
| Features | Core pack, interview controls (soft timer, difficulty, skip/retry), keyboard shortcuts, voice answers (last feature milestone) |
| Agent | LangGraph, no MCP |
| Round | 5 questions, auto-mixed types, Easy/Medium/Hard + soft timer |
| Data | SQLAlchemy; SQLite locally, Neon Postgres in production (one `DATABASE_URL` env var) |
| Users | Anonymous visitor ID (no login) |
| Privacy | Store text only (no files), "Delete my data", demo data auto-purged after 7 days |
| Rubric | 4 dimensions, 1–5 anchored scale, structured outputs |
| Demo guard | Layered caps: $1/day global, $0.25/session, 2 rounds/visitor/day, per-IP rate limit, input size limits |
| Hosting | Render free web service (Docker) + Neon Postgres. *Changed from Hugging Face Spaces in M5: HF made Docker Spaces a paid (PRO) feature.* |
| Repo | pytest + Playwright smoke + GitHub Actions CI, evals folder, docs pack |

## 2. Model choice (checked against OpenAI docs, Nov 2026)

| Step | Model | Price per 1M tokens (in / out) | Why |
|---|---|---|---|
| **Answer scoring** | `gpt-6.1-terra` | $1.00 / $5.00 | Main model. OpenAI calls it "fast and efficient"; supports structured outputs + streaming. Scoring is where quality matters most |
| **Question generation, profile analysis, round summary** | `gpt-6-luna` | $0.10 / $0.50 | 10× cheaper; these steps are guided by tight prompts and a fixed topic list, so a small model is enough |

- Both are reasoning models with a `reasoning_effort` setting; I'll use `low` (fast, cheap, more consistent). Changing models = edit two lines in `.env`.
- Estimated cost: **~$0.05 per 5-question round** → the $0.25 session cap is ~5× headroom; $1/day ≈ 15–20 demo rounds.
- The pricing table lives in one file (`pricing.py`) so the cost tracker uses real token counts × price.

## 3. Architecture

```
Browser (React)                         FastAPI server (Python)                         OpenAI API
┌──────────────────┐  REST + SSE stream ┌────────────────────────────────────┐          ┌──────────┐
│ Setup / Interview│ ─────────────────▶ │ api/ routes ─▶ guard (caps, limits)│          │ terra    │
│ Progress/History │ ◀───────────────── │        │                           │          │ luna     │
│ visitor-id in    │   tokens streamed  │        ▼                           │  llm.py  │          │
│ localStorage     │                    │  agent/graph.py (LangGraph) ───────┼─────────▶│          │
└──────────────────┘                    │        │                           │ timeouts │          │
                                        │        ▼                           │ retries  │          │
                                        │  db (SQLAlchemy) ─ SQLite / Neon   │ cost cap │          │
                                        └────────────────────────────────────┘          └──────────┘
```

### Agent graph (one LangGraph `StateGraph`, run once per user action)

```
              ┌────────── action = "start" ──────────┐
 START ─▶ route                                     analyze_profile ─▶ plan_round ─▶ generate_question ─▶ END
              └─ action = "answer" ─▶ score_answer ─▶ update_memory ─▶ decide_next ─┬─▶ generate_question ─▶ END
                 action = "skip"   ──────────────────▶ update_memory ─┘              └─▶ summarize_round ─▶ END
```

| Node | Type | What it does |
|---|---|---|
| `analyze_profile` | LLM (luna, structured) | Extracts role title, required skills → mapped to a **fixed topic list**, and 2–3 resume projects worth deep-diving |
| `plan_round` | **Plain Python** | Fills 5 slots: 2 weakest topics from memory, 2 JD topics, 1 project deep-dive or behavioural. Focused round = all 5 on one topic |
| `generate_question` | LLM (luna, streamed) | Writes the question + hidden "expected key points" + suggested time |
| `score_answer` | LLM (terra, structured) | Scores against rubric using the expected key points, writes feedback + stronger sample answer |
| `update_memory` | Plain Python | Updates per-topic weak-area stats (moving average) |
| `decide_next` | Plain Python | Next question, or end of round |
| `summarize_round` | LLM (luna) | 3-line round summary + what to practise next |

**Design point to mention in interviews:** the database is the source of truth; the graph is stateless between requests (state is loaded from the DB each call). That survives server restarts on free hosting and keeps the graph easy to test with a fake LLM. LLMs are used only where judgement is needed; rules (planning, memory, routing) are plain, testable Python.

### `llm.py` (the only file that talks to OpenAI)
- `generate(...)`, `stream(...)`, `structured(..., schema=PydanticModel)` helpers.
- 30s timeout, 2 retries with exponential backoff on rate-limit/5xx/timeouts.
- Before each call: check session cap ($0.25) and daily cap ($1, demo only); after each call: log tokens + cost to `usage_log`.
- Key read from env only; never logged. Tests use a `FakeLLM` (zero cost).

## 4. Folder structure

```
Interview Coach Agent/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app, serves React build
│   │   ├── config.py          settings from .env (pydantic-settings)
│   │   ├── db.py, models.py   SQLAlchemy engine + tables
│   │   ├── schemas.py         request/response + LLM output models
│   │   ├── llm.py, pricing.py OpenAI wrapper, cost tracking
│   │   ├── guard.py           caps, allowance, rate limit, size limits
│   │   ├── parsing.py         PDF/DOCX → text (pypdf, python-docx)
│   │   ├── agent/             graph.py, nodes.py, prompts.py, rubric.py, topics.py, planner.py, memory.py
│   │   └── api/               sessions.py, progress.py, data.py
│   └── tests/                 pytest (fake LLM)
├── frontend/src/              pages/, components/, lib/api.ts, hooks/
├── e2e/                       Playwright smoke test
├── evals/                     cases.jsonl, run_evals.py, results.md
├── docs/                      PLAN.md, ARCHITECTURE.md
├── Dockerfile, render.yaml     production image + Render service definition
├── .env.example, .gitignore, README.md, INTERVIEW_NOTES.md, LICENSE
└── .github/workflows/ci.yml
```

## 5. Data model

| Table | Key columns |
|---|---|
| `visitors` | id (uuid), created_at, last_seen |
| `interview_sessions` | id, visitor_id, role_title, jd_text, resume_text, profile_json, difficulty, focus_topic, plan_json, status, tokens_in/out, cost_usd, created_at, finished_at, summary |
| `questions` | id, session_id, index, qtype (technical / sql_python / ml_concept / project / behavioural), topic, difficulty, text, expected_points_json, time_limit_s |
| `answers` | id, question_id, attempt, text, time_taken_s, skipped, created_at |
| `scores` | id, answer_id, dim1..dim4 (1–5), justifications_json, overall (0–100), feedback, sample_answer, model |
| `topic_stats` (memory) | visitor_id, topic, attempts, avg_score (moving avg), last_score, last_seen |
| `usage_log` | visitor_id, session_id, day, model, tokens_in, tokens_out, cost_usd |

The topic list is fixed (~16 topics, e.g. SQL joins, window functions, pandas, statistics, ML fundamentals, model evaluation, feature engineering, deep learning, NLP/LLMs, computer vision, MLOps basics, project deep-dive, behavioural). A fixed list is what makes "weak areas" countable across sessions.

## 6. Scoring rubric

Each dimension scored **1–5**; the model writes a one-line justification **before** each score.

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| **Correctness** (technical) | Wrong or major errors | Mostly right, minor errors/omissions | Fully correct, precise terms |
| **STAR structure** (behavioural, replaces Correctness) | No situation/result | Some STAR parts, vague result | Clear S-T-A-R, measurable result |
| **Depth** | Surface definition only | Explains how/why, one example | Trade-offs, edge cases, real-world nuance |
| **Clarity** | Hard to follow | Understandable, some rambling | Concise, well-structured |
| **JD relevance** | Ignores role context | Some link to role | Ties answer to the JD's tools/needs |

(Levels 2 and 4 are defined as "between" in the prompt.)

- Weights: Correctness/STAR 40%, Depth 25%, Clarity 15%, Relevance 20% → overall = weighted average mapped to **0–100**.
- Consistency techniques: JSON-schema structured outputs (scores must be integers 1–5), anchored level descriptions, **reference-guided grading** (the expected key points written with the question are given to the scorer), fixed prompt + fixed `reasoning_effort`.
- `evals/` measures it: ~20 labelled answers (weak / average / strong) → repeat-run std dev, strong>weak ordering accuracy, band agreement.

## 7. Screens (wireframes)

1. **Setup** `/` — Two cards side by side (stacked on mobile): *Job description* textarea with character counter; *Resume* drag-and-drop zone (PDF/DOCX) with "or paste text" toggle. Options row: difficulty segmented control, focus dropdown (Auto mix / a question type / a weak area), "Start interview" button. Badge: "2 free rounds left today" (demo).
2. **Interview** `/interview/:id` — Top bar: progress dots (Q2 of 5), type + topic chips, difficulty, soft timer ring (grey → amber → red). Chat column: agent question streams in with a typing effect; your answers as bubbles. Composer: textarea (Ctrl+Enter submits), mic button, Skip, Submit. After submit, a **score panel slides in** (right side; bottom sheet on mobile): overall score counts up 0→N, four rubric bars fill in, feedback bullets, collapsible "Stronger sample answer", Retry / Next buttons.
3. **Round summary** `/interview/:id/summary` — Average score, per-question rows with mini rubric bars, "Improved / Still weak" topic chips, "Practise weak areas" button.
4. **Progress** `/progress` — Line chart: overall score per session over time. Radar: average per rubric dimension. Bar chart: topic averages, weakest first. Clickable weak-area chips → start a focused round using your latest JD + resume.
5. **History** `/history` — Session cards (date, role, score, questions answered). Click → read-only transcript with each answer's scores and feedback.
6. **Settings** `/settings` — Theme toggle, today's usage, privacy text, **Delete my data** (confirm dialog).

Shared: sidebar (collapses to bottom bar on mobile), skeleton loaders, toast errors, "server waking up" screen, `?` shortcut help overlay.

## 8. Milestones

| # | Milestone | What you'll be able to see and try |
|---|---|---|
| M0 | Scaffold | Run one command, open the app shell: sidebar, empty pages, light/dark toggle. Tests + CI configured; first commit |
| M1 | LLM module + intake | Drop your resume, paste a JD, see extracted role, skills and topics. Cost of each call logged |
| M2 | Agent + chat interview | Full 5-question interview with streaming questions, soft timer, skip/retry, keyboard shortcuts |
| M3 | Scoring experience | Animated score reveal, rubric bars, feedback, sample answer, round summary page |
| M4 | Memory + progress + history | Charts over multiple sessions, weak-area chips start focused rounds, review past interviews, delete my data |
| M5 | Demo guard + deploy | Caps, allowance, rate limit, friendly limit screens; live on Render with Neon. **You'll run a few account-setup steps; I'll give exact commands** |
| M6 | Evals + e2e | `evals/` results table; Playwright smoke test in CI |
| M7 | Voice answers | Mic button → speak → transcript fills the answer box (decision at M7: free browser speech API vs OpenAI transcription) |
| M8 | Portfolio polish | README with GIF, live link, Mermaid diagram, results; INTERVIEW_NOTES.md |

## 9. Risks / notes

- **Python 3.14** is new; if a dependency lacks a wheel I'll pin a working version or use a 3.12 venv.
- **No Docker locally** → the Dockerfile is first built on Render. That's fine; the app also runs locally without Docker.
- **Visitor ID** lives in `localStorage` and is sent as a header (no cookies, so no cookie banner and no iframe issues).
- **No GitHub CLI** → at M5 you'll either install `gh` or create the empty repo on github.com (I'll give steps).
- Set a **monthly hard limit in your OpenAI dashboard** as a final safety net (you do this; I never touch the key).
