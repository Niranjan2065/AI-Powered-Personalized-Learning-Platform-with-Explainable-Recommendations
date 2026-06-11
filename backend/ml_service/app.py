"""
ml_service/app.py
─────────────────────────────────────────────────────────────────────────────
Standalone Flask microservice that exposes the Python ML/XAI engine
over HTTP so Node.js can call it.

Endpoints:
  GET  /api/health                          — liveness check
  POST /ml/train                            — (re)train models from CSV
  GET  /api/recommendations/<student_id>    — recommend + SHAP
  GET  /api/recommendations/<student_id>/lime — LIME explanation only

Run from the project ROOT (not from inside backend/ml_service):
  python backend/ml_service/app.py

OR set PYTHONPATH manually:
  cd backend/ml_service
  set PYTHONPATH=../../       (Windows)
  export PYTHONPATH=../../    (Mac/Linux)
  python app.py
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import os

# ── Path setup ────────────────────────────────────────────────────────────────
# File is at:  <project_root>/backend/ml_service/app.py
# ai_engine is at: <project_root>/ai_engine/
#
# So we need to go UP three levels from this file:
#   __file__                     → .../backend/ml_service/app.py
#   dirname(__file__)            → .../backend/ml_service
#   dirname(dirname(__file__))   → .../backend
#   dirname(dirname(dirname(__file__))) → <project_root>  ✅

THIS_FILE    = os.path.abspath(__file__)
ML_DIR       = os.path.dirname(THIS_FILE)          # backend/ml_service
BACKEND_DIR  = os.path.dirname(ML_DIR)             # backend
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)         # project root  ← ai_engine lives here

# Insert project root so Python can find ai_engine package
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

print(f"[ML Service] PROJECT_ROOT = {PROJECT_ROOT}")
print(f"[ML Service] ai_engine path = {os.path.join(PROJECT_ROOT, 'ai_engine')}")
print(f"[ML Service] ai_engine exists = {os.path.isdir(os.path.join(PROJECT_ROOT, 'ai_engine'))}")

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

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


# ── Health ────────────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status':       'ok',
        'service':      'ml-microservice',
        'project_root': PROJECT_ROOT,
        'ai_engine_found': os.path.isdir(os.path.join(PROJECT_ROOT, 'ai_engine')),
    }), 200


# ── Training ──────────────────────────────────────────────────────────────────

@app.route('/ml/train', methods=['POST'])
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


# ── Recommendations ───────────────────────────────────────────────────────────

@app.route('/api/recommendations/<int:student_id>', methods=['GET'])
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
            'student_id':          student_id,
            'cluster':             rec['cluster'],
            'recommended_topics':  rec['recommended_topics'],
            'weak_topics':         rec['weak_topics'],
            'student_features':    rec['student_features'],
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
def lime_explanation(student_id):
    try:
        _, _, explain_with_lime, _, _ = _import_engine()
        result = explain_with_lime(student_id=student_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('ML_PORT', 5001))
    print(f'[ML Service] Starting on http://localhost:{port}')
    app.run(debug=True, port=port)