"""Writes evals/cases.jsonl: 7 interview questions x 3 hand-written answers (weak/average/strong).

Edit the answers here and re-run to regenerate the eval set:
    .venv\\Scripts\\python evals\\build_cases.py
"""

import json
from pathlib import Path

QUESTIONS = [
    {
        "id": "imbalance",
        "qtype": "ml_concept",
        "topic": "model_evaluation",
        "question": "Your churn model has 95% accuracy, but only 5% of customers actually churn. "
        "Is it a good model? What would you look at instead?",
        "expected_points": [
            "Accuracy is misleading on imbalanced data: always predicting 'no churn' gives 95%",
            "Use precision, recall, F1 and PR-AUC/ROC-AUC, plus the confusion matrix",
            "Choose the threshold from the business cost of false negatives vs false positives",
            "Compare against a simple baseline",
        ],
        "answers": {
            "weak": "95% is really high so I think the model is good. Maybe I would also check "
            "the loss.",
            "average": "Not necessarily, because the data is imbalanced. A model that always "
            "predicts no churn would also get 95%. I would look at precision and recall and the "
            "confusion matrix instead.",
            "strong": "Not on its own. With 5% churners, a model that always predicts 'no churn' "
            "already scores 95%, so accuracy hides everything. I'd look at the confusion matrix, "
            "recall on the churn class (how many churners we catch) and precision (how many "
            "flagged customers really churn), and summarise with PR-AUC, which is more "
            "informative than ROC-AUC under heavy imbalance. Then I'd pick the threshold from "
            "business costs: if missing a churner costs far more than a retention offer, I'd "
            "lower the threshold to raise recall, and I'd always compare against the "
            "always-no-churn baseline.",
        },
    },
    {
        "id": "sql_topn",
        "qtype": "sql_python",
        "topic": "sql_advanced",
        "question": "Using the table `transactions(customer_id, txn_id, txn_date, amount)`, write "
        "a query that returns each customer's 3 most recent transactions.",
        "expected_points": [
            "Use ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY txn_date DESC)",
            "Filter on the row number in a CTE or subquery (window functions can't go in WHERE)",
            "Mention tie handling: ROW_NUMBER vs RANK/DENSE_RANK, or a tie-breaker column",
        ],
        "answers": {
            "weak": "SELECT * FROM transactions ORDER BY txn_date DESC LIMIT 3;",
            "average": "I would use ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY txn_date "
            "DESC) as rn and then keep rows where rn <= 3.",
            "strong": "```sql\nWITH ranked AS (\n  SELECT customer_id, txn_id, txn_date, amount,\n"
            "         ROW_NUMBER() OVER (PARTITION BY customer_id\n"
            "                            ORDER BY txn_date DESC, txn_id DESC) AS rn\n"
            "  FROM transactions\n)\nSELECT customer_id, txn_id, txn_date, amount\n"
            "FROM ranked\nWHERE rn <= 3;\n```\n"
            "The window function numbers each customer's transactions newest first. I filter in "
            "an outer query because window functions can't be used in WHERE. I added txn_id as a "
            "tie-breaker so two transactions on the same date are ordered deterministically; if "
            "ties should all be kept, I'd use RANK() instead and could get more than 3 rows.",
        },
    },
    {
        "id": "pandas_monthly",
        "qtype": "sql_python",
        "topic": "pandas",
        "question": "You have a pandas DataFrame `df` with columns `user_id`, `date` (strings) "
        "and `amount`, containing some duplicate rows and missing amounts. How would you "
        "compute each user's total spend per month?",
        "expected_points": [
            "Remove duplicate rows (drop_duplicates)",
            "Decide how to handle missing amounts (investigate, drop or fill with 0) and say why",
            "Convert date with pd.to_datetime",
            "Group by user and month (dt.to_period('M') or pd.Grouper) and sum",
        ],
        "answers": {
            "weak": "df.groupby('user_id').sum()",
            "average": "First drop duplicates, then convert date with pd.to_datetime, then group "
            "by user_id and month and sum the amount.",
            "strong": "```python\ndf = df.drop_duplicates()\n"
            "df['date'] = pd.to_datetime(df['date'], errors='coerce')\n"
            "df = df.dropna(subset=['date'])\n"
            "monthly = (df.assign(month=df['date'].dt.to_period('M'))\n"
            "             .groupby(['user_id', 'month'], as_index=False)['amount']\n"
            "             .sum(min_count=1))\n```\n"
            "I drop exact duplicates first so purchases aren't double counted, and coerce bad "
            "dates to NaT and drop them. For missing amounts I'd first check why they're missing: "
            "if they mean 'no charge' I'd fill with 0, otherwise sum(min_count=1) keeps a month "
            "as NaN when every amount is missing, so we don't report a fake 0.",
        },
    },
    {
        "id": "bias_variance",
        "qtype": "ml_concept",
        "topic": "ml_fundamentals",
        "question": "Explain the bias-variance trade-off. How would you tell whether a model is "
        "overfitting, and what would you do about it?",
        "expected_points": [
            "Bias = error from overly simple assumptions (underfitting); variance = sensitivity "
            "to the training data (overfitting)",
            "Overfitting shows as low training error but much higher validation error; learning "
            "curves or cross-validation",
            "Remedies: regularisation, simpler model, more data, early stopping",
        ],
        "answers": {
            "weak": "Bias is when the model is biased and variance is the variance of the data. "
            "Overfitting is when accuracy is very high.",
            "average": "High bias means underfitting and high variance means overfitting. If "
            "training accuracy is much higher than test accuracy the model is overfitting, and I "
            "can use regularisation to fix it.",
            "strong": "Bias is error from assumptions that are too simple, so the model underfits; "
            "variance is how much the model changes with the training sample, so it overfits. "
            "Making a model more complex lowers bias but raises variance, and we want the point "
            "where validation error is lowest. I detect overfitting by comparing training and "
            "validation error, ideally with k-fold cross-validation and learning curves: a big, "
            "persistent gap means high variance. To fix it I'd add regularisation (L2, or "
            "max_depth/min_samples_leaf for trees), simplify features, get more data, or use "
            "early stopping, and re-check the validation score after each change.",
        },
    },
    {
        "id": "p_value",
        "qtype": "ml_concept",
        "topic": "statistics",
        "question": "In an A/B test of a new checkout button, the result has p = 0.03. Explain to "
        "a product manager what that means and what you'd check before recommending a launch.",
        "expected_points": [
            "If there were truly no difference, a result at least this extreme would happen "
            "about 3% of the time",
            "It is not the probability that the new button is better or that the null is true",
            "Check effect size / confidence interval and practical significance",
            "Check test validity: planned sample size, no peeking, randomisation, guardrails",
        ],
        "answers": {
            "weak": "It means there is a 97% chance that the new button is better, so we should "
            "launch it.",
            "average": "It means the result is statistically significant at the 5% level, so the "
            "difference is probably not due to chance. I would also look at how big the "
            "improvement is.",
            "strong": "In plain words: if the new button truly made no difference, we'd see a gap "
            "this large only about 3% of the time, so random noise is an unlikely explanation. "
            "It does not mean there's a 97% chance the button is better. Before recommending a "
            "launch I'd look at the effect size and its 95% confidence interval: a 0.1% lift may "
            "be real but not worth it. I'd also confirm the test ran to its planned sample size "
            "without peeking, that randomisation was balanced, and that guardrail metrics like "
            "refunds or page speed didn't get worse.",
        },
    },
    {
        "id": "mask_project",
        "qtype": "project",
        "topic": "project_deep_dive",
        "question": "In your Face Mask Detection project, why did you use transfer learning with "
        "MobileNetV2, and how did you know the model was good enough?",
        "expected_points": [
            "Small dataset, so pretrained ImageNet features generalise better than training "
            "from scratch",
            "MobileNetV2 is lightweight, suited to real-time inference on a laptop CPU",
            "Proper validation: held-out split, augmentation, metrics beyond accuracy",
            "Real-world checks and failure cases (lighting, angles, partial masks)",
        ],
        "answers": {
            "weak": "Because MobileNetV2 is a good model and transfer learning is popular. The "
            "accuracy was 96% so it was good.",
            "average": "We only had a few thousand images, so training from scratch would "
            "overfit; MobileNetV2 is pretrained on ImageNet and is light enough to run in real "
            "time. We got 96% validation accuracy.",
            "strong": "We had about 4,000 labelled images, too few to train a CNN from scratch "
            "without overfitting, so I reused MobileNetV2's ImageNet features and only trained a "
            "small classification head, then fine-tuned the top layers. I chose MobileNetV2 "
            "because it's light enough to hit about 20 FPS on a laptop CPU, which the real-time "
            "webcam demo needed. I judged it on a held-out validation set with augmentation only "
            "on training data: 96% accuracy, but I also checked per-class precision and recall "
            "because a missed 'no mask' was the costly error. Testing it live showed failures in "
            "dim light and with hands covering faces, so I'd add more varied data next time.",
        },
    },
    {
        "id": "deadline",
        "qtype": "behavioural",
        "topic": "behavioural",
        "question": "Tell me about a time you had to deliver something under a tight deadline. "
        "What did you do, and what was the result?",
        "expected_points": [
            "Specific situation and task (STAR)",
            "Concrete actions: prioritisation, communication, scope trade-offs",
            "Measurable result",
            "Reflection or lesson learned",
        ],
        "answers": {
            "weak": "I always work well under pressure and I manage my time properly, so "
            "deadlines are not a problem for me.",
            "average": "In my final-year project we had one week left before the demo and the "
            "model was not working. I divided the work among the team and we worked late, and "
            "we finished on time.",
            "strong": "During my internship at RetailMart, the regional manager asked for a "
            "sales-drop analysis two days before a leadership review. I had to deliver a clear "
            "explanation, not just data. I agreed the three questions that mattered most with my "
            "manager, dropped a nice-to-have dashboard, automated the data pull with a pandas "
            "script, and shared a draft chart after day one to get early feedback. I delivered a "
            "5-slide summary a few hours early; it showed stock-outs at two stores drove most of "
            "the drop, and replenishment was fixed that month. I learned that agreeing scope "
            "early matters more than working longer hours.",
        },
    },
]


def main() -> None:
    out = Path(__file__).with_name("cases.jsonl")
    with out.open("w", encoding="utf-8") as f:
        for q in QUESTIONS:
            for band, answer in q["answers"].items():
                case = {k: v for k, v in q.items() if k not in ("answers", "id")}
                case.update(id=f"{q['id']}-{band}", question_id=q["id"], expected_band=band)
                case["answer"] = answer
                f.write(json.dumps(case, ensure_ascii=False) + "\n")
    print(f"Wrote {sum(len(q['answers']) for q in QUESTIONS)} cases to {out.name}")


if __name__ == "__main__":
    main()
