// src/services/api.js
// ─────────────────────────────────────────────────────────────────────────────
// FIX: This file previously duplicated ML fetch logic that also lived in
// utils/api.js, creating two separate API layers.
//
// It is now a thin re-export of utils/api.js so all existing imports in
// TeacherDashboard.jsx and StudentDetailPage.jsx continue to work without
// any changes to those files:
//
//   import { getRecommendations } from '../services/api';  ← still works
//   import { getRecommendations } from '../utils/api';     ← also works
//
// All new code should import from utils/api directly.
// ─────────────────────────────────────────────────────────────────────────────

export {
  getRecommendations,
  getLimeExplanation,
  getMLHealth,
} from '../utils/api';