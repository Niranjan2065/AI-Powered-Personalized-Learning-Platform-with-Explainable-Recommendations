"""
Step 5 (continued) — Recommendation Inference
Given a student_id, returns:
  - recommended_topics  (collaborative filter + cluster fallback)
  - weak_topics         (lowest-scored attempted topics)
  - cluster             (which learning group)
  - student_features    (their raw scaled feature values)
"""

import pandas as pd
import numpy as np
import pickle
import os

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR   = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")

CLUSTERED_PATH = os.path.join(PROC_DIR,   "student_features_clustered.csv")
STM_PATH       = os.path.join(MODELS_DIR, "student_topic_matrix.csv")
KMEANS_PATH    = os.path.join(MODELS_DIR, "kmeans.pkl")
CF_MODEL_PATH  = os.path.join(MODELS_DIR, "cf_model.pkl")
SCALER_PATH    = os.path.join(MODELS_DIR, "scaler.pkl")

FEATURE_COLS = [
    "avg_quiz_score",
    "avg_time_spent",
    "total_errors",
    "avg_accuracy",
    "avg_time_efficiency",
    "struggle_topics",
    "topics_attempted",
]

_cache = {}

def load_models():
    if _cache:
        return _cache
    with open(KMEANS_PATH,    "rb") as f: _cache["kmeans"]    = pickle.load(f)
    with open(CF_MODEL_PATH,  "rb") as f: _cache["cf_model"]  = pickle.load(f)
    with open(SCALER_PATH,    "rb") as f: _cache["scaler"]    = pickle.load(f)
    _cache["stm"] = pd.read_csv(STM_PATH, index_col="student_id")
    _cache["sf"]  = pd.read_csv(CLUSTERED_PATH)
    return _cache


def get_recommendations(student_id, top_n=5):
    m = load_models()
    kmeans, cf_model, stm, sf = m["kmeans"], m["cf_model"], m["stm"], m["sf"]

    student_row = sf[sf["student_id"] == student_id]
    if student_row.empty:
        return {"error": f"Student {student_id} not found in feature matrix."}

    X = student_row[FEATURE_COLS].values
    cluster_id = int(kmeans.predict(X)[0])

    # ── Collaborative filter ──────────────────────────────────────────────────
    if student_id in stm.index:
        student_vec = stm.loc[student_id].values.reshape(1, -1)
        n_neighbors = min(6, len(stm))
        distances, indices = cf_model.kneighbors(student_vec, n_neighbors=n_neighbors)
        similar_ids = stm.index[indices[0][1:]].tolist()   # exclude self

        # Topics done by this student (score > 0)
        done_topics = set(stm.loc[student_id][stm.loc[student_id] > 0].index)

        # Average scores of similar students, drop already-done topics
        candidate_scores = stm.loc[similar_ids].mean(axis=0)
        candidate_scores = candidate_scores.drop(index=list(done_topics), errors="ignore")
        recommended_topics = candidate_scores.nlargest(top_n).index.tolist()

        # Weak topics = attempted but scored lowest
        attempted = stm.loc[student_id][stm.loc[student_id] > 0]
        weak_topics = attempted.nsmallest(3).index.tolist()
    else:
        # ── Cold-start fallback: use cluster ─────────────────────────────────
        cluster_students = sf[sf["cluster"] == cluster_id]["student_id"].tolist()
        in_matrix = [s for s in cluster_students if s in stm.index]
        if in_matrix:
            cluster_scores    = stm.loc[in_matrix].mean(axis=0)
            recommended_topics = cluster_scores.nlargest(top_n).index.tolist()
        else:
            recommended_topics = stm.columns[:top_n].tolist()
        weak_topics = []

    return {
        "student_id":        student_id,
        "cluster":           cluster_id,
        "recommended_topics": [int(t) for t in recommended_topics],
        "weak_topics":        [int(t) for t in weak_topics],
        "student_features":  student_row[FEATURE_COLS].round(4).to_dict(orient="records")[0],
    }


if __name__ == "__main__":
    import json
    result = get_recommendations(student_id=1, top_n=5)
    print(json.dumps(result, indent=2))
