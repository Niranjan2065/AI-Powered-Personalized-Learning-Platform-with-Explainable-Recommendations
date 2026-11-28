"""Run from repo root: python apply_fix.py
Makes K values and the significance-test K dataset-aware (OULAD has only ~8 topics)."""
import os
d = "ai_engine/src/"
for f in ["ablation_study.py", "baseline_recommenders.py", "evaluate_recommendations.py"]:
    s = open(d + f, encoding="utf-8").read()
    if "SIG_K" not in s:
        s = s.replace("K_VALUES = [3, 5, 10]",
            "K_VALUES = [3, 5, 10] if not _DS else [1, 2, 3]  # OULAD has only ~8 topics\n"
            "SIG_K = 10 if not _DS else 2  # K used for the paired significance test", 1)
    if f == "ablation_study.py":
        s = s.replace("1 if held_out_topic in ranked[:10] else 0", "1 if held_out_topic in ranked[:SIG_K] else 0")
    open(d + f, "w", encoding="utf-8").write(s)
f = d + "ablation_multiseed.py"
m = open(f, encoding="utf-8").read()
if "SIG_K, " not in m:
    m = m.replace("from .ablation_study import (", "from .ablation_study import (SIG_K, ")
    m = m.replace("Recall@10 A-B diff", "Recall@{SIG_K} A-B diff").replace('"recall10_diff"', 'f"recall{SIG_K}_diff"')
open(f, "w", encoding="utf-8").write(m)
print("done")
