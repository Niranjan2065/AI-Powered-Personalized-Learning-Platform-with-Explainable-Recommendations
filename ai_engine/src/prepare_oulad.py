
"""
Adapter: OULAD -> the pipeline's interactions.csv (one module-presentation).

Mapping (proxies are explicit; state them in the paper):
  student_id           <- id_student
  topic_id             <- id_assessment (TMA/CMA only; the final exam is excluded)
  quiz_score           <- studentAssessment.score        (real)
  attempts             <- 1 + studentInfo.num_of_prev_attempts   (real, module level)
  time_spent_minutes   <- VLE clicks in the 14 days before the deadline (PROXY, 1 click = 1 unit)
  days_since_activity  <- days from the last VLE click to the deadline (real, clipped at 0)
  error_count          <- round((100 - score) / 20), range 0-5   (PROXY derived from score)

Usage (from repo root):
  python -m ai_engine.src.prepare_oulad [--module FFF --presentation 2014J]
Default: the module-presentation with the most students who have scores.
Output: ai_engine/data_oulad/raw/interactions.csv
"""

import argparse, os
import numpy as np, pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "data", "external", "oulad")
OUT = os.path.join(BASE, "data_oulad", "raw")
WINDOW = 14

def main(module=None, presentation=None, min_assess=3):
    ass = pd.read_csv(os.path.join(SRC, "assessments.csv"))
    sa = pd.read_csv(os.path.join(SRC, "studentAssessment.csv"))
    info = pd.read_csv(os.path.join(SRC, "studentInfo.csv"))

    # FIX: Convert assessment dates and scores to numeric values.
    ass["date"] = pd.to_numeric(ass["date"], errors="coerce")
    sa["score"] = pd.to_numeric(sa["score"], errors="coerce")

    ass = ass[ass.assessment_type.isin(["TMA", "CMA"]) & ass.date.notna()]
    sa = sa.merge(ass, on="id_assessment").dropna(subset=["score"])

    if module is None:
        cnt = sa.groupby(["code_module", "code_presentation"]).id_student.nunique()
        nass = ass.groupby(["code_module", "code_presentation"]).id_assessment.nunique()
        cnt = cnt[nass.reindex(cnt.index).fillna(0) >= min_assess]

        if cnt.empty:
            raise ValueError("No module-presentation found with enough scored assessments.")

        module, presentation = cnt.idxmax()
        print(f"Auto-selected {module} {presentation} ({cnt.max()} students)")

    sa = sa[(sa.code_module == module) & (sa.code_presentation == presentation)]

    if sa.empty:
        raise ValueError(f"No scored assessments found for {module} {presentation}.")

    vle_cols = ["code_module", "code_presentation", "id_student", "date", "sum_click"]
    parts = []

    for ch in pd.read_csv(os.path.join(SRC, "studentVle.csv"), usecols=vle_cols, chunksize=2_000_000):
        parts.append(ch[(ch.code_module == module) & (ch.code_presentation == presentation)])

    vle = pd.concat(parts).groupby(["id_student", "date"], as_index=False).sum_click.sum()

    # FIX: Ensure VLE dates and click counts are numeric.
    vle["date"] = pd.to_numeric(vle["date"], errors="coerce")
    vle["sum_click"] = pd.to_numeric(vle["sum_click"], errors="coerce")
    vle = vle.dropna(subset=["date", "sum_click"])

    print(f"VLE daily rows: {len(vle)}")

    m = sa[["id_student", "id_assessment", "score", "date"]].rename(columns={"date": "due"})

    # FIX: Explicitly convert both date columns to numeric before comparison.
    m["due"] = pd.to_numeric(m["due"], errors="coerce")
    vle["date"] = pd.to_numeric(vle["date"], errors="coerce")

    j = m.merge(vle, on="id_student", how="left")

    # FIX: Compare numeric date values and ignore missing VLE dates.
    j = j[j.date.notna() & j.due.notna()]
    j = j[j.date <= j.due]

    last = j.groupby(["id_student", "id_assessment"]).date.max().rename("last_date")
    win = j[j.date > j.due - WINDOW].groupby(["id_student", "id_assessment"]).sum_click.sum().rename("clicks")

    m = m.join(last, on=["id_student", "id_assessment"]).join(win, on=["id_student", "id_assessment"])

    prev = info[(info.code_module == module) & (info.code_presentation == presentation)] \
        .drop_duplicates("id_student").set_index("id_student").num_of_prev_attempts

    out = pd.DataFrame({
        "student_id": m.id_student,
        "topic_id": m.id_assessment,
        "quiz_score": m.score.clip(0, 100),
        "time_spent_minutes": m.clicks.fillna(0).astype(float),
        "error_count": ((100 - m.score.clip(0, 100)) / 20).round().clip(0, 5).astype(int),
        "attempts": 1 + m.id_student.map(prev).fillna(0).astype(int),
        "days_since_activity": (m.due - m.last_date).fillna(WINDOW).clip(lower=0),
    })

    os.makedirs(OUT, exist_ok=True)
    out.to_csv(os.path.join(OUT, "interactions.csv"), index=False)

    print(f"Saved {len(out)} rows | {out.student_id.nunique()} students | "
          f"{out.topic_id.nunique()} topics -> {OUT}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--module")
    ap.add_argument("--presentation")
    a = ap.parse_args()
    main(a.module, a.presentation)