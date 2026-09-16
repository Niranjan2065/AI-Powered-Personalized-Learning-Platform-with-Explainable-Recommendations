"""
Step 5 — Train Recommendation Models
Trains:
  A) KMeans clustering   — groups students by learning profile
  B) NearestNeighbors    — collaborative filtering (similar students)

Run after preprocessing.py
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics import silhouette_score
import pickle
import os

from .feature_config import FEATURE_COLS
from .cf_utils import mean_center

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR   = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")

FEATURES_PATH     = os.path.join(PROC_DIR,   "student_features.csv")
CLEAN_DATA_PATH   = os.path.join(PROC_DIR,   "interactions_clean.csv")
CLUSTERED_PATH    = os.path.join(PROC_DIR,   "student_features_clustered.csv")
STM_PATH          = os.path.join(MODELS_DIR, "student_topic_matrix.csv")
KMEANS_PATH       = os.path.join(MODELS_DIR, "kmeans.pkl")
CF_MODEL_PATH     = os.path.join(MODELS_DIR, "cf_model.pkl")
CF_MODEL_CLUSTER_PATH = os.path.join(MODELS_DIR, "cf_model_by_cluster.pkl")


# ── A: Clustering ─────────────────────────────────────────────────────────────

def find_best_k(X, k_min=2, k_max=7):
    best_k, best_score = k_min, -1
    for k in range(k_min, min(k_max + 1, len(X))):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(X, labels)
        print(f"    k={k}  silhouette={score:.3f}")
        if score > best_score:
            best_score = score
            best_k = k
    return best_k, best_score


def train_clustering(student_features):
    X = student_features[FEATURE_COLS].values
    print("  Finding best number of clusters...")
    best_k, best_score = find_best_k(X)
    print(f"  → Best k={best_k}  (silhouette={best_score:.3f})")

    kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    student_features = student_features.copy()
    student_features["cluster"] = kmeans.fit_predict(X)

    cluster_summary = student_features.groupby("cluster")[FEATURE_COLS].mean().round(2)
    print("\n  Cluster summary (scaled means):")
    print(cluster_summary.to_string())
    return kmeans, student_features


# ── B: Collaborative filtering ────────────────────────────────────────────────

def build_student_topic_matrix(interactions_df):
    matrix = interactions_df.pivot_table(
        index="student_id",
        columns="topic_id",
        values="quiz_score",
        aggfunc="mean",
    ).fillna(0)
    print(f"\n  Student–topic matrix: {matrix.shape[0]} students × {matrix.shape[1]} topics")
    return matrix


def train_collaborative_filter(student_topic_matrix, n_neighbors=5):
    """Condition A (k-NN alone): one global neighbor model over all students,
    ignoring cluster membership. Fit on MEAN-CENTERED scores (each student's
    own average subtracted) so similarity reflects relative topic-level
    strengths/weaknesses rather than overall ability level -- see cf_utils.py
    for why this matters. Kept for backward compatibility and as the
    ablation baseline."""
    centered, _ = mean_center(student_topic_matrix)
    n = min(n_neighbors, len(student_topic_matrix))
    model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=n)
    model.fit(centered.values)
    print(f"  Collaborative filter trained on mean-centered scores (n_neighbors={n})")
    return model


def train_collaborative_filter_per_cluster(student_topic_matrix, student_clusters, n_neighbors=5):
    """Condition B (K-Means + k-NN, as described in the paper): fit a separate
    NearestNeighbors model per cluster, restricted to students in stm who
    belong to that cluster, on MEAN-CENTERED scores (see train_collaborative_filter).
    student_clusters: dict {student_id: cluster_id}.

    Returns: {cluster_id: {"model": NearestNeighbors, "student_ids": [...]}}
    Clusters with < 2 members in stm can't support in-cluster kNN; these are
    flagged with "model": None so callers can fall back to the global model.
    """
    centered, _ = mean_center(student_topic_matrix)
    models_by_cluster = {}
    stm_student_ids = set(student_topic_matrix.index)

    clusters_present = sorted(set(student_clusters.get(sid) for sid in stm_student_ids
                                   if sid in student_clusters))
    for cluster_id in clusters_present:
        member_ids = [sid for sid in student_topic_matrix.index
                      if student_clusters.get(sid) == cluster_id]
        if len(member_ids) < 2:
            models_by_cluster[cluster_id] = {"model": None, "student_ids": member_ids}
            print(f"  Cluster {cluster_id}: only {len(member_ids)} student(s) in "
                  f"interaction matrix — too few for in-cluster kNN, will fall back to global model")
            continue
        sub_matrix = centered.loc[member_ids]
        n = min(n_neighbors, len(member_ids))
        model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=n)
        model.fit(sub_matrix.values)
        models_by_cluster[cluster_id] = {"model": model, "student_ids": member_ids}
        print(f"  Cluster {cluster_id}: per-cluster collaborative filter trained on "
              f"mean-centered scores (n_students={len(member_ids)}, n_neighbors={n})")
    return models_by_cluster


# ── Main ──────────────────────────────────────────────────────────────────────

def train_and_save():
    print("\n[Training] Starting...\n")
    os.makedirs(MODELS_DIR, exist_ok=True)

    student_features = pd.read_csv(FEATURES_PATH)
    interactions_df  = pd.read_csv(CLEAN_DATA_PATH)

    print("Training KMeans clustering...")
    kmeans, student_features = train_clustering(student_features)

    print("\nBuilding student–topic matrix...")
    student_topic_matrix = build_student_topic_matrix(interactions_df)

    print("\nTraining collaborative filter (Condition A: k-NN alone, global)...")
    cf_model = train_collaborative_filter(student_topic_matrix)

    print("\nTraining per-cluster collaborative filter (Condition B: K-Means + k-NN)...")
    student_clusters = dict(zip(student_features["student_id"], student_features["cluster"]))
    cf_model_by_cluster = train_collaborative_filter_per_cluster(student_topic_matrix, student_clusters)

    # Save everything
    with open(KMEANS_PATH, "wb") as f:
        pickle.dump(kmeans, f)
    with open(CF_MODEL_PATH, "wb") as f:
        pickle.dump(cf_model, f)
    with open(CF_MODEL_CLUSTER_PATH, "wb") as f:
        pickle.dump(cf_model_by_cluster, f)
    student_topic_matrix.to_csv(STM_PATH)
    student_features.to_csv(CLUSTERED_PATH, index=False)

    print(f"\n  Saved: {KMEANS_PATH}")
    print(f"  Saved: {CF_MODEL_PATH}  (global k-NN)")
    print(f"  Saved: {CF_MODEL_CLUSTER_PATH}  (per-cluster k-NN)")
    print(f"  Saved: {STM_PATH}")
    print(f"  Saved: {CLUSTERED_PATH}")
    print("\n[Training] Done.\n")
    return kmeans, cf_model, cf_model_by_cluster, student_topic_matrix


if __name__ == "__main__":
    train_and_save()