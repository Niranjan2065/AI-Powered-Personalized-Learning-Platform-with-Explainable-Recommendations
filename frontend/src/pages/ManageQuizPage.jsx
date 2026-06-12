// src/pages/ManageQuizPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Tutor-facing quiz management page.
// Route: /tutor/courses/:courseId/quizzes/:quizId
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import axios from 'axios';

// ── Axios instance with auth header ───────────────────────────────────────────
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const chip = (bg, fg = '#fff') => ({
  display: 'inline-block', fontSize: '.65rem', fontWeight: 700,
  padding: '2px 8px', borderRadius: 999, background: bg, color: fg,
});

const diffColor = (d) =>
  d === 'hard' ? '#DC2626' : d === 'medium' ? '#F59E0B' : '#16A34A';

// ─────────────────────────────────────────────────────────────────────────────
export default function ManageQuizPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();

  const [quiz,    setQuiz]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('questions');  // 'questions' | 'settings' | 'attempts'
  const [attempts, setAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  // Settings form
  const [settings, setSettings] = useState({
    title: '', passingScore: 70, timeLimit: 0, maxAttempts: 0,
    shuffleQuestions: false, shuffleOptions: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Publish toggle
  const [publishing, setPublishing] = useState(false);

  // ── Load quiz ──────────────────────────────────────────────────────────────
  const reload = async () => {
    try {
      const { data } = await api.get(`/quizzes/${quizId}/full`);
      setQuiz(data.data);
      setSettings({
        title:            data.data.title,
        passingScore:     data.data.passingScore ?? 70,
        timeLimit:        data.data.timeLimit    ?? 0,
        maxAttempts:      data.data.maxAttempts  ?? 0,
        shuffleQuestions: data.data.shuffleQuestions ?? false,
        shuffleOptions:   data.data.shuffleOptions   ?? true,
      });
    } catch {
      toast.error('Quiz not found');
      navigate(`/tutor/courses/${courseId}`);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [quizId]);

  // ── Load attempts when tab switches ───────────────────────────────────────
  useEffect(() => {
    if (tab !== 'attempts') return;
    setLoadingAttempts(true);
    api.get(`/quizzes/${quizId}/attempts`)
      .then(r => setAttempts(r.data.data || []))
      .catch(() => setAttempts([]))
      .finally(() => setLoadingAttempts(false));
  }, [tab]);

  // ── Publish / unpublish ───────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { data } = await api.patch(`/quizzes/${quizId}/publish`);
      setQuiz(q => ({ ...q, isPublished: data.data.isPublished }));
      toast.success(data.data.isPublished ? '✓ Quiz published!' : 'Quiz unpublished');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle publish');
    }
    setPublishing(false);
  };

  // ── Save settings ─────────────────────────────────────────────────────────
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put(`/quizzes/${quizId}`, settings);
      toast.success('Quiz settings saved!');
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    }
    setSavingSettings(false);
  };

  // ── Delete quiz ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/quizzes/${quizId}`);
      toast.success('Quiz deleted');
      navigate(`/tutor/courses/${courseId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete quiz');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return <><Navbar /><Spinner center /></>;

  const TABS = ['questions', 'settings', 'attempts'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div className="container" style={{ padding: '2rem 1.5rem' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link to={`/tutor/courses/${courseId}`}
              style={{ fontSize: '.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← Back to Course
            </Link>
            <h1 style={{ fontSize: '1.4rem', marginTop: '.3rem', marginBottom: '.4rem' }}>{quiz.title}</h1>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`badge ${quiz.isPublished ? 'badge-success' : 'badge-gray'}`}>
                {quiz.isPublished ? '✓ Published' : '⚙ Draft'}
              </span>
              {quiz.isAIGenerated && (
                <span style={chip('#F59E0B')}>✦ AI Generated</span>
              )}
              <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                {quiz.questions?.length || 0} questions · Passing: {quiz.passingScore}%
                {quiz.timeLimit > 0 ? ` · ${quiz.timeLimit} min` : ' · No time limit'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handlePublish}
              disabled={publishing || (quiz.questions?.length === 0)}
              className={`btn btn-sm ${quiz.isPublished ? 'btn-ghost' : 'btn-primary'}`}
              title={quiz.questions?.length === 0 ? 'Add questions before publishing' : ''}
            >
              {publishing ? '⏳...' : quiz.isPublished ? '⏸ Unpublish' : '▶ Publish'}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn btn-sm"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              🗑 Delete Quiz
            </button>
          </div>
        </div>

        {/* ── Delete Confirm Modal ── */}
        {confirmDelete && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}>
            <div className="card" style={{ padding: '2rem', maxWidth: 400, width: '90%' }}>
              <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '1rem' }}>⚠️</div>
              <h3 style={{ textAlign: 'center', marginBottom: '.5rem' }}>Delete Quiz?</h3>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.875rem', marginBottom: '1.5rem' }}>
                This will permanently delete <strong>"{quiz.title}"</strong> and all student attempts. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center' }}>
                <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost">Cancel</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="btn" style={{ background: '#DC2626', color: '#fff' }}>
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'var(--primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
                border: 'none', padding: '.5rem 1.25rem', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', fontWeight: 600, fontSize: '.875rem',
                textTransform: 'capitalize', transition: 'all .15s',
              }}>
              {t === 'questions' ? `📋 Questions (${quiz.questions?.length || 0})` : t === 'settings' ? '⚙ Settings' : '📊 Attempts'}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TAB: QUESTIONS
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'questions' && (
          <div>
            {(!quiz.questions || quiz.questions.length === 0) && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  No questions yet. This quiz was saved but has no questions.
                </p>
                <Link to={`/tutor/courses/${courseId}`} className="btn btn-primary">
                  ← Go to Course to Regenerate
                </Link>
              </div>
            )}

            {quiz.questions?.map((q, idx) => (
              <div key={q._id || idx} className="card"
                style={{ marginBottom: '1rem', padding: '1.25rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={chip('#6366F1')}>Q{idx + 1}</span>
                  <span style={chip(q.type === 'mcq' ? '#0EA5E9' : '#7C3AED')}>
                    {q.type === 'mcq' ? 'Multiple Choice' : 'True / False'}
                  </span>
                  {q.difficulty && (
                    <span style={chip(diffColor(q.difficulty) + '22', diffColor(q.difficulty))}>
                      {q.difficulty}
                    </span>
                  )}
                  {q.topic && <span style={chip('#F0FDF4', '#16A34A')}>{q.topic}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--text-muted)' }}>
                    {q.points || 1} pt{(q.points || 1) !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {q.questionText}
                </div>

                {/* MCQ Options */}
                {q.type === 'mcq' && q.options?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginBottom: '.75rem' }}>
                    {q.options.map((opt, j) => (
                      <div key={j} style={{
                        padding: '.5rem .85rem', borderRadius: 8, fontSize: '.82rem',
                        background: opt.isCorrect ? '#F0FDF4' : '#F9FAFB',
                        color: opt.isCorrect ? '#166534' : '#374151',
                        border: `1px solid ${opt.isCorrect ? '#86EFAC' : '#E5E7EB'}`,
                        fontWeight: opt.isCorrect ? 700 : 400,
                        display: 'flex', alignItems: 'center', gap: '.4rem',
                      }}>
                        <span style={{ opacity: .5, fontSize: '.7rem' }}>
                          {String.fromCharCode(65 + j)}.
                        </span>
                        {opt.isCorrect && <span>✓</span>}
                        {opt.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* True/False Answer */}
                {q.type === 'true_false' && (
                  <div style={{
                    display: 'inline-flex', gap: '.6rem', padding: '.45rem .85rem',
                    background: '#F0FDF4', color: '#166534', borderRadius: 8,
                    border: '1px solid #86EFAC', fontWeight: 700, fontSize: '.82rem',
                    marginBottom: '.75rem',
                  }}>
                    ✓ Correct answer: {q.correctAnswer}
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div style={{
                    background: '#FFFBEB', border: '1px solid #FDE68A',
                    borderLeft: '3px solid #F59E0B', borderRadius: 6,
                    padding: '.5rem .85rem', fontSize: '.78rem', color: '#92400E',
                  }}>
                    💡 <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ))}

            {/* Summary bar at bottom */}
            {quiz.questions?.length > 0 && (
              <div className="card" style={{
                padding: '1rem 1.25rem', background: 'var(--primary-light)',
                display: 'flex', gap: '2rem', flexWrap: 'wrap',
              }}>
                {[
                  ['Total Questions', quiz.questions.length],
                  ['Total Points', quiz.questions.reduce((s, q) => s + (q.points || 1), 0)],
                  ['MCQ', quiz.questions.filter(q => q.type === 'mcq').length],
                  ['True/False', quiz.questions.filter(q => q.type === 'true_false').length],
                  ['Passing Score', `${quiz.passingScore}%`],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>{val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: SETTINGS
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'settings' && (
          <div className="card" style={{ padding: '2rem', maxWidth: 560 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>⚙ Quiz Settings</h3>
            <form onSubmit={handleSaveSettings}>

              <div className="form-group">
                <label className="form-label">Quiz Title *</label>
                <input className="form-control" value={settings.title}
                  onChange={e => setSettings(s => ({ ...s, title: e.target.value }))}
                  required placeholder="e.g. Python Basics Quiz" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Passing Score (%)</label>
                  <input className="form-control" type="number" min={0} max={100}
                    value={settings.passingScore}
                    onChange={e => setSettings(s => ({ ...s, passingScore: Number(e.target.value) }))} />
                  <small style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>0 = no minimum</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Time Limit (minutes)</label>
                  <input className="form-control" type="number" min={0}
                    value={settings.timeLimit}
                    onChange={e => setSettings(s => ({ ...s, timeLimit: Number(e.target.value) }))} />
                  <small style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>0 = no time limit</small>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Max Attempts</label>
                <input className="form-control" type="number" min={0}
                  value={settings.maxAttempts}
                  onChange={e => setSettings(s => ({ ...s, maxAttempts: Number(e.target.value) }))} />
                <small style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>0 = unlimited</small>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', margin: '1.25rem 0' }}>
                {[
                  ['shuffleQuestions', 'Shuffle question order for each attempt'],
                  ['shuffleOptions',   'Shuffle answer options (MCQ)'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: '.875rem' }}>
                    <input type="checkbox" checked={settings[key]}
                      onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                    {label}
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                  {savingSettings ? '⏳ Saving...' : '✓ Save Settings'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => reload()}>
                  Reset
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: ATTEMPTS
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'attempts' && (
          <div>
            {loadingAttempts && <Spinner center />}

            {!loadingAttempts && attempts.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                <p style={{ color: 'var(--text-muted)' }}>No attempts yet for this quiz.</p>
              </div>
            )}

            {!loadingAttempts && attempts.length > 0 && (
              <>
                {/* Summary Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Total Attempts',  value: attempts.length,                                                                                                  color: 'var(--primary)' },
                    { label: 'Avg. Score',       value: `${Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)}%`,                                   color: '#F59E0B' },
                    { label: 'Pass Rate',        value: `${Math.round(attempts.filter(a => a.isPassed).length / attempts.length * 100)}%`,                               color: '#16A34A' },
                    { label: 'Unique Students',  value: new Set(attempts.map(a => a.student?._id)).size,                                                                 color: '#8B5CF6' },
                    { label: '🚩 Flagged',       value: attempts.filter(a => a.isFlagged).length,                                                                        color: '#DC2626' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '.25rem' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Attempts Table */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                          {['Student', 'Score', 'Result', 'Attempt #', 'Completed', 'Integrity', 'Weak Topics'].map(h => (
                            <th key={h} style={{ padding: '.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attempts.map((att, i) => (
                          <tr key={att._id} style={{ borderTop: '1px solid var(--border)', background: att.isFlagged ? '#FFF5F5' : i % 2 === 0 ? 'transparent' : '#FAFBFF' }}>
                            <td style={{ padding: '.7rem 1rem' }}>
                              <div style={{ fontWeight: 600 }}>{att.student?.name || 'Unknown'}</div>
                              <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{att.student?.email || ''}</div>
                            </td>
                            <td style={{ padding: '.7rem 1rem', fontWeight: 800, color: att.isPassed ? '#16A34A' : '#DC2626' }}>
                              {att.score}%
                            </td>
                            <td style={{ padding: '.7rem 1rem' }}>
                              <span className={`badge ${att.isPassed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '.7rem' }}>
                                {att.isPassed ? '✓ Passed' : '✗ Failed'}
                              </span>
                            </td>
                            <td style={{ padding: '.7rem 1rem', color: 'var(--text-muted)' }}>#{att.attemptNumber || 1}</td>
                            <td style={{ padding: '.7rem 1rem', color: 'var(--text-muted)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                              {att.completedAt ? new Date(att.completedAt).toLocaleDateString() : '—'}
                            </td>
                            {/* Integrity / Flagged column */}
                            <td style={{ padding: '.7rem 1rem' }}>
                              {att.isFlagged ? (
                                <div>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                                    padding: '3px 8px', borderRadius: 999,
                                    background: '#FEE2E2', color: '#DC2626',
                                    fontSize: '.68rem', fontWeight: 700,
                                  }}>
                                    🚩 FLAGGED
                                  </span>
                                  {att.violationCount > 0 && (
                                    <div style={{ fontSize: '.68rem', color: '#DC2626', marginTop: '.2rem' }}>
                                      {att.violationCount} violation{att.violationCount !== 1 ? 's' : ''}
                                      {att.terminatedByProctor && ' · auto-submitted'}
                                    </div>
                                  )}
                                  {/* Violation type breakdown */}
                                  {att.violations?.length > 0 && (
                                    <div style={{ marginTop: '.3rem', display: 'flex', flexWrap: 'wrap', gap: '.2rem' }}>
                                      {[...new Set(att.violations.map(v => v.type))].map(type => (
                                        <span key={type} style={{
                                          fontSize: '.6rem', padding: '1px 6px', borderRadius: 999,
                                          background: '#FECACA', color: '#7F1D1D',
                                        }}>
                                          {type.replace(/_/g, ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                                  padding: '3px 8px', borderRadius: 999,
                                  background: '#DCFCE7', color: '#15803D',
                                  fontSize: '.68rem', fontWeight: 700,
                                }}>
                                  ✓ Clean
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '.7rem 1rem' }}>
                              {att.weakTopics?.length > 0 ? (
                                <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
                                  {att.weakTopics.slice(0, 3).map(t => (
                                    <span key={t} style={chip('#FEF2F2', '#DC2626')}>{t}</span>
                                  ))}
                                  {att.weakTopics.length > 3 && (
                                    <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>+{att.weakTopics.length - 3}</span>
                                  )}
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
