// components/tutor/ResourceSubmissionForm.jsx
// Item #2 of the coverage-expansion plan: lets a tutor submit a candidate
// external resource for a topic instead of someone hand-editing
// topic_resources.json forever. Goes to POST /api/tutor-resources as
// status: 'pending' — an admin approves/rejects it via
// AdminResourceApprovalPanel.jsx before it becomes visible to students.
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

const EMPTY = { topic: '', title: '', url: '', type: 'article', difficulty: 'beginner', site: '', description: '' };

export default function ResourceSubmissionForm() {
  const [form, setForm]           = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState(null); // lazy-loaded on toggle
  const [showMine, setShowMine]   = useState(false);

  // ── AI-assisted search suggestions ────────────────────────────────────
  // Deliberately does NOT auto-fill a URL — see resourceSuggestionService.js
  // for why trusting an LLM with a direct link is unsafe. This only
  // suggests WHERE to search; the tutor still finds and pastes the real
  // link themselves.
  const [showAiPanel, setShowAiPanel]   = useState(false);
  const [aiCourseTitle, setAiCourseTitle] = useState('');
  const [aiModuleTitle, setAiModuleTitle] = useState('');
  const [aiLoading, setAiLoading]       = useState(false);
  const [suggestions, setSuggestions]   = useState(null);

  const getSuggestions = async () => {
    if (!aiCourseTitle.trim()) {
      toast.error('Enter a course title first');
      return;
    }
    setAiLoading(true);
    setSuggestions(null);
    try {
      const res = await api.post('/tutor-resources/suggest', {
        courseTitle: aiCourseTitle,
        moduleTitle: aiModuleTitle || undefined,
      });
      const data = res.data?.data || [];
      setSuggestions(data);
      if (data.length === 0) toast.info('No suggestions found — try the manual form below');
    } catch {
      toast.error('Could not get AI suggestions — try the manual form below');
      setSuggestions([]);
    } finally { setAiLoading(false); }
  };

  // Pre-fills the manual form from a suggestion — topic/type/difficulty are
  // real, code-validated fields; title/URL are deliberately left for the
  // tutor to fill in themselves after actually finding the resource.
  const useSuggestion = (s) => {
    setForm(f => ({ ...f, topic: s.topic, type: s.type, difficulty: s.difficulty }));
    window.open(s.searchUrl, '_blank', 'noopener,noreferrer');
    toast.info('Opened search — paste the real link below once you find one');
  };

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.topic.trim() || !form.title.trim() || !form.url.trim()) {
      toast.error('Topic, title and URL are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/tutor-resources', form);
      toast.success('Submitted for admin review 🎉');
      setForm(EMPTY);
      if (showMine) loadMine(); // refresh the list if it's open
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit resource');
    } finally { setSubmitting(false); }
  };

  const loadMine = async () => {
    try {
      const res = await api.get('/tutor-resources/mine');
      setMySubmissions(res.data?.data || []);
    } catch { /* silent — non-critical */ }
  };

  const toggleMine = () => {
    const next = !showMine;
    setShowMine(next);
    if (next && mySubmissions === null) loadMine();
  };

  const STATUS_COLOR = {
    pending:  { bg: '#FEF3C7', color: '#92400E' },
    approved: { bg: '#D1FAE5', color: '#065F46' },
    rejected: { bg: '#FEE2E2', color: '#991B1B' },
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '.25rem' }}>📚 Suggest a Learning Resource</h3>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Submit a video, article, or practice link for a topic students often struggle with.
        An admin reviews it before it goes live.
      </p>

      {/* ── AI-assisted search suggestions ── */}
      <div style={{
        border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
        padding: '.75rem .9rem', marginBottom: '1.25rem', background: 'var(--bg)',
      }}>
        <button
          type="button"
          onClick={() => setShowAiPanel(s => !s)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '.82rem', fontWeight: 600, color: 'var(--primary)' }}
        >
          {showAiPanel ? '▾' : '▸'} 🤖 Not sure what's needed? Get AI suggestions
        </button>

        {showAiPanel && (
          <div style={{ marginTop: '.7rem' }}>
            <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.6rem' }}>
              AI suggests <em>where to search</em> for good topics — it never invents the
              link itself. You still pick the real resource and paste it below.
            </p>
            <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.6rem', flexWrap: 'wrap' }}>
              <input
                className="form-control" style={{ flex: 1, minWidth: 160 }}
                placeholder="Course title *"
                value={aiCourseTitle}
                onChange={e => setAiCourseTitle(e.target.value)}
              />
              <input
                className="form-control" style={{ flex: 1, minWidth: 160 }}
                placeholder="Module title (optional)"
                value={aiModuleTitle}
                onChange={e => setAiModuleTitle(e.target.value)}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={getSuggestions} disabled={aiLoading}>
                {aiLoading ? 'Thinking…' : '✨ Suggest'}
              </button>
            </div>

            {suggestions?.length > 0 && (
              <div style={{ display: 'grid', gap: '.4rem' }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '.5rem .7rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    fontSize: '.78rem', background: '#fff', gap: '.5rem',
                  }}>
                    <div>
                      <strong>{s.topic}</strong>
                      <span style={{ color: 'var(--text-muted)' }}> · {s.type} · {s.difficulty} · search on {s.siteLabel}</span>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: '.72rem', whiteSpace: 'nowrap' }}
                      onClick={() => useSuggestion(s)}>
                      🔍 Search & use
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: '.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <div>
            <label style={{ fontSize: '.75rem', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Topic *</label>
            <input className="form-control" value={form.topic} onChange={set('topic')}
              placeholder="e.g. Recursion" required />
          </div>
          <div>
            <label style={{ fontSize: '.75rem', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Type *</label>
            <select className="form-control" value={form.type} onChange={set('type')}>
              <option value="video">🎥 Video</option>
              <option value="article">📄 Article</option>
              <option value="practice">💻 Practice</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '.75rem', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Title *</label>
          <input className="form-control" value={form.title} onChange={set('title')}
            placeholder="e.g. Recursion Explained — Corey Schafer" required />
        </div>

        <div>
          <label style={{ fontSize: '.75rem', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>URL *</label>
          <input className="form-control" type="url" value={form.url} onChange={set('url')}
            placeholder="https://..." required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <div>
            <label style={{ fontSize: '.75rem', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Site name</label>
            <input className="form-control" value={form.site} onChange={set('site')} placeholder="e.g. YouTube (Corey Schafer)" />
          </div>
          <div>
            <label style={{ fontSize: '.75rem', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Difficulty</label>
            <select className="form-control" value={form.difficulty} onChange={set('difficulty')}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '.75rem', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Why is this a good resource? (optional)</label>
          <textarea className="form-control" rows={2} value={form.description} onChange={set('description')}
            maxLength={300} placeholder="Short note for the admin reviewing this" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifySelf: 'start' }}>
          {submitting ? 'Submitting…' : 'Submit for Review'}
        </button>
      </form>

      <button
        type="button"
        onClick={toggleMine}
        style={{ marginTop: '1rem', background: 'none', border: 'none', color: 'var(--primary)', fontSize: '.8rem', cursor: 'pointer', padding: 0 }}
      >
        {showMine ? '▾ Hide my submissions' : '▸ View my submissions'}
      </button>

      {showMine && (
        <div style={{ marginTop: '.75rem' }}>
          {mySubmissions === null && <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Loading…</div>}
          {mySubmissions?.length === 0 && <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>No submissions yet.</div>}
          {mySubmissions?.map(s => (
            <div key={s._id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '.5rem .7rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              marginBottom: '.4rem', fontSize: '.78rem',
            }}>
              <div>
                <strong>{s.title}</strong>
                <span style={{ color: 'var(--text-muted)' }}> — {s.topic}</span>
                {s.status === 'rejected' && s.reviewNote && (
                  <div style={{ color: '#991B1B', fontSize: '.72rem', marginTop: '.15rem' }}>Reason: {s.reviewNote}</div>
                )}
              </div>
              <span style={{
                padding: '.15rem .5rem', borderRadius: 99, fontSize: '.68rem', fontWeight: 700,
                ...STATUS_COLOR[s.status],
              }}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}