"""
Backend — Flask Application Entry Point
Connects the AI engine to REST API endpoints.
"""

import sys
import os

# Allow imports from ai_engine/src anywhere in this project
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from flask import Flask
from flask_cors import CORS
from routes.recommendations import recommend_bp
from routes.health import health_bp

app = Flask(__name__)
CORS(app)  # Allow React frontend (localhost:3000) to call this API

app.register_blueprint(recommend_bp)
app.register_blueprint(health_bp)

if __name__ == "__main__":
    print("Starting AI Learning Platform API on http://localhost:5000")
    app.run(debug=True, port=5000)
