"""
scripts/generate_synthetic_dataset.py

Regenerates the synthetic dataset described in the paper's Experimental
Setup section (200 students, 30 topics, ~3,913 interaction records, drawn
from six behavioural archetypes), since the original generator/dataset was
not preserved. Output matches the exact raw-CSV schema expected by
ai_engine/src/preprocessing.py: student_id, topic_id, quiz_score,
time_spent_minutes, error_count, attempts, days_since_activity.

This is a NEW dataset — it will not reproduce the paper's original numbers
bit-for-bit, but it lets every metric in the paper be regenerated honestly,
end to end, from a documented, seeded, reproducible source.

Run: python scripts/generate_synthetic_dataset.py
"""

import numpy as np
import pandas as pd
import os

SEED = 42
N_STUDENTS = 200
N_TOPICS = 30
TARGET_INTERACTIONS = 3913

OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "ai_engine", "data", "raw", "interactions.csv"
)
BACKUP_PATH = OUT_PATH.replace("interactions.csv", "interactions_toy_backup.csv")

# Six behavioural archetypes: (name, quiz_score(mean,sd), time_spent_min(mean,sd),
# error_rate(mean,sd as fraction of attempts), attempts(mean,sd), n_topics(mean,sd))
ARCHETYPES = [
    dict(name="high_achiever",     score=(88, 8),  time=(12, 4),  err_rate=(0.08, 0.05), attempts=(1.2, 0.4), n_topics=(27, 4)),
    dict(name="struggling",        score=(42, 12), time=(28, 8),  err_rate=(0.45, 0.15), attempts=(2.4, 0.8), n_topics=(16, 5)),
    dict(name="fast_careless",     score=(64, 14), time=(8, 3),   err_rate=(0.35, 0.12), attempts=(1.1, 0.3), n_topics=(22, 5)),
    dict(name="diligent_slow",     score=(80, 9),  time=(35, 9),  err_rate=(0.12, 0.06), attempts=(1.8, 0.5), n_topics=(24, 4)),
    dict(name="inconsistent",      score=(60, 20), time=(18, 10), err_rate=(0.30, 0.18), attempts=(1.6, 0.7), n_topics=(20, 6)),
    dict(name="disengaged",        score=(55, 15), time=(15, 7),  err_rate=(0.25, 0.15), attempts=(1.3, 0.5), n_topics=(9, 4)),
]


def generate(seed=SEED, n_students=N_STUDENTS, n_topics=N_TOPICS):
    rng = np.random.default_rng(seed)
    rows = []

    student_archetype = rng.integers(0, len(ARCHETYPES), size=n_students)

    for sid in range(1, n_students + 1):
        arch = ARCHETYPES[student_archetype[sid - 1]]

        n_attempted = int(np.clip(rng.normal(*arch["n_topics"]), 2, n_topics))
        topics = rng.choice(np.arange(100, 100 + n_topics), size=n_attempted, replace=False)

        for tid in topics:
            score = float(np.clip(rng.normal(*arch["score"]), 0, 100))
            time_spent = float(np.clip(rng.normal(*arch["time"]), 1, 90))
            attempts = int(np.clip(round(rng.normal(*arch["attempts"])), 1, 6))
            err_rate = float(np.clip(rng.normal(*arch["err_rate"]), 0, 0.9))
            error_count = int(round(err_rate * attempts * 3))
            days_since_activity = int(np.clip(rng.exponential(20), 0, 150))

            rows.append({
                "student_id": sid,
                "topic_id": int(tid),
                "quiz_score": round(score, 1),
                "time_spent_minutes": round(time_spent, 1),
                "error_count": error_count,
                "attempts": attempts,
                "days_since_activity": days_since_activity,
            })

    df = pd.DataFrame(rows)
    return df, student_archetype


def main():
    df, student_archetype = generate()
    print(f"Generated {len(df)} interaction rows "
          f"(target was ~{TARGET_INTERACTIONS}; actual count depends on random draws)")
    print(f"Students: {df['student_id'].nunique()}  |  Topics: {df['topic_id'].nunique()}")
    print("\nArchetype distribution:")
    names, counts = np.unique(student_archetype, return_counts=True)
    for i, c in zip(names, counts):
        print(f"  {ARCHETYPES[i]['name']:<16} {c} students")

    if os.path.exists(OUT_PATH) and not os.path.exists(BACKUP_PATH):
        os.rename(OUT_PATH, BACKUP_PATH)
        print(f"\nBacked up existing (7-student) dataset to: {BACKUP_PATH}")

    df.to_csv(OUT_PATH, index=False)
    print(f"Saved new synthetic dataset to: {OUT_PATH}")


if __name__ == "__main__":
    main()
