"""
Step 4 — Data Preprocessing & Feature Engineering
Reads raw CSV from ai_engine/data/raw/interactions.csv
Outputs cleaned files to ai_engine/data/processed/
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import pickle
import os

from .feature_config import FEATURE_COLS

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_PATH      = os.path.join(BASE_DIR, "data", "raw", "interactions.csv")
PROCESSED_DIR      = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR         = os.path.join(BASE_DIR, "models")
SCALER_PATH        = os.path.join(MODELS_DIR, "scaler.pkl")
FEATURES_OUT_PATH  = os.path.join(PROCESSED_DIR, "student_features.csv")
CLEAN_DATA_PATH    = os.path.join(PROCESSED_DIR, "interactions_clean.csv")

# Days after which a topic's retention is considered to have decayed to
# ~37% (1/e) for a student with an average (50%) quiz score. Higher-scoring
# students decay slower, lower-scoring students decay faster — mirrors the
# ease-factor logic in backend/ai/forgettingCurve.js (score >= 80 -> ease
# 2.5 ... score < 40 -> ease 1.3), just expressed as a continuous half-life
# instead of four discrete buckets.
RETENTION_BASE_HALFLIFE_DAYS = 5.0


def load_raw_data(path=RAW_DATA_PATH):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Raw data not found at: {path}")
    df = pd.read_csv(path)
    print(f"  Loaded {len(df)} rows from {path}")
    return df


def clean_data(df):
    before = len(df)
    df = df.dropna(subset=["student_id", "topic_id"])
    numeric_cols = ["quiz_score", "time_spent_minutes", "error_count", "attempts"]
    for col in numeric_cols:
        if col not in df.columns:
            df[col] = 0
    df[numeric_cols] = df[numeric_cols].fillna(0)
    # Clamp scores to 0–100
    df["quiz_score"] = df["quiz_score"].clip(0, 100)
    df["attempts"]   = df["attempts"].clip(1, None)

    # days_since_activity is new (added by mlBridgeService.exportInteractionsCSV
    # for the retention-score feature). Older interactions.csv exports won't
    # have this column, so default to 0 (= "practiced today") rather than
    # error out — that's the conservative assumption and just means those
    # rows get zero decay penalty until the CSV is re-exported.
    if "days_since_activity" not in df.columns:
        df["days_since_activity"] = 0
    df["days_since_activity"] = df["days_since_activity"].fillna(0).clip(0, None)
    print(f"  Cleaned: {before} → {len(df)} rows")
    return df


def engineer_features(df):
    df = df.copy()
    df["accuracy_rate"] = df["quiz_score"] / df["attempts"]
    df["time_efficiency"] = df.apply(
        lambda r: r["quiz_score"] / r["time_spent_minutes"]
        if r["time_spent_minutes"] > 0 else 0,
        axis=1
    )
    # Struggle: error rate > 50 %
    df["struggle_flag"] = (
        df["error_count"] / (df["attempts"] + 1) > 0.5
    ).astype(int)

    # Retention score (recommendation-improvement item #3): Ebbinghaus
    # exponential decay, R = e^(-t / S), where t = days since last practice
    # and S = per-row stability derived from that row's own quiz score.
    # A student who scored well on a topic forgets it more slowly (larger
    # S -> slower decay) than one who scored poorly, matching the intuition
    # already encoded in forgettingCurve.js's four ease-factor buckets.
    # score 100 -> stability = 2x base halflife; score 0 -> 0.5x base.
    stability_days = RETENTION_BASE_HALFLIFE_DAYS * (0.5 + df["quiz_score"] / 100.0)
    df["retention_score"] = np.exp(-df["days_since_activity"] / stability_days)

    print("  Engineered features: accuracy_rate, time_efficiency, struggle_flag, retention_score")
    return df


def build_student_feature_matrix(df):
    agg = df.groupby("student_id").agg(
        avg_quiz_score      = ("quiz_score",        "mean"),
        avg_time_spent      = ("time_spent_minutes", "mean"),
        total_errors        = ("error_count",        "sum"),
        avg_accuracy        = ("accuracy_rate",      "mean"),
        avg_time_efficiency = ("time_efficiency",    "mean"),
        struggle_topics     = ("struggle_flag",      "sum"),
        topics_attempted    = ("topic_id",           "nunique"),
        avg_retention_score = ("retention_score",    "mean"),
    ).reset_index()
    print(f"  Built feature matrix: {len(agg)} students × {len(FEATURE_COLS)} features")
    return agg


def scale_features(feature_matrix):
    os.makedirs(MODELS_DIR, exist_ok=True)
    fm = feature_matrix.copy()
    scaler = StandardScaler()
    fm[FEATURE_COLS] = scaler.fit_transform(fm[FEATURE_COLS])
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    print(f"  Scaler saved → {SCALER_PATH}")
    return fm, scaler


def run_preprocessing():
    print("\n[Preprocessing] Starting...\n")
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)

    df = load_raw_data()
    df = clean_data(df)
    df = engineer_features(df)

    student_features = build_student_feature_matrix(df)
    student_features, scaler = scale_features(student_features)

    student_features.to_csv(FEATURES_OUT_PATH, index=False)
    df.to_csv(CLEAN_DATA_PATH, index=False)

    print(f"\n  Saved: {FEATURES_OUT_PATH}")
    print(f"  Saved: {CLEAN_DATA_PATH}")
    print("\n[Preprocessing] Done.\n")
    return student_features, df


if __name__ == "__main__":
    run_preprocessing()