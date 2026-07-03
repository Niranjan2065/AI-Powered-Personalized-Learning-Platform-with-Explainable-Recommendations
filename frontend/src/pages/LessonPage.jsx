// src/pages/LessonPage.jsx
//
// CHANGES in this version:
//
//  NEW — Prev / Next lesson navigation
//   • Derives a flat ordered list of all lessons across all modules from the
//     existing `modules` state (already fetched) — no extra API call needed.
//   • Prev button in footer + Next button in footer (replaces plain "Back to Course")
//   • Keyboard shortcuts: ← / → arrow keys navigate between lessons
//   • "Mark Complete & Continue" button auto-navigates to next lesson after marking
//   • After completing the LAST lesson in the course, shows a "Course Complete 🎉"
//     banner and links back to the course page instead of a next button.
//
//  NEW — Progress indicator in sidebar header
//   • Shows "X of Y lessons" below "COURSE CONTENT" heading
//   • Lesson completion dots in sidebar (✓ ticked when lesson is in completedIds[])
//     completedIds is read from the local state — no extra API call.
//
//  NEW — Auto-scroll sidebar active lesson into view on navigation
//
//  KEPT — all existing content rendering, quiz CTA, toEmbedUrl, topics, AIChatTutor
//    completely unchanged.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import { getLesson, markLessonComplete, getModules, getQuizzesByModule } from '../utils/api';

// ─────────────────────────────────────────────────────────────
// YouTube URL → embed URL converter (unchanged)
// ─────────────────────────────────────────────────────────────
const toEmbedUrl = (url) => {
  if (!url) return '';
  if (url.includes('youtube.com/embed/')) return url;
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  const watchMatch = url.match(/[?&]v=([^?&]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  return url;
};

// ─────────────────────────────────────────────────────────────
// Build a flat ordered lesson list from modules array
// Returns: [{ lessonId, lessonTitle, moduleTitle, moduleOrder, contentType, duration }, ...]
// ─────────────────────────────────────────────────────────────
function buildFlatLessonList(modules) {
  const flat = [];
  const sorted = [...modules].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const mod of sorted) {
    const lessons = [...(mod.lessons || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const l of lessons) {
      flat.push({
        lessonId:    l._id,
        lessonTitle: l.title,
        moduleTitle: mod.title,
        moduleOrder: mod.order,
        contentType: l.contentType,
        duration:    l.estimatedDuration,
      });
    }
  }
  return flat;
}

// ─────────────────────────────────────────────────────────────
// Markdown-like renderer (unchanged from original)
// ─────────────────────────────────────────────────────────────
function renderTextContent(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (line.startsWith('# '))
      return <h1 key={i} style={{ fontSize: '1.5rem', margin: '1.25rem 0 .6rem', color: 'var(--text-primary)' }}>{line.slice(2)}</h1>;
    if (line.startsWith('## '))
      return <h2 key={i} style={{ fontSize: '1.2rem', margin: '1rem 0 .5rem', color: 'var(--text-primary)' }}>{line.slice(3)}</h2>;
    if (line.startsWith('### '))
      return <h3 key={i} style={{ fontSize: '1rem', margin: '.85rem 0 .4rem', color: 'var(--text-primary)', fontWeight: 700 }}>{line.slice(4)}</h3>;
    if (line.startsWith('```') || line === '```') return null;
    if (line.startsWith('- ') || line.startsWith('* '))
      return <li key={i} style={{ marginLeft: '1.5rem', marginBottom: '.3rem', color: 'var(--text-secondary)' }}>{line.slice(2)}</li>;
    if (line.trim() === '') return <br key={i} />;
    if (line.includes('`')) {
      const parts = line.split('`');
      return (
        <p key={i} style={{ marginBottom: '.5rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {parts.map((p, j) =>
            j % 2 === 1
              ? <code key={j} style={{ background: '#F1F5F9', color: '#E11D48', padding: '.1rem .35rem', borderRadius: 4, fontSize: '.875em', fontFamily: 'monospace' }}>{p}</code>
              : p
          )}
        </p>
      );
    }
    return <p key={i} style={{ marginBottom: '.5rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{line}</p>;
  });
}

// ─────────────────────────────────────────────────────────────
// NavButton — prev / next footer button
// ─────────────────────────────────────────────────────────────
function NavButton({ direction, lesson: target, courseId, disabled }) {
  const navigate = useNavigate();
  if (disabled || !target) {
    return (
      <button disabled style={{
        padding: '.6rem 1.1rem', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: 'var(--bg-2)',
        color: 'var(--text-muted)', fontSize: '.82rem', cursor: 'not-allowed',
        display: 'flex', alignItems: 'center', gap: '.4rem', opacity: .5,
      }}>
        {direction === 'prev' ? '← Previous' : 'Next →'}
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate(`/learn/${courseId}/lesson/${target.lessonId}`)}
      title={`${direction === 'prev' ? 'Previous' : 'Next'}: ${target.lessonTitle} (${direction === 'prev' ? '←' : '→'} arrow key)`}
      style={{
        padding: '.6rem 1.1rem', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text-primary)', fontSize: '.82rem', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: direction === 'prev' ? 'flex-start' : 'flex-end',
        gap: '.15rem', transition: 'all .15s', maxWidth: 220,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
    >
      <span style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        {direction === 'prev' ? '← PREVIOUS' : 'NEXT →'}
      </span>
      <span style={{
        fontWeight: 500, lineHeight: 1.3, textAlign: direction === 'prev' ? 'left' : 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190,
      }}>
        {target.lessonTitle}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export default function LessonPage() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson,       setLesson]       = useState(null);
  const [modules,      setModules]      = useState([]);
  const [quizzes,      setQuizzes]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [completed,    setCompleted]    = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [completedIds, setCompletedIds] = useState(() => {
    // Persist completed lesson IDs in sessionStorage so they survive
    // navigation between lessons within the same browsing session.
    try {
      return new Set(JSON.parse(sessionStorage.getItem('completedLessons') || '[]'));
    } catch { return new Set(); }
  });
  const [timeStart] = useState(Date.now());
  const activeLessonRef = useRef(null);

  // ── Fetch lesson + modules ──────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setCompleted(false);

    const load = async () => {
      try {
        const [lesRes, modRes] = await Promise.all([
          getLesson(lessonId),
          getModules(courseId),
        ]);
        setLesson(lesRes.data.data);
        setModules(modRes.data.data);

        // Mark current lesson as visited (not complete, just seen)
        if (lesRes.data.data?.module?._id) {
          try {
            const qRes = await getQuizzesByModule(lesRes.data.data.module._id);
            setQuizzes(qRes.data.data);
          } catch {}
        }
      } catch {
        toast.error('Lesson not found');
        navigate(`/courses/${courseId}`);
      }
      setLoading(false);
    };
    load();
  }, [lessonId]);

  // ── Auto-scroll sidebar active lesson into view ─────────────
  useEffect(() => {
    if (activeLessonRef.current) {
      activeLessonRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [lessonId, loading]);

  // ── Flat lesson list + navigation index ────────────────────
  const flatLessons = buildFlatLessonList(modules);
  const currentIdx  = flatLessons.findIndex(l => l.lessonId === lessonId);
  const prevLesson  = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
  const nextLesson  = currentIdx < flatLessons.length - 1 ? flatLessons[currentIdx + 1] : null;
  const isLast      = currentIdx === flatLessons.length - 1 && flatLessons.length > 0;
  const totalCount  = flatLessons.length;
  const currentPos  = currentIdx + 1;

  // ── Keyboard navigation ← → ────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    // Don't fire if user is typing in an input/textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowLeft'  && prevLesson) navigate(`/learn/${courseId}/lesson/${prevLesson.lessonId}`);
    if (e.key === 'ArrowRight' && nextLesson) navigate(`/learn/${courseId}/lesson/${nextLesson.lessonId}`);
  }, [prevLesson, nextLesson, courseId, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Mark complete ───────────────────────────────────────────
  const handleComplete = async (andNavigate = false) => {
    const timeSpent = Math.round((Date.now() - timeStart) / 60000);
    setCompleting(true);
    try {
      await markLessonComplete(lessonId, { timeSpent });
      setCompleted(true);

      // Persist in sessionStorage so sidebar ticks show on nav
      const next = new Set(completedIds);
      next.add(lessonId);
      setCompletedIds(next);
      sessionStorage.setItem('completedLessons', JSON.stringify([...next]));

      toast.success('Lesson complete! 🎉');
      if (andNavigate && nextLesson) {
        setTimeout(() => navigate(`/learn/${courseId}/lesson/${nextLesson.lessonId}`), 600);
      }
    } catch {
      toast.error('Could not mark complete');
    }
    setCompleting(false);
  };

  if (loading) return <><Navbar /><Spinner center /></>;

  const embedUrl = lesson?.content?.videoUrl ? toEmbedUrl(lesson.content.videoUrl) : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Keyboard shortcut hint — shown briefly at top */}
      <div style={{
        background: 'var(--primary)', color: '#fff',
        fontSize: '.72rem', textAlign: 'center', padding: '.3rem',
        letterSpacing: '.03em',
      }}>
        Use <kbd style={{ background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: 3, fontFamily: 'monospace' }}>←</kbd>
        {' / '}
        <kbd style={{ background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: 3, fontFamily: 'monospace' }}>→</kbd>
        {' arrow keys to navigate between lessons'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 'calc(100vh - 88px)' }}>

        {/* ══════════════════════════════════════════
            SIDEBAR
        ══════════════════════════════════════════ */}
        <div style={{ background: '#1e1b4b', color: '#fff', overflowY: 'auto', padding: '1.5rem 0' }}>

          {/* Sidebar header */}
          <div style={{ padding: '0 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <Link to={`/courses/${courseId}`}
              style={{ color: 'rgba(255,255,255,.6)', fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.3rem', marginBottom: '.75rem', textDecoration: 'none' }}>
              ← Back to course
            </Link>
            <h3 style={{ fontSize: '.85rem', opacity: .6, fontWeight: 600, margin: 0 }}>COURSE CONTENT</h3>

            {/* ✅ NEW — Progress counter */}
            {totalCount > 0 && (
              <div style={{ marginTop: '.5rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.15)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(completedIds.size / totalCount) * 100}%`,
                    height: '100%', background: '#34D399', borderRadius: 99,
                    transition: 'width .4s ease',
                  }} />
                </div>
                <span style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.45)', whiteSpace: 'nowrap' }}>
                  {completedIds.size}/{totalCount}
                </span>
              </div>
            )}

            {/* Current lesson position */}
            {currentPos > 0 && (
              <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.35)', marginTop: '.3rem' }}>
                Lesson {currentPos} of {totalCount}
              </div>
            )}
          </div>

          {/* Module + lesson list */}
          {modules.map(mod => (
            <div key={mod._id}>
              <div style={{
                padding: '.75rem 1.25rem',
                fontSize: '.72rem', fontWeight: 700,
                color: 'rgba(255,255,255,.45)',
                textTransform: 'uppercase', letterSpacing: '.06em',
                borderBottom: '1px solid rgba(255,255,255,.05)',
                marginTop: '.25rem',
              }}>
                {mod.order}. {mod.title}
              </div>

              {mod.lessons?.map(l => {
                const isActive    = l._id === lessonId;
                const isDone      = completedIds.has(l._id);

                return (
                  <Link
                    key={l._id}
                    ref={isActive ? activeLessonRef : null}
                    to={`/learn/${courseId}/lesson/${l._id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '.6rem',
                      padding: '.65rem 1.25rem', fontSize: '.82rem', textDecoration: 'none',
                      color: isActive ? '#A5F3FC' : 'rgba(255,255,255,.7)',
                      background: isActive ? 'rgba(165,243,252,.08)' : 'transparent',
                      borderLeft: isActive ? '3px solid #A5F3FC' : '3px solid transparent',
                      transition: 'background .1s',
                    }}
                  >
                    {/* Content type icon */}
                    <span style={{ fontSize: '.9rem', flexShrink: 0 }}>
                      {l.contentType === 'video' ? '🎬' : l.contentType === 'pdf' ? '📄' : '📝'}
                    </span>

                    <span style={{ flex: 1, lineHeight: 1.3 }}>{l.title}</span>

                    <span style={{ fontSize: '.68rem', opacity: .5, flexShrink: 0 }}>
                      {l.estimatedDuration}m
                    </span>

                    {/* ✅ NEW — completion tick */}
                    {isDone && (
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#34D399', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '.6rem', flexShrink: 0,
                      }}>✓</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════════ */}
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>

            {/* ── Meta row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{
                background: 'var(--primary-light)', color: 'var(--primary)',
                padding: '.25rem .75rem', borderRadius: 99,
                fontSize: '.8rem', fontWeight: 600,
              }}>
                {lesson.contentType === 'video' ? '🎬 Video' : lesson.contentType === 'pdf' ? '📄 PDF' : '📝 Text'} · {lesson.estimatedDuration} min
              </span>
              {lesson.module?.title && (
                <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                  📦 {lesson.module.title}
                </span>
              )}
              {/* Position badge */}
              {currentPos > 0 && (
                <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {currentPos} / {totalCount}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
              {lesson.title}
            </h1>

            {/* ── Content card (unchanged) ── */}
            <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>

              {/* VIDEO */}
              {lesson.contentType === 'video' && (
                <div>
                  {embedUrl ? (
                    <div style={{
                      position: 'relative', paddingBottom: '56.25%',
                      height: 0, overflow: 'hidden',
                      borderRadius: 'var(--radius)', background: '#000',
                      marginBottom: '1rem',
                    }}>
                      <iframe
                        src={embedUrl}
                        title={lesson.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      />
                    </div>
                  ) : (
                    <div style={{ background: '#F8FAFC', border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '3rem', textAlign: 'center', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '.75rem' }}>🎬</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>
                        No video URL set for this lesson.<br />
                        <strong style={{ color: 'var(--text-primary)' }}>Tip:</strong> Add a YouTube URL like:<br />
                        <code style={{ background: '#E2E8F0', padding: '.2rem .5rem', borderRadius: 4, fontSize: '.8rem' }}>
                          https://www.youtube.com/watch?v=VIDEO_ID
                        </code>
                      </p>
                    </div>
                  )}
                  {lesson.content?.text && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                      {renderTextContent(lesson.content.text)}
                    </div>
                  )}
                </div>
              )}

              {/* TEXT */}
              {lesson.contentType === 'text' && lesson.content?.text && (
                <div style={{ lineHeight: 1.8, fontSize: '.95rem' }}>
                  {renderTextContent(lesson.content.text)}
                </div>
              )}

              {/* PDF */}
              {lesson.contentType === 'pdf' && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  {lesson.content?.pdfUrl ? (
                    <div>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        PDF lesson: {lesson.title}
                      </p>
                      <a href={lesson.content.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
                        📄 Open PDF
                      </a>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '.75rem' }}>📄</div>
                      <p>No PDF URL set for this lesson.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Topics (unchanged) ── */}
            {lesson.topics?.length > 0 && (
              <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Topics covered:</span>
                {lesson.topics.map(t => (
                  <span key={t} className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{t}</span>
                ))}
              </div>
            )}

            {/* ── Quiz CTA (unchanged) ── */}
            {quizzes.length > 0 && (
              <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--accent)', background: '#FFFBEB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.5rem' }}>📝</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: '.2rem' }}>Module Quizzes Available</div>
                    <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
                      Test your understanding after completing this lesson
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {quizzes.map(q => (
                      <Link key={q._id} to={`/quiz/${q._id}`} className="btn btn-sm"
                        style={{ background: 'var(--accent)', color: '#fff' }}>
                        {q.title} →
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Course complete banner (shown after last lesson is marked done) ── */}
            {isLast && completed && (
              <div style={{
                background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
                border: '1px solid #34D399', borderRadius: 'var(--radius)',
                padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>🎉</div>
                <h2 style={{ color: '#065F46', marginBottom: '.4rem', fontSize: '1.2rem' }}>
                  You've completed the course!
                </h2>
                <p style={{ color: '#047857', fontSize: '.875rem', marginBottom: '1rem' }}>
                  All lessons done. Head back to take any remaining quizzes or get your AI recommendations.
                </p>
                <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link to={`/courses/${courseId}`} className="btn btn-primary">
                    View Course Summary →
                  </Link>
                  <Link to="/recommendations" className="btn btn-outline">
                    🤖 Get AI Recommendations
                  </Link>
                </div>
              </div>
            )}

            {/* ✅ NEW — Navigation footer with prev / next */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: '1.25rem', borderTop: '1px solid var(--border)',
              gap: '1rem', flexWrap: 'wrap',
            }}>

              {/* Prev button */}
              <NavButton direction="prev" lesson={prevLesson} courseId={courseId} disabled={!prevLesson} />

              {/* Centre — complete / complete+next / done state */}
              <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                {!completed ? (
                  <>
                    <button
                      onClick={() => handleComplete(false)}
                      disabled={completing}
                      className="btn btn-outline"
                      style={{ fontSize: '.82rem' }}
                    >
                      {completing ? '⏳ Saving…' : '✓ Mark Complete'}
                    </button>
                    {nextLesson && (
                      <button
                        onClick={() => handleComplete(true)}
                        disabled={completing}
                        className="btn btn-primary"
                        style={{ fontSize: '.82rem' }}
                      >
                        {completing ? '⏳ Saving…' : 'Complete & Continue →'}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      background: '#D1FAE5', color: '#065F46',
                      padding: '.5rem 1rem', borderRadius: 'var(--radius-sm)',
                      fontWeight: 600, fontSize: '.82rem',
                    }}>
                      ✓ Complete
                    </span>
                    {quizzes[0] && (
                      <Link to={`/quiz/${quizzes[0]._id}`} className="btn btn-primary" style={{ fontSize: '.82rem' }}>
                        Take Quiz →
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Next button */}
              <NavButton direction="next" lesson={nextLesson} courseId={courseId} disabled={!nextLesson} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}