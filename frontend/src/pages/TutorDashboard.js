// src/pages/TutorDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { StatCard, Spinner, EmptyState } from '../components/common/StatCard';
import { getMyCourses, togglePublish, deleteCourse } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function TutorDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyCourses().then(({ data }) => { setCourses(data.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleToggle = async (id) => {
    try {
      const { data } = await togglePublish(id);
      setCourses(cs => cs.map(c => c._id === id ? { ...c, isPublished: data.data.isPublished } : c));
      toast.success(`Course ${data.data.isPublished ? 'published' : 'unpublished'}`);
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteCourse(id);
      setCourses(cs => cs.filter(c => c._id !== id));
      toast.success('Course deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const totalStudents = courses.reduce((s, c) => s + (c.enrollmentCount || 0), 0);
  const published = courses.filter(c => c.isPublished).length;

  if (loading) return <><Navbar /><Spinner center /></>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #7c3aed)', color: '#fff', borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '.3rem' }}>Tutor Dashboard 👨‍🏫</h1>
            <p style={{ opacity: .8, fontSize: '.9rem' }}>Welcome back, {user?.name}! Manage your courses below.</p>
          </div>
          <Link to="/tutor/courses/create" className="btn btn-lg" style={{ background: '#fff', color: '#7c3aed', fontWeight: 700 }}>
            + Create New Course
          </Link>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '2rem' }}>
          <StatCard icon="📚" label="Total Courses" value={courses.length} color="var(--primary)" />
          <StatCard icon="✅" label="Published" value={published} color="var(--secondary)" />
          <StatCard icon="📝" label="Drafts" value={courses.length - published} color="var(--accent)" />
          <StatCard icon="👥" label="Total Students" value={totalStudents} color="var(--info)" />
        </div>

        {/* Courses Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.1rem' }}>My Courses</h2>
            <Link to="/tutor/courses/create" className="btn btn-primary btn-sm">+ New Course</Link>
          </div>

          {courses.length === 0 ? (
            <EmptyState icon="📭" title="No courses yet" message="Create your first course to get started"
              action={<Link to="/tutor/courses/create" className="btn btn-primary">Create Course</Link>} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {['Course', 'Category', 'Level', 'Students', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '.75rem 1.25rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course, i) => (
                    <tr key={course._id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : 'var(--bg)' }}>
                      <td style={{ padding: '.9rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '.875rem', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{course.isFree ? 'Free' : `$${course.price}`}</div>
                      </td>
                      <td style={{ padding: '.9rem 1.25rem', fontSize: '.82rem', textTransform: 'capitalize' }}>{course.category?.replace('-',' ')}</td>
                      <td style={{ padding: '.9rem 1.25rem' }}>
                        <span className={`badge ${course.level === 'beginner' ? 'badge-success' : course.level === 'advanced' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize', fontSize: '.72rem' }}>{course.level}</span>
                      </td>
                      <td style={{ padding: '.9rem 1.25rem', fontSize: '.875rem', fontWeight: 600 }}>{course.enrollmentCount || 0}</td>
                      <td style={{ padding: '.9rem 1.25rem' }}>
                        <span className={`badge ${course.isPublished ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: '.72rem' }}>
                          {course.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '.9rem 1.25rem' }}>
                        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'nowrap' }}>
                          <Link to={`/tutor/courses/${course._id}/manage`} className="btn btn-ghost btn-sm">Manage</Link>
                          <button onClick={() => handleToggle(course._id)} className="btn btn-sm" style={{ background: course.isPublished ? '#FEF3C7' : '#D1FAE5', color: course.isPublished ? '#92400E' : '#065F46', border: 'none', cursor: 'pointer' }}>
                            {course.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          <button onClick={() => handleDelete(course._id, course.title)} className="btn btn-sm" style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', cursor: 'pointer' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
