"""
Multi-seed ablation: k-NN alone (A) vs K-Means + k-NN (B).
The seed controls which strong topic is held out per student, so repeating
over seeds measures sensitivity to that choice. Reports mean ± std per metric,
a paired Wilcoxon test on per-student Recall@10 averaged over seeds, and a
95% bootstrap CI for the A-B difference.

Run: python -m ai_engine.src.ablation_multiseed [--seeds 20]
"""
import argparse, json, pickle
import numpy as np, pandas as pd
from scipy.stats import wilcoxon

from .ablation_study import (SIG_K, STM_PATH, CF_MODEL_PATH, CF_MODEL_CLUSTER_PATH,
                             CLUSTERED_PATH, PROC_DIR, K_VALUES, evaluate,
                             neighbors_condition_a, neighbors_condition_b)
import os

METRICS = ["Precision@K", "Recall@K", "NDCG@K"]


def main(n_seeds):
    stm = pd.read_csv(STM_PATH, index_col="student_id")
    sf = pd.read_csv(CLUSTERED_PATH)
    cluster = dict(zip(sf["student_id"], sf["cluster"]))
    cf = pickle.load(open(CF_MODEL_PATH, "rb"))
    cf_c = pickle.load(open(CF_MODEL_CLUSTER_PATH, "rb"))

    fn_a = lambda sid, mr, mrc, n: (neighbors_condition_a(stm, None, cf, mr, mrc, sid, n), False)
    fn_b = lambda sid, mr, mrc, n: neighbors_condition_b(stm, None, cf_c, cluster, mr, mrc, sid, n, cf)

    rows, r10 = [], {"A": [], "B": []}
    for seed in range(n_seeds):
        for cond, fn in (("A", fn_a), ("B", fn_b)):
            summ, _, _, _, per = evaluate(stm, fn, seed=seed)
            for s in summ:
                rows.append({"seed": seed, "cond": cond, **s})
            r10[cond].append(pd.Series(per))
    df = pd.DataFrame(rows)

    out = {}
    print(f"{n_seeds} seeds | {df.n_students_evaluated.iloc[0]} eligible students\n")
    for k in K_VALUES:
        for m in METRICS:
            a = df[(df.cond == "A") & (df.K == k)][m]
            b = df[(df.cond == "B") & (df.K == k)][m]
            out[f"{m[:-2]}@{k}"] = {"A_mean": a.mean(), "A_std": a.std(), "B_mean": b.mean(), "B_std": b.std()}
            print(f"{m[:-2]}@{k:<2} A {a.mean():.4f}±{a.std():.4f} | B {b.mean():.4f}±{b.std():.4f}")

    pa = pd.concat(r10["A"], axis=1).mean(axis=1)
    pb = pd.concat(r10["B"], axis=1).mean(axis=1)
    d = (pa - pb).values
    rng = np.random.default_rng(0)
    boots = [rng.choice(d, len(d)).mean() for _ in range(5000)]
    ci = np.percentile(boots, [2.5, 97.5])
    p = 1.0 if np.all(d == 0) else wilcoxon(pa, pb).pvalue
    print(f"\nRecall@{SIG_K} A-B diff: {d.mean():+.4f}  95% CI [{ci[0]:+.4f}, {ci[1]:+.4f}]  Wilcoxon p={p:.4f}")
    out[f"recall{SIG_K}_diff"] = {"mean": d.mean(), "ci95": ci.tolist(), "wilcoxon_p": float(p), "n_students": len(d)}

    df.to_csv(os.path.join(PROC_DIR, "ablation_multiseed.csv"), index=False)
    with open(os.path.join(PROC_DIR, "ablation_multiseed.json"), "w") as f:
        json.dump(out, f, indent=2, default=float)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--seeds", type=int, default=20)
    main(ap.parse_args().seeds)
