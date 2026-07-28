"""
Explainability (XAI) Evaluation Script
For a sample of students, runs both SHAP and LIME explanations of their
cluster assignment and measures:

  - Top-2 Feature Agreement: do SHAP and LIME agree on the top-2 most
    important features driving the cluster assignment?
  - Rank Correlation (Spearman): how similarly do SHAP and LIME rank
    all 7 features by importance?
  - Stability: re-running SHAP twice with different random samples,
    measuring rank correlation between the two runs (consistency check).

NOTE: This is slower (SHAP KernelExplainer is sampling-based), so we
evaluate on a random subset of students rather than all 200.

Run: python -m src.evaluate_explainability   (from ai_engine/ directory)
"""

import pandas as pd
import numpy as np
import pickle
import os
import json
from scipy.stats import spearmanr

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")

CLUSTERED_PATH = os.path.join(PROC_DIR, "student_features_clustered.csv")
KMEANS_PATH = os.path.join(MODELS_DIR, "kmeans.pkl")

FEATURE_COLS = [
    "avg_quiz_score", "avg_time_spent", "total_errors",
    "avg_accuracy", "avg_time_efficiency", "struggle_topics", "topics_attempted",
]
FEATURE_LABELS = [
    "Quiz score average", "Time spent average", "Total errors",
    "Accuracy rate", "Time efficiency", "Struggling topics", "Topics attempted",
]

SAMPLE_SIZE = 20
SEED = 42


def _predict_fn(kmeans, X):
    dists = kmeans.transform(X)
    scores = 1.0 / (dists + 1e-9)
    return scores / scores.sum(axis=1, keepdims=True)


def run_shap(kmeans, X_all, student_X, cluster_id, nsamples=100, seed=42):
    import shap
    rng_background = shap.sample(X_all, min(50, len(X_all)), random_state=seed)
    explainer = shap.KernelExplainer(lambda x: _predict_fn(kmeans, x), rng_background)
    shap_values = explainer.shap_values(student_X, nsamples=nsamples, silent=True)

    sv = np.array(shap_values)
    if sv.ndim == 3:
        idx = min(cluster_id, sv.shape[2] - 1)
        sv = sv[0, :, idx]
    elif sv.ndim == 2:
        sv = sv[0]
    return sv.astype(float)


def run_lime(kmeans, X_all, student_X_1d, cluster_id, num_features=7):
    from lime.lime_tabular import LimeTabularExplainer
    explainer = LimeTabularExplainer(
        training_data=X_all, feature_names=FEATURE_LABELS,
        mode="classification", discretize_continuous=True,
    )
    exp = explainer.explain_instance(
        data_row=student_X_1d, predict_fn=lambda x: _predict_fn(kmeans, x),
        num_features=num_features, labels=[cluster_id],
    )
    # Map back to FEATURE_LABELS order using the condition strings
    weights = {label: 0.0 for label in FEATURE_LABELS}
    for cond, w in exp.as_list(label=cluster_id):
        for label in FEATURE_LABELS:
            if label in cond:
                weights[label] = w
                break
    return np.array([weights[label] for label in FEATURE_LABELS])


def top_k_overlap(vec_a, vec_b, k=2):
    top_a = set(np.argsort(-np.abs(vec_a))[:k])
    top_b = set(np.argsort(-np.abs(vec_b))[:k])
    return len(top_a & top_b) / k


def main():
    sf = pd.read_csv(CLUSTERED_PATH)
    with open(KMEANS_PATH, "rb") as f:
        kmeans = pickle.load(f)

    X_all = sf[FEATURE_COLS].values
    rng = np.random.default_rng(SEED)
    sample_ids = rng.choice(sf["student_id"].values, size=min(SAMPLE_SIZE, len(sf)), replace=False)

    agreement_scores = []
    spearman_scores = []
    stability_scores = []

    print(f"Evaluating XAI agreement on {len(sample_ids)} sampled students...\n")

    for i, sid in enumerate(sample_ids, 1):
        row = sf[sf["student_id"] == sid]
        student_X = row[FEATURE_COLS].values
        student_X_1d = student_X[0]
        cluster_id = int(kmeans.predict(student_X)[0])

        shap_vec = run_shap(kmeans, X_all, student_X, cluster_id, seed=SEED)
        lime_vec = run_lime(kmeans, X_all, student_X_1d, cluster_id)

        agreement_scores.append(top_k_overlap(shap_vec, lime_vec, k=2))
        rho, _ = spearmanr(np.abs(shap_vec), np.abs(lime_vec))
        if not np.isnan(rho):
            spearman_scores.append(rho)

        # Stability: rerun SHAP with a different seed, compare rankings
        shap_vec_2 = run_shap(kmeans, X_all, student_X, cluster_id, seed=SEED + 100)
        rho_stab, _ = spearmanr(np.abs(shap_vec), np.abs(shap_vec_2))
        if not np.isnan(rho_stab):
            stability_scores.append(rho_stab)

        print(f"  [{i}/{len(sample_ids)}] student {sid}: "
              f"top-2 agreement={agreement_scores[-1]:.2f}, "
              f"SHAP-LIME rho={rho:.2f}, SHAP stability rho={rho_stab:.2f}")

    summary = {
        "n_students_sampled": int(len(sample_ids)),
        "mean_top2_feature_agreement": round(float(np.mean(agreement_scores)), 4),
        "mean_shap_lime_spearman": round(float(np.mean(spearman_scores)), 4),
        "mean_shap_stability_spearman": round(float(np.mean(stability_scores)), 4),
    }

    print("\nExplainability Evaluation Summary (for IEEE paper):\n")
    for k, v in summary.items():
        print(f"  {k}: {v}")

    out_json = os.path.join(PROC_DIR, "explainability_metrics.json")
    with open(out_json, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nSaved metrics JSON to: {out_json}")


if __name__ == "__main__":
    main()
