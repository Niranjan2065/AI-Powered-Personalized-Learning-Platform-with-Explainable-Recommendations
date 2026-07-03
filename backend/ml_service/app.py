"""
ml_service/app.py
─────────────────────────────────────────────────────────────────────────────
Standalone Flask microservice that exposes the Python ML/XAI engine
over HTTP so Node.js can call it.

Endpoints (original):
  GET  /api/health
  POST /ml/train
  GET  /api/recommendations/<student_id>
  GET  /api/recommendations/<student_id>/lime

Endpoints (new — resource recommendations):
  GET  /api/students/<student_id>/recommendations
  GET  /api/students/<student_id>/progress
  POST /api/students/<student_id>/resource-feedback
  GET  /api/topics/<topic_id>/resources

Run from the project ROOT:
  python backend/ml_service/app.py
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import os
from datetime import datetime, timezone
from typing import Optional

# ── Path setup  ───────────────────────────────────────────────────────────────
# IMPORTANT: path setup MUST come before any ai_engine or db_stub imports.
#
#   __file__                            → .../backend/ml_service/app.py
#   dirname(__file__)                   → .../backend/ml_service
#   dirname(dirname(__file__))          → .../backend
#   dirname(dirname(dirname(__file__))) → <project_root>   ← ai_engine lives here

THIS_FILE    = os.path.abspath(__file__)
ML_DIR       = os.path.dirname(THIS_FILE)
BACKEND_DIR  = os.path.dirname(ML_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Also add ml_service dir so db_stub.py (sitting next to this file) is importable
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

print(f"[ML Service] PROJECT_ROOT      = {PROJECT_ROOT}")
print(f"[ML Service] ai_engine exists  = {os.path.isdir(os.path.join(PROJECT_ROOT, 'ai_engine'))}")
print(f"[ML Service] db_stub.py exists = {os.path.isfile(os.path.join(ML_DIR, 'db_stub.py'))}")

# ── Imports (after path setup) ────────────────────────────────────────────────

from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS

from db_stub import (
    get_student_weaknesses,
    get_topic_resources,
    get_student_progress,
    save_resource_feedback,
)
from ai_engine.src.generate_reason import generate_xai_reason

# ── App setup ─────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

# ── Shared-secret auth ────────────────────────────────────────────────────────
# Protects expensive/sensitive endpoints (model retraining, student data reads)
# from being called by anyone who can reach this service on the network.
#
# The Node.js backend (mlBridgeService.js) sends this same value in the
# X-ML-Secret header on every request. Set ML_SECRET to the same value in
# both backend/.env and the environment this Flask service runs in.
#
# If ML_SECRET is not set, auth is skipped with a loud warning — this keeps
# local dev frictionless but should never happen in any shared/deployed
# environment. Always set ML_SECRET outside of local development.

ML_SECRET = os.environ.get('ML_SECRET')

if not ML_SECRET:
    print(
        '[ML Service] ⚠️  WARNING: ML_SECRET is not set. '
        '/ml/train and student data endpoints are UNPROTECTED. '
        'Set ML_SECRET in your environment before deploying.'
    )


def require_ml_secret(fn):
    """Decorator — rejects requests missing/mismatching the X-ML-Secret header.

    No-ops (allows all requests) when ML_SECRET is unset, so local dev
    without an .env file still works out of the box.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not ML_SECRET:
            return fn(*args, **kwargs)  # auth disabled — dev mode only

        provided = request.headers.get('X-ML-Secret')
        if not provided or provided != ML_SECRET:
            return jsonify({
                'error': 'Unauthorized — missing or invalid X-ML-Secret header.'
            }), 401
        return fn(*args, **kwargs)
    return wrapper

# ── Lazy-import ML modules ────────────────────────────────────────────────────

def _import_engine():
    from ai_engine.src.recommend       import get_recommendations
    from ai_engine.src.explain         import explain_with_shap, explain_with_lime
    from ai_engine.src.generate_reason import (
        generate_recommendation_reason,
        generate_weak_topic_reason,
    )
    return get_recommendations, explain_with_shap, explain_with_lime, \
           generate_recommendation_reason, generate_weak_topic_reason


def _import_pipeline():
    from ai_engine.src.preprocessing import run_preprocessing as preprocess
    from ai_engine.src.train_model   import train_and_save
    return preprocess, train_and_save


# ── Helper functions for resource recommendation ──────────────────────────────

LEARNING_STYLE_PRIORITY = {
    "visual":   ["video", "article", "practice"],
    "reading":  ["article", "video", "practice"],
    "practice": ["practice", "article", "video"],
    "default":  ["video", "article", "practice"],
}
MAX_RESOURCES_PER_TYPE = 2


def _rank_resources(resources, learning_style, max_total=5):
    """Sort resources by learning-style preference, then quality score."""
    priority = LEARNING_STYLE_PRIORITY.get(learning_style, LEARNING_STYLE_PRIORITY["default"])
    type_rank = {rtype: idx for idx, rtype in enumerate(priority)}

    ranked = sorted(
        resources,
        key=lambda r: (type_rank.get(r.get("type", ""), 99), -r.get("quality_score", 0)),
    )

    counts = {}
    result = []
    for r in ranked:
        rtype = r.get("type", "other")
        if counts.get(rtype, 0) < MAX_RESOURCES_PER_TYPE:
            result.append(r)
            counts[rtype] = counts.get(rtype, 0) + 1
        if len(result) >= max_total:
            break
    return result


def _build_recommendation(weakness, learning_style):
    """Combine a weakness record + its resources into one recommendation object."""
    resources = get_topic_resources(weakness["topic_id"])
    ranked    = _rank_resources(resources, learning_style)

    xai_reason = generate_xai_reason(
        topic_name=weakness["topic_name"],
        quiz_scores=weakness.get("quiz_scores", []),
        shap_values=weakness.get("shap_values", {}),
        prerequisite_weakness=weakness.get("prerequisite_weakness"),
    )

    return {
        "topic_id":    weakness["topic_id"],
        "topic_name":  weakness["topic_name"],
        "avg_score":   round(weakness.get("avg_score", 0)),
        "xai_reason":  xai_reason,
        "resources":   ranked,
        "detected_at": weakness.get("detected_at", ""),
    }


# ═════════════════════════════════════════════════════════════════════════════
# ORIGINAL ROUTES (unchanged)
# ═════════════════════════════════════════════════════════════════════════════

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status':          'ok',
        'service':         'ml-microservice',
        'project_root':    PROJECT_ROOT,
        'ai_engine_found': os.path.isdir(os.path.join(PROJECT_ROOT, 'ai_engine')),
    }), 200


@app.route('/ml/train', methods=['POST'])
@require_ml_secret
def train():
    try:
        preprocess, train_and_save = _import_pipeline()
        print('[ML Service] Running preprocessing...')
        preprocess()
        print('[ML Service] Training models...')
        train_and_save()
        return jsonify({'success': True, 'message': 'Models trained successfully.'}), 200
    except FileNotFoundError as e:
        return jsonify({'error': f'Data file missing: {str(e)}'}), 422
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/recommendations/<int:student_id>', methods=['GET'])
@require_ml_secret
def recommendations(student_id):
    top_n = request.args.get('top_n', 5, type=int)
    try:
        get_recommendations, explain_with_shap, _, \
            generate_recommendation_reason, generate_weak_topic_reason = _import_engine()

        rec = get_recommendations(student_id=student_id, top_n=top_n)
        if 'error' in rec:
            return jsonify(rec), 404

        shap_exp    = explain_with_shap(student_id=student_id)
        reason      = generate_recommendation_reason(shap_exp, rec['recommended_topics'])
        weak_reason = generate_weak_topic_reason(rec['weak_topics'])

        return jsonify({
            'student_id':         student_id,
            'cluster':            rec['cluster'],
            'recommended_topics': rec['recommended_topics'],
            'weak_topics':        rec['weak_topics'],
            'student_features':   rec['student_features'],
            'explanation': {
                'human_readable':     reason,
                'weak_topic_note':    weak_reason,
                'shap_contributions': shap_exp.get('feature_contributions', {}),
            },
        }), 200

    except FileNotFoundError:
        return jsonify({'error': 'Models not trained yet. POST /ml/train first.'}), 503
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/recommendations/<int:student_id>/lime', methods=['GET'])
@require_ml_secret
def lime_explanation(student_id):
    try:
        _, _, explain_with_lime, _, _ = _import_engine()
        result = explain_with_lime(student_id=student_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ═════════════════════════════════════════════════════════════════════════════
# NEW ROUTES — personalised resource recommendations
# ═════════════════════════════════════════════════════════════════════════════

@app.route('/api/students/<student_id>/recommendations', methods=['GET'])
@require_ml_secret
def student_recommendations(student_id):
    """
    GET /api/students/<student_id>/recommendations?limit=5
    Returns weak topics + xai_reason + ranked resource links.
    Called by WeakTopicsPanel.jsx on the frontend.
    """
    limit = min(int(request.args.get('limit', 5)), 10)

    student_data = get_student_weaknesses(student_id)
    if student_data is None:
        return jsonify({'error': f"Student '{student_id}' not found."}), 404

    learning_style = student_data.get('learning_style', 'default')
    weaknesses     = student_data.get('weaknesses', [])

    # Worst topics first
    weaknesses = sorted(weaknesses, key=lambda w: w.get('avg_score', 100))[:limit]

    recommendations = [_build_recommendation(w, learning_style) for w in weaknesses]

    return jsonify({
        'student_id':      student_id,
        'learning_style':  learning_style,
        'recommendations': recommendations,
        'generated_at':    datetime.now(timezone.utc).isoformat(),
    }), 200


@app.route('/api/students/<student_id>/progress', methods=['GET'])
@require_ml_secret
def student_progress(student_id):
    """
    GET /api/students/<student_id>/progress
    Returns per-topic scores for the progress bars on the dashboard.
    """
    progress = get_student_progress(student_id)
    if progress is None:
        return jsonify({'error': f"Student '{student_id}' not found."}), 404

    return jsonify({
        'student_id': student_id,
        'topics': [
            {
                'topic_id':   t['topic_id'],
                'topic_name': t['topic_name'],
                'avg_score':  round(t['avg_score']),
                'is_weak':    t['avg_score'] < 50,
            }
            for t in progress
        ],
    }), 200


@app.route('/api/students/<student_id>/resource-feedback', methods=['POST'])
@require_ml_secret
def resource_feedback(student_id):
    """
    POST /api/students/<student_id>/resource-feedback
    Body: { "resource_id": "...", "helpful": true, "time_spent_sec": 240 }
    Records whether a student found a resource helpful.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Request body must be JSON.'}), 400

    resource_id = body.get('resource_id')
    helpful     = body.get('helpful')
    time_spent  = body.get('time_spent_sec', 0)

    if resource_id is None or helpful is None:
        return jsonify({'error': "'resource_id' and 'helpful' are required."}), 400

    save_resource_feedback(
        student_id=student_id,
        resource_id=resource_id,
        helpful=bool(helpful),
        time_spent_sec=int(time_spent),
    )
    return jsonify({'status': 'ok', 'message': 'Feedback recorded.'}), 201


@app.route('/api/topics/<topic_id>/resources', methods=['GET'])
def topic_resources(topic_id):
    """
    GET /api/topics/<topic_id>/resources?type=video
    Returns curated resources for a topic, optionally filtered by type.
    """
    rtype_filter = request.args.get('type')
    resources    = get_topic_resources(topic_id)

    if rtype_filter:
        resources = [r for r in resources if r.get('type') == rtype_filter]

    return jsonify({'topic_id': topic_id, 'resources': resources}), 200


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port  = int(os.environ.get('ML_PORT', 5001))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    print(f'[ML Service] Starting on http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=debug)