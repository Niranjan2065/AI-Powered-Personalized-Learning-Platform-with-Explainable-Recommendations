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
const ShapChart = ({ contributions }) => {
  if (!contributions || !Object.keys(contributions).length) return null;
  const data = Object.entries(contributions)
    .map(([name, value]) => ({ name, value: parseFloat(value), abs: Math.abs(parseFloat(value)) }))
    .sort((a, b) => b.abs - a.abs)
    .slice(0, 6);

  return (
    <div style={{ marginTop:'1rem', background:'var(--bg)', borderRadius:10, padding:'1rem', border:'1px solid var(--border)' }}>
      <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'.6rem', textTransform:'uppercase', letterSpacing:'.05em' }}>
        🧠 SHAP Feature Contributions
      </div>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top:0, right:16, left:4, bottom:0 }}>
          <XAxis type="number" tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={v => [v.toFixed(4), 'SHAP value']}
            contentStyle={{ fontSize:11, borderRadius:8, border:'1px solid var(--border)' }}
          />
          <Bar dataKey="value" radius={[0,4,4,0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.value >= 0 ? '#1d9e75' : '#d85a30'} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:'1rem', marginTop:'.5rem', fontSize:'.68rem', color:'var(--text-muted)' }}>
        <span>🟢 Green = pushed recommendation</span>
        <span>🟠 Orange = worked against it</span>
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
                <div className="card" style={{ padding:'1.5rem' }}>
                  <h3 style={{ fontSize:'1rem', marginBottom:'1rem' }}>📈 Performance Overview</h3>
                  <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
                    {[
                      { label:'Overall Score', val:`${analysis.overallScore}%`, color: analysis.overallScore >= 80 ? 'var(--secondary)' : analysis.overallScore >= 60 ? 'var(--accent)' : 'var(--danger)' },
                      { label:'Quizzes Taken', val: analysis.stats?.totalQuizzesTaken || 0, color:'var(--primary)' },
                      { label:'Passed',        val: analysis.stats?.quizzesPassed || 0,    color:'var(--secondary)' },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize:'1.75rem', fontWeight:800, color:s.color }}>{s.val}</div>
                        <div style={{ fontSize:'.72rem', color:'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {analysis.weakTopics?.length > 0 && (
                    <div style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--danger)', marginBottom:'.5rem' }}>🔴 Topics Needing Improvement</div>
                      {analysis.weakTopics.map(t => <XAIBar key={t.topic} label={t.topic} pct={t.percentage} color="var(--danger)" />)}
                    </div>
                  )}

                  {analysis.strongTopics?.length > 0 && (
                    <div>
                      <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--secondary)', marginBottom:'.5rem' }}>🟢 Strong Topics</div>
                      {analysis.strongTopics.map(t => <XAIBar key={t.topic} label={t.topic} pct={t.percentage} color="var(--secondary)" />)}
                    </div>
                  )}

                  {/* Global SHAP chart */}
                  {mlInsights?.shapContributions && (
                    <ShapChart contributions={mlInsights.shapContributions} />
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
                                  <ShapChart contributions={mlInsights.shapContributions} />
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