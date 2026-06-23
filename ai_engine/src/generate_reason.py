"""
ai_engine/src/generate_reason.py
----------------------------------
Human-readable reason generator for the AI Learning Platform.

Contains ALL three functions needed by the project:
  - generate_xai_reason()              used by new /api/students/ routes
  - generate_recommendation_reason()   used by original /api/recommendations/ route
  - generate_weak_topic_reason()       used by original /api/recommendations/ route
"""

import statistics
from dataclasses import dataclass
from typing import Optional


# ── Shared REASON_MAP (used by both old and new functions) ────────────────────

REASON_MAP = {
    "Quiz score average":  ("your quiz scores in this area are below average",
                            "your quiz scores show you are ready to advance"),
    "Total errors":        ("you have made frequent errors on related problems",
                            "you have been making very few mistakes recently"),
    "Struggling topics":   ("you are currently struggling with several related topics",
                            "you have already mastered several similar topics"),
    "Accuracy rate":       ("your accuracy needs improvement in this area",
                            "your accuracy is strong and you can go deeper"),
    "Time efficiency":     ("you are spending a lot of time on similar problems",
                            "you complete similar topics efficiently"),
    "Topics attempted":    ("you have not explored many topics in this area yet",
                            "you have covered many topics and this is a natural next step"),
    "Time spent average":  ("you tend to spend extra time on this type of content",
                            "you work through this content quickly"),
}


# ── SHAP feature → plain-English error phrase mapping ─────────────────────────

FEATURE_PHRASES = {
    "error_rate_pointer":     lambda v: "pointer manipulation errors",
    "error_rate_deletion":    lambda v: "mistakes when deleting nodes",
    "error_rate_loop":        lambda v: "loop or traversal logic errors",
    "error_rate_base_case":   lambda v: "missing or incorrect base cases",
    "error_rate_index":       lambda v: "off-by-one index errors",
    "error_rate_formula":     lambda v: "formula application errors",
    "error_rate_sign":        lambda v: "sign errors in calculations",
    "error_rate_discriminant":lambda v: "errors using the discriminant",
    "error_rate_syntax":      lambda v: "syntax mistakes in code",
    "error_rate_logic":       lambda v: "logical errors in solutions",
    "time_per_question":      lambda v: "spending too long per question (suggesting conceptual gaps)",
    "skip_rate":              lambda v: "frequently skipping questions on this topic",
    "hint_usage":             lambda v: "relying heavily on hints",
}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _top_shap_features(shap_values, top_n=2):
    positive = {k: v for k, v in shap_values.items() if v > 0.05}
    return sorted(positive, key=lambda k: positive[k], reverse=True)[:top_n]


def _match_phrase(feature_key):
    for pattern, phrase_fn in FEATURE_PHRASES.items():
        if pattern in feature_key.lower():
            return phrase_fn(None)
    return None


def _score_severity_label(avg):
    if avg < 35:
        return "significantly below the passing threshold"
    if avg < 50:
        return "below the passing threshold"
    return "inconsistent"


def _trend_phrase(scores):
    if len(scores) < 2:
        return ""
    delta = scores[-1] - scores[0]
    if delta > 8:
        return f" Your most recent score ({scores[-1]}%) shows improvement — keep going."
    if delta < -8:
        return f" Your scores have been declining (latest: {scores[-1]}%) — now is a good time to revisit the basics."
    return ""


# ═════════════════════════════════════════════════════════════════════════════
# FUNCTION 1 — generate_xai_reason
# Used by: new /api/students/<student_id>/recommendations route
# ═════════════════════════════════════════════════════════════════════════════

def generate_xai_reason(topic_name, quiz_scores, shap_values, prerequisite_weakness=None):
    """
    Converts quiz scores + SHAP values into a plain-English explanation
    shown to the student on the dashboard under each weak topic.

    Parameters
    ----------
    topic_name             : str   e.g. "Linked Lists"
    quiz_scores            : list  e.g. [28, 35, 22]  (0-100, oldest first)
    shap_values            : dict  e.g. {"error_rate_pointer_ops": 0.61, ...}
    prerequisite_weakness  : str   optional, e.g. "Arrays"

    Returns
    -------
    str — 1 to 3 plain-English sentences
    """
    if not quiz_scores:
        return f"You have not attempted any quizzes on {topic_name} yet."

    avg      = round(statistics.mean(quiz_scores))
    severity = _score_severity_label(avg)
    count    = len(quiz_scores)

    if count == 1:
        attempt_phrase = "in your only attempt so far"
    elif count == 2:
        attempt_phrase = "across both recent attempts"
    else:
        attempt_phrase = f"across your last {count} attempts"

    opening = (
        f"Your average score on {topic_name} is {avg}% — "
        f"{severity} {attempt_phrase}."
    )

    top_features  = _top_shap_features(shap_values)
    error_phrases = [p for p in (_match_phrase(f) for f in top_features) if p]

    if len(error_phrases) >= 2:
        error_sentence = (
            f" The most common patterns in your mistakes are "
            f"{error_phrases[0]} and {error_phrases[1]}."
        )
    elif len(error_phrases) == 1:
        error_sentence = f" The most common pattern in your mistakes is {error_phrases[0]}."
    else:
        error_sentence = " Review your recent quiz attempts to spot recurring mistake patterns."

    prereq_note = ""
    if prerequisite_weakness:
        prereq_note = (
            f" Note: '{prerequisite_weakness}' is also flagged as a weak area — "
            f"strengthening that prerequisite may help here too."
        )

    trend_note = _trend_phrase(quiz_scores)

    return opening + error_sentence + prereq_note + trend_note


# ═════════════════════════════════════════════════════════════════════════════
# FUNCTION 2 — generate_recommendation_reason
# Used by: original /api/recommendations/<student_id> route
# Required by: ai_engine/src/__init__.py
# ═════════════════════════════════════════════════════════════════════════════

def generate_recommendation_reason(shap_explanation, recommended_topics):
    """
    Converts a SHAP explanation dict into one plain-English sentence.

    Parameters
    ----------
    shap_explanation  : dict with 'feature_contributions' key
    recommended_topics: list of topic IDs

    Returns
    -------
    str
    """
    contributions = shap_explanation.get("feature_contributions", {})
    if not contributions:
        return "This topic is recommended based on your overall learning profile."

    top_feature = max(contributions, key=lambda k: abs(contributions[k]))
    top_value   = contributions[top_feature]

    if top_feature in REASON_MAP:
        neg_reason, pos_reason = REASON_MAP[top_feature]
        reason = neg_reason if top_value < 0 else pos_reason
    else:
        reason = "your recent activity points to this topic"

    if recommended_topics:
        topic_str = f"Topic {recommended_topics[0]}"
        if len(recommended_topics) > 1:
            topic_str += f" (and {len(recommended_topics) - 1} more)"
    else:
        topic_str = "This topic"

    return f"{topic_str} is suggested because {reason}."


# ═════════════════════════════════════════════════════════════════════════════
# FUNCTION 3 — generate_weak_topic_reason
# Used by: original /api/recommendations/<student_id> route
# Required by: ai_engine/src/__init__.py
# ═════════════════════════════════════════════════════════════════════════════

def generate_weak_topic_reason(weak_topics):
    """
    Returns a sentence listing the topics the student should review.

    Parameters
    ----------
    weak_topics : list of topic IDs

    Returns
    -------
    str
    """
    if not weak_topics:
        return ""
    topic_list = ", ".join(f"Topic {t}" for t in weak_topics)
    return f"You may also want to review {topic_list}, where your scores are lowest."


# ── Quick smoke test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== generate_xai_reason ===")
    print(generate_xai_reason(
        topic_name="Linked Lists",
        quiz_scores=[28, 35, 22],
        shap_values={"error_rate_pointer_ops": 0.61, "error_rate_deletion": 0.38},
        prerequisite_weakness="Arrays",
    ))

    print("\n=== generate_recommendation_reason ===")
    print(generate_recommendation_reason(
        {"feature_contributions": {"Total errors": -0.32, "Quiz score average": -0.21}},
        [104, 105],
    ))

    print("\n=== generate_weak_topic_reason ===")
    print(generate_weak_topic_reason([101, 103]))