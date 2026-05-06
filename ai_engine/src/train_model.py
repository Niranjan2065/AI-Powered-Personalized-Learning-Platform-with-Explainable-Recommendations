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

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR   = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")

FEATURES_PATH     = os.path.join(PROC_DIR,   "student_features.csv")
CLEAN_DATA_PATH   = os.path.join(PROC_DIR,   "interactions_clean.csv")
CLUSTERED_PATH    = os.path.join(PROC_DIR,   "student_features_clustered.csv")
STM_PATH          = os.path.join(MODELS_DIR, "student_topic_matrix.csv")
KMEANS_PATH       = os.path.join(MODELS_DIR, "kmeans.pkl")
CF_MODEL_PATH     = os.path.join(MODELS_DIR, "cf_model.pkl")

FEATURE_COLS = [
    "avg_quiz_score",
    "avg_time_spent",
    "total_errors",
    "avg_accuracy",
    "avg_time_efficiency",
    "struggle_topics",
    "topics_attempted",
]


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
    n = min(n_neighbors, len(student_topic_matrix))
    model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=n)
    model.fit(student_topic_matrix.values)
    print(f"  Collaborative filter trained (n_neighbors={n})")
    return model


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

    print("\nTraining collaborative filter...")
    cf_model = train_collaborative_filter(student_topic_matrix)

    # Save everything
    with open(KMEANS_PATH, "wb") as f:
        pickle.dump(kmeans, f)
    with open(CF_MODEL_PATH, "wb") as f:
        pickle.dump(cf_model, f)
    student_topic_matrix.to_csv(STM_PATH)
    student_features.to_csv(CLUSTERED_PATH, index=False)

    print(f"\n  Saved: {KMEANS_PATH}")
    print(f"  Saved: {CF_MODEL_PATH}")
    print(f"  Saved: {STM_PATH}")
    print(f"  Saved: {CLUSTERED_PATH}")
    print("\n[Training] Done.\n")
    return kmeans, cf_model, student_topic_matrix


if __name__ == "__main__":
    train_and_save()
