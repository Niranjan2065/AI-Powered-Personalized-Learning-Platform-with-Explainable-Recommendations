# AI-Powered Personalized Learning Platform

## Project Structure

```
ai_learning_platform/
├── ai_engine/                  ← All AI / XAI code lives here
│   ├── data/
│   │   ├── raw/
│   │   │   └── interactions.csv        ← Export from your database
│   │   └── processed/                  ← Auto-generated after step 4
│   ├── models/                         ← Auto-generated after step 5
│   │   ├── kmeans.pkl
│   │   ├── cf_model.pkl
│   │   └── scaler.pkl
│   ├── src/
│   │   ├── preprocessing.py    ← STEP 4: clean + feature engineer
│   │   ├── train_model.py      ← STEP 5: train KMeans + collab filter
│   │   ├── recommend.py        ← STEP 5: inference / get recommendations
│   │   ├── explain.py          ← STEP 6 XAI: SHAP + LIME
│   │   └── generate_reason.py  ← STEP 6 XAI: human-readable text
│   └── requirements.txt
├── backend/                    ← Your existing Flask/Django backend
│   ├── app.py                  ← Main Flask app
│   └── routes/
│       ├── recommendations.py  ← NEW: AI endpoint wired to engine
│       └── health.py
├── frontend/                   ← Your React frontend
└── scripts/
    └── run_pipeline.py         ← ONE command to run everything
```

## Setup

### 1. Install Python dependencies
```bash
cd ai_learning_platform
pip install -r ai_engine/requirements.txt
```

### 2. Add your data
Export student interaction data from your database as CSV into:
```
ai_engine/data/raw/interactions.csv
```
Required columns: `student_id, topic_id, quiz_score, time_spent_minutes, error_count, attempts`

### 3. Run the full AI pipeline (Steps 4–6)
```bash
python scripts/run_pipeline.py
```
This will:
- Clean and feature-engineer the data
- Train KMeans clustering + collaborative filter
- Test recommendations for sample students
- Run SHAP + LIME explanations and print results

### 4. Start the backend API
```bash
cd backend
python app.py
```
API runs at `http://localhost:5000`

## API Endpoints

### Get recommendations + XAI for a student
```
GET /api/recommendations/<student_id>?top_n=5
```
Response:
```json
{
  "student_id": 1,
  "cluster": 2,
  "recommended_topics": [104, 105, 106],
  "weak_topics": [101, 103],
  "explanation": {
    "human_readable": "Topic 104 is suggested because you have made frequent errors on related problems.",
    "weak_topic_note": "You may also want to review Topic 101, Topic 103, where your scores are lowest.",
    "shap_contributions": {
      "Total errors": -0.32,
      "Quiz score average": -0.21
    }
  }
}
```

### Get LIME explanation only
```
GET /api/recommendations/<student_id>/lime
```

### Health check
```
GET /api/health
```
🔹 Recommendation
GET http://localhost:5000/api/recommend/1
🔹 With query
GET http://localhost:5000/api/recommend/1?top_n=5
🔹 LIME explanation
GET http://localhost:5000/api/recommend/1/lime