// pages/RecommendationsPage.jsx — Full XAI Dashboard with explanations
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

const Spin = () => (
  <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'3rem auto' }} />
);

const ProgressBar = ({ pct, color='var(--primary)', height=8 }) => (
  <div style={{ background:'var(--border)', borderRadius:99, height, overflow:'hidden', flex:1 }}>
    <div style={{ width:`${Math.min(100,pct||0)}%`, height:'100%', background:color, borderRadius:99, transition:'width .6s ease' }} />
  </div>
);

const XAIBar = ({ label, pct, color='var(--primary)' }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.4rem' }}>
    <span style={{ fontSize:'.73rem', color:'var(--text-secondary)', width:110, flexShrink:0, textTransform:'capitalize' }}>{label}</span>
    <ProgressBar pct={pct} color={color} />
    <span style={{ fontSize:'.7rem', color:'var(--text-muted)', width:35, textAlign:'right', flexShrink:0 }}>{Math.round(pct)}%</span>
  </div>
);

// Safe string coercion helper
const safeStr = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

const priorityColors = {
  high:   { bg:'#EDE9FE', text:'#5B21B6', border:'var(--primary)' },
  medium: { bg:'#D1FAE5', text:'#065F46', border:'var(--secondary)' },
  low:    { bg:'#FEF3C7', text:'#92400E', border:'var(--accent)' },
};

export default function RecommendationsPage() {
  const { user } = useAuth();
  const [recs,       setRecs]       = useState([]);
  const [analysis,   setAnalysis]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [noData,     setNoData]     = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recRes, anRes] = await Promise.allSettled([
        api.get('/recommendations/my'),
        api.get('/recommendations/analysis'),
      ]);
      if (recRes.status === 'fulfilled') {
        const d = recRes.value.data;
        // Handle all response shapes: array, {recommendations:[]}, or null
        const raw = d.data;
        let recsArr = [];
        if (Array.isArray(raw)) recsArr = raw;
        else if (Array.isArray(raw?.recommendations)) recsArr = raw.recommendations;
        else if (Array.isArray(raw?.items)) recsArr = raw.items;
        setRecs(recsArr);
        if (!raw) setNoData(true);
      }
      if (anRes.status === 'fulfilled') {
        const d = anRes.value.data;
        setAnalysis(d.data?.hasData ? d.data : null);
        if (!d.data?.hasData) setNoData(true);
      }
    } catch { toast.error('Failed to load recommendations'); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/recommendations/generate');
      if (data.success) {
        toast.success('New personalized learning path generated! 🤖');
        const rawRecs = data.data;
        let newRecs = [];
        if (Array.isArray(rawRecs)) newRecs = rawRecs;
        else if (Array.isArray(rawRecs?.recommendations)) newRecs = rawRecs.recommendations;
        setRecs(newRecs);
        setNoData(false);
        await loadData();
      } else {
        toast.info(data.message || 'Not enough data. Complete some quizzes first.');
        setNoData(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    }
    setGenerating(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ padding:'2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <h1 style={{ fontSize:'1.5rem', marginBottom:'.25rem' }}>🤖 AI Learning Path</h1>
            <p style={{ color:'var(--text-muted)', fontSize:'.875rem' }}>
              Personalized recommendations based on your performance · Powered by Explainable AI
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
                  Complete at least one quiz to get your personalized AI-powered learning path with explainable recommendations.
                </p>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'center', flexWrap:'wrap' }}>
                  <Link to="/courses" className="btn btn-primary">Browse Courses</Link>
                  <Link to="/student" className="btn btn-outline">Dashboard</Link>
                </div>
              </div>
            )}

            {analysis && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'2rem' }}>

                {/* Overall Score */}
                <div className="card" style={{ padding:'1.5rem' }}>
                  <h3 style={{ fontSize:'1rem', marginBottom:'1rem' }}>📈 Performance Overview</h3>
                  <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
                    {[
                      { label:'Overall Score', val:`${analysis.overallScore}%`, color: analysis.overallScore >= 80 ? 'var(--secondary)' : analysis.overallScore >= 60 ? 'var(--accent)' : 'var(--danger)' },
                      { label:'Quizzes Taken', val: analysis.stats?.totalQuizzesTaken || 0, color:'var(--primary)' },
                      { label:'Passed', val: analysis.stats?.quizzesPassed || 0, color:'var(--secondary)' },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize:'1.75rem', fontWeight:800, color:s.color }}>{s.val}</div>
                        <div style={{ fontSize:'.72rem', color:'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Weak Topics */}
                  {analysis.weakTopics?.length > 0 && (
                    <div style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--danger)', marginBottom:'.5rem' }}>🔴 Topics Needing Improvement</div>
                      {analysis.weakTopics.map(t => (
                        <XAIBar key={t.topic} label={t.topic} pct={t.percentage} color="var(--danger)" />
                      ))}
                    </div>
                  )}

                  {/* Strong Topics */}
                  {analysis.strongTopics?.length > 0 && (
                    <div>
                      <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--secondary)', marginBottom:'.5rem' }}>🟢 Strong Topics</div>
                      {analysis.strongTopics.map(t => (
                        <XAIBar key={t.topic} label={t.topic} pct={t.percentage} color="var(--secondary)" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent History */}
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
                  )) : (
                    <p style={{ color:'var(--text-muted)', fontSize:'.85rem' }}>No quiz history yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {recs.length > 0 && (
              <div>
                <h2 style={{ fontSize:'1.15rem', marginBottom:'1rem' }}>🎯 Your Personalized Learning Path</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  {recs.map((rec, i) => {
                    // Safely coerce priority to a plain string
                    const priority = typeof rec.priority === 'string' ? rec.priority : 'medium';
                    const c = priorityColors[priority] || priorityColors.medium;
                    return (
                      <div key={rec._id || i} className="card" style={{ padding:'1.25rem', borderLeft:`4px solid ${c.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem', flexWrap:'wrap' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.4rem' }}>
                              <span style={{ padding:'.15rem .55rem', borderRadius:99, fontSize:'.65rem', fontWeight:700, background:c.bg, color:c.text }}>
                                {priority.toUpperCase()}
                              </span>
                              <span style={{ fontSize:'.72rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:600 }}>
                                {safeStr(rec.type, 'resource')}
                              </span>
                            </div>
                            <h3 style={{ fontSize:'.95rem', marginBottom:'.4rem' }}>{safeStr(rec.itemTitle, 'Recommended Resource')}</h3>

                            {/* XAI Explanation */}
                            {safeStr(rec.explanation) && (
                              <div className="xai-explanation">
                                <span className="xai-icon">💡</span>
                                <span>{safeStr(rec.explanation)}</span>
                              </div>
                            )}

                            {/* Reason Factors */}
                            {rec.reasonFactors?.length > 0 && (
                              <div style={{ marginTop:'.75rem' }}>
                                <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'.4rem' }}>WHY THIS WAS RECOMMENDED:</div>
                                {rec.reasonFactors.map((f, fi) => (
                                  <div key={fi} style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.25rem', fontSize:'.75rem' }}>
                                    <span style={{ color:'var(--primary)' }}>→</span>
                                    <span style={{ color:'var(--text-secondary)' }}>{f.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {safeStr(rec.addressesTopic) && (
                              <div style={{ marginTop:'.5rem', fontSize:'.73rem', color:'var(--text-muted)' }}>
                                📌 Targets weak topic: <strong style={{ color:'var(--danger)', textTransform:'capitalize' }}>{safeStr(rec.addressesTopic)}</strong>
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:'.72rem', color:'var(--text-muted)', marginBottom:'.5rem' }}>
                              Confidence: <strong style={{ color:'var(--primary)' }}>{(typeof rec.confidence === 'number' ? rec.confidence : 70)}%</strong>
                            </div>
                            {rec.isDismissed ? (
                              <span style={{ fontSize:'.75rem', color:'var(--text-muted)' }}>Dismissed</span>
                            ) : (
                              <Link to={`/courses`} className="btn btn-primary btn-sm">
                                Start Learning →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No Recs but has data */}
            {recs.length === 0 && analysis && (
              <div className="card" style={{ padding:'2.5rem', textAlign:'center' }}>
                <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✨</div>
                <h3 style={{ marginBottom:'.5rem' }}>Generate Your Learning Path</h3>
                <p style={{ color:'var(--text-muted)', marginBottom:'1.5rem' }}>
                  Click the button above to generate AI-powered personalized recommendations based on your quiz performance.
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