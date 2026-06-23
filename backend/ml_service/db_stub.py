"""
backend/ml_service/db_stub.py
─────────────────────────────────────────────────────────────────────────────
Real MongoDB data layer for the ML service.

Replaces the previous hardcoded mock data with live queries against the
same MongoDB database used by the Node.js backend.

How it works:
  1. Reads ai_engine/data/raw/student_id_map.json  (MongoDB ObjectID → numeric ID)
  2. Reads ai_engine/data/raw/topic_id_map.json    (topic name → numeric ID)
  3. Connects to MongoDB using MONGO_URI from .env (same URI as Node.js)
  4. Queries QuizAttempt and Result collections to get real quiz scores
  5. Builds SHAP-compatible feature dicts from per-topic performance data
  6. Returns resource recommendations keyed to real topic names

Collections used (read-only):
  • quizattempts  — per-attempt scores + weakTopics + strongTopics
  • results       — per-answer topic performance maps
  • progresses    — lesson completion + time spent

Environment variables required (same .env as Node.js backend):
  MONGO_URI   — MongoDB connection string (default: mongodb://localhost:27017/ai_learning_platform)
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import os
import json
import statistics
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False
    print("[db_stub] WARNING: pymongo not installed. Run: pip install pymongo python-dotenv")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv optional — env vars may already be set


# ── Path resolution ───────────────────────────────────────────────────────────
# This file is at: backend/ml_service/db_stub.py
# ai_engine is at: <project_root>/ai_engine/
THIS_FILE    = Path(__file__).resolve()
ML_DIR       = THIS_FILE.parent                    # backend/ml_service
BACKEND_DIR  = ML_DIR.parent                       # backend
PROJECT_ROOT = BACKEND_DIR.parent                  # project root

STUDENT_ID_MAP_PATH = PROJECT_ROOT / "ai_engine" / "data" / "raw" / "student_id_map.json"
TOPIC_ID_MAP_PATH   = PROJECT_ROOT / "ai_engine" / "data" / "raw" / "topic_id_map.json"

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/ai_learning_platform")
DB_NAME   = MONGO_URI.split("/")[-1].split("?")[0] or "ai_learning_platform"

# Weakness threshold — topics below this avg score are flagged
WEAK_SCORE_THRESHOLD = 50.0

# How many recent quiz attempts to analyse per student
MAX_ATTEMPTS = 20


# ── MongoDB client (lazy singleton) ──────────────────────────────────────────

_mongo_client: Optional[MongoClient] = None

def _get_db():
    """Return the MongoDB database object. Creates client on first call."""
    global _mongo_client
    if not PYMONGO_AVAILABLE:
        raise RuntimeError("pymongo is not installed. Run: pip install pymongo")
    if _mongo_client is None:
        _mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Trigger connection check
        _mongo_client.admin.command("ping")
        print(f"[db_stub] Connected to MongoDB: {DB_NAME}")
    return _mongo_client[DB_NAME]


# ── ID map loaders ────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_student_id_map() -> dict:
    """
    Loads the MongoDB ObjectID → numeric ID mapping.
    Written by mlBridgeService.js every time interactions.csv is exported.

    Returns: { "69d10cc4f4c258c5156646aa": 1, ... }
    """
    if STUDENT_ID_MAP_PATH.exists():
        with open(STUDENT_ID_MAP_PATH) as f:
            return json.load(f)
    print(f"[db_stub] WARNING: student_id_map.json not found at {STUDENT_ID_MAP_PATH}")
    return {}


@lru_cache(maxsize=1)
def _load_topic_id_map() -> dict:
    """
    Loads the topic name → numeric ID mapping.
    Written by mlBridgeService.js.

    Returns: { "Variables": 104, "if_statements": 106, ... }
    Inverted: { 104: "Variables", 106: "if_statements", ... }
    """
    if TOPIC_ID_MAP_PATH.exists():
        with open(TOPIC_ID_MAP_PATH) as f:
            return json.load(f)
    print(f"[db_stub] WARNING: topic_id_map.json not found at {TOPIC_ID_MAP_PATH}")
    return {}


def _numeric_id_to_mongo_id(numeric_id: int) -> Optional[str]:
    """Reverse lookup: numeric ID → MongoDB ObjectID string."""
    id_map = _load_student_id_map()
    for mongo_id, num_id in id_map.items():
        if num_id == numeric_id:
            return mongo_id
    return None


def _mongo_id_to_numeric(mongo_id: str) -> Optional[int]:
    """MongoDB ObjectID string → numeric ID."""
    id_map = _load_student_id_map()
    return id_map.get(str(mongo_id))


def _topic_name_to_id(topic_name: str) -> Optional[int]:
    topic_map = _load_topic_id_map()
    return topic_map.get(topic_name)


def _topic_id_to_name(numeric_id: int) -> str:
    topic_map = _load_topic_id_map()
    for name, num in topic_map.items():
        if num == numeric_id:
            return name
    return f"Topic {numeric_id}"


# ── Core query helpers ────────────────────────────────────────────────────────

def _get_quiz_attempts(mongo_student_id: str) -> list[dict]:
    """
    Fetches recent quiz attempts for a student from MongoDB.
    Queries: db.quizattempts — same collection as Node.js QuizAttempt model.
    """
    db = _get_db()
    from bson import ObjectId
    attempts = list(
        db.quizattempts
        .find(
            {"student": ObjectId(mongo_student_id)},
            {
                "score": 1, "isPassed": 1, "weakTopics": 1,
                "strongTopics": 1, "timeTaken": 1, "answers": 1,
                "createdAt": 1, "attemptNumber": 1,
            }
        )
        .sort("createdAt", -1)
        .limit(MAX_ATTEMPTS)
    )
    return attempts


def _get_result_topic_performance(mongo_student_id: str) -> dict[str, list[float]]:
    """
    Reads Result.topicPerformance maps from MongoDB to get per-topic scores.
    Queries: db.results — same collection as Node.js Result model.

    Returns: { "Variables": [80, 60, 70], "if_statements": [30, 40, 35], ... }
    """
    db = _get_db()
    from bson import ObjectId
    results = list(
        db.results
        .find(
            {"student": ObjectId(mongo_student_id)},
            {"topicPerformance": 1, "createdAt": 1}
        )
        .sort("createdAt", -1)
        .limit(MAX_ATTEMPTS)
    )

    topic_scores: dict[str, list[float]] = {}
    for result in results:
        tp = result.get("topicPerformance") or {}
        # topicPerformance is a MongoDB Map — comes through as a dict in pymongo
        if hasattr(tp, "items"):
            for topic, stats in tp.items():
                if isinstance(stats, dict):
                    pct = stats.get("percentage", 0)
                elif hasattr(stats, "get"):
                    pct = getattr(stats, "percentage", 0)
                else:
                    pct = 0
                topic_scores.setdefault(topic, []).append(float(pct))

    return topic_scores


def _get_lesson_progress(mongo_student_id: str) -> dict:
    """
    Gets lesson completion counts and total time spent.
    Queries: db.progresses — same collection as Node.js Progress model.
    """
    db = _get_db()
    from bson import ObjectId
    progress_records = list(
        db.progresses.find(
            {"student": ObjectId(mongo_student_id)},
            {"isCompleted": 1, "timeSpent": 1, "lesson": 1}
        )
    )
    completed  = sum(1 for p in progress_records if p.get("isCompleted"))
    time_total = sum(p.get("timeSpent", 0) for p in progress_records)
    return {
        "completed_lessons": completed,
        "total_time_minutes": round(time_total / 60) if time_total else 0,
    }


# ── Weakness analyser ─────────────────────────────────────────────────────────

def _build_weaknesses(
    attempts: list[dict],
    topic_scores: dict[str, list[float]],
    mongo_student_id: str,
) -> list[dict]:
    """
    Combines QuizAttempt.weakTopics + Result.topicPerformance to produce
    a ranked list of weakness records ready for generate_xai_reason().

    Each record shape:
    {
        "topic_id":             "if_statements",
        "topic_name":           "if_statements",
        "avg_score":            35.0,
        "quiz_scores":          [30, 40, 35],
        "shap_values":          { "error_rate_logic": 0.55, ... },
        "prerequisite_weakness": "Basic Syntax" | None,
        "detected_at":          "2026-06-23T...",
    }
    """
    # Count how often each topic appeared in weakTopics across attempts
    weak_topic_counts: dict[str, int] = {}
    for attempt in attempts:
        for topic in attempt.get("weakTopics") or []:
            weak_topic_counts[topic] = weak_topic_counts.get(topic, 0) + 1

    # Merge with Result.topicPerformance scores
    all_topics = set(list(weak_topic_counts.keys()) + list(topic_scores.keys()))
    weaknesses = []

    for topic in all_topics:
        scores = topic_scores.get(topic, [])
        avg = statistics.mean(scores) if scores else 50.0

        # Only flag as weak if score is below threshold OR repeatedly in weakTopics
        weak_count = weak_topic_counts.get(topic, 0)
        if avg >= WEAK_SCORE_THRESHOLD and weak_count < 2:
            continue

        # Build SHAP-compatible feature dict from available signals
        error_rate = max(0.0, (100 - avg) / 100)
        shap_values = {
            "avg_score":          round(-(error_rate * 0.5), 4),
            "error_rate_logic":   round(error_rate * 0.6, 4) if error_rate > 0.4 else 0.0,
            "error_rate_formula": round(error_rate * 0.4, 4) if error_rate > 0.5 else 0.0,
            "time_per_question":  round(0.1 if weak_count >= 2 else 0.0, 4),
            "hint_usage":         round(0.15 if weak_count >= 3 else 0.0, 4),
        }
        # Remove zero values so generate_xai_reason only sees meaningful features
        shap_values = {k: v for k, v in shap_values.items() if abs(v) > 0.01}

        # Simple prerequisite graph — topics that depend on others
        PREREQ_MAP = {
            "if_statements":       "Variables",
            "Functions":           "Basic Syntax",
            "Data Types":          "Variables",
            "Control Structures":  "if_statements",
            "Arrays":              "Variables",
            "Recursion":           "Functions",
            "Linked Lists":        "Arrays",
            "Sorting Algorithms":  "Arrays",
            "Quadratic Equations": "Basic Algebra",
            "Derivatives":         "Functions",
        }
        prereq = PREREQ_MAP.get(topic)
        # Only flag prereq if it's also weak
        if prereq:
            prereq_scores = topic_scores.get(prereq, [])
            prereq_avg = statistics.mean(prereq_scores) if prereq_scores else 100.0
            if prereq_avg >= WEAK_SCORE_THRESHOLD:
                prereq = None  # prereq is fine, don't flag it

        weaknesses.append({
            "topic_id":              topic,
            "topic_name":            topic,
            "avg_score":             round(avg, 1),
            "quiz_scores":           [round(s) for s in scores] or [round(avg)],
            "shap_values":           shap_values,
            "prerequisite_weakness": prereq,
            "detected_at":           datetime.now(timezone.utc).isoformat(),
        })

    # Sort worst first
    weaknesses.sort(key=lambda w: w["avg_score"])
    return weaknesses


# ── Topic resource library ────────────────────────────────────────────────────
# Keyed to your REAL topic names from topic_id_map.json.
# Add more topics here as your course library grows.

TOPIC_RESOURCES: dict[str, list[dict]] = {
    "Variables": [
        {"id": "res_var_01", "title": "Python Variables Explained",
         "url": "https://www.youtube.com/results?search_query=python+variables+explained+beginner",
         "type": "video", "difficulty": "beginner", "quality_score": 0.92, "site": "YouTube"},
        {"id": "res_var_02", "title": "Python Variables – W3Schools",
         "url": "https://www.w3schools.com/python/python_variables.asp",
         "type": "article", "difficulty": "beginner", "quality_score": 0.88, "site": "W3Schools"},
        {"id": "res_var_03", "title": "Variables Practice – HackerRank",
         "url": "https://www.hackerrank.com/domains/python?filters%5Bsubdomains%5D%5B%5D=py-basic-data-types",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.85, "site": "HackerRank"},
    ],
    "Data Types": [
        {"id": "res_dt_01", "title": "Python Data Types – Full Tutorial",
         "url": "https://www.youtube.com/results?search_query=python+data+types+tutorial",
         "type": "video", "difficulty": "beginner", "quality_score": 0.91, "site": "YouTube"},
        {"id": "res_dt_02", "title": "Python Data Types – GeeksForGeeks",
         "url": "https://www.geeksforgeeks.org/python-data-types/",
         "type": "article", "difficulty": "beginner", "quality_score": 0.87, "site": "GeeksForGeeks"},
        {"id": "res_dt_03", "title": "Data Types Practice – W3Schools",
         "url": "https://www.w3schools.com/python/exercise.asp?filename=exercise_datatypes1",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.83, "site": "W3Schools"},
    ],
    "Basic Syntax": [
        {"id": "res_bs_01", "title": "Python Syntax for Beginners",
         "url": "https://www.youtube.com/results?search_query=python+syntax+beginners",
         "type": "video", "difficulty": "beginner", "quality_score": 0.90, "site": "YouTube"},
        {"id": "res_bs_02", "title": "Python Syntax – W3Schools",
         "url": "https://www.w3schools.com/python/python_syntax.asp",
         "type": "article", "difficulty": "beginner", "quality_score": 0.88, "site": "W3Schools"},
        {"id": "res_bs_03", "title": "Python Basics – Codecademy",
         "url": "https://www.codecademy.com/learn/learn-python-3",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.92, "site": "Codecademy"},
    ],
    "Input and Output": [
        {"id": "res_io_01", "title": "Python Input and Output – Tutorial",
         "url": "https://www.youtube.com/results?search_query=python+input+output+print+tutorial",
         "type": "video", "difficulty": "beginner", "quality_score": 0.89, "site": "YouTube"},
        {"id": "res_io_02", "title": "Python Input/Output – Real Python",
         "url": "https://realpython.com/python-input-output/",
         "type": "article", "difficulty": "beginner", "quality_score": 0.91, "site": "Real Python"},
        {"id": "res_io_03", "title": "Python I/O Exercises – W3Schools",
         "url": "https://www.w3schools.com/python/exercise.asp?filename=exercise_syntax1",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.82, "site": "W3Schools"},
    ],
    "if_statements": [
        {"id": "res_if_01", "title": "Python If Statements – Full Explanation",
         "url": "https://www.youtube.com/results?search_query=python+if+else+elif+statements+explained",
         "type": "video", "difficulty": "beginner", "quality_score": 0.93, "site": "YouTube"},
        {"id": "res_if_02", "title": "Python Conditions – W3Schools",
         "url": "https://www.w3schools.com/python/python_conditions.asp",
         "type": "article", "difficulty": "beginner", "quality_score": 0.88, "site": "W3Schools"},
        {"id": "res_if_03", "title": "Conditional Statements – Exercism",
         "url": "https://exercism.org/tracks/python/exercises/bob",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.90, "site": "Exercism"},
    ],
    "Functions": [
        {"id": "res_fn_01", "title": "Python Functions – Crash Course",
         "url": "https://www.youtube.com/results?search_query=python+functions+crash+course",
         "type": "video", "difficulty": "beginner", "quality_score": 0.94, "site": "YouTube"},
        {"id": "res_fn_02", "title": "Python Functions – Real Python",
         "url": "https://realpython.com/defining-your-own-python-function/",
         "type": "article", "difficulty": "beginner", "quality_score": 0.93, "site": "Real Python"},
        {"id": "res_fn_03", "title": "Functions Practice – HackerRank",
         "url": "https://www.hackerrank.com/challenges/write-a-function/problem",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.88, "site": "HackerRank"},
    ],
    "Introduction to Python": [
        {"id": "res_py_01", "title": "Python for Beginners – Full Course",
         "url": "https://www.youtube.com/results?search_query=python+for+beginners+full+course",
         "type": "video", "difficulty": "beginner", "quality_score": 0.95, "site": "YouTube"},
        {"id": "res_py_02", "title": "Python Introduction – Khan Academy",
         "url": "https://www.khanacademy.org/computing/intro-to-python-fundamentals",
         "type": "article", "difficulty": "beginner", "quality_score": 0.92, "site": "Khan Academy"},
        {"id": "res_py_03", "title": "Learn Python – Codecademy",
         "url": "https://www.codecademy.com/learn/learn-python-3",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.94, "site": "Codecademy"},
    ],
    "Control Structures": [
        {"id": "res_cs_01", "title": "Python Loops and Control Flow",
         "url": "https://www.youtube.com/results?search_query=python+loops+control+flow+for+while",
         "type": "video", "difficulty": "beginner", "quality_score": 0.91, "site": "YouTube"},
        {"id": "res_cs_02", "title": "Python Control Flow – GeeksForGeeks",
         "url": "https://www.geeksforgeeks.org/python-control-flow/",
         "type": "article", "difficulty": "beginner", "quality_score": 0.87, "site": "GeeksForGeeks"},
        {"id": "res_cs_03", "title": "Control Structures Practice – Exercism",
         "url": "https://exercism.org/tracks/python/exercises/collatz-conjecture",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.89, "site": "Exercism"},
    ],
    "HTML Basics": [
        {"id": "res_html_01", "title": "HTML Full Course for Beginners",
         "url": "https://www.youtube.com/results?search_query=HTML+full+course+beginners",
         "type": "video", "difficulty": "beginner", "quality_score": 0.93, "site": "YouTube"},
        {"id": "res_html_02", "title": "HTML Tutorial – W3Schools",
         "url": "https://www.w3schools.com/html/",
         "type": "article", "difficulty": "beginner", "quality_score": 0.90, "site": "W3Schools"},
        {"id": "res_html_03", "title": "HTML Practice – freeCodeCamp",
         "url": "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.94, "site": "freeCodeCamp"},
    ],
    "Arrays": [
        {"id": "res_arr_01", "title": "Python Lists (Arrays) – Tutorial",
         "url": "https://www.youtube.com/results?search_query=python+lists+arrays+tutorial",
         "type": "video", "difficulty": "beginner", "quality_score": 0.91, "site": "YouTube"},
        {"id": "res_arr_02", "title": "Python Lists – GeeksForGeeks",
         "url": "https://www.geeksforgeeks.org/python-lists/",
         "type": "article", "difficulty": "beginner", "quality_score": 0.88, "site": "GeeksForGeeks"},
        {"id": "res_arr_03", "title": "Array Problems – LeetCode",
         "url": "https://leetcode.com/tag/array/",
         "type": "practice", "difficulty": "beginner", "quality_score": 0.90, "site": "LeetCode"},
    ],
}


# ── In-memory feedback log ────────────────────────────────────────────────────
_FEEDBACK_LOG: list[dict] = []


# ═════════════════════════════════════════════════════════════════════════════
# PUBLIC API — same function signatures as before so api.py needs no changes
# ═════════════════════════════════════════════════════════════════════════════

def get_student_weaknesses(student_id: str) -> Optional[dict]:
    """
    Returns weakness records + learning style for a student.

    Accepts either:
      - MongoDB ObjectID string  e.g. "69d10cc4f4c258c5156646aa"
      - Numeric string           e.g. "1"  (from student_id_map.json)

    Returns None if the student is not found.
    """
    # ── Resolve MongoDB ObjectID ──────────────────────────────────────────────
    mongo_id: Optional[str] = None
    id_map = _load_student_id_map()

    # Try as MongoDB ObjectID directly
    if student_id in id_map:
        mongo_id = student_id

    # Try as numeric string → reverse lookup
    if mongo_id is None:
        try:
            num = int(student_id)
            mongo_id = _numeric_id_to_mongo_id(num)
        except ValueError:
            pass

    if mongo_id is None:
        print(f"[db_stub] Student '{student_id}' not found in student_id_map.json")
        return None

    # ── Connect to MongoDB ────────────────────────────────────────────────────
    try:
        from bson import ObjectId

        db = _get_db()

        # Get learning style from User document
        user_doc = db.users.find_one(
            {"_id": ObjectId(mongo_id)},
            {"learningLevel": 1, "name": 1}
        )

        # Map learningLevel → learning_style
        LEVEL_TO_STYLE = {
            "beginner":     "visual",
            "intermediate": "reading",
            "advanced":     "practice",
        }
        level = (user_doc or {}).get("learningLevel", "beginner")
        learning_style = LEVEL_TO_STYLE.get(level, "visual")

        # Get quiz attempts and topic performance
        attempts     = _get_quiz_attempts(mongo_id)
        topic_scores = _get_result_topic_performance(mongo_id)

        if not attempts and not topic_scores:
            print(f"[db_stub] No quiz data found for student {mongo_id}")
            return None

        # Build weakness records
        weaknesses = _build_weaknesses(attempts, topic_scores, mongo_id)

        if not weaknesses:
            print(f"[db_stub] No weak topics detected for student {mongo_id}")
            return None

        return {
            "student_id":    mongo_id,
            "learning_style": learning_style,
            "weaknesses":    weaknesses,
        }

    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        print(f"[db_stub] MongoDB connection failed: {e}")
        return None
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[db_stub] Error fetching student {student_id}: {e}")
        return None


def get_topic_resources(topic_id: str) -> list[dict]:
    """
    Returns curated resources for a topic.
    topic_id can be the topic name string e.g. "if_statements"
    or a numeric string e.g. "106" (auto-resolved via topic_id_map.json).
    """
    # Try resolving numeric ID → topic name
    topic_name = topic_id
    try:
        num_id = int(topic_id)
        resolved = _topic_id_to_name(num_id)
        if resolved != f"Topic {num_id}":
            topic_name = resolved
    except ValueError:
        pass

    resources = TOPIC_RESOURCES.get(topic_name, [])

    # Fallback: try case-insensitive match
    if not resources:
        for key, val in TOPIC_RESOURCES.items():
            if key.lower().replace(" ", "_") == topic_name.lower().replace(" ", "_"):
                resources = val
                break

    return resources


def get_student_progress(student_id: str) -> Optional[list[dict]]:
    """
    Returns per-topic average scores for the progress bars on the dashboard.
    """
    # Resolve to MongoDB ID
    id_map  = _load_student_id_map()
    mongo_id: Optional[str] = None

    if student_id in id_map:
        mongo_id = student_id
    else:
        try:
            num = int(student_id)
            mongo_id = _numeric_id_to_mongo_id(num)
        except ValueError:
            pass

    if mongo_id is None:
        return None

    try:
        topic_scores = _get_result_topic_performance(mongo_id)
        if not topic_scores:
            return None

        return [
            {
                "topic_id":   topic,
                "topic_name": topic,
                "avg_score":  round(statistics.mean(scores), 1),
            }
            for topic, scores in topic_scores.items()
            if scores
        ]

    except Exception as e:
        print(f"[db_stub] Error fetching progress for {student_id}: {e}")
        return None


def save_resource_feedback(
    student_id: str,
    resource_id: str,
    helpful: bool,
    time_spent_sec: int,
) -> None:
    """
    Saves a student's feedback on a resource.
    Stored in-memory for now. To persist to MongoDB add:
        db.resourcefeedbacks.insert_one({...})
    """
    _FEEDBACK_LOG.append({
        "student_id":     student_id,
        "resource_id":    resource_id,
        "helpful":        helpful,
        "time_spent_sec": time_spent_sec,
        "viewed_at":      datetime.now(timezone.utc).isoformat(),
    })
    print(f"[db_stub] Feedback saved: student={student_id} resource={resource_id} helpful={helpful}")


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== db_stub.py smoke test ===\n")

    id_map = _load_student_id_map()
    print(f"student_id_map.json: {len(id_map)} students → {id_map}")

    topic_map = _load_topic_id_map()
    print(f"topic_id_map.json:   {len(topic_map)} topics  → {list(topic_map.keys())}\n")

    if not id_map:
        print("No student IDs found. Run the Node.js backend and export data first.")
    else:
        first_mongo_id = next(iter(id_map))
        print(f"Testing with student: {first_mongo_id}")
        result = get_student_weaknesses(first_mongo_id)
        if result:
            print(f"\nLearning style: {result['learning_style']}")
            print(f"Weak topics found: {len(result['weaknesses'])}")
            for w in result["weaknesses"]:
                print(f"  {w['topic_name']:25s} avg={w['avg_score']}%  reason: {w.get('xai_reason','(not generated yet)')[:60]}")
        else:
            print("No data returned. Check MongoDB connection and quiz data.")

    print("\nTesting resources for 'if_statements':")
    for r in get_topic_resources("if_statements"):
        print(f"  [{r['type']:8s}] {r['title']} — {r['site']}")