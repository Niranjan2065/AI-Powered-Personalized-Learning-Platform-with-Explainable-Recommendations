"""
Ablation Study — k-NN alone (Condition A) vs. K-Means + k-NN (Condition B)
Requested by Reviewer 1: "The rationale for combining clustering with
collaborative filtering should also be supported through an ablation
experiment comparing k-NN alone versus K-Means + k-NN."

Same leave-one-out protocol as evaluate_recommendations.py for both
conditions, so the cluster restriction is the only variable that changes.

Run: python -m ai_engine.src.ablation_study   (from repo root)
"""

import pandas as pd
import numpy as np
import pickle
import os
import json
import time

from scipy.stats import wilcoxon

from .cf_utils import mean_center, reconstruct_scores

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")

STM_PATH = os.path.join(MODELS_DIR, "student_topic_matrix.csv")
CF_MODEL_PATH = os.path.join(MODELS_DIR, "cf_model.pkl")
CF_MODEL_CLUSTER_PATH = os.path.join(MODELS_DIR, "cf_model_by_cluster.pkl")
CLUSTERED_PATH = os.path.join(PROC_DIR, "student_features_clustered.csv")

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


def neighbors_condition_a(stm, centered, cf_model, masked_row, masked_row_centered, sid, n_neighbors):
    """k-NN alone: global neighbor search on MEAN-CENTERED scores, ignoring
    cluster membership."""
    query_vec = masked_row_centered.values.reshape(1, -1)
    n = min(n_neighbors, len(stm))
    distances, indices = cf_model.kneighbors(query_vec, n_neighbors=n)
    similar_ids = stm.index[indices[0]].tolist()
    similar_ids = [s for s in similar_ids if s != sid][: n_neighbors - 1]
    return similar_ids


def neighbors_condition_b(stm, centered, cf_by_cluster, student_cluster, masked_row,
                           masked_row_centered, sid, n_neighbors, fallback_model):
    """K-Means + k-NN: neighbor search restricted to the student's cluster,
    on MEAN-CENTERED scores. Falls back to the global model (Condition A) if
    the cluster has < 2 members in the interaction matrix — an explicit,
    reported fallback rather than a silent one."""
    cluster_id = student_cluster.get(sid)
    entry = cf_by_cluster.get(cluster_id, {})
    model, member_ids = entry.get("model"), entry.get("student_ids", [])

    if model is None:
        return neighbors_condition_a(stm, centered, fallback_model, masked_row,
                                      masked_row_centered, sid, n_neighbors), True

    query_vec = masked_row_centered.values.reshape(1, -1)
    n = min(n_neighbors, len(member_ids))
    distances, indices = model.kneighbors(query_vec, n_neighbors=n)
    similar_ids = [member_ids[i] for i in indices[0] if member_ids[i] != sid][: n_neighbors - 1]
    return similar_ids, False


def evaluate(stm, neighbor_fn, k_values=K_VALUES, seed=SEED):
    rng = np.random.default_rng(seed)
    results = {k: {"precision_hits": 0, "recall_hits": 0, "ndcg_sum": 0.0, "n_eval": 0} for k in k_values}
    per_student_recall10 = {}  # NEW: per-student Recall@10 (1/0), for paired significance testing
    n_neighbors = min(6, len(stm))
    eligible = get_eligible_students(stm)
    fallback_count = 0
    centered, student_means = mean_center(stm)

    t0 = time.perf_counter()
    for sid in eligible:
        row = stm.loc[sid].copy()
        strong_topics = row[row >= RELEVANCE_THRESHOLD].index.tolist()
        held_out_topic = rng.choice(strong_topics)

        masked_row = row.copy()
        masked_row[held_out_topic] = 0.0
        # recompute this student's centered query using the masked row, so
        # the held-out topic can't leak into the student's own mean either
        masked_attempted = masked_row > 0
        masked_mean = masked_row[masked_attempted].mean() if masked_attempted.any() else 0.0
        masked_row_centered = masked_row.sub(masked_mean).where(masked_attempted, 0)

        similar_ids, used_fallback = neighbor_fn(sid, masked_row, masked_row_centered, n_neighbors)
        if used_fallback:
            fallback_count += 1

        done_topics = set(masked_row[masked_row > 0].index)
        if similar_ids:
            neighbor_residuals = centered.loc[similar_ids].mean(axis=0)
            candidate_scores = reconstruct_scores(neighbor_residuals, masked_mean)
        else:
            candidate_scores = pd.Series(masked_mean, index=stm.columns)
        candidate_scores = candidate_scores.drop(index=list(done_topics), errors="ignore")
        ranked = candidate_scores.nlargest(max(k_values)).index.tolist()

        hit_rank = ranked.index(held_out_topic) + 1 if held_out_topic in ranked else None

        # NEW: record this student's Recall@10 hit/miss for the significance test
        per_student_recall10[sid] = 1 if held_out_topic in ranked[:10] else 0

        for k in k_values:
            top_k = ranked[:k]
            hit = held_out_topic in top_k
            results[k]["n_eval"] += 1
            if hit:
                results[k]["precision_hits"] += 1
                results[k]["recall_hits"] += 1
            results[k]["ndcg_sum"] += ndcg_at_k(hit_rank, k)
    elapsed = time.perf_counter() - t0

    summary = []
    for k in k_values:
        n = results[k]["n_eval"]
        precision = results[k]["precision_hits"] / (n * k) if n else 0.0
        recall = results[k]["recall_hits"] / n if n else 0.0
        hit_rate = results[k]["precision_hits"] / n if n else 0.0
        ndcg = results[k]["ndcg_sum"] / n if n else 0.0
        summary.append({
            "K": k, "Precision@K": round(precision, 4), "Recall@K": round(recall, 4),
            "HitRate@K": round(hit_rate, 4), "NDCG@K": round(ndcg, 4), "n_students_evaluated": n,
        })
    # NEW: per_student_recall10 added to the return tuple
    return summary, elapsed, fallback_count, len(eligible), per_student_recall10


def main():
    stm = pd.read_csv(STM_PATH, index_col="student_id")
    sf = pd.read_csv(CLUSTERED_PATH)
    student_cluster = dict(zip(sf["student_id"], sf["cluster"]))

    with open(CF_MODEL_PATH, "rb") as f:
        cf_model = pickle.load(f)
    with open(CF_MODEL_CLUSTER_PATH, "rb") as f:
        cf_by_cluster = pickle.load(f)

    print(f"Student-topic matrix: {stm.shape[0]} students x {stm.shape[1]} topics")
    print(f"Clusters: {sorted(set(student_cluster.values()))}\n")

    print("=" * 60)
    print("Condition A — k-NN alone (global, no cluster restriction)")
    print("=" * 60)
    fn_a = lambda sid, masked_row, masked_row_centered, n: (
        neighbors_condition_a(stm, None, cf_model, masked_row, masked_row_centered, sid, n), False)
    summary_a, time_a, _, n_elig, recall10_a = evaluate(stm, fn_a)
    df_a = pd.DataFrame(summary_a)
    print(df_a.to_string(index=False))
    print(f"Wall-clock: {time_a*1000:.2f} ms  |  eligible students: {n_elig}\n")

    print("=" * 60)
    print("Condition B — K-Means + k-NN (neighbor search restricted to cluster)")
    print("=" * 60)
    fn_b = lambda sid, masked_row, masked_row_centered, n: neighbors_condition_b(
        stm, None, cf_by_cluster, student_cluster, masked_row, masked_row_centered, sid, n, cf_model)
    summary_b, time_b, fallback_count, _, recall10_b = evaluate(stm, fn_b)
    df_b = pd.DataFrame(summary_b)
    print(df_b.to_string(index=False))
    print(f"Wall-clock: {time_b*1000:.2f} ms  |  eligible students: {n_elig}  |  "
          f"fell back to global model: {fallback_count}/{n_elig} "
          f"(student's cluster had < 2 members in the interaction matrix)\n")

    # NEW: paired Wilcoxon signed-rank test on per-student Recall@10
    print("=" * 60)
    print("Statistical significance test (Recall@10, paired)")
    print("=" * 60)
    common_ids = [sid for sid in recall10_a if sid in recall10_b]
    a_vals = [recall10_a[sid] for sid in common_ids]
    b_vals = [recall10_b[sid] for sid in common_ids]
    diffs = np.array(a_vals) - np.array(b_vals)
    if np.all(diffs == 0):
        print(f"All {len(common_ids)} paired values identical — Wilcoxon undefined (p=1.0).")
        stat, p = np.nan, 1.0
    else:
        stat, p = wilcoxon(a_vals, b_vals)
        print(f"Wilcoxon signed-rank test (Recall@10, paired, n={len(common_ids)}): "
              f"statistic={stat:.4f}, p={p:.4f}")

    # Side-by-side comparison table
    comparison = []
    for a, b in zip(summary_a, summary_b):
        comparison.append({
            "K": a["K"],
            "Recall@K (kNN alone)": a["Recall@K"],
            "Recall@K (KMeans+kNN)": b["Recall@K"],
            "Precision@K (kNN alone)": a["Precision@K"],
            "Precision@K (KMeans+kNN)": b["Precision@K"],
            "NDCG@K (kNN alone)": a["NDCG@K"],
            "NDCG@K (KMeans+kNN)": b["NDCG@K"],
        })
    comp_df = pd.DataFrame(comparison)
    print("\n" + "=" * 60)
    print("Side-by-side comparison")
    print("=" * 60)
    print(comp_df.to_string(index=False))

    out_csv = os.path.join(PROC_DIR, "ablation_results.csv")
    comp_df.to_csv(out_csv, index=False)
    out_json = os.path.join(PROC_DIR, "ablation_results.json")
    with open(out_json, "w") as f:
        json.dump({
            "condition_a_knn_only": summary_a,
            "condition_b_kmeans_knn": summary_b,
            "wall_clock_ms": {"knn_only": time_a * 1000, "kmeans_knn": time_b * 1000},
            "n_eligible_students": n_elig,
            "fallback_to_global_count": fallback_count,
            "significance_test": {
                "metric": "Recall@10",
                "test": "Wilcoxon signed-rank (paired)",
                "n_paired": len(common_ids),
                "statistic": None if np.isnan(stat) else float(stat),
                "p_value": float(p),
            },
            "caveat": ("Dataset in this repo has only 7 students across 2 clusters "
                       "(one cluster has a single member), so per-cluster neighbor "
                       "pools are extremely small. Results here demonstrate the "
                       "mechanism and evaluation protocol, not a statistically "
                       "meaningful comparison — re-run on the full-scale dataset "
                       "(200 students / 30 topics) before reporting in the paper."),
        }, f, indent=2)
    print(f"\nSaved: {out_csv}")
    print(f"Saved: {out_json}")


if __name__ == "__main__":
    main()