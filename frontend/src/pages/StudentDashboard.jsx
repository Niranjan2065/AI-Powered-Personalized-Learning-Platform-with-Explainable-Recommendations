// src/pages/StudentDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { StatCard, Spinner, EmptyState, ProgressBar } from '../components/common/StatCard';
import { getMyEnrollments, getMyAnalysis } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [enRes, anRes] = await Promise.all([getMyEnrollments(), getMyAnalysis()]);
        setEnrollments(enRes.data.data);
        setAnalysis(anRes.data.data);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <><Navbar /><Spinner center /></>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        {/* Welcome */}
        <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '.3rem' }}>Welcome back, {user?.name?.split(' ')[0]}! 👋</h1>
            <p style={{ opacity: .85, fontSize: '.9rem' }}>Your AI-powered learning journey continues</p>
          </div>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <Link to="/courses" className="btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>
              Browse Courses
            </Link>
            <Link to="/recommendations" className="btn" style={{ background: '#fff', color: '#667eea', fontWeight: 700 }}>
              🤖 AI Recommendations
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '2rem' }}>
          <StatCard icon="📚" label="Enrolled Courses" value={enrollments.length} color="var(--primary)" />
          <StatCard icon="✅" label="Completed" value={enrollments.filter(e => e.status === 'completed').length} color="var(--secondary)" />
          <StatCard icon="📝" label="Quizzes Taken" value={analysis?.stats?.totalQuizzesTaken || 0} color="var(--accent)" />
          <StatCard icon="🏆" label="Avg Score" value={`${analysis?.stats?.averageScore || 0}%`} color="var(--info)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Enrolled Courses */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem' }}>My Courses</h2>
              <Link to="/courses" className="btn btn-outline btn-sm">+ Enroll More</Link>
            </div>
            {enrollments.length === 0 ? (
              <div className="card" style={{ padding: '2rem' }}>
                <EmptyState icon="📭" title="No enrollments yet" message="Browse courses and enroll to start learning"
                  action={<Link to="/courses" className="btn btn-primary">Browse Courses</Link>} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {enrollments.map(en => (
                  <div key={en._id} className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📚</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '.9rem', marginBottom: '.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{en.course?.title}</h4>
                      <ProgressBar value={en.completionPercentage} showLabel={false} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
                        <span>{en.completionPercentage}% complete</span>
                        <span>{Math.round(en.totalTimeSpent / 60)}h spent</span>
                      </div>
                    </div>
                    {en.course && (
                      <Link to={`/courses/${en.course._id}`} className="btn btn-primary btn-sm">Continue</Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Panel */}
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>Performance Analysis</h2>
            {!analysis?.hasData ? (
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📊</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>Complete quizzes to see your performance analysis here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {analysis.weakTopics?.length > 0 && (
                  <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)' }}>
                    <h4 style={{ fontSize: '.9rem', marginBottom: '.75rem', color: 'var(--danger)' }}>🔴 Weak Topics</h4>
                    {analysis.weakTopics.slice(0,3).map(t => (
                      <div key={t.topic} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.4rem', fontSize: '.8rem' }}>
                        <span style={{ textTransform: 'capitalize' }}>{t.topic}</span>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{t.percentage}%</span>
                      </div>
                    ))}
                  </div>
                )}
                {analysis.strongTopics?.length > 0 && (
                  <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--secondary)' }}>
                    <h4 style={{ fontSize: '.9rem', marginBottom: '.75rem', color: 'var(--secondary)' }}>🟢 Strong Topics</h4>
                    {analysis.strongTopics.slice(0,3).map(t => (
                      <div key={t.topic} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.4rem', fontSize: '.8rem' }}>
                        <span style={{ textTransform: 'capitalize' }}>{t.topic}</span>
                        <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{t.percentage}%</span>
                      </div>
                    ))}
                  </div>
                )}
                <Link to="/recommendations" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                  🤖 View AI Recommendations
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
