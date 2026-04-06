// src/components/quiz/QuizAnalytics.jsx
// ─────────────────────────────────────────────────────────────
// Instructor-facing analytics dashboard per course.
// Shows: overall pass rate, average score, weak topics heatmap,
// per-quiz stats, and AI vs manual quiz breakdown.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const s = {
  wrap:      { fontFamily: "'DM Sans', system-ui, sans-serif", padding: '1.5rem 0' },
  grid3:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' },
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' },
  metricCard:{ background: '#f9fafb', borderRadius: 12, padding: '1rem 1.25rem', textAlign: 'center' },
  metricNum: { fontSize: 28, fontWeight: 800, color: '#111827' },
  metricLbl: { fontSize: 12, color: '#6b7280', marginTop: 3 },
  card:      { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: '1rem' },
  row:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
               padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 },
  badge:     (color) => ({ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
               background: color + '1a', color }),
  barWrap:   { display: 'flex', alignItems: 'center', gap: 10 },
  barTrack:  { flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill:   (pct, color) => ({ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }),
  pill:      (type) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
    padding: '4px 10px', borderRadius: 999, margin: '3px',
    background: type === 'weak' ? '#fef2f2' : '#f0fdf4',
    color:      type === 'weak' ? '#dc2626'  : '#16a34a',
  }),
  aiTag:     { fontSize: 11, padding: '2px 7px', borderRadius: 999,
               background: '#eff6ff', color: '#2563eb', fontWeight: 600 },
};

export default function QuizAnalytics({ courseId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    axios.get(`${API}/quizzes/analytics/course/${courseId}`, { withCredentials: true })
      .then(r => { setData(r.data.data); setLoading(false); })
      .catch(e => { setError(e.response?.data?.message || 'Failed to load analytics'); setLoading(false); });
  }, [courseId]);

  if (loading) return <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading analytics…</p>;
  if (error)   return <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>;
  if (!data)   return null;

  const maxWeak = data.topWeakTopics?.[0]?.count || 1;
  const aiCount = data.quizzes.filter(q => q.isAIGenerated).length;
  const pubCount = data.quizzes.filter(q => q.isPublished).length;

  return (
    <div style={s.wrap}>

      {/* ── Top metrics ── */}
      <div style={s.grid3}>
        <div style={s.metricCard}>
          <div style={s.metricNum}>{data.totalAttempts}</div>
          <div style={s.metricLbl}>Total attempts</div>
        </div>
        <div style={s.metricCard}>
          <div style={{ ...s.metricNum, color: data.overallAverage >= 70 ? '#16a34a' : '#dc2626' }}>
            {data.overallAverage}%
          </div>
          <div style={s.metricLbl}>Average score</div>
        </div>
        <div style={s.metricCard}>
          <div style={{ ...s.metricNum, color: data.passRate >= 60 ? '#16a34a' : '#d97706' }}>
            {data.passRate}%
          </div>
          <div style={s.metricLbl}>Pass rate</div>
        </div>
      </div>

      <div style={s.grid2}>
        {/* ── Quiz overview ── */}
        <div style={s.card}>
          <div style={s.cardTitle}>Quizzes ({data.quizzes.length})</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: '0.75rem' }}>
            {pubCount} published · {aiCount} AI-generated
          </div>
          {data.quizzes.map(q => (
            <div key={q._id} style={s.row}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500 }}>{q.title}</span>
                {q.isAIGenerated && <span style={{ ...s.aiTag, marginLeft: 6 }}>AI</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{q.totalAttempts} attempts</span>
                <span style={s.badge(q.isPublished ? '#16a34a' : '#9ca3af')}>
                  {q.isPublished ? 'Live' : 'Draft'}
                </span>
                {q.totalAttempts > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: q.averageScore >= 70 ? '#16a34a' : '#dc2626' }}>
                    {q.averageScore}%
                  </span>
                )}
              </div>
            </div>
          ))}
          {data.quizzes.length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No quizzes yet.</p>
          )}
        </div>

        {/* ── Weak topics ── */}
        <div style={s.card}>
          <div style={s.cardTitle}>Top weak topics</div>
          {data.topWeakTopics?.length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No data yet — students haven't attempted quizzes.</p>
          )}
          {data.topWeakTopics?.map(({ topic, count }) => (
            <div key={topic} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{topic}</span>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>{count} errors</span>
              </div>
              <div style={s.barTrack}>
                <div style={s.barFill(Math.round((count / maxWeak) * 100), '#dc2626')} />
              </div>
            </div>
          ))}
          {data.topWeakTopics?.length > 0 && (
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: '0.75rem' }}>
              These topics feed into the recommendation engine automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}