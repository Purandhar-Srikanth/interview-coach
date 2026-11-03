# Scoring evals

How do we know the answer scorer is any good? This folder tests it like a model.

- **`cases.jsonl`**: 21 labelled answers: 7 interview questions (ML concepts, SQL, pandas,
  statistics, a project deep-dive, behavioural), each answered three times by hand:
  **weak**, **average** and **strong**. Generated from `build_cases.py`.
- **`run_evals.py`**: scores every answer several times with the *same code the app uses*
  (`backend/app/agent/scoring.py`) and measures:

| Metric | Question it answers |
|---|---|
| Ranking accuracy | For the same question, does strong beat average beat weak? |
| Band agreement | Does each answer land in its expected range (weak <40, average 40–69, strong 70+)? |
| Consistency (std dev, spread) | If the same answer is scored again, does the score stay put? |
| Dimension stability | How often each 1–5 rubric score repeats exactly |

- **`results.md` / `results.json`**: the latest real-model results (shown in the main README).

```powershell
# free dry run (mock scores, just checks the harness) - also runs in CI
.venv\Scripts\python evals\run_evals.py --mock

# real run: needs OPENAI_API_KEY in .env; about $0.10-0.30
.venv\Scripts\python evals\run_evals.py --repeats 3
```

**Why these techniques keep scores consistent:** anchored 1–5 level descriptions, a
justification written *before* each score, JSON-schema structured outputs, reference points
written together with the question ("reference-guided grading"), and a fixed, low reasoning
effort. The evals are how we check those choices actually work, and how we'd catch a
regression after changing the prompt or the model.
