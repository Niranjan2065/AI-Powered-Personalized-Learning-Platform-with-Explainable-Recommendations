"""
ai_engine/src/feature_config.py
─────────────────────────────────────────────────────────────────────────────
Single source of truth for the student feature vector used by every part
of the ML pipeline (preprocessing, training, inference, and both XAI
explainers).

Before this file existed, FEATURE_COLS was copy-pasted independently into
preprocessing.py, train_model.py, recommend.py, explain.py,
evaluate_explainability.py and clustering_metrics.py. Six copies that all
have to be edited in lockstep any time a feature is added or removed —
easy to miss one and get a silent shape-mismatch bug (e.g. KMeans trained
on 8 columns but SHAP explaining only 7). Everything now imports from here.

avg_retention_score is new (recommendation-improvement item #3):
an Ebbinghaus-forgetting-curve-based recency signal. It answers "how
likely is this student to still remember what they studied?", not just
"how well did they score?" — the same idea already used by the JS
spaced-repetition scheduler in backend/ai/forgettingCurve.js, now folded
into the clustering/collaborative-filtering feature space too. See
engineer_features() in preprocessing.py for the actual decay formula.
"""

FEATURE_COLS = [
    "avg_quiz_score",
    "avg_time_spent",
    "total_errors",
    "avg_accuracy",
    "avg_time_efficiency",
    "struggle_topics",
    "topics_attempted",
    "avg_retention_score",
]

# Human-readable labels, same order as FEATURE_COLS — used by the SHAP/LIME
# explainers when presenting feature contributions to students.
FEATURE_LABELS = [
    "Quiz score average",
    "Time spent average",
    "Total errors",
    "Accuracy rate",
    "Time efficiency",
    "Struggling topics",
    "Topics attempted",
    "Retention score (forgetting curve)",
]