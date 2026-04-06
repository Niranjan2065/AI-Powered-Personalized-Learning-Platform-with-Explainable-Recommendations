// src/utils/api.js - Axios instance with interceptors
import axios from 'axios';

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

// ── Auth ─────────────────────────────────────────────────────
export const registerUser   = (data) => API.post('/auth/register', data);
export const loginUser      = (data) => API.post('/auth/login', data);
export const logoutUser     = ()     => API.post('/auth/logout');
export const getMe          = ()     => API.get('/auth/me');
export const updateProfile  = (data) => API.put('/auth/update-profile', data);

// ── Courses ──────────────────────────────────────────────────
export const getCourses     = (params) => API.get('/courses', { params });
export const getCourse      = (id)     => API.get(`/courses/${id}`);
export const createCourse   = (data)   => API.post('/courses', data);
export const updateCourse   = (id, data) => API.put(`/courses/${id}`, data);
export const deleteCourse   = (id)     => API.delete(`/courses/${id}`);
export const togglePublish  = (id)     => API.put(`/courses/${id}/publish`);
export const getMyCourses   = ()       => API.get('/courses/my-courses');

// ── Modules ──────────────────────────────────────────────────
export const getModules     = (courseId)       => API.get(`/courses/${courseId}/modules`);
export const createModule   = (courseId, data) => API.post(`/courses/${courseId}/modules`, data);
export const updateModule   = (id, data)       => API.put(`/modules/${id}`, data);
export const deleteModule   = (id)             => API.delete(`/modules/${id}`);

// ── Lessons ──────────────────────────────────────────────────
export const getLessons          = (moduleId)       => API.get(`/modules/${moduleId}/lessons`);
export const getLesson           = (id)             => API.get(`/lessons/${id}`);
export const createLesson        = (moduleId, data) => API.post(`/modules/${moduleId}/lessons`, data);
export const updateLesson        = (id, data)       => API.put(`/lessons/${id}`, data);
export const deleteLesson        = (id)             => API.delete(`/lessons/${id}`);
export const markLessonComplete  = (id, data)       => API.post(`/lessons/${id}/complete`, data);

// ── Quizzes ──────────────────────────────────────────────────
// FIX 1: getQuizzesByModule now hits the correct backend URL
//         Old: /modules/:moduleId/quizzes  → 404 (never existed)
//         New: /quizzes/lesson/:lessonId   → correct route
//         NOTE: pass a lessonId, not a moduleId
export const getQuizzesByLesson  = (lessonId) => API.get(`/quizzes/lesson/${lessonId}`);

// FIX 2: kept old name so ManageCoursePage.js import still works —
//         but now hits the right URL (pass lessonId as argument)
export const getQuizzesByModule  = (lessonId) => API.get(`/quizzes/lesson/${lessonId}`);

// FIX 3: createQuiz now posts to /quizzes directly (not /modules/:id/quizzes)
//         Old: /modules/:moduleId/quizzes  → 404
//         New: /quizzes                    → correct route
export const createQuiz = (moduleId, data) => API.post('/quizzes', {
  ...data,
  moduleId,   // pass along so controller can use it if needed
});

// Standard quiz CRUD
export const getQuiz         = (id)     => API.get(`/quizzes/${id}`);
export const getQuizFull     = (id)     => API.get(`/quizzes/${id}/full`);
export const updateQuiz      = (id, data) => API.put(`/quizzes/${id}`, data);
export const deleteQuiz      = (id)     => API.delete(`/quizzes/${id}`);
export const publishQuiz     = (id)     => API.patch(`/quizzes/${id}/publish`);

// FIX 4: submitQuiz — old endpoint was /quizzes/:id/submit, new is /quizzes/:id/attempt
export const submitQuiz      = (id, data) => API.post(`/quizzes/${id}/attempt`, data);
export const getQuizResults  = (id)       => API.get(`/quizzes/${id}/my-attempts`);
export const getMyAttempts   = (id)       => API.get(`/quizzes/${id}/my-attempts`);
export const getAttempts     = (id)       => API.get(`/quizzes/${id}/attempts`);

// AI generation (NEW — used by ManageCoursePage.js AI panel)
export const aiGenerateQuiz = (data) =>
  API.post('/quizzes/generate', data);

export const aiGenerateFromPdf = (formData) =>
  API.post('/quizzes/generate-from-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const aiSaveGeneratedQuiz = (data) =>
  API.post('/quizzes/save-generated', data);

export const getCourseQuizAnalytics = (courseId) =>
  API.get(`/quizzes/analytics/course/${courseId}`);

// ── Enrollments ──────────────────────────────────────────────
export const enrollCourse    = (courseId)       => API.post(`/enrollments/${courseId}`);
export const getMyEnrollments= ()               => API.get('/enrollments/my');
export const getEnrollment   = (courseId)       => API.get(`/enrollments/${courseId}`);
export const unenrollCourse  = (courseId)       => API.delete(`/enrollments/${courseId}`);
export const updateProgress  = (courseId, data) => API.put(`/enrollments/${courseId}/progress`, data);

// ── AI Recommendations ───────────────────────────────────────
export const generateRecommendations = ()              => API.post('/recommendations/generate');
export const getMyRecommendations    = ()              => API.get('/recommendations/my');
export const getMyAnalysis           = ()              => API.get('/recommendations/analysis');
export const dismissRecommendation   = (recId, itemId) => API.put(`/recommendations/${recId}/item/${itemId}/dismiss`);

// ── Admin ────────────────────────────────────────────────────
export const getAdminStats         = ()       => API.get('/admin/stats');
export const getAllUsers            = (params) => API.get('/admin/users', { params });
export const toggleUserStatus      = (id)     => API.put(`/admin/users/${id}/toggle-status`);
export const getAllCoursesAdmin     = ()       => API.get('/admin/courses');
export const getPerformanceOverview= ()       => API.get('/admin/performance');

export default API;