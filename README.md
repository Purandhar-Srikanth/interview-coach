# Interview Coach

An AI mock interviewer: paste a job description and your resume, answer tailored questions one at a time, get rubric-based scores with feedback, and let the agent remember your weak areas across sessions.

> Work in progress. See [docs/PLAN.md](docs/PLAN.md) for the architecture and milestones. A full README (demo GIF, live link, results) comes at the end.

## Run locally (Windows PowerShell)

Requirements: Python 3.12+ and Node 20+.

```powershell
# 1. Backend: create a virtual environment and install packages
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements-dev.txt

# 2. Frontend: install packages
npm --prefix frontend install

# 3. Your OpenAI key: either set OPENAI_API_KEY as an environment variable,
#    or copy .env.example to .env and put the key there (.env is gitignored).

# 4. Start the backend (terminal 1)
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000 --app-dir backend

# 5. Start the frontend (terminal 2), then open http://localhost:5173
npm --prefix frontend run dev
```

## Tests

```powershell
cd backend; ..\.venv\Scripts\python -m pytest -q
```
