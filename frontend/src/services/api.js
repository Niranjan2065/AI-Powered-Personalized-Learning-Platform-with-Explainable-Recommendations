/**
 * services/api.js
 * Central API layer — all fetch calls to the Flask backend live here.
 * Components never call fetch() directly; they use these functions.
 */

const BASE_URL = process.env.REACT_APP_API_URL || "";

async function request(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Get AI recommendations + SHAP explanation for a student.
 * GET /api/recommendations/:studentId?top_n=5
 */
export async function getRecommendations(studentId, topN = 5) {
  return request(`/api/recommendations/${studentId}?top_n=${topN}`);
}

/**
 * Get LIME explanation for a student.
 * GET /api/recommendations/:studentId/lime
 */
export async function getLimeExplanation(studentId) {
  return request(`/api/recommendations/${studentId}/lime`);
}

/**
 * Health check.
 * GET /api/health
 */
export async function getHealth() {
  return request("/api/health");
}
