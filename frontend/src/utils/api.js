// src/utils/api.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED API LAYER
//
// FIX: Previously two separate files existed:
//   • utils/api.js  — Axios instance for Node.js/Express backend (JWT auth)
//   • services/api.js — plain fetch() calls for Python/Flask ML backend
//
// Both are now merged here. Import everything from utils/api:
//   import { getCourse, enrollCourse } from '../utils/api';          ← Node backend
//   import { getRecommendations }      from '../utils/api';          ← Python ML backend
//
// services/api.js is now a thin re-export of this file so existing
// imports in TeacherDashboard and StudentDetailPage continue to work.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';

// ── Axios instance — Node.js / Express backend ────────────────────────────────
const API = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally (redirect to login)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerUser  = (data) => API.post('/auth/register', data);
export const loginUser     = (data) => API.post('/auth/login', data);
export const logoutUser    = ()     => API.post('/auth/logout');
export const getMe         = ()     => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/update-profile', data);

// ── Courses ───────────────────────────────────────────────────────────────────
export const getCourses    = (params)    => API.get('/courses', { params });
export const getCourse     = (id)        => API.get(`/courses/${id}`);
export const createCourse  = (data)      => API.post('/courses', data);
export const updateCourse  = (id, data)  => API.put(`/courses/${id}`, data);
export const deleteCourse  = (id)        => API.delete(`/courses/${id}`);
export const togglePublish = (id)        => API.put(`/courses/${id}/publish`);
export const getMyCourses  = ()          => API.get('/courses/my-courses');

// ── Modules ───────────────────────────────────────────────────────────────────
export const getModules   = (courseId)        => API.get(`/courses/${courseId}/modules`);
export const createModule = (courseId, data)  => API.post(`/courses/${courseId}/modules`, data);
export const updateModule = (id, data)        => API.put(`/modules/${id}`, data);
export const deleteModule = (id)              => API.delete(`/modules/${id}`);

// ── Lessons ───────────────────────────────────────────────────────────────────
export const getLessons         = (moduleId)        => API.get(`/modules/${moduleId}/lessons`);
export const getLesson          = (id)              => API.get(`/lessons/${id}`);
export const createLesson       = (moduleId, data)  => API.post(`/modules/${moduleId}/lessons`, data);
export const updateLesson       = (id, data)        => API.put(`/lessons/${id}`, data);
export const deleteLesson       = (id)              => API.delete(`/lessons/${id}`);
export const markLessonComplete = (id, data)        => API.post(`/lessons/${id}/complete`, data);

// ── Quizzes ───────────────────────────────────────────────────────────────────
export const getQuizzesByLesson  = (lessonId)      => API.get(`/quizzes/lesson/${lessonId}`);
export const getQuizzesByModule  = (lessonId)      => API.get(`/quizzes/lesson/${lessonId}`);
export const createQuiz          = (moduleId, data) => API.post('/quizzes', { ...data, moduleId });
export const getQuiz             = (id)             => API.get(`/quizzes/${id}`);
export const getQuizFull         = (id)             => API.get(`/quizzes/${id}/full`);
export const updateQuiz          = (id, data)       => API.put(`/quizzes/${id}`, data);
export const deleteQuiz          = (id)             => API.delete(`/quizzes/${id}`);
export const publishQuiz         = (id)             => API.patch(`/quizzes/${id}/publish`);
export const submitQuiz          = (id, data)       => API.post(`/quizzes/${id}/attempt`, data);
export const getQuizResults      = (id)             => API.get(`/quizzes/${id}/my-attempts`);
export const getMyAttempts       = (id)             => API.get(`/quizzes/${id}/my-attempts`);
export const getAttempts         = (id)             => API.get(`/quizzes/${id}/attempts`);
export const aiGenerateQuiz      = (data)           => API.post('/quizzes/generate', data);
export const aiGenerateFromPdf   = (formData)       => API.post('/quizzes/generate-from-pdf', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const aiSaveGeneratedQuiz    = (data)     => API.post('/quizzes/save-generated', data);
export const getCourseQuizAnalytics = (courseId) => API.get(`/quizzes/analytics/course/${courseId}`);

// ── Enrollments ───────────────────────────────────────────────────────────────
export const enrollCourse     = (courseId)        => API.post(`/enrollments/${courseId}`);
export const getMyEnrollments = ()                => API.get('/enrollments/my');
export const getEnrollment    = (courseId)        => API.get(`/enrollments/${courseId}`);
export const unenrollCourse   = (courseId)        => API.delete(`/enrollments/${courseId}`);
export const updateProgress   = (courseId, data)  => API.put(`/enrollments/${courseId}/progress`, data);

// ── AI Recommendations (Node.js backend) ─────────────────────────────────────
export const generateRecommendations = ()               => API.post('/recommendations/generate');
export const getMyRecommendations    = ()               => API.get('/recommendations/my');
export const getMyAnalysis           = ()               => API.get('/recommendations/analysis');
export const dismissRecommendation   = (recId, itemId)  => API.put(`/recommendations/${recId}/item/${itemId}/dismiss`);

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getAdminStats          = ()       => API.get('/admin/stats');
export const getAllUsers             = (params) => API.get('/admin/users', { params });
export const toggleUserStatus       = (id)     => API.put(`/admin/users/${id}/toggle-status`);
export const getAllCoursesAdmin      = ()       => API.get('/admin/courses');
export const getPerformanceOverview = ()       => API.get('/admin/performance');

// ── Python / Flask ML backend calls ──────────────────────────────────────────
// These hit the Python Flask service (default port 5001, proxied via /ml).
// The proxy is configured in package.json or the Express server.
const ML_BASE = process.env.REACT_APP_ML_URL || '/ml';

async function mlRequest(path) {
  const res = await fetch(`${ML_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// GET /ml/api/recommendations/:studentId?top_n=5
export async function getRecommendations(studentId, topN = 5) {
  return mlRequest(`/api/recommendations/${studentId}?top_n=${topN}`);
}

// GET /ml/api/recommendations/:studentId/lime
export async function getLimeExplanation(studentId) {
  return mlRequest(`/api/recommendations/${studentId}/lime`);
}

// GET /ml/api/health
export async function getMLHealth() {
  return mlRequest('/api/health');
}

export default API;