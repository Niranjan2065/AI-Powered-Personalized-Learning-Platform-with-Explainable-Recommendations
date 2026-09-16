"""
ai_engine/src/baseline_recommenders.py

Reviewer 2: "The proposed approach should be compared with random
recommendation, popularity-based recommendation, conventional user-based
k-NN without clustering, and preferably another educational recommender
approach."

k-NN alone (Condition A from ablation_study.py) already serves as the
"conventional user-based k-NN without clustering" baseline. This script
adds Random and Popularity-based baselines under the identical leave-one-out
protocol so all four conditions are directly comparable.

Run: python -m ai_engine.src.baseline_recommenders
"""

import pandas as pd
import numpy as np
import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
PROC_DIR = os.path.join(BASE_DIR, "data", "processed")
STM_PATH = os.path.join(MODELS_DIR, "student_topic_matrix.csv")

RELEVANCE_THRESHOLD = 70
K_VALUES = [3, 5, 10]
SEED = 42


def ndcg_at_k(hit_rank, k):
    if hit_rank is None or hit_rank > k:
        return 0.0
    return 1.0 / np.log2(hit_rank + 1)


def get_eligible_students(stm):
    eligible = []
    for sid in stm.index:
        row = stm.loc[sid]
        strong = row[row >= RELEVANCE_THRESHOLD].index.tolist()
        attempted = row[row > 0].index.tolist()
        if len(strong) >= 1 and len(attempted) >= 2:
            eligible.append(sid)
    return eligible


def evaluate(stm, rank_fn, k_values=K_VALUES, seed=SEED, name=""):
    rng = np.random.default_rng(seed)
    results = {k: {"hits": 0, "ndcg_sum": 0.0, "n_eval": 0} for k in k_values}
    eligible = get_eligible_students(stm)

    for sid in eligible:
        row = stm.loc[sid].copy()
        strong_topics = row[row >= RELEVANCE_THRESHOLD].index.tolist()
        held_out_topic = rng.choice(strong_topics)

        masked_row = row.copy()
        masked_row[held_out_topic] = 0.0
        done_topics = set(masked_row[masked_row > 0].index)

        ranked = rank_fn(sid, masked_row, done_topics, rng)
        hit_rank = ranked.index(held_out_topic) + 1 if held_out_topic in ranked else None

        for k in k_values:
            top_k = ranked[:k]
            results[k]["n_eval"] += 1
            if held_out_topic in top_k:
                results[k]["hits"] += 1
            results[k]["ndcg_sum"] += ndcg_at_k(hit_rank, k)

    summary = []
    for k in k_values:
        n = results[k]["n_eval"]
        recall = results[k]["hits"] / n if n else 0.0
        precision = results[k]["hits"] / (n * k) if n else 0.0
        ndcg = results[k]["ndcg_sum"] / n if n else 0.0
        summary.append({"K": k, "Precision@K": round(precision, 4), "Recall@K": round(recall, 4),
                         "NDCG@K": round(ndcg, 4), "n_students_evaluated": n})
    return summary


def main():
    stm = pd.read_csv(STM_PATH, index_col="student_id")
    all_topics = list(stm.columns)

    # ---- Random baseline: shuffle all not-yet-attempted topics ----
    def random_rank(sid, masked_row, done_topics, rng):
        candidates = [t for t in all_topics if t not in done_topics]
        candidates = list(rng.permutation(candidates))
        return candidates

    # ---- Popularity baseline: rank by mean score across all OTHER students (no personalization) ----
    topic_popularity = stm.mean(axis=0)  # global average score per topic

    def popularity_rank(sid, masked_row, done_topics, rng):
        scores = topic_popularity.drop(index=list(done_topics), errors="ignore")
        return scores.sort_values(ascending=False).index.tolist()

    print("=" * 60)
    print("Baseline A — Random recommendation")
    print("=" * 60)
    summary_random = evaluate(stm, random_rank, name="random")
    print(pd.DataFrame(summary_random).to_string(index=False))

    print("\n" + "=" * 60)
    print("Baseline B — Popularity-based recommendation (no personalization)")
    print("=" * 60)
    summary_pop = evaluate(stm, popularity_rank, name="popularity")
    print(pd.DataFrame(summary_pop).to_string(index=False))

    # Load the already-computed k-NN alone / K-Means+k-NN results for the combined table
    with open(os.path.join(PROC_DIR, "ablation_results.json")) as f:
        ablation = json.load(f)
    summary_knn = ablation["condition_a_knn_only"]
    summary_hybrid = ablation["condition_b_kmeans_knn"]

    print("\n" + "=" * 60)
    print("All four conditions — Recall@K")
    print("=" * 60)
    combined = []
    for i, k in enumerate(K_VALUES):
        combined.append({
            "K": k,
            "Random": summary_random[i]["Recall@K"],
            "Popularity": summary_pop[i]["Recall@K"],
            "k-NN alone": summary_knn[i]["Recall@K"],
            "K-Means+k-NN": summary_hybrid[i]["Recall@K"],
        })
    combined_df = pd.DataFrame(combined)
    print(combined_df.to_string(index=False))

    out = {
        "random": summary_random,
        "popularity": summary_pop,
        "knn_alone": summary_knn,
        "kmeans_knn": summary_hybrid,
    }
    out_path = os.path.join(PROC_DIR, "baseline_comparison.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    combined_df.to_csv(os.path.join(PROC_DIR, "baseline_comparison.csv"), index=False)
    print(f"\nSaved: {out_path}")
    print(f"Saved: {os.path.join(PROC_DIR, 'baseline_comparison.csv')}")


if __name__ == "__main__":
    main()
