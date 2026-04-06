// src/pages/CourseDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import { getCourse, enrollCourse, getEnrollment } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function CourseDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [openModule, setOpenModule] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await getCourse(id);
        setCourse(data.data);
        if (user?.role === 'student') {
          try {
            const { data: enData } = await getEnrollment(id);
            setEnrollment(enData.data);
          } catch {}
        }
      } catch { toast.error('Course not found'); navigate('/courses'); }
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleEnroll = async () => {
    if (!user) return navigate('/login');
    setEnrolling(true);
    try {
      await enrollCourse(id);
      toast.success('Enrolled successfully! 🎉');
      const { data: enData } = await getEnrollment(id);
      setEnrollment(enData.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Enrollment failed'); }
    setEnrolling(false);
  };

  if (loading) return <><Navbar /><Spinner center /></>;
  if (!course) return null;

  const totalLessons = course.modules?.reduce((s, m) => s + (m.lessons?.length || 0), 0) || 0;
  const totalDuration = course.estimatedDuration || 0;

  return (
    <div>
      <Navbar />
      {/* Hero Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#fff', padding: '3rem 0' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '3rem', alignItems: 'start' }}>
          <div>
            <span style={{ background: 'rgba(255,255,255,.15)', padding: '.3rem .8rem', borderRadius: 99, fontSize: '.8rem', fontWeight: 600 }}>
              {course.category?.replace('-',' ')} · {course.level}
            </span>
            <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', margin: '1rem 0 .75rem' }}>{course.title}</h1>
            <p style={{ opacity: .8, lineHeight: 1.65, marginBottom: '1.25rem', maxWidth: 560 }}>{course.description}</p>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '.85rem', opacity: .75, flexWrap: 'wrap' }}>
              <span>👨‍🏫 {course.tutor?.name}</span>
              <span>📚 {totalLessons} lessons</span>
              <span>⏱ {Math.round(totalDuration / 60)} hours</span>
              <span>👥 {course.enrollmentCount} students</span>
            </div>
          </div>

          {/* Enrollment Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1rem' }}>
              {course.isFree ? 'FREE' : `$${course.price}`}
            </div>
            {enrollment ? (
              <div>
                <div style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 'var(--radius-sm)', padding: '.75rem', marginBottom: '1rem', fontWeight: 600, fontSize: '.875rem' }}>
                  ✓ You are enrolled ({enrollment.completionPercentage}% complete)
                </div>
                {course.modules?.[0]?.lessons?.[0] && (
                  <Link to={`/learn/${id}/lesson/${course.modules[0].lessons[0]._id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '.6rem' }}>
                    Continue Learning →
                  </Link>
                )}
                <Link to={`/courses/${id}/quizzes`} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: '.5rem' }}>
                  View All Quizzes
                </Link>
              </div>
            ) : (
              <button onClick={handleEnroll} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={enrolling}>
                {enrolling ? 'Enrolling...' : `Enroll ${course.isFree ? 'for Free' : 'Now'} →`}
              </button>
            )}
            <div style={{ marginTop: '1rem', fontSize: '.8rem', color: 'var(--text-muted)' }}>
              {course.learningOutcomes?.length > 0 && (
                <>
                  <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '.5rem' }}>What you'll learn:</p>
                  {course.learningOutcomes.map((o, i) => (
                    <div key={i} style={{ display: 'flex', gap: '.4rem', marginBottom: '.3rem' }}>
                      <span style={{ color: 'var(--secondary)' }}>✓</span><span>{o}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Course Curriculum</h2>
        {course.modules?.map((mod) => (
          <div key={mod._id} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
            <button onClick={() => setOpenModule(openModule === mod._id ? null : mod._id)}
              style={{ width: '100%', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '.95rem' }}>Module {mod.order}: {mod.title}</span>
                <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginLeft: '.75rem' }}>
                  {mod.lessons?.length || 0} lessons
                </span>
              </div>
              <span style={{ color: 'var(--text-muted)', transform: openModule === mod._id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
            </button>
            {openModule === mod._id && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {mod.lessons?.map((lesson, idx) => (
                  <div key={lesson._id} style={{ padding: '.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '.75rem', borderBottom: idx < mod.lessons.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: '1rem' }}>{lesson.contentType === 'video' ? '🎬' : lesson.contentType === 'pdf' ? '📄' : '📝'}</span>
                    <span style={{ flex: 1, fontSize: '.875rem' }}>{lesson.title}</span>
                    <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{lesson.estimatedDuration} min</span>
                    {lesson.isFree && <span className="badge badge-success" style={{ fontSize: '.65rem' }}>Free</span>}
                    {enrollment && (
                      <Link to={`/learn/${id}/lesson/${lesson._id}`} style={{ fontSize: '.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                        {enrollment.completedLessons?.includes(lesson._id) ? '✓ Done' : 'Start →'}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}