"""Run the full pipeline + evaluations on OULAD (outputs to data_oulad/, models_oulad/).
Prereq: OULAD CSVs in ai_engine/data/external/oulad/.  Run from repo root:
  python scripts/run_oulad.py
"""
import os, sys, subprocess
os.environ["EDU_DATASET"] = "oulad"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

steps = [
    "ai_engine.src.prepare_oulad",
    "ai_engine.src.preprocessing",
    "ai_engine.src.train_model",
    "ai_engine.src.clustering_metrics",
    "ai_engine.src.ablation_study",
    "ai_engine.src.baseline_recommenders",
    "ai_engine.src.ablation_multiseed",
    "ai_engine.src.evaluate_fidelity",
]
for m in steps:
    print(f"\n===== {m} =====", flush=True)
    r = subprocess.run([sys.executable, "-m", m], env=os.environ)
    if r.returncode:
        sys.exit(f"FAILED at {m}")
