"""
Backend Route — /api/recommendations
Connects the AI recommendation engine + XAI to a REST endpoint.
"""

from flask import Blueprint, jsonify, request
import sys, os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)

from ai_engine.src.recommend       import get_recommendations
from ai_engine.src.explain         import explain_with_shap, explain_with_lime
from ai_engine.src.generate_reason import generate_recommendation_reason, generate_weak_topic_reason

recommend_bp = Blueprint("recommendations", __name__)


@recommend_bp.route("/api/recommendations/<int:student_id>", methods=["GET"])
def recommendations(student_id):
    """
    GET /api/recommendations/<student_id>?top_n=5
    Returns recommendations + SHAP explanation + human-readable reason.
    """
    top_n = request.args.get("top_n", 5, type=int)

    try:
        # 1. Get topic recommendations
        rec = get_recommendations(student_id=student_id, top_n=top_n)
        if "error" in rec:
            return jsonify(rec), 404

        # 2. SHAP explanation
        shap_exp = explain_with_shap(student_id=student_id)

        # 3. Human-readable reason sentence
        reason       = generate_recommendation_reason(shap_exp, rec["recommended_topics"])
        weak_reason  = generate_weak_topic_reason(rec["weak_topics"])

        return jsonify({
            "student_id":          student_id,
            "cluster":             rec["cluster"],
            "recommended_topics":  rec["recommended_topics"],
            "weak_topics":         rec["weak_topics"],
            "student_features":    rec["student_features"],
            "explanation": {
                "human_readable":       reason,
                "weak_topic_note":      weak_reason,
                "shap_contributions":   shap_exp.get("feature_contributions", {}),
            },
        })

    except FileNotFoundError:
        return jsonify({
            "error": "Models not trained yet. Run scripts/run_pipeline.py first."
        }), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recommend_bp.route("/api/recommendations/<int:student_id>/lime", methods=["GET"])
def lime_explanation(student_id):
    """
    GET /api/recommendations/<student_id>/lime
    Returns LIME explanation for the student's cluster assignment.
    """
    try:
        lime_exp = explain_with_lime(student_id=student_id)
        return jsonify(lime_exp)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
