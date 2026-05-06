"""
Step 6 — XAI: Explainability Module
Uses SHAP (KernelExplainer) and LIME (LimeTabularExplainer)
to explain WHY a student was assigned to a cluster /
why a recommendation was made.
"""

import pandas as pd
import numpy as np
import pickle
import os

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR   = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")

CLUSTERED_PATH = os.path.join(PROC_DIR,   "student_features_clustered.csv")
KMEANS_PATH    = os.path.join(MODELS_DIR, "kmeans.pkl")

FEATURE_COLS = [
    "avg_quiz_score",
    "avg_time_spent",
    "total_errors",
    "avg_accuracy",
    "avg_time_efficiency",
    "struggle_topics",
    "topics_attempted",
]
FEATURE_LABELS = [
    "Quiz score average",
    "Time spent average",
    "Total errors",
    "Accuracy rate",
    "Time efficiency",
    "Struggling topics",
    "Topics attempted",
]

_xai_cache = {}

def _load():
    if _xai_cache:
        return _xai_cache
    with open(KMEANS_PATH, "rb") as f:
        _xai_cache["kmeans"] = pickle.load(f)
    _xai_cache["sf"] = pd.read_csv(CLUSTERED_PATH)
    return _xai_cache


def _predict_fn(kmeans, X):
    """Soft cluster membership via inverse distance (pseudo-probability)."""
    dists  = kmeans.transform(X)
    scores = 1.0 / (dists + 1e-9)
    return scores / scores.sum(axis=1, keepdims=True)


def _extract_shap_vector(shap_values, cluster_id):
    """
    Normalise whatever shape shap_values has into a 1-D array
    of length n_features for the relevant cluster.

    Observed shapes from shap.KernelExplainer:
      - list of arrays  → one array per class, each (n_samples, n_features)
      - ndarray (1, n_features, n_classes)
      - ndarray (1, n_features)
      - ndarray (n_features,)
    """
    if isinstance(shap_values, list):
        idx = min(cluster_id, len(shap_values) - 1)
        sv  = np.array(shap_values[idx]).reshape(-1)
    else:
        sv = np.array(shap_values)
        if sv.ndim == 3:
            # (n_samples, n_features, n_classes)
            idx = min(cluster_id, sv.shape[2] - 1)
            sv  = sv[0, :, idx]
        elif sv.ndim == 2:
            sv = sv[0]
        # else already 1-D
    return sv.astype(float)


# ── SHAP ──────────────────────────────────────────────────────────────────────

def explain_with_shap(student_id, nsamples=100):
    try:
        import shap
    except ImportError:
        return {"error": "shap not installed. Run: pip install shap"}

    m = _load()
    kmeans, sf = m["kmeans"], m["sf"]
    X_all = sf[FEATURE_COLS].values

    student_row = sf[sf["student_id"] == student_id]
    if student_row.empty:
        return {"error": f"Student {student_id} not found."}

    student_X  = student_row[FEATURE_COLS].values
    cluster_id = int(kmeans.predict(student_X)[0])

    background = shap.sample(X_all, min(50, len(X_all)))

    def pf(x): return _predict_fn(kmeans, x)

    explainer   = shap.KernelExplainer(pf, background)
    shap_values = explainer.shap_values(student_X, nsamples=nsamples)

    sv = _extract_shap_vector(shap_values, cluster_id)

    contributions = {
        FEATURE_LABELS[i]: round(float(sv[i]), 4)
        for i in range(len(FEATURE_COLS))
    }
    # Sort by absolute importance
    contributions = dict(
        sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True)
    )

    return {
        "student_id":            student_id,
        "cluster":               cluster_id,
        "method":                "SHAP",
        "feature_contributions": contributions,
    }


# ── LIME ──────────────────────────────────────────────────────────────────────

def explain_with_lime(student_id, num_features=5):
    try:
        from lime.lime_tabular import LimeTabularExplainer
    except ImportError:
        return {"error": "lime not installed. Run: pip install lime"}

    m = _load()
    kmeans, sf = m["kmeans"], m["sf"]
    X_all = sf[FEATURE_COLS].values

    student_row = sf[sf["student_id"] == student_id]
    if student_row.empty:
        return {"error": f"Student {student_id} not found."}

    student_X  = student_row[FEATURE_COLS].values[0]
    cluster_id = int(kmeans.predict(student_X.reshape(1, -1))[0])

    def pf(x): return _predict_fn(kmeans, x)

    explainer = LimeTabularExplainer(
        training_data=X_all,
        feature_names=FEATURE_LABELS,
        mode="classification",
        discretize_continuous=True,
    )

    lime_exp = explainer.explain_instance(
        data_row=student_X,
        predict_fn=pf,
        num_features=num_features,
        labels=[cluster_id],
    )

    factors = [
        {"condition": cond, "weight": round(float(w), 4)}
        for cond, w in lime_exp.as_list(label=cluster_id)
    ]

    return {
        "student_id":   student_id,
        "cluster":      cluster_id,
        "method":       "LIME",
        "lime_factors": factors,
    }


if __name__ == "__main__":
    import json
    print("=== SHAP ===")
    print(json.dumps(explain_with_shap(student_id=1), indent=2))
    print("\n=== LIME ===")
    print(json.dumps(explain_with_lime(student_id=1), indent=2))
