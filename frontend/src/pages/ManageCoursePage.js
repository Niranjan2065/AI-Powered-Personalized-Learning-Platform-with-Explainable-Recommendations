// src/pages/ManageCoursePage.js — AI-Only Quiz Generation
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import { getCourse, createModule, createLesson } from '../utils/api';
import axios from 'axios';

const authApi = axios.create({ baseURL: '/api' });
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const buildContent = (form) => {
  const type = form.contentType || 'text';
  if (type === 'video') return { videoUrl: form.videoUrl || '', videoDuration: 0, text: form.description || '' };
  if (type === 'pdf')   return { pdfUrl: form.pdfUrl || '', text: form.description || '' };
  return { text: form.text || '' };
};

const GEN_STEPS = [
  'Reading lesson content…',
  'Identifying key concepts…',
  'Drafting question stems…',
  'Building answer options…',
  'Finalising & validating…',
];

const chip = (color) => ({
  display: 'inline-block', fontSize: '.68rem', fontWeight: 700,
  padding: '2px 7px', borderRadius: 999,
  background: color + '22', color,
});

export default function ManageCoursePage() {
  const { id } = useParams();           // ✅ courseId always from URL
  const [course,  setCourse]  = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('modules');

  const [addingModule, setAddingModule] = useState(false);
  const [modForm,      setModForm]      = useState({ title: '', description: '', topics: '' });
  const [modSaving,    setModSaving]    = useState(false);

  const [lessonForms,  setLessonForms]  = useState({});
  const [addingLesson, setAddingLesson] = useState(null);
  const [lessonSaving, setLessonSaving] = useState(false);

  const [quizzesByModule, setQuizzesByModule] = useState({});

  const [aiState,   setAiState]   = useState({});
  const [quizTitle, setQuizTitle] = useState({});
  const [saving,    setSaving]    = useState({});
  const fileRefs = useRef({});

  const getAI = (mid) => aiState[mid] || {
    open: false, source: 'lesson', pdfFile: null,
    numQ: 5, difficulty: 'medium',
    types: ['mcq', 'true_false'], focusArea: '',
    step: 'idle', genLabel: GEN_STEPS[0], genPct: 0,
    error: '', preview: [],
    lessonId: null, courseId: null,   // ✅ always initialised
  };
  const setAI = (mid, patch) =>
    setAiState(p => ({ ...p, [mid]: { ...getAI(mid), ...(typeof patch === 'function' ? patch(getAI(mid)) : patch) } }));

  const toggleAiType = (mid, t) => {
    const cur = getAI(mid).types;
    setAI(mid, { types: cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t] });
  };

  // ── AI generation ──────────────────────────────────────────
  const runAiGenerate = async (mid) => {
    const ai  = getAI(mid);
    const mod = modules.find(m => m._id === mid);

    if (ai.types.length === 0) {
      setAI(mid, { error: 'Select at least one question type.' });
      return;
    }

    // ✅ FIX: Resolve lessonId and courseId BEFORE any API call.
    // courseId always comes from the URL param `id` (never undefined).
    // lessonId comes from the first lesson of this module.
    const lessonId = mod?.lessons?.[0]?._id || null;
    const courseId = id;   // URL param — always defined

    // For text source, a lesson is required
    if (ai.source === 'lesson' && !lessonId) {
      setAI(mid, {
        step: 'error',
        error: 'This module has no lessons yet. Add a text lesson first, or switch to "Upload a PDF".',
      });
      return;
    }

    // Store resolved IDs immediately in AI state so they survive async calls
    setAI(mid, { error: '', step: 'generating', genPct: 5, lessonId, courseId });

    let stepIdx = 0;
    const iv = setInterval(() => {
      stepIdx = (stepIdx + 1) % GEN_STEPS.length;
      setAI(mid, p => ({ genLabel: GEN_STEPS[stepIdx], genPct: Math.min((p.genPct || 5) + 17, 88) }));
    }, 900);

    try {
      let response;

      if (ai.source === 'pdf' && ai.pdfFile) {
        const fd = new FormData();
        fd.append('pdf', ai.pdfFile);
        fd.append('numQuestions', ai.numQ);
        fd.append('difficulty', ai.difficulty);
        fd.append('types', JSON.stringify(ai.types));
        if (ai.focusArea) fd.append('focusArea', ai.focusArea);
        // ✅ FIX: Always send lessonId in PDF request so backend can return courseId
        if (lessonId) fd.append('lessonId', lessonId);

        response = await authApi.post('/quizzes/generate-from-pdf', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        response = await authApi.post('/quizzes/generate', {
          lessonId,
          numQuestions: ai.numQ,
          difficulty:   ai.difficulty,
          types:        ai.types,
          focusArea:    ai.focusArea || '',
        });
      }

      clearInterval(iv);

      // ✅ FIX: Use IDs from response if present, ALWAYS fall back to
      // locally resolved values — guarantees they are never undefined.
      const resolvedLessonId = response.data.data?.lessonId || lessonId;
      const resolvedCourseId = response.data.data?.courseId || courseId;

      setAI(mid, {
        step:     'done',
        genPct:   100,
        preview:  response.data.data.questions,
        lessonId: resolvedLessonId,
        courseId: resolvedCourseId,
        error:    '',
      });
    } catch (err) {
      clearInterval(iv);
      setAI(mid, {
        step:  'error',
        error: err.response?.data?.message || 'AI generation failed. Please try again.',
      });
    }
  };

  // ── Save AI quiz ───────────────────────────────────────────
  const saveAiQuiz = async (mid) => {
    const ai    = getAI(mid);
    const title = quizTitle[mid]?.trim();

    if (!title)           { toast.error('Enter a quiz title before saving'); return; }
    if (!ai.preview?.length) { toast.error('No questions to save'); return; }

    // ✅ FIX: courseId always falls back to URL param so it is never undefined.
    const lessonId = ai.lessonId;
    const courseId = ai.courseId || id;

    if (!lessonId) {
      toast.error('No lesson linked to this quiz. Add a lesson to this module first, then regenerate.');
      return;
    }

    setSaving(p => ({ ...p, [mid]: true }));
    try {
      await authApi.post('/quizzes/save-generated', {
        lessonId,          // ✅ guaranteed defined
        courseId,          // ✅ guaranteed defined
        title,
        questions:    ai.preview,
        passingScore: 70,
        timeLimit:    0,
        maxAttempts:  3,
        aiMeta: {
          numQuestions: ai.numQ,
          difficulty:   ai.difficulty,
          types:        ai.types,
          focusArea:    ai.focusArea,
        },
      });

      // Auto-publish — non-critical, wrap in try/catch
      try {
        const quizzesRes = await authApi.get(`/quizzes/lesson/${lessonId}`);
        const saved = quizzesRes.data.data?.[0];
        if (saved?._id) await authApi.patch(`/quizzes/${saved._id}/publish`);
      } catch { /* publish failure doesn't block save */ }

      toast.success(`✓ Quiz "${title}" saved & published!`);
      setAI(mid, { open: false, step: 'idle', preview: [], lessonId: null, courseId: null });
      setQuizTitle(p => ({ ...p, [mid]: '' }));
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save quiz');
    }
    setSaving(p => ({ ...p, [mid]: false }));
  };

  // ── Data loading ───────────────────────────────────────────
  const reload = async () => {
    const { data } = await getCourse(id);
    setCourse(data.data);
    setModules(data.data.modules || []);
    const qMap = {};
    for (const mod of data.data.modules || []) {
      try {
        const lessonId = mod.lessons?.[0]?._id;
        if (lessonId) {
          const r = await authApi.get(`/quizzes/lesson/${lessonId}`);
          qMap[mod._id] = r.data.data;
        } else {
          qMap[mod._id] = [];
        }
      } catch { qMap[mod._id] = []; }
    }
    setQuizzesByModule(qMap);
  };

  useEffect(() => { reload().then(() => setLoading(false)); }, [id]);

  const setLessonField = (mid, field, val) =>
    setLessonForms(p => ({ ...p, [mid]: { ...(p[mid] || {}), [field]: val } }));
  const getLF = (mid) => lessonForms[mid] || {};

  const handleAddModule = async (e) => {
    e.preventDefault(); setModSaving(true);
    try {
      await createModule(id, { title: modForm.title, description: modForm.description, topics: modForm.topics.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), isPublished: true });
      toast.success('Module added!');
      setModForm({ title: '', description: '', topics: '' }); setAddingModule(false); await reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setModSaving(false);
  };

  const handleAddLesson = async (e, mid) => {
    e.preventDefault();
    const form = getLF(mid);
    if (form.contentType === 'video' && !form.videoUrl?.trim()) { toast.error('Please enter a YouTube video URL'); return; }
    setLessonSaving(true);
    try {
      await createLesson(mid, { title: form.title, contentType: form.contentType || 'text', topics: (form.topics || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean), estimatedDuration: parseInt(form.estimatedDuration) || 10, isPublished: true, content: buildContent(form) });
      toast.success('Lesson added!');
      setLessonForms(p => ({ ...p, [mid]: {} })); setAddingLesson(null); await reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLessonSaving(false);
  };

  if (loading) return <><Navbar /><Spinner center /></>;
  const TABS = ['modules', 'quizzes', 'settings'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <Link to="/tutor" style={{ fontSize: '.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>← Tutor Dashboard</Link>
            <h1 style={{ fontSize: '1.4rem', marginTop: '.3rem', marginBottom: '.4rem' }}>{course?.title}</h1>
            <span className={`badge ${course?.isPublished ? 'badge-success' : 'badge-gray'}`}>
              {course?.isPublished ? '✓ Published' : '⚙ Draft'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: tab === t ? 'var(--primary)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '.5rem 1.25rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '.875rem', textTransform: 'capitalize', transition: 'all .15s' }}>
              {t === 'modules' ? '📦 Modules & Lessons' : t === 'quizzes' ? '📝 Quizzes' : '⚙ Settings'}
            </button>
          ))}
        </div>

        {/* ── MODULES TAB ── */}
        {tab === 'modules' && (
          <div>
            {modules.map((mod) => {
              const form = getLF(mod._id);
              const ct = form.contentType || 'text';
              const isAdding = addingLesson === mod._id;
              return (
                <div key={mod._id} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', background: 'var(--primary-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Module {mod.order}: {mod.title}</span>
                      {mod.topics?.length > 0 && <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>Topics: {mod.topics.join(', ')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '.5rem' }}>
                      <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>{mod.lessons?.length || 0} lessons · {(quizzesByModule[mod._id] || []).length} quizzes</span>
                      <button onClick={() => setAddingLesson(isAdding ? null : mod._id)} className="btn btn-primary btn-sm">{isAdding ? '✕ Cancel' : '+ Add Lesson'}</button>
                    </div>
                  </div>
                  {mod.lessons?.length === 0 && !isAdding && (<div style={{ padding: '.85rem 1.25rem', fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No lessons yet.</div>)}
                  {mod.lessons?.map((l) => (
                    <div key={l._id} style={{ padding: '.7rem 1.25rem', display: 'flex', gap: '.75rem', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                      <span>{l.contentType === 'video' ? '🎬' : l.contentType === 'pdf' ? '📄' : '📝'}</span>
                      <span style={{ flex: 1, fontSize: '.875rem', fontWeight: 500 }}>{l.title}</span>
                      <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{l.estimatedDuration}min</span>
                      <span className={`badge ${l.contentType === 'video' ? 'badge-primary' : 'badge-gray'}`} style={{ fontSize: '.65rem', textTransform: 'capitalize' }}>{l.contentType}</span>
                    </div>
                  ))}
                  {isAdding && (
                    <form onSubmit={e => handleAddLesson(e, mod._id)} style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: '#F8FAFF' }}>
                      <div style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--primary)', marginBottom: '1rem' }}>➕ New Lesson</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '.75rem', marginBottom: '.75rem' }}>
                        <div><label className="form-label">Lesson Title *</label><input className="form-control" placeholder="e.g. Python Data Types Explained" required value={form.title || ''} onChange={e => setLessonField(mod._id, 'title', e.target.value)} /></div>
                        <div><label className="form-label">Content Type *</label><select className="form-control" value={ct} onChange={e => setLessonField(mod._id, 'contentType', e.target.value)}><option value="text">📝 Text</option><option value="video">🎬 Video</option><option value="pdf">📄 PDF</option></select></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '.75rem', marginBottom: '.75rem' }}>
                        <div><label className="form-label">Topics (comma-separated)</label><input className="form-control" placeholder="e.g. data types, variables" value={form.topics || ''} onChange={e => setLessonField(mod._id, 'topics', e.target.value)} /></div>
                        <div><label className="form-label">Duration (min)</label><input className="form-control" type="number" min="1" placeholder="10" value={form.estimatedDuration || ''} onChange={e => setLessonField(mod._id, 'estimatedDuration', e.target.value)} /></div>
                      </div>
                      {ct === 'video' && (<div style={{ marginBottom: '.75rem' }}><label className="form-label">🎬 YouTube Video URL *</label><input className="form-control" type="url" placeholder="https://www.youtube.com/watch?v=VIDEO_ID" value={form.videoUrl || ''} onChange={e => setLessonField(mod._id, 'videoUrl', e.target.value)} required /><small style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Supports youtube.com/watch?v=... · youtu.be/... · youtube.com/embed/...</small><div style={{ marginTop: '.5rem' }}><label className="form-label">Description (optional)</label><textarea className="form-control" rows={2} value={form.description || ''} onChange={e => setLessonField(mod._id, 'description', e.target.value)} /></div></div>)}
                      {ct === 'pdf' && (<div style={{ marginBottom: '.75rem' }}><label className="form-label">📄 PDF URL *</label><input className="form-control" type="url" placeholder="https://example.com/document.pdf" value={form.pdfUrl || ''} onChange={e => setLessonField(mod._id, 'pdfUrl', e.target.value)} required /></div>)}
                      {ct === 'text' && (<div style={{ marginBottom: '.75rem' }}><label className="form-label">📝 Lesson Content (Markdown supported)</label><textarea className="form-control" rows={5} placeholder={"# Lesson Title\n\nWrite your content here..."} value={form.text || ''} onChange={e => setLessonField(mod._id, 'text', e.target.value)} /></div>)}
                      <div style={{ display: 'flex', gap: '.5rem' }}>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={lessonSaving}>{lessonSaving ? '⏳ Saving...' : '✓ Add Lesson'}</button>
                        <button type="button" onClick={() => { setAddingLesson(null); setLessonForms(p => ({ ...p, [mod._id]: {} })); }} className="btn btn-ghost btn-sm">Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
            {addingModule ? (
              <div className="card" style={{ padding: '1.5rem', border: '2px dashed var(--primary)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>📦 New Module</h4>
                <form onSubmit={handleAddModule}>
                  <div className="form-group"><label className="form-label">Module Title *</label><input className="form-control" placeholder="e.g. Python Fundamentals" required value={modForm.title} onChange={e => setModForm({ ...modForm, title: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Description</label><input className="form-control" placeholder="Brief description" value={modForm.description} onChange={e => setModForm({ ...modForm, description: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Topics (comma-separated)</label><input className="form-control" placeholder="e.g. variables, data types" value={modForm.topics} onChange={e => setModForm({ ...modForm, topics: e.target.value })} /></div>
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={modSaving}>{modSaving ? 'Saving...' : '✓ Add Module'}</button>
                    <button type="button" onClick={() => setAddingModule(false)} className="btn btn-ghost">Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <button onClick={() => setAddingModule(true)} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed', padding: '1rem' }}>+ Add New Module</button>
            )}
          </div>
        )}

        {/* ── QUIZZES TAB ── */}
        {tab === 'quizzes' && (
          <div>
            {modules.length === 0 && (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📦</div>
                <p style={{ color: 'var(--text-muted)' }}>Create modules first before adding quizzes.</p>
                <button onClick={() => setTab('modules')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Go to Modules</button>
              </div>
            )}

            {modules.map((mod) => {
              const existingQuizzes = quizzesByModule[mod._id] || [];
              const ai       = getAI(mod._id);
              const isSaving = saving[mod._id] || false;
              const hasLesson = (mod.lessons?.length || 0) > 0;

              return (
                <div key={mod._id} className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#92400E' }}>📦 Module {mod.order}: {mod.title}</span>
                      <div style={{ fontSize: '.72rem', color: '#B45309', marginTop: '.15rem' }}>
                        {existingQuizzes.length} quiz{existingQuizzes.length !== 1 ? 'zes' : ''} created
                        {!hasLesson && <span style={{ marginLeft: 8, color: '#DC2626' }}>⚠ No lessons — add a lesson first</span>}
                      </div>
                    </div>
                    <button onClick={() => setAI(mod._id, { open: !ai.open, step: 'idle', error: '' })}
                      className="btn btn-sm"
                      style={{ background: '#F59E0B', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      {ai.open ? '✕ Close' : '✦ Generate Quiz with AI'}
                    </button>
                  </div>

                  {existingQuizzes.length === 0 && !ai.open && (
                    <div style={{ padding: '.85rem 1.25rem', fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No quizzes yet. Use AI to generate one.</div>
                  )}
                  {existingQuizzes.map((q) => (
                    <div key={q._id} style={{ padding: '.85rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.25rem' }}>📝</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{q.title}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                          {q.questions?.length || 0} questions · Pass: {q.passingScore}%
                          {q.timeLimit > 0 ? ` · ${q.timeLimit} min` : ' · No time limit'}
                          {q.isAIGenerated && <span style={{ marginLeft: 6, ...chip('#F59E0B') }}>✦ AI</span>}
                        </div>
                      </div>
                      <span className={`badge ${q.isPublished ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: '.68rem' }}>
                        {q.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  ))}

                  {/* ════ AI PANEL ════ */}
                  {ai.open && (
                    <div style={{ borderTop: '1px solid var(--border)', background: '#FFFBEB', padding: '1.5rem' }}>
                      {ai.error && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', color: '#DC2626', fontSize: '.8rem', marginBottom: '1rem' }}>
                          {ai.error}
                        </div>
                      )}

                      {(ai.step === 'idle' || ai.step === 'error') && (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#92400E', marginBottom: '1rem' }}>✦ Generate Questions with AI</div>
                          <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Content source</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {[['lesson', '📄 First lesson text'], ['pdf', '📎 Upload a PDF']].map(([val, lbl]) => (
                                <button key={val} type="button" onClick={() => setAI(mod._id, { source: val })}
                                  style={{ padding: '5px 14px', fontSize: '.8rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: `2px solid ${ai.source === val ? '#F59E0B' : '#E5E7EB'}`, background: ai.source === val ? '#FEF3C7' : '#fff', color: ai.source === val ? '#92400E' : '#6B7280' }}>
                                  {lbl}
                                </button>
                              ))}
                            </div>
                            {ai.source === 'lesson' && !hasLesson && (
                              <div style={{ marginTop: 6, fontSize: '.78rem', color: '#DC2626', background: '#FEF2F2', padding: '5px 10px', borderRadius: 6 }}>
                                ⚠ No lessons in this module. Add a text lesson first, or switch to "Upload a PDF".
                              </div>
                            )}
                          </div>

                          {ai.source === 'pdf' && (
                            <div style={{ marginBottom: '1rem' }}>
                              <label className="form-label">PDF file (max 20 MB)</label>
                              <div onClick={() => {
                                if (!fileRefs.current[mod._id]) {
                                  const inp = document.createElement('input');
                                  inp.type = 'file'; inp.accept = 'application/pdf';
                                  inp.onchange = e => setAI(mod._id, { pdfFile: e.target.files[0] });
                                  fileRefs.current[mod._id] = inp;
                                }
                                fileRefs.current[mod._id].click();
                              }} style={{ border: '2px dashed #FCD34D', borderRadius: 8, padding: '1rem', textAlign: 'center', cursor: 'pointer', background: '#FFFBEB' }}>
                                <span style={{ fontSize: '.85rem', color: '#92400E', fontWeight: ai.pdfFile ? 700 : 400 }}>
                                  {ai.pdfFile ? `📎 ${ai.pdfFile.name}` : 'Click to choose a PDF'}
                                </span>
                              </div>
                              {!hasLesson && (
                                <div style={{ marginTop: 6, fontSize: '.78rem', color: '#B45309', background: '#FEF3C7', padding: '5px 10px', borderRadius: 6 }}>
                                  ℹ Add a lesson to this module so the quiz can be linked to it.
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.6rem', marginBottom: '1rem' }}>
                            <div><label className="form-label">Questions to generate</label><input className="form-control" type="number" min={1} max={20} value={ai.numQ} onChange={e => setAI(mod._id, { numQ: Number(e.target.value) })} /></div>
                            <div><label className="form-label">Difficulty</label><select className="form-control" value={ai.difficulty} onChange={e => setAI(mod._id, { difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                            <div><label className="form-label">Focus area (optional)</label><input className="form-control" placeholder="e.g. CSS flexbox" value={ai.focusArea} onChange={e => setAI(mod._id, { focusArea: e.target.value })} /></div>
                          </div>

                          <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Question types</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {[['mcq', 'Multiple Choice'], ['true_false', 'True / False']].map(([val, lbl]) => {
                                const sel = ai.types.includes(val);
                                return (
                                  <button key={val} type="button" onClick={() => toggleAiType(mod._id, val)}
                                    style={{ padding: '5px 14px', borderRadius: 999, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', border: `2px solid ${sel ? '#F59E0B' : '#E5E7EB'}`, background: sel ? '#FEF3C7' : '#fff', color: sel ? '#92400E' : '#6B7280' }}>
                                    {sel ? '✓ ' : ''}{lbl}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <button type="button" onClick={() => runAiGenerate(mod._id)}
                            style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#F59E0B', color: '#fff', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(245,158,11,0.3)' }}>
                            ✦ Generate {ai.numQ} Questions with AI
                          </button>
                        </>
                      )}

                      {ai.step === 'generating' && (
                        <div style={{ textAlign: 'center', padding: '1.5rem .5rem' }}>
                          <style>{`@keyframes aiSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                          <div style={{ fontSize: 30, display: 'inline-block', animation: 'aiSpin 1.5s linear infinite', marginBottom: '.75rem' }}>✦</div>
                          <div style={{ fontWeight: 700, color: '#92400E', fontSize: '.9rem', marginBottom: 4 }}>{ai.genLabel}</div>
                          <div style={{ fontSize: '.78rem', color: '#B45309', marginBottom: '1rem' }}>AI is reading your content and crafting questions…</div>
                          <div style={{ height: 6, background: '#FEF3C7', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                            <div style={{ height: '100%', background: '#F59E0B', borderRadius: 6, width: `${ai.genPct}%`, transition: 'width .4s ease' }} />
                          </div>
                          <div style={{ fontSize: '.72rem', color: '#B45309' }}>{ai.genPct}% — usually takes 5–15 seconds</div>
                        </div>
                      )}

                      {ai.step === 'done' && ai.preview.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.85rem' }}>
                            <span style={{ fontWeight: 700, color: '#92400E', fontSize: '.9rem' }}>✓ {ai.preview.length} questions ready</span>
                            <button type="button" onClick={() => setAI(mod._id, { step: 'idle' })}
                              style={{ fontSize: '.75rem', padding: '3px 10px', borderRadius: 6, border: '1px solid #FCD34D', background: '#FEF3C7', color: '#92400E', cursor: 'pointer', fontWeight: 600 }}>⟳ Regenerate</button>
                          </div>
                          {ai.preview.map((q, i) => (
                            <div key={i} style={{ border: '1px solid #FCD34D', borderRadius: 8, padding: '.85rem', marginBottom: '.6rem', background: '#FFFBEB' }}>
                              <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={chip('#F59E0B')}>Q{i + 1}</span>
                                <span style={chip('#B45309')}>{q.type === 'mcq' ? 'MCQ' : 'T/F'}</span>
                                <span style={chip('#D97706')}>{q.difficulty}</span>
                                {q.topic && <span style={chip('#92400E')}>{q.topic}</span>}
                              </div>
                              <div style={{ fontWeight: 600, fontSize: '.85rem', marginBottom: 6, color: '#111827' }}>{q.questionText}</div>
                              {q.type === 'mcq' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {q.options?.map((o, j) => (
                                    <div key={j} style={{ fontSize: '.78rem', padding: '3px 9px', borderRadius: 5, background: o.isCorrect ? '#F0FDF4' : '#F9FAFB', color: o.isCorrect ? '#15803D' : '#374151', border: `1px solid ${o.isCorrect ? '#86EFAC' : '#E5E7EB'}`, fontWeight: o.isCorrect ? 700 : 400 }}>
                                      {o.isCorrect ? '✓ ' : ''}{o.text}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.type === 'true_false' && (
                                <span style={{ fontSize: '.78rem', padding: '3px 9px', borderRadius: 5, background: '#F0FDF4', color: '#15803D', fontWeight: 700, border: '1px solid #86EFAC' }}>✓ {q.correctAnswer}</span>
                              )}
                              {q.explanation && (
                                <div style={{ fontSize: '.72rem', color: '#92400E', marginTop: 6, background: '#FEF3C7', padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid #F59E0B' }}>{q.explanation}</div>
                              )}
                            </div>
                          ))}
                          <div style={{ marginTop: '1rem', padding: '1rem', background: '#FEF3C7', borderRadius: 8, border: '1px solid #FCD34D' }}>
                            <label className="form-label" style={{ color: '#92400E', fontWeight: 700 }}>Quiz Title *</label>
                            <input className="form-control" placeholder="e.g. Python Fundamentals Quiz"
                              value={quizTitle[mod._id] || ''}
                              onChange={e => setQuizTitle(p => ({ ...p, [mod._id]: e.target.value }))}
                              style={{ marginBottom: '.75rem' }} />
                            <button type="button" onClick={() => saveAiQuiz(mod._id)} disabled={isSaving}
                              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#92400E', color: '#fff', fontWeight: 700, fontSize: '.9rem', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                              {isSaving ? '⏳ Saving & Publishing...' : `✓ Save & Publish Quiz (${ai.preview.length} questions)`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Course Info</h3>
            {[
              { label: 'Title',    value: course?.title },
              { label: 'Category', value: course?.category },
              { label: 'Level',    value: course?.level },
              { label: 'Status',   value: course?.isPublished ? 'Published' : 'Draft' },
              { label: 'Topics',   value: course?.topicsCovered?.join(', ') || 'None set' },
              { label: 'Free',     value: course?.isFree ? 'Yes' : `No — $${course?.price}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: '1rem', fontSize: '.875rem', padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: 100 }}>{label}:</span>
                <span style={{ textTransform: 'capitalize' }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.75rem' }}>
              <Link to={`/courses/${id}`} className="btn btn-outline btn-sm">View Course Page →</Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}