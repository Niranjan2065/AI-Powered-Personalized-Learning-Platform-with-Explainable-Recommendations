// src/pages/ManageCoursePage.jsx
//
// FIXES in this version:
//  1. Added useNavigate to react-router-dom import
//  2. Declared navigate = useNavigate() inside the component
//  3. Removed dead state: addingLesson, lessonForms, lessonSaving (no longer needed)
//  4. Removed unused handleAddLesson, setLessonField, getLF, buildContent
//  5. Removed the inline lesson form JSX (now a dedicated CreateLessonPage)
//  6. Removed unused imports: createLesson, useRef, GEN_STEPS

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import { getCourse, createModule } from '../utils/api';
import AIQuizGenerator from '../components/quiz/AIQuizGenerator';
import axios from 'axios';

const authApi = axios.create({ baseURL: '/api' });
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const chip = (color) => ({
  display: 'inline-block', fontSize: '.68rem', fontWeight: 700,
  padding: '2px 7px', borderRadius: 999,
  background: color + '22', color,
});

export default function ManageCoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();  // ✅ FIXED — was missing, caused "navigate is not defined"

  const [course,          setCourse]         = useState(null);
  const [modules,         setModules]        = useState([]);
  const [loading,         setLoading]        = useState(true);
  const [tab,             setTab]            = useState('modules');

  const [addingModule,    setAddingModule]   = useState(false);
  const [modForm,         setModForm]        = useState({ title: '', description: '', topics: '' });
  const [modSaving,       setModSaving]      = useState(false);

  const [quizzesByModule, setQuizzesByModule] = useState({});
  const [aiOpenModule,    setAiOpenModule]   = useState(null);

  // ── Data loading ──────────────────────────────────────────────
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

  const handleAddModule = async (e) => {
    e.preventDefault();
    setModSaving(true);
    try {
      await createModule(id, {
        title:       modForm.title,
        description: modForm.description,
        topics:      modForm.topics.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
        isPublished: true,
      });
      toast.success('Module added!');
      setModForm({ title: '', description: '', topics: '' });
      setAddingModule(false);
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add module');
    }
    setModSaving(false);
  };

  if (loading) return <><Navbar /><Spinner center /></>;

  const TABS = ['modules', 'quizzes', 'settings'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ padding: '2rem 1.5rem' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <Link to="/tutor" style={{ fontSize: '.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← Tutor Dashboard
            </Link>
            <h1 style={{ fontSize: '1.4rem', marginTop: '.3rem', marginBottom: '.4rem' }}>
              {course?.title}
            </h1>
            <span className={`badge ${course?.isPublished ? 'badge-success' : 'badge-gray'}`}>
              {course?.isPublished ? '✓ Published' : '⚙ Draft'}
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'var(--primary)' : 'transparent',
                color:      tab === t ? '#fff' : 'var(--text-secondary)',
                border: 'none', padding: '.5rem 1.25rem',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontWeight: 600, fontSize: '.875rem',
                textTransform: 'capitalize', transition: 'all .15s',
              }}>
              {t === 'modules' ? '📦 Modules & Lessons'
               : t === 'quizzes' ? '📝 Quizzes'
               : '⚙ Settings'}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            MODULES TAB
        ══════════════════════════════════════════ */}
        {tab === 'modules' && (
          <div>
            {modules.map((mod) => (
              <div key={mod._id} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>

                {/* Module header row */}
                <div style={{
                  padding: '1rem 1.25rem',
                  background: 'var(--primary-light)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      Module {mod.order}: {mod.title}
                    </span>
                    {mod.topics?.length > 0 && (
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                        Topics: {mod.topics.join(', ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                      {mod.lessons?.length || 0} lessons · {(quizzesByModule[mod._id] || []).length} quizzes
                    </span>
                    {/* ✅ FIXED — navigates to dedicated CreateLessonPage */}
                    <button
                      onClick={() => navigate(`/tutor/courses/${id}/modules/${mod._id}/lessons/create`)}
                      className="btn btn-primary btn-sm">
                      + Add Lesson
                    </button>
                  </div>
                </div>

                {/* Empty state */}
                {mod.lessons?.length === 0 && (
                  <div style={{ padding: '.85rem 1.25rem', fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No lessons yet. Click "+ Add Lesson" to create one.
                  </div>
                )}

                {/* Lesson list */}
                {mod.lessons?.map((l) => (
                  <div key={l._id} style={{
                    padding: '.7rem 1.25rem',
                    display: 'flex', gap: '.75rem', alignItems: 'center',
                    borderTop: '1px solid var(--border)',
                  }}>
                    <span>
                      {l.contentType === 'video' ? '🎬' : l.contentType === 'pdf' ? '📄' : '📝'}
                    </span>
                    <span style={{ flex: 1, fontSize: '.875rem', fontWeight: 500 }}>{l.title}</span>
                    <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
                      {l.estimatedDuration}min
                    </span>
                    {l.topics?.length > 0 && (
                      <span style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>
                        🏷 {l.topics.slice(0, 2).join(', ')}{l.topics.length > 2 ? '…' : ''}
                      </span>
                    )}
                    <span
                      className={`badge ${l.contentType === 'video' ? 'badge-primary' : 'badge-gray'}`}
                      style={{ fontSize: '.65rem', textTransform: 'capitalize' }}>
                      {l.contentType}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {/* Add Module form / button */}
            {addingModule ? (
              <div className="card" style={{ padding: '1.5rem', border: '2px dashed var(--primary)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>📦 New Module</h4>
                <form onSubmit={handleAddModule}>
                  <div className="form-group">
                    <label className="form-label">Module Title *</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Python Fundamentals"
                      required
                      value={modForm.title}
                      onChange={e => setModForm({ ...modForm, title: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input
                      className="form-control"
                      placeholder="Brief description"
                      value={modForm.description}
                      onChange={e => setModForm({ ...modForm, description: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Topics (comma-separated)</label>
                    <input
                      className="form-control"
                      placeholder="e.g. variables, data types"
                      value={modForm.topics}
                      onChange={e => setModForm({ ...modForm, topics: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={modSaving}>
                      {modSaving ? 'Saving...' : '✓ Add Module'}
                    </button>
                    <button type="button" onClick={() => setAddingModule(false)} className="btn btn-ghost">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                onClick={() => setAddingModule(true)}
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed', padding: '1rem' }}>
                + Add New Module
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            QUIZZES TAB
        ══════════════════════════════════════════ */}
        {tab === 'quizzes' && (
          <div>
            {modules.length === 0 && (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📦</div>
                <p style={{ color: 'var(--text-muted)' }}>Create modules first before adding quizzes.</p>
                <button onClick={() => setTab('modules')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Go to Modules
                </button>
              </div>
            )}

            {modules.map((mod) => {
              const existingQuizzes = quizzesByModule[mod._id] || [];
              const hasLesson = (mod.lessons?.length || 0) > 0;
              const isAiOpen = aiOpenModule === mod._id;

              return (
                <div key={mod._id} className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
                  <div style={{
                    padding: '1rem 1.25rem',
                    background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#92400E' }}>
                        📦 Module {mod.order}: {mod.title}
                      </span>
                      <div style={{ fontSize: '.72rem', color: '#B45309', marginTop: '.15rem' }}>
                        {existingQuizzes.length} quiz{existingQuizzes.length !== 1 ? 'zes' : ''} created
                        {!hasLesson && (
                          <span style={{ marginLeft: 8, color: '#DC2626' }}>
                            ⚠ No lessons — add a lesson first
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setAiOpenModule(isAiOpen ? null : mod._id)}
                      className="btn btn-sm"
                      style={{ background: '#F59E0B', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      {isAiOpen ? '✕ Close' : '✦ Generate Quiz with AI'}
                    </button>
                  </div>

                  {existingQuizzes.length === 0 && !isAiOpen && (
                    <div style={{ padding: '.85rem 1.25rem', fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No quizzes yet. Use AI to generate one.
                    </div>
                  )}

                  {existingQuizzes.map((q) => (
                    <div key={q._id} style={{
                      padding: '.85rem 1.25rem',
                      borderTop: '1px solid var(--border)',
                      display: 'flex', gap: '1rem', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '1.25rem' }}>📝</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{q.title}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                          {q.questions?.length || 0} questions · Pass: {q.passingScore}%
                          {q.timeLimit > 0 ? ` · ${q.timeLimit} min` : ' · No time limit'}
                          {q.isAIGenerated && (
                            <span style={{ marginLeft: 6, ...chip('#F59E0B') }}>✦ AI</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`badge ${q.isPublished ? 'badge-success' : 'badge-gray'}`}
                        style={{ fontSize: '.68rem' }}>
                        {q.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  ))}

                  {isAiOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)', padding: '1.5rem' }}>
                      <AIQuizGenerator
                        lesson={mod.lessons?.[0]}
                        onClose={() => setAiOpenModule(null)}
                        onSaveSuccess={() => reload()}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════
            SETTINGS TAB
        ══════════════════════════════════════════ */}
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
              <div key={label} style={{
                display: 'flex', gap: '1rem', fontSize: '.875rem',
                padding: '.6rem 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: 100 }}>{label}:</span>
                <span style={{ textTransform: 'capitalize' }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.75rem' }}>
              <Link to={`/courses/${id}`} className="btn btn-outline btn-sm">
                View Course Page →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}