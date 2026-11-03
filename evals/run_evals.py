"""Scoring evals: is the answer scorer consistent and does it rank answers sensibly?

Each case in cases.jsonl is a question plus a hand-written answer labelled weak / average /
strong. Every case is scored --repeats times with the SAME code the app uses
(app.agent.scoring), then we measure:

  1. Consistency   - how much the overall score moves when the same answer is re-scored
  2. Ranking       - for each question: strong > average > weak (by median score)
  3. Band agreement- median score lands in the expected band (weak <40, average 40-69, strong 70+)
  4. Dimension stability - how often each 1-5 rubric score repeats exactly across runs

Usage (from the project folder):
    .venv\\Scripts\\python evals\\run_evals.py            # real model, uses OPENAI_API_KEY in .env
    .venv\\Scripts\\python evals\\run_evals.py --mock     # free dry run of the harness
Writes evals/results.json and evals/results.md. A full run costs roughly $0.10-0.30.
"""

import argparse
import json
import statistics
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "backend"))

from app.agent.scoring import score_answer  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.llm import Budget, OpenAILLM  # noqa: E402
from app.mock_llm import MockLLM  # noqa: E402

ROLE = "Junior Data Scientist"
JD_SKILLS = ["Python", "SQL", "pandas", "scikit-learn", "Statistics", "A/B testing"]
BANDS = {"weak": (0, 39), "average": (40, 69), "strong": (70, 100)}
DIMENSIONS = ("correctness", "depth", "clarity", "relevance")
ORDER = ["weak", "average", "strong"]


def band_of(score: float) -> str:
    return next(name for name, (low, high) in BANDS.items() if low <= round(score) <= high)


def run_case(llm, case: dict, repeats: int, total: dict, lock: threading.Lock, cap: float):
    runs = []
    for _ in range(repeats):
        with lock:
            if total["cost"] >= cap:
                raise SystemExit(f"Stopped: eval budget of ${cap:.2f} reached.")
        budget = Budget(cap_usd=0.10)  # per call; real calls cost well under 1 cent
        started = time.time()
        result, overall = score_answer(
            llm,
            question=case["question"],
            qtype=case["qtype"],
            role_title=ROLE,
            jd_skills=JD_SKILLS,
            expected_points=case["expected_points"],
            answer=case["answer"],
            budget=budget,
        )
        with lock:
            total["cost"] += budget.spent_usd
        runs.append(
            {
                "overall": overall,
                "seconds": round(time.time() - started, 2),
                **{d: getattr(result, d).score for d in DIMENSIONS},
            }
        )
    return case, runs


def summarise(cases_runs: list[tuple[dict, list[dict]]]) -> dict:
    per_case = []
    for case, runs in cases_runs:
        overalls = [r["overall"] for r in runs]
        median = statistics.median(overalls)
        stability = {
            d: Counter(r[d] for r in runs).most_common(1)[0][1] / len(runs) for d in DIMENSIONS
        }
        per_case.append(
            {
                "id": case["id"],
                "question_id": case["question_id"],
                "qtype": case["qtype"],
                "expected": case["expected_band"],
                "scores": overalls,
                "median": median,
                "spread": max(overalls) - min(overalls),
                "stdev": statistics.pstdev(overalls),
                "band": band_of(median),
                "dimension_stability": stability,
                "seconds": statistics.mean(r["seconds"] for r in runs),
            }
        )

    # Ranking: for each question, every pair (weak<average, weak<strong, average<strong).
    by_question: dict[str, dict[str, float]] = {}
    for c in per_case:
        by_question.setdefault(c["question_id"], {})[c["expected"]] = c["median"]
    pairs_ok = pairs_total = questions_fully_ordered = 0
    for medians in by_question.values():
        ordered = [b for b in ORDER if b in medians]
        ok = 0
        for i, low in enumerate(ordered):
            for high in ordered[i + 1 :]:
                pairs_total += 1
                ok += medians[low] < medians[high]
        pairs_ok += ok
        questions_fully_ordered += ok == len(ordered) * (len(ordered) - 1) // 2

    n = len(per_case)
    return {
        "cases": n,
        "questions": len(by_question),
        "mean_stdev": statistics.mean(c["stdev"] for c in per_case),
        "max_spread": max(c["spread"] for c in per_case),
        "within_10_points": sum(c["spread"] <= 10 for c in per_case) / n,
        "pairwise_ranking_accuracy": pairs_ok / pairs_total,
        "questions_fully_ordered": questions_fully_ordered / len(by_question),
        "band_agreement": sum(c["band"] == c["expected"] for c in per_case) / n,
        "dimension_stability": {
            d: statistics.mean(c["dimension_stability"][d] for c in per_case) for d in DIMENSIONS
        },
        "mean_seconds_per_score": statistics.mean(c["seconds"] for c in per_case),
        "per_case": per_case,
    }


def write_markdown(summary: dict, meta: dict, path: Path) -> None:
    pct = lambda x: f"{x * 100:.0f}%"  # noqa: E731
    dims = summary["dimension_stability"]
    lines = [
        "# Scoring eval results",
        "",
        f"Model `{meta['model']}` · reasoning effort `{meta['reasoning_effort']}` · "
        f"{summary['cases']} answers ({summary['questions']} questions × weak/average/strong) · "
        f"each scored {meta['repeats']}× · run {meta['date']} · cost ${meta['cost_usd']:.3f}",
        "",
        "| Metric | Result | What it means |",
        "|---|---|---|",
        f"| Ranking accuracy (pairs) | **{pct(summary['pairwise_ranking_accuracy'])}** | "
        "strong > average > weak for the same question |",
        f"| Questions fully ordered | **{pct(summary['questions_fully_ordered'])}** | "
        "all three answers in the right order |",
        f"| Band agreement | **{pct(summary['band_agreement'])}** | median score in the expected "
        "band (weak <40, average 40–69, strong 70+) |",
        f"| Consistency: mean std dev | **{summary['mean_stdev']:.1f} points** | how much the "
        "0–100 score moves when the same answer is re-scored |",
        f"| Consistency: within 10 points | **{pct(summary['within_10_points'])}** | answers whose "
        f"repeated scores stay within 10 points (max spread {summary['max_spread']}) |",
        f"| Dimension stability | {pct(dims['correctness'])} / {pct(dims['depth'])} / "
        f"{pct(dims['clarity'])} / {pct(dims['relevance'])} | correctness / depth / clarity / "
        "relevance: share of runs giving the same 1–5 score |",
        f"| Latency | {summary['mean_seconds_per_score']:.1f} s | average time to score one "
        "answer |",
        "",
        "## Per answer",
        "",
        "| Case | Expected | Scores | Median | Band |",
        "|---|---|---|---|---|",
    ]
    for c in summary["per_case"]:
        mark = "✅" if c["band"] == c["expected"] else "⚠️"
        scores = ", ".join(str(s) for s in c["scores"])
        lines.append(
            f"| {c['id']} | {c['expected']} | {scores} | {c['median']:g} | {c['band']} {mark} |"
        )
    lines += [
        "",
        "Generated by `evals/run_evals.py`. The bands are a rough human judgement, so band "
        "agreement below 100% can mean the label was harsh or generous, not only that the "
        "scorer is wrong; ranking and consistency are the more important signals.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--mock", action="store_true", help="use canned scores (free, offline)")
    parser.add_argument("--limit", type=int, default=0, help="only the first N cases")
    parser.add_argument("--max-cost", type=float, default=1.00, help="stop above this $ spend")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    settings = get_settings()
    if args.mock:
        llm = MockLLM()
    else:
        if not settings.openai_api_key:
            raise SystemExit("Set OPENAI_API_KEY in .env (or use --mock for a free dry run).")
        llm = OpenAILLM(settings)

    cases = [json.loads(line) for line in (HERE / "cases.jsonl").read_text("utf-8").splitlines()]
    if args.limit:
        cases = cases[: args.limit]

    total, lock = {"cost": 0.0}, threading.Lock()
    print(f"Scoring {len(cases)} answers × {args.repeats} with {llm.model_for('main')}...")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(
            pool.map(lambda c: run_case(llm, c, args.repeats, total, lock, args.max_cost), cases)
        )

    summary = summarise(results)
    meta = {
        "model": llm.model_for("main"),
        "reasoning_effort": "mock" if args.mock else settings.reasoning_effort,
        "repeats": args.repeats,
        "date": datetime.now(UTC).strftime("%Y-%m-%d"),
        "cost_usd": total["cost"],
    }
    suffix = "_mock" if args.mock else ""
    (HERE / f"results{suffix}.json").write_text(
        json.dumps({"meta": meta, **summary}, indent=2), encoding="utf-8"
    )
    write_markdown(summary, meta, HERE / f"results{suffix}.md")
    print(
        f"Ranking {summary['pairwise_ranking_accuracy']:.0%} · bands "
        f"{summary['band_agreement']:.0%} · mean std dev {summary['mean_stdev']:.1f} · "
        f"cost ${total['cost']:.3f} -> evals/results{suffix}.md"
    )


if __name__ == "__main__":
    main()
