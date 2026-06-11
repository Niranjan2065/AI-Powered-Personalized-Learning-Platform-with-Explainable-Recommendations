// pages/RecommendationsPage.jsx — Phase 11: ML + XAI Dashboard
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Navbar from '../components/shared/Navbar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const Spin = () => (
  <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'3rem auto' }} />
);

const ProgressBar = ({ pct, color='var(--primary)', height=8 }) => (
  <div style={{ background:'var(--border)', borderRadius:99, height, overflow:'hidden', flex:1 }}>
    <div style={{ width:`${Math.min(100, pct||0)}%`, height:'100%', background:color, borderRadius:99, transition:'width .6s ease' }} />
  </div>
);

const XAIBar = ({ label, pct, color='var(--primary)' }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.4rem' }}>
    <span style={{ fontSize:'.73rem', color:'var(--text-secondary)', width:120, flexShrink:0, textTransform:'capitalize' }}>{label}</span>
    <ProgressBar pct={pct} color={color} />
    <span style={{ fontSize:'.7rem', color:'var(--text-muted)', width:35, textAlign:'right', flexShrink:0 }}>{Math.round(pct)}%</span>
  </div>
);

// SHAP horizontal bar chart
// ── Feature 05: Student-friendly SHAP Visual Chart ───────────────────────────
// Maps raw SHAP feature names to plain English labels students understand.
const FEATURE_LABELS = {
  avg_quiz_score:       'Average Quiz Score',
  error_count:          'Error Rate',
  attempts:             'Number of Attempts',
  time_spent_minutes:   'Time Spent Studying',
  quiz_score:           'Latest Quiz Score',
  completion_rate:      'Course Completion',
  streak_days:          'Study Streak',
};

const FEATURE_TIPS = {
  avg_quiz_score:     { pos: 'Your strong quiz scores boosted this recommendation.', neg: 'Low quiz scores triggered this — this lesson targets your weak areas.' },
  error_count:        { pos: 'Low error rate — great accuracy so far!',               neg: 'High error count detected — this lesson will help fix common mistakes.' },
  attempts:           { pos: 'Multiple attempts show commitment — keep going.',       neg: 'You needed several tries — this lesson reinforces the concept.' },
  time_spent_minutes: { pos: 'Good study time investment detected.',                  neg: 'Spending more time here will improve retention.' },
  quiz_score:         { pos: 'Recent quiz score supports this topic.',                neg: 'Recent quiz score flagged this topic for review.' },
  completion_rate:    { pos: 'High completion rate — great progress!',               neg: 'Low completion detected — focus on finishing lessons.' },
  streak_days:        { pos: 'Consistent study streak — excellent habit!',           neg: 'Study more consistently to reinforce learning.' },
};

const ShapChart = ({ contributions, topic }) => {
  if (!contributions || !Object.keys(contributions).length) return null;

  // Normalise to 0–100% scale for student-friendly display
  const entries = Object.entries(contributions)
    .map(([key, value]) => ({
      key,
      label:    FEATURE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      rawValue: parseFloat(value),
      abs:      Math.abs(parseFloat(value)),
    }))
    .sort((a, b) => b.abs - a.abs)
    .slice(0, 6);

  const maxAbs = Math.max(...entries.map(e => e.abs), 0.001);

  // Top positive and negative factors for the "Why this matters" summary
  const topNeg = entries.filter(e => e.rawValue < 0)[0];
  const topPos = entries.filter(e => e.rawValue > 0)[0];

  return (
    <div style={{ marginTop:'1.25rem', background:'var(--bg)', borderRadius:12,
                  padding:'1.25rem', border:'1px solid var(--border)' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:'1rem', flexWrap:'wrap', gap:'.5rem' }}>
        <div>
          <div style={{ fontSize:'.78rem', fontWeight:700, color:'#1D4ED8', marginBottom:'.15rem' }}>
            🧠 Why AI recommended this{topic ? ` for "${topic}"` : ''}
          </div>
          <div style={{ fontSize:'.68rem', color:'var(--text-muted)' }}>
            SHAP explainability — each bar shows how much each factor influenced this recommendation
          </div>
        </div>
      </div>

      {/* Bars */}
      <div style={{ display:'flex', flexDirection:'column', gap:'.6rem' }}>
        {entries.map((e) => {
          const pct     = (e.abs / maxAbs) * 100;
          const isPos   = e.rawValue >= 0;
          const barColor = isPos ? '#059669' : '#DC2626';
          const bgColor  = isPos ? '#D1FAE5' : '#FEE2E2';
          const tip      = (FEATURE_TIPS[e.key] || {})[isPos ? 'pos' : 'neg'];

          return (
            <div key={e.key} title={tip || ''}>
              {/* Label row */}
              <div style={{ display:'flex', justifyContent:'space-between',
                            alignItems:'center', marginBottom:'.25rem' }}>
                <span style={{ fontSize:'.78rem', fontWeight:500,
                               color:'var(--text-secondary)', textTransform:'capitalize' }}>
                  {isPos ? '↑' : '↓'} {e.label}
                </span>
                <span style={{ fontSize:'.72rem', fontWeight:600, color: barColor }}>
                  {isPos ? '+' : '−'}{(e.abs * 100).toFixed(1)}
                </span>
              </div>
              {/* Bar track */}
              <div style={{ background:'var(--border)', borderRadius:99, height:10, overflow:'hidden' }}>
                <div style={{
                  width:`${pct}%`, height:'100%', background: barColor,
                  borderRadius:99, transition:'width .7s cubic-bezier(.4,0,.2,1)',
                  position:'relative',
                }}>
                  <div style={{
                    position:'absolute', inset:0, background: bgColor,
                    opacity:0.35, borderRadius:99,
                  }} />
                </div>
              </div>
              {/* Tip line */}
              {tip && (
                <div style={{ fontSize:'.67rem', color: isPos ? '#065F46' : '#991B1B',
                              marginTop:'.2rem', lineHeight:1.4 }}>
                  {tip}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary callout */}
      {(topNeg || topPos) && (
        <div style={{ marginTop:'1rem', padding:'.75rem 1rem',
                      background:'#EFF6FF', borderRadius:8,
                      border:'1px solid #BFDBFE', fontSize:'.78rem',
                      color:'#1E40AF', lineHeight:1.6 }}>
          <strong>📌 Key insight: </strong>
          {topNeg
            ? `Your ${topNeg.label.toLowerCase()} is the main reason the AI flagged this topic for improvement.`
            : `Your ${topPos?.label.toLowerCase()} is your biggest strength contributing to this recommendation.`}
          {topNeg && topPos && ` Meanwhile, your ${topPos.label.toLowerCase()} is a strong point to build on.`}
        </div>
      )}

      {/* Legend */}
      <div style={{ display:'flex', gap:'1.25rem', marginTop:'.75rem',
                    fontSize:'.67rem', color:'var(--text-muted)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
          <span style={{ width:10, height:10, borderRadius:2, background:'#059669', display:'inline-block' }}/>
          Positive factor (strength)
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
          <span style={{ width:10, height:10, borderRadius:2, background:'#DC2626', display:'inline-block' }}/>
          Negative factor (needs work)
        </span>
      </div>
    </div>
  );
};

const priorityColors = {
  high:   { bg:'#EDE9FE', text:'#5B21B6', border:'var(--primary)' },
  medium: { bg:'#D1FAE5', text:'#065F46', border:'var(--secondary)' },
  low:    { bg:'#FEF3C7', text:'#92400E', border:'var(--accent)' },
};

const EngineBadge = ({ engine }) => {
  const isML = engine === 'ml-v1';
  return (
    <span style={{
      padding:'.2rem .6rem', borderRadius:99, fontSize:'.65rem', fontWeight:700,
      background: isML ? '#DBEAFE' : '#F3F4F6',
      color:      isML ? '#1D4ED8' : '#6B7280',
      border: `1px solid ${isML ? '#93C5FD' : '#E5E7EB'}`,
    }}>
      {isML ? '🤖 ML Powered' : '📋 Rule-Based'}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function RecommendationsPage() {
  const { user }                          = useAuth();
  const [recs,       setRecs]             = useState([]);
  const [analysis,   setAnalysis]         = useState(null);
  const [mlInsights, setMlInsights]       = useState(null);
  const [engine,     setEngine]           = useState(null);
  const [loading,    setLoading]          = useState(true);
  const [generating, setGenerating]       = useState(false);
  const [noData,     setNoData]           = useState(false);
  const [expandShap, setExpandShap]       = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, anRes] = await Promise.allSettled([
        api.get('/recommendations/my'),
        api.get('/recommendations/analysis'),
      ]);

      if (recRes.status === 'fulfilled') {
        const d   = recRes.value.data;
        const raw = d.data;
        let recsArr = [];
        if (Array.isArray(raw))                       recsArr = raw;
        else if (Array.isArray(raw?.recommendations)) recsArr = raw.recommendations;
        else if (Array.isArray(raw?.items))           recsArr = raw.items;
        setRecs(recsArr);
        if (!raw) setNoData(true);

        // Detect engine from generatedBy field
        if (raw?.generatedBy) setEngine(raw.generatedBy);

        // ML cluster + SHAP from analysisSummary
        if (raw?.analysisSummary?.shapExplanation) {
          setMlInsights({
            cluster:          raw.analysisSummary.mlCluster,
            shapContributions: raw.analysisSummary.shapExplanation?.shap_contributions,
            humanReadable:    raw.analysisSummary.shapExplanation?.human_readable,
            weakTopicNote:    raw.analysisSummary.shapExplanation?.weak_topic_note,
          });
        }
      }

      if (anRes.status === 'fulfilled') {
        const d = anRes.value.data;
        if (d.data?.hasData) {
          setAnalysis(d.data);
          if (d.data.mlInsights) setMlInsights(d.data.mlInsights);
        } else {
          setNoData(true);
        }
      }
    } catch {
      toast.error('Failed to load recommendations');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Feature 04: Real-time auto-refresh ───────────────────────────────────────
  // Poll every 15s so if the backend silently regenerated recommendations after
  // a quiz attempt, the page picks up the new data without any user action.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [recRes, anRes] = await Promise.allSettled([
          api.get('/recommendations/my'),
          api.get('/recommendations/analysis'),
        ]);
        if (recRes.status === 'fulfilled') {
          const raw = recRes.value.data?.data;
          if (!raw) return;
          let recsArr = [];
          if (Array.isArray(raw))                       recsArr = raw;
          else if (Array.isArray(raw?.recommendations)) recsArr = raw.recommendations;
          else if (Array.isArray(raw?.items))           recsArr = raw.items;
          setRecs(prev => {
            // Only update (and show toast) if rec count or latest ID changed
            const prevId  = prev?.[0]?._id;
            const newId   = recsArr?.[0]?._id;
            if (newId && newId !== prevId) {
              toast.info('🤖 Your learning path was just updated!', { autoClose: 3500 });
              return recsArr;
            }
            return prev;
          });
          if (raw?.generatedBy) setEngine(raw.generatedBy);
          if (raw?.analysisSummary?.shapExplanation) {
            setMlInsights({
              cluster:           raw.analysisSummary.mlCluster,
              shapContributions: raw.analysisSummary.shapExplanation?.shap_contributions,
              humanReadable:     raw.analysisSummary.shapExplanation?.human_readable,
              weakTopicNote:     raw.analysisSummary.shapExplanation?.weak_topic_note,
            });
          }
        }
        if (anRes.status === 'fulfilled') {
          const d = anRes.value.data;
          if (d.data?.hasData) {
            setAnalysis(d.data);
            if (d.data.mlInsights) setMlInsights(d.data.mlInsights);
          }
        }
      } catch { /* silent — don't disrupt the UI */ }
    }, 15000); // poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/recommendations/generate');
      if (data.success) {
        toast.success('New personalized learning path generated! 🤖');
        setEngine(data.engine || null);
        await loadData();
        setNoData(false);
      } else {
        toast.info(data.message || 'Not enough data. Complete some quizzes first.');
        setNoData(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    }
    setGenerating(false);
  };

  const toggleShap = (id) => setExpandShap(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ padding:'2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'.25rem' }}>
              <h1 style={{ fontSize:'1.5rem', margin:0 }}>🤖 AI Learning Path</h1>
              {engine && <EngineBadge engine={engine} />}
            </div>
            <p style={{ color:'var(--text-muted)', fontSize:'.875rem', margin:0 }}>
              Personalized recommendations · KMeans Clustering + Collaborative Filtering + SHAP
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || loading}>
            {generating ? '🔄 Generating…' : '⚡ Generate New Path'}
          </button>
        </div>

        {loading ? <Spin /> : (
          <>
            {/* No Data State */}
            {noData && !analysis && (
              <div className="card" style={{ padding:'3rem', textAlign:'center', maxWidth:540, margin:'0 auto' }}>
                <div style={{ fontSize:'4rem', marginBottom:'1rem' }}>📊</div>
                <h2 style={{ fontSize:'1.25rem', marginBottom:'.75rem' }}>No Data Yet</h2>
                <p style={{ color:'var(--text-muted)', lineHeight:1.65, marginBottom:'1.5rem' }}>
                  Complete at least one quiz to get your AI-powered personalized learning path with explainable recommendations.
                </p>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'center', flexWrap:'wrap' }}>
                  <Link to="/courses" className="btn btn-primary">Browse Courses</Link>
                  <Link to="/student" className="btn btn-outline">Dashboard</Link>
                </div>
              </div>
            )}

            {/* ML Cluster Insight Banner */}
            {mlInsights?.cluster !== undefined && (
              <div className="card" style={{ padding:'1rem 1.5rem', marginBottom:'1.5rem', background:'linear-gradient(135deg,#EDE9FE,#DBEAFE)', border:'1px solid #C4B5FD', display:'flex', gap:'1rem', alignItems:'flex-start', flexWrap:'wrap' }}>
                <div style={{ fontSize:'2rem' }}>🔬</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:'#1D4ED8', marginBottom:'.25rem' }}>
                    ML Cluster {mlInsights.cluster} — Your Learning Group
                  </div>
                  {mlInsights.humanReadable && (
                    <p style={{ fontSize:'.85rem', color:'#374151', margin:0, lineHeight:1.6 }}>
                      {mlInsights.humanReadable}
                    </p>
                  )}
                  {mlInsights.weakTopicNote && (
                    <p style={{ fontSize:'.8rem', color:'#92400E', margin:'.4rem 0 0', background:'#FEF3C7', padding:'.4rem .75rem', borderRadius:6 }}>
                      ⚠️ {mlInsights.weakTopicNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {analysis && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'2rem' }}>

                {/* Performance Overview */}
                {/* ── Improved Performance Overview ───────────────────────── */}
                <div className="card" style={{ padding:'1.5rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
                    <h3 style={{ fontSize:'1rem', margin:0 }}>📈 Performance Overview</h3>
                    {mlInsights?.cluster !== undefined && (
                      <span style={{ fontSize:'.68rem', padding:'.2rem .65rem', borderRadius:99,
                                     background:'#EDE9FE', color:'#5B21B6', fontWeight:600, border:'1px solid #C4B5FD' }}>
                        🔬 ML Cluster {mlInsights.cluster}
                      </span>
                    )}
                  </div>

                  {/* ── Stat grid: 6 real metrics ── */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.75rem', marginBottom:'1.25rem' }}>
                    {[
                      {
                        icon: '🎯',
                        label: 'Overall Score',
                        val: `${analysis.overallScore}%`,
                        color: analysis.overallScore >= 80 ? '#059669' : analysis.overallScore >= 60 ? '#D97706' : '#DC2626',
                        sub: analysis.overallScore >= 80 ? 'Excellent' : analysis.overallScore >= 60 ? 'On track' : 'Needs work',
                      },
                      {
                        icon: '📝',
                        label: 'Quizzes Taken',
                        val: analysis.stats?.totalQuizzesTaken || 0,
                        color: '#1D4ED8',
                        sub: `${analysis.stats?.quizzesPassed || 0} passed`,
                      },
                      {
                        icon: '✅',
                        label: 'Pass Rate',
                        val: analysis.stats?.totalQuizzesTaken
                          ? `${Math.round((analysis.stats.quizzesPassed / analysis.stats.totalQuizzesTaken) * 100)}%`
                          : '—',
                        color: '#059669',
                        sub: 'Quiz pass rate',
                      },
                      {
                        icon: '📚',
                        label: 'Lessons Done',
                        val: analysis.stats?.completedLessons || 0,
                        color: '#7C3AED',
                        sub: 'Completed',
                      },
                      {
                        icon: '⏱️',
                        label: 'Study Time',
                        val: analysis.stats?.totalTimeSpentMinutes
                          ? `${analysis.stats.totalTimeSpentMinutes}m`
                          : '—',
                        color: '#0891B2',
                        sub: 'Total minutes',
                      },
                      {
                        icon: '🔴',
                        label: 'Weak Topics',
                        val: analysis.weakTopics?.length || 0,
                        color: analysis.weakTopics?.length > 0 ? '#DC2626' : '#059669',
                        sub: analysis.weakTopics?.length > 0 ? 'Need focus' : 'All clear!',
                      },
                    ].map(s => (
                      <div key={s.label} style={{
                        background:'var(--bg)', border:'1px solid var(--border)',
                        borderRadius:10, padding:'.75rem', textAlign:'center',
                      }}>
                        <div style={{ fontSize:'1.1rem', marginBottom:'.2rem' }}>{s.icon}</div>
                        <div style={{ fontSize:'1.4rem', fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
                        <div style={{ fontSize:'.67rem', fontWeight:600, color:'var(--text-secondary)', margin:'.2rem 0 .1rem' }}>{s.label}</div>
                        <div style={{ fontSize:'.63rem', color:'var(--text-muted)' }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Course progress bars ── */}
                  {analysis.courseProgress?.length > 0 && (
                    <div style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'.5rem' }}>
                        📖 Course Progress
                      </div>
                      {analysis.courseProgress.map((c, i) => (
                        <div key={i} style={{ marginBottom:'.5rem' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.75rem', marginBottom:'.2rem' }}>
                            <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{c.courseTitle}</span>
                            <span style={{ color: c.completionPct >= 80 ? '#059669' : c.completionPct >= 40 ? '#D97706' : '#DC2626', fontWeight:600 }}>
                              {Math.round(c.completionPct || 0)}%
                            </span>
                          </div>
                          <div style={{ background:'var(--border)', borderRadius:99, height:7, overflow:'hidden' }}>
                            <div style={{
                              width:`${Math.min(100, c.completionPct || 0)}%`, height:'100%', borderRadius:99,
                              background: c.completionPct >= 80 ? '#059669' : c.completionPct >= 40 ? '#D97706' : '#DC2626',
                              transition:'width .6s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Weak topics ── */}
                  {analysis.weakTopics?.length > 0 && (
                    <div style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:'.75rem', fontWeight:700, color:'#DC2626', marginBottom:'.5rem' }}>
                        🔴 Topics Needing Improvement
                      </div>
                      {analysis.weakTopics.map(t => (
                        <div key={t.topic} style={{ marginBottom:'.4rem' }}>
                          <XAIBar label={t.topic} pct={t.percentage} color="#DC2626" />
                          <div style={{ fontSize:'.67rem', color:'#991B1B', marginTop:'.1rem' }}>
                            {t.quizzesTaken} quiz{t.quizzesTaken !== 1 ? 'zes' : ''} taken · avg {Math.round(t.percentage)}%
                            {t.percentage < 40 ? ' · ⚠️ High priority' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Average topics ── */}
                  {analysis.averageTopics?.length > 0 && (
                    <div style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:'.75rem', fontWeight:700, color:'#D97706', marginBottom:'.5rem' }}>
                        🟡 Average Topics (60–79%)
                      </div>
                      {analysis.averageTopics.map(t => (
                        <XAIBar key={t.topic} label={t.topic} pct={t.percentage} color="#D97706" />
                      ))}
                    </div>
                  )}

                  {/* ── Strong topics ── */}
                  {analysis.strongTopics?.length > 0 && (
                    <div style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:'.75rem', fontWeight:700, color:'#059669', marginBottom:'.5rem' }}>
                        🟢 Strong Topics (80%+)
                      </div>
                      {analysis.strongTopics.map(t => (
                        <XAIBar key={t.topic} label={t.topic} pct={t.percentage} color="#059669" />
                      ))}
                    </div>
                  )}

                  {/* ── ML learning level badge ── */}
                  {analysis.detectedLevel && (
                    <div style={{ marginTop:'.75rem', padding:'.6rem 1rem', borderRadius:8,
                                  background: analysis.detectedLevel === 'advanced' ? '#D1FAE5'
                                            : analysis.detectedLevel === 'intermediate' ? '#FEF3C7' : '#FEE2E2',
                                  border:'1px solid var(--border)', fontSize:'.78rem', fontWeight:500 }}>
                      🧠 ML detected your level: <strong style={{ textTransform:'capitalize' }}>
                        {analysis.detectedLevel}
                      </strong>
                      {analysis.detectedLevel === 'beginner' && ' — Focus on fundamentals first.'}
                      {analysis.detectedLevel === 'intermediate' && ' — You are making solid progress!'}
                      {analysis.detectedLevel === 'advanced' && ' — Ready for advanced challenges!'}
                    </div>
                  )}

                  {/* ── SHAP chart ── */}
                  {mlInsights?.shapContributions && (
                    <ShapChart
                      contributions={mlInsights.shapContributions}
                      topic={analysis?.weakTopics?.[0]?.topic}
                    />
                  )}
                </div>

                {/* Quiz History */}
                <div className="card" style={{ padding:'1.5rem' }}>
                  <h3 style={{ fontSize:'1rem', marginBottom:'1rem' }}>📝 Quiz History</h3>
                  {analysis.recentHistory?.length > 0 ? analysis.recentHistory.slice(0, 6).map((r, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.55rem 0', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={{ fontSize:'.82rem', fontWeight:500 }}>{r.quizTitle}</div>
                        <div style={{ fontSize:'.7rem', color:'var(--text-muted)' }}>{r.courseTitle}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'.9rem', fontWeight:700, color: r.score >= 70 ? 'var(--secondary)' : 'var(--danger)' }}>
                          {Math.round(r.score||0)}%
                        </div>
                        <div style={{ fontSize:'.65rem', color: r.passed ? 'var(--secondary)' : 'var(--danger)' }}>
                          {r.passed ? '✓ Passed' : '✗ Failed'}
                        </div>
                      </div>
                    </div>
                  )) : <p style={{ color:'var(--text-muted)', fontSize:'.85rem' }}>No quiz history yet.</p>}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {recs.length > 0 && (
              <div>
                <h2 style={{ fontSize:'1.15rem', marginBottom:'1rem' }}>🎯 Your Personalized Learning Path</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  {recs.map((rec, i) => {
                    // priority stored as number 1-10 — map to label
                    const priorityNum = typeof rec.priority === 'number' ? rec.priority : 5;
                    const priorityLabel = priorityNum >= 8 ? 'high' : priorityNum >= 5 ? 'medium' : 'low';
                    const c = priorityColors[priorityLabel];

                    // Per-card SHAP: collect from reasonFactors
                    const shapFactor = rec.reasonFactors?.find(f => f.factor === 'shap_top_feature');

                    return (
                      <div key={rec._id || i} className="card" style={{ padding:'1.25rem', borderLeft:`4px solid ${c.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem', flexWrap:'wrap' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.4rem', flexWrap:'wrap' }}>
                              <span style={{ padding:'.15rem .55rem', borderRadius:99, fontSize:'.65rem', fontWeight:700, background:c.bg, color:c.text }}>
                                {priorityLabel.toUpperCase()}
                              </span>
                              <span style={{ fontSize:'.72rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:600 }}>
                                {String(rec.type || 'resource')}
                              </span>
                              {engine === 'ml-v1' && (
                                <span style={{ fontSize:'.62rem', background:'#DBEAFE', color:'#1D4ED8', padding:'.1rem .4rem', borderRadius:99, fontWeight:600 }}>
                                  ML
                                </span>
                              )}
                            </div>

                            <h3 style={{ fontSize:'.95rem', marginBottom:'.4rem' }}>
                              {String(rec.itemId?.title || rec.itemTitle || 'Recommended Resource')}
                            </h3>

                            {/* XAI Explanation */}
                            {rec.explanation && (
                              <div className="xai-explanation">
                                <span className="xai-icon">💡</span>
                                <span>{String(rec.explanation)}</span>
                              </div>
                            )}

                            {/* Reason Factors */}
                            {rec.reasonFactors?.length > 0 && (
                              <div style={{ marginTop:'.75rem' }}>
                                <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'.4rem' }}>WHY THIS WAS RECOMMENDED:</div>
                                {rec.reasonFactors.map((f, fi) => (
                                  <div key={fi} style={{ display:'flex', alignItems:'flex-start', gap:'.5rem', marginBottom:'.25rem', fontSize:'.75rem' }}>
                                    <span style={{ color:'var(--primary)', flexShrink:0 }}>→</span>
                                    <span style={{ color:'var(--text-secondary)' }}>{f.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {rec.addressesTopic && (
                              <div style={{ marginTop:'.5rem', fontSize:'.73rem', color:'var(--text-muted)' }}>
                                📌 Targets: <strong style={{ color:'var(--danger)', textTransform:'capitalize' }}>{String(rec.addressesTopic)}</strong>
                              </div>
                            )}

                            {/* Per-card SHAP toggle */}
                            {shapFactor && (
                              <div style={{ marginTop:'.75rem' }}>
                                <button
                                  onClick={() => toggleShap(rec._id || i)}
                                  style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'.25rem .6rem', fontSize:'.72rem', cursor:'pointer', color:'var(--text-secondary)' }}
                                >
                                  {expandShap[rec._id || i] ? '▲ Hide SHAP detail' : '▼ Show SHAP detail'}
                                </button>
                                {expandShap[rec._id || i] && mlInsights?.shapContributions && (
                                  <ShapChart
                                    contributions={mlInsights.shapContributions}
                                    topic={rec.addressesTopic}
                                  />
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:'.72rem', color:'var(--text-muted)', marginBottom:'.5rem' }}>
                              Confidence: <strong style={{ color:'var(--primary)' }}>{typeof rec.confidence === 'number' ? rec.confidence : 70}%</strong>
                            </div>
                            {rec.isDismissed ? (
                              <span style={{ fontSize:'.75rem', color:'var(--text-muted)' }}>Dismissed</span>
                            ) : (
                              <Link to="/courses" className="btn btn-primary btn-sm">Start Learning →</Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recs.length === 0 && analysis && (
              <div className="card" style={{ padding:'2.5rem', textAlign:'center' }}>
                <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✨</div>
                <h3 style={{ marginBottom:'.5rem' }}>Generate Your Learning Path</h3>
                <p style={{ color:'var(--text-muted)', marginBottom:'1.5rem' }}>
                  Click the button above to generate ML-powered personalized recommendations with SHAP explanations.
                </p>
                <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                  {generating ? '🔄 Generating…' : '⚡ Generate Learning Path'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}