import numpy as np, pandas as pd
from ai_engine.src.ablation_study import ndcg_at_k, get_eligible_students
from ai_engine.src.cf_utils import mean_center, reconstruct_scores


def test_ndcg():
    assert ndcg_at_k(1, 5) == 1.0
    assert ndcg_at_k(None, 5) == 0.0
    assert ndcg_at_k(6, 5) == 0.0
    assert np.isclose(ndcg_at_k(3, 5), 0.5)


def test_mean_center_preserves_sparsity():
    stm = pd.DataFrame({"a": [80, 0], "b": [60, 50]}, index=["s1", "s2"])
    c, m = mean_center(stm)
    assert m["s1"] == 70 and c.loc["s1", "a"] == 10
    assert c.loc["s2", "a"] == 0  # unattempted stays 0


def test_reconstruct():
    r = reconstruct_scores(pd.Series({"a": 5.0}), 70)
    assert r["a"] == 75


def test_eligibility():
    stm = pd.DataFrame({"a": [80, 50, 90], "b": [60, 40, 0]}, index=["x", "y", "z"])
    assert get_eligible_students(stm) == ["x"]  # y has no strong topic, z <2 attempts
