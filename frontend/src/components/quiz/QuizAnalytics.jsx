// src/components/quiz/QuizAnalytics.jsx
// ─────────────────────────────────────────────────────────────
// Instructor analytics dashboard per course.
// Charts: score trend (area), score distribution (bar),
//         weak topic heatmap, quiz-level table, pass/fail donut.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── palette (reuses project CSS vars via inline style fallback) ──
const P  = '#6C63FF';   // primary
const G  = '#10B981';   // pass / good
const R  = '#EF4444';   // fail / danger
const AM = '#F59E0B';   // amber / warning
const DIST_COLORS = [R, AM, '#8B5CF6', P, G];

// ── tiny helpers ─────────────────────────────────────────────
const pct  = (n) => `${n}%`;
const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 14, padding: '1.25rem', marginBottom: 16 };

function MetricTile({ value, label, color, sub }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: '1.25rem 1rem' }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: color || 'var(--text-primary, #111)' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #9CA3AF)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #111)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface,#fff)', border: '1px solid var(--border,#E5E7EB)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: 0 }}>
          {p.name}: <strong>{p.value}{p.name?.includes('Score') ? '%' : ''}</strong>
        </p>
      ))}
    </div>
  );
};

export default function QuizAnalytics({ courseId }) {
  const [core,  setCore]  = useState(null);
  const [trend, setTrend] = useState([]);
  const [dist,  setDist]  = useState([]);
  const [tab,   setTab]   = useState('overview'); // 'overview' | 'trend' | 'topics' | 'quizzes'
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);

    const token = localStorage.getItem('token');
    const cfg   = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };

    Promise.all([
      axios.get(`${API}/quizzes/analytics/course/${courseId}`, cfg),
      axios.get(`${API}/quizzes/analytics/course/${courseId}/trend`, cfg).catch(() => ({ data: { data: [] } })),
      axios.get(`${API}/quizzes/analytics/course/${courseId}/distribution`, cfg).catch(() => ({ data: { data: [] } })),
    ])
      .then(([coreRes, trendRes, distRes]) => {
        setCore(coreRes.data.data);
        setTrend(trendRes.data.data || []);
        setDist(distRes.data.data  || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.response?.data?.message || 'Failed to load analytics');
        setLoading(false);
      });
  }, [courseId]);

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border,#E5E7EB)', borderTopColor: P, borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading analytics…</p>
    </div>
  );

  if (error) return <p style={{ color: R, fontSize: 13, padding: '1rem' }}>{error}</p>;
  if (!core) return null;

  const maxWeak  = core.topWeakTopics?.[0]?.count || 1;
  const aiCount  = core.quizzes.filter(q => q.isAIGenerated).length;
  const pubCount = core.quizzes.filter(q => q.isPublished).length;

  const donutData = [
    { name: 'Passed', value: Math.round(core.totalAttempts * core.passRate / 100) },
    { name: 'Failed', value: core.totalAttempts - Math.round(core.totalAttempts * core.passRate / 100) },
  ];

  // ── Tab nav ─────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'trend',    label: '📈 Trend' },
    { id: 'topics',   label: '🧠 Weak Topics' },
    { id: 'quizzes',  label: '📝 Quizzes' },
  ];

  const tabStyle = (id) => ({
    padding: '7px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: tab === id ? P : 'transparent',
    color: tab === id ? '#fff' : 'var(--text-secondary, #374151)',
    transition: 'all .15s',
  });

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '1.5rem 0' }}>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface-2,#F3F2FB)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} style={tabStyle(t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ══ OVERVIEW ═══════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Metric tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <MetricTile value={core.totalAttempts} label="Total Attempts" />
            <MetricTile value={pct(core.overallAverage)} label="Avg Score" color={core.overallAverage >= 70 ? G : R} />
            <MetricTile value={pct(core.passRate)} label="Pass Rate" color={core.passRate >= 60 ? G : AM} />
            <MetricTile value={core.quizzes.length} label="Quizzes" sub={`${pubCount} live · ${aiCount} AI`} />
          </div>

          {/* Pass/Fail donut + score distribution side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div style={card}>
              <SectionTitle>Pass vs Fail</SectionTitle>
              {core.totalAttempts === 0
                ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No attempts yet.</p>
                : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        <Cell fill={G} />
                        <Cell fill={R} />
                      </Pie>
                      <Tooltip formatter={(v) => [v, 'Students']} />
                      <Legend iconType="circle" iconSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              }
            </div>
            <div style={card}>
              <SectionTitle>Score Distribution</SectionTitle>
              {dist.every(d => d.count === 0)
                ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No data yet.</p>
                : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={dist} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#E5E7EB)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                        {dist.map((_, i) => <Cell key={i} fill={DIST_COLORS[i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>
        </>
      )}

      {/* ══ TREND ══════════════════════════════════════════════ */}
      {tab === 'trend' && (
        <div style={card}>
          <SectionTitle>📈 Average Score — Last 30 Days</SectionTitle>
          {trend.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No quiz activity in the last 30 days.</p>
            : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={P} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={P} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#E5E7EB)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="avgScore" name="Avg Score" stroke={P} strokeWidth={2.5} fill="url(#scoreGrad)" dot={{ r: 4, fill: P }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
          {trend.length > 0 && (
            <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border,#E5E7EB)' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Peak</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: G }}>
                  {Math.max(...trend.map(t => t.avgScore))}%
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Low</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: R }}>
                  {Math.min(...trend.map(t => t.avgScore))}%
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Days Active</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{trend.length}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ WEAK TOPICS ════════════════════════════════════════ */}
      {tab === 'topics' && (
        <div style={card}>
          <SectionTitle>🧠 Most-Missed Topics</SectionTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Ranked by number of students who got questions on this topic wrong. These feed into the AI recommendation engine automatically.
          </p>
          {core.topWeakTopics?.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No data yet — students haven't attempted quizzes.</p>
            : (
              <>
                {/* Horizontal bar chart */}
                <ResponsiveContainer width="100%" height={core.topWeakTopics.length * 44 + 40}>
                  <BarChart data={core.topWeakTopics} layout="vertical" barSize={18} margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#E5E7EB)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="topic" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [v, 'Errors']} />
                    <Bar dataKey="count" name="Errors" fill={R} radius={[0, 4, 4, 0]}>
                      {core.topWeakTopics.map((_, i) => {
                        const opacity = 1 - (i / core.topWeakTopics.length) * 0.5;
                        return <Cell key={i} fill={R} fillOpacity={opacity} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Text list with heat-bar */}
                <div style={{ marginTop: 16 }}>
                  {core.topWeakTopics.map(({ topic, count }) => (
                    <div key={topic} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{topic}</span>
                        <span style={{ color: R, fontWeight: 600 }}>{count} error{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border,#E5E7EB)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(count / maxWeak * 100)}%`, background: R, borderRadius: 3, transition: 'width .4s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      )}

      {/* ══ QUIZZES TABLE ══════════════════════════════════════ */}
      {tab === 'quizzes' && (
        <div style={card}>
          <SectionTitle>📝 Quiz Breakdown</SectionTitle>
          {core.quizzes.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No quizzes yet.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border,#E5E7EB)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0', fontWeight: 600 }}>Quiz</th>
                    <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center' }}>Attempts</th>
                    <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center' }}>Avg Score</th>
                    <th style={{ padding: '8px 0', fontWeight: 600, textAlign: 'right' }}>Score Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {core.quizzes.map((q, i) => {
                    const scoreColor = q.averageScore >= 80 ? G : q.averageScore >= 60 ? AM : R;
                    return (
                      <tr key={q._id} style={{ borderBottom: i < core.quizzes.length - 1 ? '1px solid var(--border,#E5E7EB)' : 'none' }}>
                        <td style={{ padding: '10px 0' }}>
                          <span style={{ fontWeight: 500 }}>{q.title}</span>
                          {q.isAIGenerated && (
                            <span style={{ marginLeft: 6, fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#EEF2FF', color: P, fontWeight: 600 }}>AI</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 600,
                            background: q.isPublished ? '#D1FAE5' : '#F3F4F6',
                            color:      q.isPublished ? '#065F46' : '#6B7280' }}>
                            {q.isPublished ? 'Live' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {q.totalAttempts ?? 0}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: q.totalAttempts ? scoreColor : 'var(--text-muted)' }}>
                          {q.totalAttempts ? `${q.averageScore}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', minWidth: 100 }}>
                          {q.totalAttempts > 0 && (
                            <div style={{ height: 8, background: 'var(--border,#E5E7EB)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${q.averageScore}%`, background: scoreColor, borderRadius: 4 }} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  );
}