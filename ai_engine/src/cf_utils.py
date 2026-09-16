"""
ai_engine/src/cf_utils.py

Shared collaborative-filtering utilities. Diagnostic testing (see
baseline_recommenders.py results and the paper's Discussion section)
showed that raw-score k-NN similarity is dominated by each student's
overall ability level, making it barely distinguishable from a simple
popularity baseline: two students who are both generally strong (or both
generally weak) look "similar" even if they have no shared topic-level
strengths or weaknesses. Mean-centering each student's scores before
computing similarity removes this global-ability bias and lets k-NN
find students who share a topic-level PROFILE (relatively better/worse
at specific topics), which is the actual premise of collaborative
filtering and is what should differentiate it from popularity ranking.
"""

import pandas as pd


def mean_center(stm: pd.DataFrame):
    """Returns (centered_matrix, student_means). Only attempted topics
    (score > 0) contribute to a student's mean; unattempted topics are 0
    in both the input and the centered output, so sparsity is preserved."""
    attempted_mask = stm > 0
    student_means = stm.where(attempted_mask).mean(axis=1).fillna(0)
    centered = stm.sub(student_means, axis=0).where(attempted_mask, 0)
    return centered, student_means


def reconstruct_scores(neighbor_residuals: pd.Series, student_mean: float) -> pd.Series:
    """Adds a student's own mean back to neighbour-averaged residuals to
    get predicted absolute scores for ranking candidate topics."""
    return neighbor_residuals + student_mean
