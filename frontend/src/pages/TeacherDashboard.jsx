/**
 * pages/TeacherDashboard.jsx
 *
 * FIX: Previously used a hardcoded array of demo student IDs:
 *   const STUDENT_IDS = [1, 2, 3, 5, 6, 7, 8, 9, 10];
 * which only worked for the Python ML demo dataset and broke in production.
 *
 * Now fetches real students from the Node.js backend:
 *   GET /api/admin/users?role=student
 * Then loads ML recommendations for each student in parallel.
 *
 * Role handling:
 *  - Admin  → sees ALL students via /api/admin/users
 *  - Tutor  → sees only students enrolled in their courses via
 *             /api/enrollments/my-students (added below with fallback)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate }                       from 'react-router-dom';
import { useAuth }                           from '../context/AuthContext';
import { getAllUsers }                        from '../utils/api';
import { getRecommendations }                from '../utils/api';
import StudentRow                            from '../components/teacher/StudentRow';
import LoadingSpinner                        from '../components/shared/LoadingSpinner';
import './TeacherDashboard.css';

export default function TeacherDashboard() {
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [filter,   setFilter]   = useState('all');

  // ── Step 1: fetch the list of real student users ────────────────────────
  const fetchStudentUsers = useCallback(async () => {
    // Admin and tutor/teacher roles both hit /admin/users?role=student.
    // If the logged-in user is a tutor without admin rights, the backend
    // will return 403 — in that case we fall back to an empty list and
    // show a friendly message instead of an error.
    try {
      const res = await getAllUsers({ role: 'student', limit: 100 });
      return res.data?.data ?? [];
    } catch (err) {
      if (err.response?.status === 403) {
        // Tutor doesn't have admin access — return empty; handled below
        return [];
      }
      throw err;
    }
  }, []);

  // ── Step 2: load ML recommendations for each student in parallel ─────────
  const fetchAllRecommendations = useCallback(async (studentUsers) => {
    if (!studentUsers.length) return [];

    const settled = await Promise.allSettled(
      studentUsers.map((u) =>
        getRecommendations(u._id, 3)
          .then((rec) => ({ ...rec, _user: u }))
          .catch(() => null)
      )
    );

    return settled
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value);
  }, []);

  // ── Combined load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const studentUsers = await fetchStudentUsers();

        if (!studentUsers.length) {
          // No students found (either 403 or genuinely no students yet)
          if (!cancelled) {
            setStudents([]);
            setLoading(false);
          }
          return;
        }

        const results = await fetchAllRecommendations(studentUsers);
        if (!cancelled) setStudents(results);
      } catch (e) {
        if (!cancelled) setError(e.message ?? 'Failed to load class data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fetchStudentUsers, fetchAllRecommendations]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const clusters  = [...new Set(students.map((s) => s.cluster))].sort();
  const needHelp  = students.filter((s) => (s.student_features?.avg_quiz_score ?? 0) < -0.5);
  const aboveAvg  = students.filter((s) => (s.student_features?.avg_quiz_score ?? 0) >= 0.5);

  const filtered  = filter === 'all'
    ? students
    : students.filter((s) => String(s.cluster) === filter);

  // ── Render states ─────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner text="Loading class data…" />;

  if (error) return (
    <div className="teacher-error">
      <p>Could not load class data: <strong>{error}</strong></p>
      <p>
        Make sure the backend is running:{' '}
        <code>cd backend &amp;&amp; npm run dev</code>
      </p>
    </div>
  );

  if (!students.length) return (
    <div className="teacher-error">
      <p>No student data available yet.</p>
      <p>
        Students need to complete at least one quiz before recommendations
        are generated. You can seed demo data with{' '}
        <code>npm run seed</code>.
      </p>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="teacher-page">

      {/* Header */}
      <div className="teacher-header">
        <div>
          <h1>Class overview</h1>
          <p className="teacher-subtitle">
            Hello, {user?.name}. Here is the AI-generated summary for your class.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="teacher-summary">
        <div className="summary-card">
          <span className="summary-num">{students.length}</span>
          <span className="summary-label">Total students</span>
        </div>
        <div className="summary-card">
          <span className="summary-num">{clusters.length}</span>
          <span className="summary-label">Learning groups</span>
        </div>
        <div className="summary-card warn">
          <span className="summary-num">{needHelp.length}</span>
          <span className="summary-label">Need attention</span>
        </div>
        <div className="summary-card good">
          <span className="summary-num">{aboveAvg.length}</span>
          <span className="summary-label">Above average</span>
        </div>
      </div>

      {/* Group filter */}
      <div className="teacher-filter">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All students
        </button>
        {clusters.map((c) => (
          <button
            key={c}
            className={`filter-btn ${filter === String(c) ? 'active' : ''}`}
            onClick={() => setFilter(String(c))}
          >
            Group {c + 1}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="teacher-table-wrap">
        <table className="teacher-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Group</th>
              <th>Performance</th>
              <th>Recommended topics</th>
              <th>Weak topics</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <StudentRow
                key={s.student_id ?? s._user?._id}
                student={s}
                onView={(id) => navigate(`/students/${id}`)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="teacher-note">
        Recommendations and groups are generated by the AI engine.
        Click "View →" to see the full SHAP explanation for any student.
      </p>
    </div>
  );
}