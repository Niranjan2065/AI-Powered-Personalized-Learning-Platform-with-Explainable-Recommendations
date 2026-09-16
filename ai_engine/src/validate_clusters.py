"""
ai_engine/src/validate_clusters.py

Reviewer 2: "Since the true generating groups are known, the authors have
an opportunity to provide a stronger clustering validation using measures
such as Adjusted Rand Index or Normalized Mutual Information. A contingency
matrix between generated archetypes and discovered clusters would also help
establish whether K-Means actually recovers meaningful behavioral structure."

Run: python -m ai_engine.src.validate_clusters
"""

import pandas as pd
import numpy as np
import os
import json
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROC_DIR = os.path.join(BASE_DIR, "data", "processed")

ARCHETYPE_PATH = os.path.join(RAW_DIR, "student_archetypes_ground_truth.csv")
CLUSTERED_PATH = os.path.join(PROC_DIR, "student_features_clustered.csv")


def main():
    truth = pd.read_csv(ARCHETYPE_PATH)
    clustered = pd.read_csv(CLUSTERED_PATH)

    merged = truth.merge(clustered[["student_id", "cluster"]], on="student_id", how="inner")
    print(f"Matched {len(merged)} / {len(truth)} students between ground truth and cluster assignments\n")

    y_true = merged["archetype_name"].values
    y_pred = merged["cluster"].values

    ari = adjusted_rand_score(y_true, y_pred)
    nmi = normalized_mutual_info_score(y_true, y_pred)

    print(f"Adjusted Rand Index (ARI):            {ari:.4f}")
    print(f"Normalized Mutual Information (NMI):  {nmi:.4f}\n")

    # Contingency matrix: rows = ground-truth archetype, columns = discovered cluster
    contingency = pd.crosstab(merged["archetype_name"], merged["cluster"])
    print("Contingency matrix (rows = archetype, columns = K-Means cluster):")
    print(contingency.to_string())
    print()

    # Purity: for each discovered cluster, what fraction belongs to its dominant archetype
    cluster_purity = {}
    for c in sorted(merged["cluster"].unique()):
        sub = merged[merged["cluster"] == c]
        dominant = sub["archetype_name"].value_counts()
        purity = dominant.iloc[0] / len(sub)
        cluster_purity[int(c)] = {
            "n_students": len(sub),
            "dominant_archetype": dominant.index[0],
            "purity": round(float(purity), 4),
        }
        print(f"  Cluster {c}: n={len(sub)}, dominant archetype = '{dominant.index[0]}' "
              f"({dominant.iloc[0]}/{len(sub)} = {purity:.1%} purity)")

    overall_purity = sum(v["n_students"] * v["purity"] for v in cluster_purity.values()) / len(merged)
    print(f"\nOverall weighted purity: {overall_purity:.4f}")

    out = {
        "n_students_matched": len(merged),
        "adjusted_rand_index": round(float(ari), 4),
        "normalized_mutual_info": round(float(nmi), 4),
        "overall_weighted_purity": round(float(overall_purity), 4),
        "contingency_matrix": contingency.to_dict(),
        "cluster_purity": cluster_purity,
    }
    out_path = os.path.join(PROC_DIR, "cluster_validation_metrics.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    contingency.to_csv(os.path.join(PROC_DIR, "cluster_contingency_matrix.csv"))
    print(f"\nSaved: {out_path}")
    print(f"Saved: {os.path.join(PROC_DIR, 'cluster_contingency_matrix.csv')}")


if __name__ == "__main__":
    main()
