"""
Step 6 (continued) — Human-Readable Reason Generator
Converts SHAP feature contributions into a plain-English
explanation sentence shown to the student on the dashboard.
"""


REASON_MAP = {
    "Quiz score average": (
        "your quiz scores in this area are below average",
        "your quiz scores show you are ready to advance",
    ),
    "Total errors": (
        "you have made frequent errors on related problems",
        "you have been making very few mistakes recently",
    ),
    "Struggling topics": (
        "you are currently struggling with several related topics",
        "you have already mastered several similar topics",
    ),
    "Accuracy rate": (
        "your accuracy needs improvement in this area",
        "your accuracy is strong and you can go deeper",
    ),
    "Time efficiency": (
        "you are spending a lot of time on similar problems",
        "you complete similar topics efficiently",
    ),
    "Topics attempted": (
        "you have not explored many topics in this area yet",
        "you have covered many topics and this is a natural next step",
    ),
    "Time spent average": (
        "you tend to spend extra time on this type of content",
        "you work through this content quickly",
    ),
}


def generate_recommendation_reason(shap_explanation, recommended_topics):
    """
    Parameters
    ----------
    shap_explanation  : dict returned by explain_with_shap()
    recommended_topics: list of topic IDs

    Returns
    -------
    str  — one plain-English sentence explaining the recommendation
    """
    contributions = shap_explanation.get("feature_contributions", {})
    if not contributions:
        return "This topic is recommended based on your overall learning profile."

    # Pick the feature with the largest absolute SHAP contribution
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


def generate_weak_topic_reason(weak_topics):
    """Returns a sentence highlighting topics the student should review."""
    if not weak_topics:
        return ""
    topic_list = ", ".join(f"Topic {t}" for t in weak_topics)
    return f"You may also want to review {topic_list}, where your scores are lowest."


if __name__ == "__main__":
    sample_shap = {
        "feature_contributions": {
            "Total errors":        -0.32,
            "Quiz score average":  -0.21,
            "Accuracy rate":       -0.15,
            "Topics attempted":     0.08,
            "Time efficiency":      0.05,
        }
    }
    print(generate_recommendation_reason(sample_shap, [104, 105]))
    print(generate_weak_topic_reason([101, 103]))
