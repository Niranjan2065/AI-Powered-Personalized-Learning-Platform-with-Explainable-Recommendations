"""
scripts/generate_synthetic_dataset_v2.py

v2: adds genuine topic-level structure so collaborative filtering has real
signal to exploit, not just global per-student ability. v1 drew each
student's score from the SAME archetype distribution regardless of which
topic it was, so a student's performance carried no information about
WHICH topics they were relatively strong/weak at beyond their overall
archetype-level ability. Popularity and random baselines were then
essentially unbeatable, because there was nothing "personal" to recommend.

v2 groups the 30 topics into 6 topic categories (5 topics each) and gives
each of the 6 behavioural archetypes a distinct affinity profile across
categories (some archetypes are relatively stronger/weaker in certain
categories, on top of their overall ability level and behavioural
signature). This creates real student-topic interaction structure: two
students in the same archetype will still correlate strongly in which
topics they do relatively well/poorly on, which is exactly the structure
k-NN collaborative filtering is designed to exploit and that a
popularity-only or random baseline cannot.

Run: python scripts/generate_synthetic_dataset_v2.py
"""

import numpy as np
import pandas as pd
import os

SEED = 42
N_STUDENTS = 200
N_TOPICS = 30
N_CATEGORIES = 6
TOPICS_PER_CATEGORY = N_TOPICS // N_CATEGORIES

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ai_engine", "data", "raw")
OUT_PATH = os.path.join(OUT_DIR, "interactions.csv")
ARCHETYPE_PATH = os.path.join(OUT_DIR, "student_archetypes_ground_truth.csv")
TOPIC_CATEGORY_PATH = os.path.join(OUT_DIR, "topic_categories.csv")

# Base archetype parameters (same behavioural signature as v1), PLUS a
# per-category affinity vector (additive shift to quiz_score, in points,
# for each of the 6 topic categories). Affinities are asymmetric by design
# (each archetype has 1-2 relative strengths and 1-2 relative weaknesses)
# so that behaviourally similar students share a distinctive topic profile.
ARCHETYPES = [
    dict(name="high_achiever", score=(82, 6), time=(12, 4), err_rate=(0.08, 0.05),
         attempts=(1.2, 0.4), n_topics=(27, 4),
         affinity=[+6, +2, -4, +4, -2, -6]),   # strong in cat0,cat3; weak in cat2,cat5
    dict(name="struggling", score=(48, 10), time=(28, 8), err_rate=(0.45, 0.15),
         attempts=(2.4, 0.8), n_topics=(16, 5),
         affinity=[-2, +5, +5, -6, -4, +2]),    # strong in cat1,cat2; weak in cat3,cat4
    dict(name="fast_careless", score=(62, 12), time=(8, 3), err_rate=(0.35, 0.12),
         attempts=(1.1, 0.3), n_topics=(22, 5),
         affinity=[+5, -5, +2, -2, +6, -6]),    # strong in cat0,cat4; weak in cat1,cat5
    dict(name="diligent_slow", score=(74, 7), time=(35, 9), err_rate=(0.12, 0.06),
         attempts=(1.8, 0.5), n_topics=(24, 4),
         affinity=[-4, +6, -2, +5, +2, -5]),    # strong in cat1,cat3; weak in cat0,cat5
    dict(name="inconsistent", score=(58, 15), time=(18, 10), err_rate=(0.30, 0.18),
         attempts=(1.6, 0.7), n_topics=(20, 6),
         affinity=[+3, -3, +6, -5, -3, +4]),    # strong in cat2,cat5; weak in cat1,cat3
    dict(name="disengaged", score=(52, 12), time=(15, 7), err_rate=(0.25, 0.15),
         attempts=(1.3, 0.5), n_topics=(9, 4),
         affinity=[-5, -2, +3, +2, +5, -3]),    # strong in cat3,cat4; weak in cat0,cat5
]


def generate(seed=SEED, n_students=N_STUDENTS, n_topics=N_TOPICS):
    rng = np.random.default_rng(seed)
    rows = []

    topic_ids = np.arange(100, 100 + n_topics)
    topic_category = {tid: (i // TOPICS_PER_CATEGORY) for i, tid in enumerate(topic_ids)}

    student_archetype = rng.integers(0, len(ARCHETYPES), size=n_students)

    for sid in range(1, n_students + 1):
        arch = ARCHETYPES[student_archetype[sid - 1]]

        n_attempted = int(np.clip(rng.normal(*arch["n_topics"]), 2, n_topics))
        topics = rng.choice(topic_ids, size=n_attempted, replace=False)

        # small individual-level (student-specific, not just archetype-specific)
        # affinity jitter, so students in the same archetype aren't IDENTICAL
        # but remain correlated -- this is what makes clustering non-trivial too
        individual_affinity_jitter = rng.normal(0, 2.5, size=N_CATEGORIES)

        for tid in topics:
            cat = topic_category[tid]
            category_shift = arch["affinity"][cat] + individual_affinity_jitter[cat]

            score = float(np.clip(rng.normal(arch["score"][0] + category_shift, arch["score"][1]), 0, 100))
            time_spent = float(np.clip(rng.normal(*arch["time"]), 1, 90))
            attempts = int(np.clip(round(rng.normal(*arch["attempts"])), 1, 6))
            err_rate = float(np.clip(rng.normal(*arch["err_rate"]), 0, 0.9))
            error_count = int(round(err_rate * attempts * 3))
            days_since_activity = int(np.clip(rng.exponential(20), 0, 150))

            rows.append({
                "student_id": sid, "topic_id": int(tid), "quiz_score": round(score, 1),
                "time_spent_minutes": round(time_spent, 1), "error_count": error_count,
                "attempts": attempts, "days_since_activity": days_since_activity,
            })

    df = pd.DataFrame(rows)
    topic_cat_df = pd.DataFrame({"topic_id": topic_ids, "category": [topic_category[t] for t in topic_ids]})
    return df, student_archetype, topic_cat_df


def main():
    df, student_archetype, topic_cat_df = generate()
    print(f"Generated {len(df)} interaction rows")
    print(f"Students: {df['student_id'].nunique()}  |  Topics: {df['topic_id'].nunique()}  "
          f"|  Categories: {N_CATEGORIES} ({TOPICS_PER_CATEGORY} topics each)")

    df.to_csv(OUT_PATH, index=False)
    print(f"Saved: {OUT_PATH}")

    archetype_df = pd.DataFrame({
        "student_id": np.arange(1, len(student_archetype) + 1),
        "archetype_id": student_archetype,
        "archetype_name": [ARCHETYPES[i]["name"] for i in student_archetype],
    })
    archetype_df.to_csv(ARCHETYPE_PATH, index=False)
    print(f"Saved: {ARCHETYPE_PATH}")

    topic_cat_df.to_csv(TOPIC_CATEGORY_PATH, index=False)
    print(f"Saved: {TOPIC_CATEGORY_PATH}")


if __name__ == "__main__":
    main()
