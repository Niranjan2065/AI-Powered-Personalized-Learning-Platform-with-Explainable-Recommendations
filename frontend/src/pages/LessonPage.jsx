// src/pages/LessonPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import { getLesson, markLessonComplete, getModules, getQuizzesByModule } from '../utils/api';

// ============================================================
// FIX: Convert any YouTube URL to embed format
// Handles:
//   https://www.youtube.com/watch?v=VIDEO_ID  → embed
//   https://youtu.be/VIDEO_ID                 → embed
//   https://www.youtube.com/embed/VIDEO_ID    → already correct
// ============================================================
const toEmbedUrl = (url) => {
  if (!url) return '';

  // Already an embed URL
  if (url.includes('youtube.com/embed/')) return url;

  // youtu.be short link
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  // Full YouTube watch URL
  const watchMatch = url.match(/[?&]v=([^?&]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;

  // Not YouTube — return as-is (e.g. Vimeo, direct mp4)
  return url;
};

export default function LessonPage() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [modules, setModules] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [timeStart] = useState(Date.now());

  useEffect(() => {
    const fetch = async () => {
      try {
        const [lesRes, modRes] = await Promise.all([
          getLesson(lessonId),
          getModules(courseId),
        ]);
        setLesson(lesRes.data.data);
        setModules(modRes.data.data);
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
    fetch();
  }, [lessonId]);

  const handleComplete = async () => {
    const timeSpent = Math.round((Date.now() - timeStart) / 60000);
    try {
      await markLessonComplete(lessonId, { timeSpent });
      setCompleted(true);
      toast.success('Lesson marked as complete! 🎉');
    } catch { toast.error('Could not mark complete'); }
  };

  // Render markdown-like text content
  const renderTextContent = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# '))
        return <h1 key={i} style={{ fontSize: '1.5rem', margin: '1.25rem 0 .6rem', color: 'var(--text-primary)' }}>{line.slice(2)}</h1>;
      if (line.startsWith('## '))
        return <h2 key={i} style={{ fontSize: '1.2rem', margin: '1rem 0 .5rem', color: 'var(--text-primary)' }}>{line.slice(3)}</h2>;
      if (line.startsWith('### '))
        return <h3 key={i} style={{ fontSize: '1rem', margin: '.85rem 0 .4rem', color: 'var(--text-primary)', fontWeight: 700 }}>{line.slice(4)}</h3>;
      if (line.startsWith('```') || line === '```')
        return null; // handled below
      if (line.startsWith('- ') || line.startsWith('* '))
        return <li key={i} style={{ marginLeft: '1.5rem', marginBottom: '.3rem', color: 'var(--text-secondary)' }}>{line.slice(2)}</li>;
      if (line.trim() === '')
        return <br key={i} />;
      // Inline code
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
  };

  if (loading) return <><Navbar /><Spinner center /></>;

  const embedUrl = lesson?.content?.videoUrl ? toEmbedUrl(lesson.content.videoUrl) : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 'calc(100vh - 64px)' }}>
        {/* ── Sidebar ── */}
        <div style={{ background: '#1e1b4b', color: '#fff', overflowY: 'auto', padding: '1.5rem 0' }}>
          <div style={{ padding: '0 1.25rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <Link to={`/courses/${courseId}`}
              style={{ color: 'rgba(255,255,255,.6)', fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.3rem', marginBottom: '.75rem', textDecoration: 'none' }}>
              ← Back to course
            </Link>
            <h3 style={{ fontSize: '.85rem', opacity: .6, fontWeight: 600 }}>COURSE CONTENT</h3>
          </div>

          {modules.map(mod => (
            <div key={mod._id}>
              <div style={{ padding: '.75rem 1.25rem', fontSize: '.72rem', fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid rgba(255,255,255,.05)', marginTop: '.25rem' }}>
                {mod.order}. {mod.title}
              </div>
              {mod.lessons?.map(l => (
                <Link key={l._id} to={`/learn/${courseId}/lesson/${l._id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '.6rem',
                    padding: '.65rem 1.25rem', fontSize: '.82rem', textDecoration: 'none',
                    color: l._id === lessonId ? '#A5F3FC' : 'rgba(255,255,255,.7)',
                    background: l._id === lessonId ? 'rgba(165,243,252,.08)' : 'transparent',
                    borderLeft: l._id === lessonId ? '3px solid #A5F3FC' : '3px solid transparent',
                  }}>
                  <span style={{ fontSize: '.9rem' }}>
                    {l.contentType === 'video' ? '🎬' : l.contentType === 'pdf' ? '📄' : '📝'}
                  </span>
                  <span style={{ flex: 1, lineHeight: 1.3 }}>{l.title}</span>
                  <span style={{ fontSize: '.68rem', opacity: .5 }}>{l.estimatedDuration}m</span>
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* ── Main Content ── */}
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>

            {/* Meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem' }}>
              <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '.25rem .75rem', borderRadius: 99, fontSize: '.8rem', fontWeight: 600 }}>
                {lesson.contentType === 'video' ? '🎬 Video' : lesson.contentType === 'pdf' ? '📄 PDF' : '📝 Text'} · {lesson.estimatedDuration} min
              </span>
              {lesson.module?.title && (
                <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                  📦 {lesson.module.title}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>{lesson.title}</h1>

            {/* ── Content Card ── */}
            <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>

              {/* VIDEO CONTENT */}
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
                  {/* Show text description below video if any */}
                  {lesson.content?.text && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                      {renderTextContent(lesson.content.text)}
                    </div>
                  )}
                </div>
              )}

              {/* TEXT CONTENT */}
              {lesson.contentType === 'text' && lesson.content?.text && (
                <div style={{ lineHeight: 1.8, fontSize: '.95rem' }}>
                  {renderTextContent(lesson.content.text)}
                </div>
              )}

              {/* PDF CONTENT */}
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

            {/* Topics */}
            {lesson.topics?.length > 0 && (
              <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Topics covered:</span>
                {lesson.topics.map(t => (
                  <span key={t} className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{t}</span>
                ))}
              </div>
            )}

            {/* Quiz CTA */}
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

            {/* Navigation Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem' }}>
              <Link to={`/courses/${courseId}`} className="btn btn-ghost">
                ← Back to Course
              </Link>
              {!completed ? (
                <button onClick={handleComplete} className="btn btn-primary btn-lg">
                  ✓ Mark as Complete
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                  <span style={{ background: '#D1FAE5', color: '#065F46', padding: '.6rem 1.25rem', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '.875rem' }}>
                    ✓ Lesson Complete!
                  </span>
                  {quizzes[0] && (
                    <Link to={`/quiz/${quizzes[0]._id}`} className="btn btn-primary">
                      Take Quiz →
                    </Link>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}