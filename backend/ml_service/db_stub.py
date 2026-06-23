"""
db_stub.py
-----------
Realistic mock data layer for local development.
Replace each function body with real DB queries (SQLAlchemy / psycopg2)
when connecting to PostgreSQL.

All functions mirror the exact signatures and return shapes that api.py expects,
so swapping this file out for a real DB layer requires zero changes to api.py.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional


# ---------------------------------------------------------------------------
# Mock data store
# ---------------------------------------------------------------------------

_STUDENTS: dict[str, dict] = {
    "stu_001": {
        "id": "stu_001",
        "name": "Arun Kumar",
        "email": "arun@example.com",
        "learning_style": "visual",   # visual | reading | practice
    },
    "stu_002": {
        "id": "stu_002",
        "name": "Priya Sharma",
        "email": "priya@example.com",
        "learning_style": "practice",
    },
}

_TOPICS: dict[str, dict] = {
    "top_linked_lists": {
        "id": "top_linked_lists",
        "name": "Linked Lists",
        "subject": "Data Structures",
        "prerequisite_id": "top_arrays",
        "prerequisite_name": "Arrays",
    },
    "top_arrays": {
        "id": "top_arrays",
        "name": "Arrays",
        "subject": "Data Structures",
        "prerequisite_id": None,
        "prerequisite_name": None,
    },
    "top_recursion": {
        "id": "top_recursion",
        "name": "Recursion",
        "subject": "Programming",
        "prerequisite_id": None,
        "prerequisite_name": None,
    },
    "top_quadratic": {
        "id": "top_quadratic",
        "name": "Quadratic Equations",
        "subject": "Mathematics",
        "prerequisite_id": "top_algebra",
        "prerequisite_name": "Basic Algebra",
    },
    "top_sorting": {
        "id": "top_sorting",
        "name": "Sorting Algorithms",
        "subject": "Data Structures",
        "prerequisite_id": "top_arrays",
        "prerequisite_name": "Arrays",
    },
}

# Resources per topic
_TOPIC_RESOURCES: dict[str, list[dict]] = {
    "top_linked_lists": [
        {
            "id": "res_ll_01",
            "title": "Linked Lists in 10 Minutes",
            "url": "https://www.youtube.com/results?search_query=linked+lists+explained",
            "type": "video",
            "difficulty": "beginner",
            "quality_score": 0.93,
            "site": "YouTube",
        },
        {
            "id": "res_ll_02",
            "title": "Linked List – Data Structure Guide",
            "url": "https://www.geeksforgeeks.org/linked-list-data-structure/",
            "type": "article",
            "difficulty": "beginner",
            "quality_score": 0.88,
            "site": "GeeksForGeeks",
        },
        {
            "id": "res_ll_03",
            "title": "Linked List Problems – Easy Set",
            "url": "https://leetcode.com/tag/linked-list/",
            "type": "practice",
            "difficulty": "beginner",
            "quality_score": 0.90,
            "site": "LeetCode",
        },
        {
            "id": "res_ll_04",
            "title": "Pointers & Linked Lists – Visual Explainer",
            "url": "https://visualgo.net/en/list",
            "type": "video",
            "difficulty": "intermediate",
            "quality_score": 0.85,
            "site": "VisuAlgo",
        },
        {
            "id": "res_ll_05",
            "title": "Linked List – HackerRank Challenge",
            "url": "https://www.hackerrank.com/domains/data-structures?filters%5Bsubdomains%5D%5B%5D=linked-lists",
            "type": "practice",
            "difficulty": "intermediate",
            "quality_score": 0.82,
            "site": "HackerRank",
        },
    ],
    "top_quadratic": [
        {
            "id": "res_qe_01",
            "title": "Quadratic Equations – Full Series",
            "url": "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations",
            "type": "video",
            "difficulty": "beginner",
            "quality_score": 0.95,
            "site": "Khan Academy",
        },
        {
            "id": "res_qe_02",
            "title": "The Quadratic Formula Explained",
            "url": "https://www.mathsisfun.com/algebra/quadratic-equation.html",
            "type": "article",
            "difficulty": "beginner",
            "quality_score": 0.87,
            "site": "Math is Fun",
        },
        {
            "id": "res_qe_03",
            "title": "Quadratic Equations Practice Problems",
            "url": "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations/x2f8bb11595b61c86:quadratic-formula-a1/e/quadratic_formula",
            "type": "practice",
            "difficulty": "beginner",
            "quality_score": 0.91,
            "site": "Khan Academy",
        },
    ],
    "top_recursion": [
        {
            "id": "res_rec_01",
            "title": "Recursion in Programming – Crash Course",
            "url": "https://www.youtube.com/results?search_query=recursion+programming+explained",
            "type": "video",
            "difficulty": "beginner",
            "quality_score": 0.89,
            "site": "YouTube",
        },
        {
            "id": "res_rec_02",
            "title": "Recursion – GeeksForGeeks",
            "url": "https://www.geeksforgeeks.org/recursion/",
            "type": "article",
            "difficulty": "beginner",
            "quality_score": 0.86,
            "site": "GeeksForGeeks",
        },
        {
            "id": "res_rec_03",
            "title": "Recursion Problems – LeetCode",
            "url": "https://leetcode.com/tag/recursion/",
            "type": "practice",
            "difficulty": "beginner",
            "quality_score": 0.88,
            "site": "LeetCode",
        },
    ],
    "top_sorting": [
        {
            "id": "res_sort_01",
            "title": "Sorting Algorithms Visualised",
            "url": "https://visualgo.net/en/sorting",
            "type": "video",
            "difficulty": "beginner",
            "quality_score": 0.92,
            "site": "VisuAlgo",
        },
        {
            "id": "res_sort_02",
            "title": "Sorting Algorithms – GeeksForGeeks",
            "url": "https://www.geeksforgeeks.org/sorting-algorithms/",
            "type": "article",
            "difficulty": "intermediate",
            "quality_score": 0.87,
            "site": "GeeksForGeeks",
        },
        {
            "id": "res_sort_03",
            "title": "Sorting Problems – LeetCode",
            "url": "https://leetcode.com/tag/sorting/",
            "type": "practice",
            "difficulty": "intermediate",
            "quality_score": 0.85,
            "site": "LeetCode",
        },
    ],
}

# Weaknesses per student
_STUDENT_WEAKNESSES: dict[str, dict] = {
    "stu_001": {
        "learning_style": "visual",
        "weaknesses": [
            {
                "topic_id": "top_linked_lists",
                "topic_name": "Linked Lists",
                "avg_score": 28.0,
                "quiz_scores": [28, 35, 22],
                "shap_values": {
                    "avg_score": -0.42,
                    "error_rate_pointer_ops": 0.61,
                    "error_rate_deletion": 0.38,
                    "time_per_question": 0.12,
                },
                "prerequisite_weakness": "Arrays",
                "detected_at": "2026-06-12T10:00:00Z",
            },
            {
                "topic_id": "top_quadratic",
                "topic_name": "Quadratic Equations",
                "avg_score": 41.0,
                "quiz_scores": [55, 41, 38],
                "shap_values": {
                    "avg_score": -0.31,
                    "error_rate_discriminant": 0.55,
                    "error_rate_sign": 0.29,
                    "hint_usage": 0.18,
                },
                "prerequisite_weakness": None,
                "detected_at": "2026-06-13T09:00:00Z",
            },
            {
                "topic_id": "top_recursion",
                "topic_name": "Recursion",
                "avg_score": 52.0,
                "quiz_scores": [40, 52, 65],
                "shap_values": {
                    "avg_score": -0.20,
                    "error_rate_base_case": 0.44,
                    "time_per_question": 0.15,
                },
                "prerequisite_weakness": None,
                "detected_at": "2026-06-14T08:00:00Z",
            },
        ],
    },
    "stu_002": {
        "learning_style": "practice",
        "weaknesses": [
            {
                "topic_id": "top_sorting",
                "topic_name": "Sorting Algorithms",
                "avg_score": 38.0,
                "quiz_scores": [45, 38, 30],
                "shap_values": {
                    "avg_score": -0.35,
                    "error_rate_logic": 0.50,
                    "error_rate_index": 0.30,
                },
                "prerequisite_weakness": "Arrays",
                "detected_at": "2026-06-14T11:00:00Z",
            },
        ],
    },
}

# Per-student topic progress (for the progress bars)
_STUDENT_PROGRESS: dict[str, list[dict]] = {
    "stu_001": [
        {"topic_id": "top_arrays",       "topic_name": "Arrays",              "avg_score": 84},
        {"topic_id": "top_recursion",     "topic_name": "Recursion",           "avg_score": 52},
        {"topic_id": "top_quadratic",     "topic_name": "Quadratic Equations", "avg_score": 41},
        {"topic_id": "top_linked_lists",  "topic_name": "Linked Lists",        "avg_score": 28},
        {"topic_id": "top_sorting",       "topic_name": "Sorting Algorithms",  "avg_score": 60},
    ],
    "stu_002": [
        {"topic_id": "top_arrays",   "topic_name": "Arrays",             "avg_score": 75},
        {"topic_id": "top_sorting",  "topic_name": "Sorting Algorithms", "avg_score": 38},
    ],
}

# In-memory feedback store (use DB in production)
_FEEDBACK_LOG: list[dict] = []


# ---------------------------------------------------------------------------
# Public functions — replace bodies with real DB calls in production
# ---------------------------------------------------------------------------

def get_student_weaknesses(student_id: str) -> Optional[dict]:
    """
    Returns weakness records + learning style for a student.
    Replace with:
        SELECT sw.*, s.learning_style FROM student_weaknesses sw
        JOIN students s ON s.id = sw.student_id
        WHERE sw.student_id = %s
    """
    return _STUDENT_WEAKNESSES.get(student_id)


def get_topic_resources(topic_id: str) -> list[dict]:
    """
    Returns all curated resources for a topic.
    Replace with:
        SELECT * FROM topic_resources WHERE topic_id = %s
        ORDER BY quality_score DESC
    """
    return _TOPIC_RESOURCES.get(topic_id, [])


def get_student_progress(student_id: str) -> Optional[list[dict]]:
    """
    Returns per-topic average scores for a student.
    Replace with:
        SELECT t.id AS topic_id, t.name AS topic_name,
               AVG(qa.score::float / qa.max_score * 100) AS avg_score
        FROM quiz_attempts qa
        JOIN topics t ON t.id = qa.topic_id
        WHERE qa.student_id = %s
        GROUP BY t.id, t.name
        ORDER BY avg_score DESC
    """
    return _STUDENT_PROGRESS.get(student_id)


def save_resource_feedback(
    student_id: str,
    resource_id: str,
    helpful: bool,
    time_spent_sec: int,
) -> None:
    """
    Saves a student's feedback on a resource.
    Replace with:
        INSERT INTO resource_views
            (student_id, resource_id, helpful, time_spent_sec, viewed_at)
        VALUES (%s, %s, %s, %s, NOW())
    """
    _FEEDBACK_LOG.append({
        "student_id":     student_id,
        "resource_id":    resource_id,
        "helpful":        helpful,
        "time_spent_sec": time_spent_sec,
        "viewed_at":      datetime.now(timezone.utc).isoformat(),
    })