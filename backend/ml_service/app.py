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

Run:
  cd ml_service
  python app.py          # port 5001
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import os

# ── Path setup ────────────────────────────────────────────────────────────────
# Allow imports from the ai_engine package
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Lazy-import ML modules (so startup is fast even if deps are missing) ──────

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
    from ai_engine.src.preprocessing import preprocess
    from ai_engine.src.train_model   import train_and_save
    return preprocess, train_and_save


# ── Health ────────────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'ml-microservice'}), 200


# ── Training ─────────────────────────────────────────────────────────────────

@app.route('/ml/train', methods=['POST'])
def train():
    """
    (Re)train KMeans + collaborative filter from the latest interactions.csv.
    Called by Node.js mlBridgeService.triggerMLTraining().
    """
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
    """
    GET /api/recommendations/<numeric_student_id>?top_n=5

    Returns:
      {
        student_id, cluster,
        recommended_topics, weak_topics,
        student_features,
        explanation: {
          human_readable, weak_topic_note,
          shap_contributions
        }
      }
    """
    top_n = request.args.get('top_n', 5, type=int)

    try:
        get_recommendations, explain_with_shap, _, \
            generate_recommendation_reason, generate_weak_topic_reason = _import_engine()

        rec = get_recommendations(student_id=student_id, top_n=top_n)
        if 'error' in rec:
            return jsonify(rec), 404

        shap_exp = explain_with_shap(student_id=student_id)

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
        return jsonify({
            'error': 'Models not trained yet. POST /ml/train first.'
        }), 503
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/recommendations/<int:student_id>/lime', methods=['GET'])
def lime_explanation(student_id):
    """
    GET /api/recommendations/<numeric_student_id>/lime
    Returns LIME explanation for the student's cluster assignment.
    """
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