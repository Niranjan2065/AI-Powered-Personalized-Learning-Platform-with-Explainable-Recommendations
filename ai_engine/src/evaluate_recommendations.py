"""
Recommendation Quality Evaluation Script
Leave-One-Out evaluation of the collaborative-filtering recommender.

For each student with >= 2 attempted topics:
  1. Pick one topic where the student scored well (>= 70) as the "held-out"
     relevant topic and remove it from their profile vector.
  2. Ask the CF model (using the remaining topics) for top-K recommendations.
  3. Check whether the held-out topic appears in the top-K list.

Metrics reported:
  - Precision@K   = (# relevant hits in top-K) / K
  - Recall@K      = (# relevant hits) / (# relevant held-out items, i.e. 1 per student here)
  - Hit Rate@K    = fraction of students for whom the held-out topic was recovered at all
  - NDCG@K        = rank-aware version (rewards the held-out topic appearing near the top)

Run: python -m src.evaluate_recommendations   (from ai_engine/ directory)
"""

import pandas as pd
import numpy as np
import pickle
import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")

STM_PATH = os.path.join(MODELS_DIR, "student_topic_matrix.csv")
CF_MODEL_PATH = os.path.join(MODELS_DIR, "cf_model.pkl")

RELEVANCE_THRESHOLD = 70  # quiz_score >= 70 counts as "a topic worth recommending"
K_VALUES = [3, 5, 10]
SEED = 42


def ndcg_at_k(hit_rank, k):
    """hit_rank: 1-indexed rank of the relevant item in the recommended list, or None if absent."""
    if hit_rank is None or hit_rank > k:
        return 0.0
    # Single relevant item per student -> DCG = 1 / log2(rank+1), IDCG = 1 / log2(2) = 1
    return 1.0 / np.log2(hit_rank + 1)


def evaluate(stm, cf_model, k_values=K_VALUES, seed=SEED):
    rng = np.random.default_rng(seed)
    results = {k: {"precision_hits": 0, "recall_hits": 0, "ndcg_sum": 0.0, "n_eval": 0} for k in k_values}

    eligible_students = []
    for sid in stm.index:
        row = stm.loc[sid]
        strong_topics = row[row >= RELEVANCE_THRESHOLD].index.tolist()
        attempted_topics = row[row > 0].index.tolist()
        if len(strong_topics) >= 1 and len(attempted_topics) >= 2:
            eligible_students.append(sid)

    print(f"Eligible students for leave-one-out eval: {len(eligible_students)} / {len(stm)}\n")

    max_k = max(k_values)
    n_neighbors = min(6, len(stm))

    for sid in eligible_students:
        row = stm.loc[sid].copy()
        strong_topics = row[row >= RELEVANCE_THRESHOLD].index.tolist()
        held_out_topic = rng.choice(strong_topics)

        # Build a masked profile vector with the held-out topic zeroed out
        masked_row = row.copy()
        masked_row[held_out_topic] = 0.0

        student_vec = masked_row.values.reshape(1, -1)
        distances, indices = cf_model.kneighbors(student_vec, n_neighbors=n_neighbors)
        similar_ids = stm.index[indices[0]].tolist()
        # Exclude the student itself if it appears (masked vector may still match closely)
        similar_ids = [s for s in similar_ids if s != sid][: n_neighbors - 1]

        done_topics = set(masked_row[masked_row > 0].index)
        candidate_scores = stm.loc[similar_ids].mean(axis=0)
        candidate_scores = candidate_scores.drop(index=list(done_topics), errors="ignore")
        ranked = candidate_scores.nlargest(max_k).index.tolist()

        hit_rank = None
        if held_out_topic in ranked:
            hit_rank = ranked.index(held_out_topic) + 1  # 1-indexed

        for k in k_values:
            top_k = ranked[:k]
            hit = held_out_topic in top_k
            results[k]["n_eval"] += 1
            if hit:
                results[k]["precision_hits"] += 1
                results[k]["recall_hits"] += 1
            results[k]["ndcg_sum"] += ndcg_at_k(hit_rank, k)

    summary = []
    for k in k_values:
        n = results[k]["n_eval"]
        precision = results[k]["precision_hits"] / (n * k) if n else 0.0
        recall = results[k]["recall_hits"] / n if n else 0.0  # 1 relevant item per student
        hit_rate = results[k]["precision_hits"] / n if n else 0.0
        ndcg = results[k]["ndcg_sum"] / n if n else 0.0
        summary.append({
            "K": k,
            "Precision@K": round(precision, 4),
            "Recall@K": round(recall, 4),
            "HitRate@K": round(hit_rate, 4),
            "NDCG@K": round(ndcg, 4),
            "n_students_evaluated": n,
        })
    return summary


def main():
    stm = pd.read_csv(STM_PATH, index_col="student_id")
    with open(CF_MODEL_PATH, "rb") as f:
        cf_model = pickle.load(f)

    print(f"Student-topic matrix: {stm.shape[0]} students x {stm.shape[1]} topics\n")

    summary = evaluate(stm, cf_model)
    df = pd.DataFrame(summary)
    print("Recommendation Evaluation Table (Leave-One-Out, for IEEE paper):\n")
    print(df.to_string(index=False))

    out_csv = os.path.join(PROC_DIR, "recommendation_metrics.csv")
    df.to_csv(out_csv, index=False)
    out_json = os.path.join(PROC_DIR, "recommendation_metrics.json")
    with open(out_json, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nSaved metrics table to: {out_csv}")
    print(f"Saved metrics JSON to: {out_json}")


if __name__ == "__main__":
    main()
