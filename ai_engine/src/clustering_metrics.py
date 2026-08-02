"""
Clustering Evaluation Script
Computes Silhouette Score, Davies-Bouldin Index, and Inertia for k=2..7
on the student feature matrix, so results can be reported in a paper.

Run: python -m src.clustering_metrics   (from ai_engine/ directory)
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
import os
import json

from .feature_config import FEATURE_COLS

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEATURES_PATH = os.path.join(BASE_DIR, "data", "processed", "student_features.csv")


def evaluate_k_range(X, k_min=2, k_max=7, seed=42):
    results = []
    for k in range(k_min, k_max + 1):
        km = KMeans(n_clusters=k, random_state=seed, n_init=10)
        labels = km.fit_predict(X)
        if len(set(labels)) < 2:
            continue
        sil = silhouette_score(X, labels)
        db = davies_bouldin_score(X, labels)
        ch = calinski_harabasz_score(X, labels)
        results.append({
            "k": k,
            "silhouette_score": round(float(sil), 4),
            "davies_bouldin_index": round(float(db), 4),
            "calinski_harabasz_score": round(float(ch), 2),
            "inertia": round(float(km.inertia_), 2),
        })
    return results


def main():
    sf = pd.read_csv(FEATURES_PATH)
    X = sf[FEATURE_COLS].values
    print(f"Loaded feature matrix: {X.shape[0]} students x {X.shape[1]} features\n")

    results = evaluate_k_range(X)

    df = pd.DataFrame(results)
    print("Clustering Evaluation Table (for IEEE paper):\n")
    print(df.to_string(index=False))

    best_row = df.loc[df["silhouette_score"].idxmax()]
    print(f"\nBest k by Silhouette Score: k={int(best_row['k'])} "
          f"(silhouette={best_row['silhouette_score']}, "
          f"Davies-Bouldin={best_row['davies_bouldin_index']})")

    out_csv = os.path.join(BASE_DIR, "data", "processed", "clustering_metrics.csv")
    df.to_csv(out_csv, index=False)
    print(f"\nSaved metrics table to: {out_csv}")

    out_json = os.path.join(BASE_DIR, "data", "processed", "clustering_metrics.json")
    with open(out_json, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Saved metrics JSON to: {out_json}")


if __name__ == "__main__":
    main()