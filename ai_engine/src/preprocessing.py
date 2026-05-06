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

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_PATH      = os.path.join(BASE_DIR, "data", "raw", "interactions.csv")
PROCESSED_DIR      = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR         = os.path.join(BASE_DIR, "models")
SCALER_PATH        = os.path.join(MODELS_DIR, "scaler.pkl")
FEATURES_OUT_PATH  = os.path.join(PROCESSED_DIR, "student_features.csv")
CLEAN_DATA_PATH    = os.path.join(PROCESSED_DIR, "interactions_clean.csv")

FEATURE_COLS = [
    "avg_quiz_score",
    "avg_time_spent",
    "total_errors",
    "avg_accuracy",
    "avg_time_efficiency",
    "struggle_topics",
    "topics_attempted",
]


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
    print("  Engineered features: accuracy_rate, time_efficiency, struggle_flag")
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
