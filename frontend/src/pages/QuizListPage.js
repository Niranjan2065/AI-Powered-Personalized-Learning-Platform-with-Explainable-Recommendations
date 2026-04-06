// src/pages/QuizListPage.js — All quizzes for a course (Student view)
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner, EmptyState } from '../components/common/StatCard';
import { getCourse, getModules, getQuizzesByLesson, getQuizResults } from '../utils/api';

export default function QuizListPage() {
  const { courseId } = useParams();
  const [course, setCourse]     = useState(null);
  const [modules, setModules]   = useState([]);
  const [quizData, setQuizData] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [cRes, mRes] = await Promise.all([getCourse(courseId), getModules(courseId)]);
        setCourse(cRes.data.data);
        const mods = mRes.data.data;
        setModules(mods);

        // FIX: use lessonId (first lesson of each module), not moduleId
        const combined = await Promise.all(mods.map(async (mod) => {
          try {
            const lessonId = mod.lessons?.[0]?._id;
            if (!lessonId) return { module: mod, quizzes: [] };

            const qRes   = await getQuizzesByLesson(lessonId);
            const quizzes = qRes.data.data;

            const withResults = await Promise.all(quizzes.map(async (quiz) => {
              try {
                const rRes = await getQuizResults(quiz._id);
                return { quiz, results: rRes.data.data };
              } catch { return { quiz, results: [] }; }
            }));
            return { module: mod, quizzes: withResults };
          } catch { return { module: mod, quizzes: [] }; }
        }));
        setQuizData(combined);
      } catch { toast.error('Failed to load quizzes'); }
      setLoading(false);
    };
    fetch();
  }, [courseId]);

  const totalQuizzes = quizData.reduce((s, m) => s + m.quizzes.length, 0);
  const attempted    = quizData.reduce((s, m) => s + m.quizzes.filter(q => q.results.length > 0).length, 0);
  const passed       = quizData.reduce((s, m) => s + m.quizzes.filter(q => q.results.some(r => r.isPassed)).length, 0);

  if (loading) return <><Navbar /><Spinner center /></>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #78350f, #d97706)', color: '#fff', padding: '2.5rem 0' }}>
        <div className="container">
          <Link to={`/courses/${courseId}`} style={{ color: 'rgba(255,255,255,.7)', fontSize: '.82rem', textDecoration: 'none', display: 'inline-block', marginBottom: '.75rem' }}>
            ← Back to Course
          </Link>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>📝 Course Quizzes</h1>
          <p style={{ opacity: .85, fontSize: '.9rem', marginBottom: '1.25rem' }}>{course?.title}</p>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Quizzes', val: totalQuizzes },
              { label: 'Attempted',     val: attempted },
              { label: 'Passed',        val: passed },
              { label: 'Remaining',     val: totalQuizzes - attempted },
            ].map(({ label, val }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{val}</div>
                <div style={{ fontSize: '.75rem', opacity: .75 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        {totalQuizzes === 0 ? (
          <EmptyState icon="📝" title="No quizzes available yet"
            message="The tutor hasn't created any quizzes for this course yet."
            action={<Link to={`/courses/${courseId}`} className="btn btn-primary">Back to Course</Link>} />
        ) : (
          quizData.map(({ module, quizzes }) => quizzes.length === 0 ? null : (
            <div key={module._id} style={{ marginBottom: '2rem' }}>

              {/* Module Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.9rem', flexShrink: 0 }}>
                  {module.order}
                </div>
                <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{module.title}</h2>
                <span className="badge badge-warning" style={{ fontSize: '.7rem' }}>{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {quizzes.map(({ quiz, results }) => {
                  const bestResult = results.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
                  const attempts   = results.length;
                  const hasPassed  = results.some(r => r.isPassed);
                  const canAttempt = quiz.maxAttempts === 0 || attempts < quiz.maxAttempts;
                  const bestScore  = bestResult?.score ?? bestResult?.scorePercentage ?? null;
                  const scoreColor = bestScore === null ? 'var(--text-muted)' : bestScore >= 80 ? 'var(--secondary)' : bestScore >= 60 ? 'var(--accent)' : 'var(--danger)';

                  return (
                    <div key={quiz._id} className="card" style={{ padding: '1.5rem', borderLeft: `4px solid ${hasPassed ? 'var(--secondary)' : attempts > 0 ? 'var(--accent)' : '#d97706'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.4rem', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{quiz.title}</h3>
                            {hasPassed  && <span className="badge badge-success" style={{ fontSize: '.68rem' }}>✓ Passed</span>}
                            {attempts > 0 && !hasPassed && <span className="badge badge-warning" style={{ fontSize: '.68rem' }}>Attempted</span>}
                            {attempts === 0 && <span className="badge badge-gray" style={{ fontSize: '.68rem' }}>Not started</span>}
                            {quiz.isAIGenerated && <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#FEF3C7', color: '#92400E' }}>✦ AI</span>}
                          </div>

                          {quiz.description && (
                            <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '.6rem' }}>{quiz.description}</p>
                          )}

                          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '.78rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: '.6rem' }}>
                            <span>❓ {quiz.questions?.length || 0} questions</span>
                            <span>🎯 Pass: {quiz.passingScore}%</span>
                            <span>🔁 {attempts}/{quiz.maxAttempts || '∞'} attempts used</span>
                            {quiz.timeLimit > 0 && <span>⏱ {quiz.timeLimit} min</span>}
                          </div>

                          {quiz.topicsTested?.length > 0 && (
                            <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
                              {quiz.topicsTested.map(t => (
                                <span key={t} className="badge badge-warning" style={{ fontSize: '.65rem', textTransform: 'capitalize' }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Score + CTA */}
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          {bestScore !== null ? (
                            <div style={{ marginBottom: '.75rem' }}>
                              <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{bestScore}%</div>
                              <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>Best score</div>
                            </div>
                          ) : (
                            <div style={{ marginBottom: '.75rem' }}>
                              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>—</div>
                              <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>No attempts</div>
                            </div>
                          )}

                          {canAttempt ? (
                            <Link to={`/quiz/${quiz._id}`} className="btn btn-primary btn-sm"
                              style={{ background: '#d97706', borderColor: '#d97706', whiteSpace: 'nowrap' }}>
                              {attempts === 0 ? 'Start Quiz →' : 'Retry Quiz →'}
                            </Link>
                          ) : (
                            <span style={{ fontSize: '.78rem', color: 'var(--danger)', fontWeight: 600 }}>Max attempts reached</span>
                          )}
                        </div>
                      </div>

                      {/* Past Attempts */}
                      {results.length > 0 && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.4rem' }}>Past Attempts:</div>
                          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                            {results.map((r, i) => (
                              <span key={r._id} style={{
                                background: r.isPassed ? '#D1FAE5' : '#FEE2E2',
                                color: r.isPassed ? '#065F46' : '#991B1B',
                                borderRadius: 99, padding: '.2rem .65rem',
                                fontSize: '.75rem', fontWeight: 700,
                              }}>
                                #{r.attemptNumber || i + 1}: {r.score ?? r.scorePercentage}% {r.isPassed ? '✓' : '✗'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}