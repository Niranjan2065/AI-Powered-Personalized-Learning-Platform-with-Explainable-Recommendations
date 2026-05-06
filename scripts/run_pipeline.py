"""
scripts/run_pipeline.py
Run this ONE script to execute the full AI pipeline in order:
  Step 4 → preprocessing
  Step 5 → train models
  Step 6 → test recommendations + XAI

Usage:
  cd ai_learning_platform
  python scripts/run_pipeline.py
"""

import sys
import os

# Make sure ai_engine is importable
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)


def separator(title):
    print("\n" + "=" * 55)
    print(f"  {title}")
    print("=" * 55)


def step4_preprocessing():
    separator("STEP 4 — Data Preprocessing & Feature Engineering")
    from ai_engine.src.preprocessing import run_preprocessing
    run_preprocessing()


def step5_training():
    separator("STEP 5 — Training AI Models")
    from ai_engine.src.train_model import train_and_save
    train_and_save()


def step6_test_recommendations():
    separator("STEP 5 (test) — Sample Recommendations")
    import json
    from ai_engine.src.recommend import get_recommendations
    for sid in [1, 2, 5]:
        result = get_recommendations(student_id=sid, top_n=3)
        print(f"\n  Student {sid}:")
        print(f"    Cluster:              {result.get('cluster')}")
        print(f"    Recommended topics:   {result.get('recommended_topics')}")
        print(f"    Weak topics:          {result.get('weak_topics')}")


def step6_test_xai():
    separator("STEP 6 — XAI: SHAP + LIME Explanations")
    import json
    from ai_engine.src.explain         import explain_with_shap, explain_with_lime
    from ai_engine.src.generate_reason import generate_recommendation_reason, generate_weak_topic_reason
    from ai_engine.src.recommend       import get_recommendations

    student_id = 1
    rec      = get_recommendations(student_id=student_id, top_n=3)
    shap_exp = explain_with_shap(student_id=student_id)

    print(f"\n  SHAP contributions for Student {student_id}:")
    for feat, val in shap_exp.get("feature_contributions", {}).items():
        bar = "+" * int(abs(val) * 20) if val >= 0 else "-" * int(abs(val) * 20)
        print(f"    {feat:<25} {val:+.4f}  {bar}")

    reason      = generate_recommendation_reason(shap_exp, rec["recommended_topics"])
    weak_reason = generate_weak_topic_reason(rec["weak_topics"])

    print(f"\n  Human-readable explanation:")
    print(f"    {reason}")
    if weak_reason:
        print(f"    {weak_reason}")

    print("\n  LIME explanation:")
    lime_exp = explain_with_lime(student_id=student_id)
    for factor in lime_exp.get("lime_factors", []):
        print(f"    {factor['condition']:<40}  weight={factor['weight']:+.4f}")


if __name__ == "__main__":
    print("\nAI Learning Platform — Full Pipeline Runner")
    step4_preprocessing()
    step5_training()
    step6_test_recommendations()
    step6_test_xai()
    separator("ALL STEPS COMPLETE")
    print("\n  Next: start the backend API with:")
    print("    cd backend && python app.py\n")
