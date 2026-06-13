// src/pages/QuizPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import ViolationWarningModal from '../components/quiz/ViolationWarningModal';
import useQuizProctor from '../hooks/useQuizProctor';
import { getQuiz, submitQuiz, logQuizViolation } from '../utils/api';

// ─────────────────────────────────────────────────────────────
// Field-name normalizers (AI quizzes vs manual quizzes)
// ─────────────────────────────────────────────────────────────
const getText  = (q) => q.questionText || q.question || '';
const getType  = (q) => {
  const t = q.type || q.questionType || '';
  if (t === 'mcq')        return 'multiple-choice';
  if (t === 'true_false') return 'true-false';
  return t;
};
const getOptionText = (opt) => opt.text || opt.label || String(opt);

// ─────────────────────────────────────────────────────────────
// Fisher-Yates shuffle — returns a NEW array
// ─────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizPage() {
  const { quizId } = useParams();
  const navigate   = useNavigate();

  const [quiz,          setQuiz]          = useState(null);
  const [questions,     setQuestions]     = useState([]); // shuffled order
  const [answers,       setAnswers]       = useState({});
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [timeLeft,      setTimeLeft]      = useState(null);
  const [currentQ,      setCurrentQ]      = useState(0);
  const [adaptiveBlock, setAdaptiveBlock] = useState(null);
  const [countdown,     setCountdown]     = useState(null);

  // Proctoring state
  const [activeViolation, setActiveViolation] = useState(null); // currently displayed violation
  const [quizStarted,     setQuizStarted]     = useState(false); // becomes true after student clicks "Start"

  const startedAt  = useRef(new Date());
  const timerRef   = useRef(null);
  const cdRef      = useRef(null);
  const submitOnce = useRef(false); // guard against double-submit from proctor + manual

  // ── Proctored submit (called by proctor on 3rd violation) ───────────────────
  const handleForceSubmit = useCallback(async (violationLog) => {
    if (submitOnce.current) return;
    submitOnce.current = true;
    toast.error('🚫 Quiz auto-submitted due to repeated violations!', { autoClose: 5000 });
    await handleSubmit(true, { isFlagged: true, violations: violationLog, terminatedByProctor: true });
  }, []); 

  // ── Violation warning (1st / 2nd violation) ─────────────────────────────────
  const handleViolation = useCallback((violation) => {
    setActiveViolation(violation);
    // Fire-and-forget to backend
    logQuizViolation(quizId, {
      type:      violation.type,
      message:   violation.message,
      timestamp: violation.log[violation.log.length - 1]?.timestamp,
    }).catch(() => {});
  }, [quizId]);

  // ── Proctor hook (only active when quiz is started) ─────────────────────────
  const { violationCount, isFullscreen, requestFullscreen, getViolationLog, MAX_WARNINGS } =
    useQuizProctor({
      active:         quizStarted && !submitting,
      onViolation:    handleViolation,
      onForceSubmit:  handleForceSubmit,
    });

  // ── Load quiz ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await getQuiz(quizId);
        const quizData = data.data;
        setQuiz(quizData);
        // Shuffle questions (always on — user requested this feature)
        const shuffled = shuffle(quizData.questions || []);
        setQuestions(shuffled);
        if (quizData.timeLimit > 0) setTimeLeft(quizData.timeLimit * 60);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load quiz');
        navigate(-1);
      }
      setLoading(false);
    };
    load();
  }, [quizId]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || !quizStarted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft !== null, quizStarted]); 

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (autoSubmit = false, proctorFlags = {}) => {
    if (submitOnce.current && !proctorFlags.terminatedByProctor) return;
    if (!autoSubmit && !proctorFlags.terminatedByProctor) {
      const unanswered = questions.filter(q => answers[q._id] === undefined).length;
      if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    }
    submitOnce.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    try {
      const timeTaken = Math.round((new Date() - startedAt.current) / 1000);
      const answerArray = questions.map(q => {
        const type = getType(q);
        const ans  = answers[q._id];
        return {
          questionId:     q._id,
          selectedOption: type === 'multiple-choice' ? (ans ?? null) : null,
          selectedAnswer: type !== 'multiple-choice' ? (ans ?? null) : null,
          timeTaken:      0,
        };
      });

      const violationLog = getViolationLog();
      const { data } = await submitQuiz(quizId, {
        answers: answerArray,
        timeTaken,
        startedAt: startedAt.current,
        // Anti-cheat fields
        isFlagged:           proctorFlags.isFlagged           || violationCount > 0,
        violationCount:      proctorFlags.violationCount      || violationCount,
        violations:          proctorFlags.violations          || violationLog,
        terminatedByProctor: proctorFlags.terminatedByProctor || false,
      });

      navigate(`/quiz/${quizId}/result`, {
        state: { result: data.data, softBlock: data.data?.softBlock || null },
      });
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.adaptiveBlock) {
        setAdaptiveBlock(errData);
        if (errData.waitMinutes) setCountdown(errData.waitMinutes * 60);
      } else {
        toast.error(errData?.message || 'Submission failed');
      }
      submitOnce.current = false;
      setSubmitting(false);
    }
  };

  // ── Cooldown countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!countdown) return;
    cdRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(cdRef.current);
          setAdaptiveBlock(prev =>
            prev?.blockType === 'cooldown' || prev?.blockType === 'struggle_cooldown' ? null : prev);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(cdRef.current);
  }, [countdown]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return <><Navbar /><Spinner center /></>;

  // ── Adaptive block screen ───────────────────────────────────────────────────
  if (adaptiveBlock) {
    const isLessonReview = adaptiveBlock.blockType === 'lesson_review';
    const isCooldown     = adaptiveBlock.blockType === 'cooldown' || adaptiveBlock.blockType === 'struggle_cooldown';
    const mm = countdown ? String(Math.floor(countdown / 60)).padStart(2,'0') : '00';
    const ss = countdown ? String(countdown % 60).padStart(2,'0') : '00';

    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
        <Navbar />
        <div className="container" style={{ maxWidth:600, padding:'3rem 1.5rem' }}>
          <div className="card" style={{
            padding:'2.5rem', textAlign:'center',
            borderTop:`4px solid ${isLessonReview ? 'var(--danger)' : 'var(--accent)'}`,
          }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>
              {isLessonReview ? '📚' : '⏳'}
            </div>
            <h2 style={{ fontSize:'1.4rem', marginBottom:'.5rem' }}>
              {isLessonReview ? 'Review the Lesson First' : 'Take a Short Break'}
            </h2>

            <div style={{
              background: isLessonReview ? '#FEF2F2' : '#FFFBEB',
              border:`1px solid ${isLessonReview ? '#FCA5A5' : '#FCD34D'}`,
              borderRadius:10, padding:'1rem 1.25rem', margin:'1.25rem 0', textAlign:'left',
            }}>
              <div style={{ display:'flex', gap:'.6rem', alignItems:'flex-start' }}>
                <span style={{ fontSize:'1.1rem' }}>🤖</span>
                <div>
                  <div style={{ fontSize:'.72rem', fontWeight:700,
                    color: isLessonReview ? '#991B1B' : '#92400E', marginBottom:'.3rem' }}>
                    AI ADAPTIVE FEEDBACK
                  </div>
                  <p style={{ fontSize:'.875rem', color:'var(--text-secondary)',
                    lineHeight:1.65, margin:0 }}>
                    {adaptiveBlock.message}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'center', gap:'2rem',
              margin:'1.25rem 0', flexWrap:'wrap' }}>
              {[
                { label:'Attempts', val: adaptiveBlock.prevAttempts },
                { label:'Avg Score', val: `${adaptiveBlock.avgScore}%` },
                ...(isCooldown ? [{ label:'Retry in', val: `${mm}:${ss}` }] : []),
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--primary)' }}>{s.val}</div>
                  <div style={{ fontSize:'.72rem', color:'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {adaptiveBlock.weakTopics?.length > 0 && (
              <div style={{ textAlign:'left', marginBottom:'1.25rem',
                background:'var(--bg)', borderRadius:8, padding:'.75rem 1rem',
                border:'1px solid var(--border)' }}>
                <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--danger)',
                  marginBottom:'.4rem' }}>🔴 Topics to focus on:</div>
                {adaptiveBlock.weakTopics.map(t => (
                  <div key={t} style={{ fontSize:'.82rem', color:'var(--text-secondary)',
                    padding:'.2rem 0', textTransform:'capitalize' }}>
                    → {t}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
              {adaptiveBlock.lessonId && (
                <button className="btn btn-primary"
                  onClick={() => navigate(`/lessons/${adaptiveBlock.lessonId}`)}>
                  📖 Go to Lesson
                </button>
              )}
              <button className="btn btn-outline"
                onClick={() => navigate('/recommendations')}>
                🤖 View My AI Learning Path
              </button>
              {isCooldown && countdown === 0 && (
                <button className="btn btn-secondary"
                  onClick={() => { setAdaptiveBlock(null); setCountdown(null); }}>
                  ✓ Try Again Now
                </button>
              )}
              <button className="btn btn-ghost"
                onClick={() => navigate(-1)}>
                ← Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-quiz Start Screen ───────────────────────────────────────────────────
  if (!quizStarted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div className="container" style={{ maxWidth: 620, padding: '3rem 1.5rem' }}>
          <div className="card" style={{
            padding: '2.5rem',
            textAlign: 'center',
            borderTop: '4px solid var(--primary)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '.4rem' }}>{quiz.title}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', marginBottom: '1.75rem' }}>
              {quiz.questions?.length} Questions · {quiz.timeLimit > 0 ? `${quiz.timeLimit} min` : 'No time limit'}
            </p>

            {/* Rules box */}
            <div style={{
              background: '#FEF2F2',
              border: '1.5px solid #FECACA',
              borderRadius: 12,
              padding: '1.25rem 1.5rem',
              textAlign: 'left',
              marginBottom: '1.75rem',
            }}>
              <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#DC2626', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                🔒 Exam Integrity Rules
              </div>
              {[
                '🚫 Do NOT switch tabs or leave this window',
                '📋 Copying or cutting text is blocked',
                '🖱️ Right-click is disabled',
                '⌨️ Keyboard shortcuts (Ctrl+C, etc.) are blocked',
                '🖥️ The quiz runs in fullscreen mode',
                '⚠️ 2 warnings allowed — 3rd violation auto-submits your quiz',
                '🔀 Questions are randomized each attempt',
              ].map((rule, i) => (
                <div key={i} style={{
                  fontSize: '.84rem',
                  color: '#7F1D1D',
                  padding: '.3rem 0',
                  borderBottom: i < 6 ? '1px solid #FEE2E2' : 'none',
                }}>
                  {rule}
                </div>
              ))}
            </div>

            <button
              id="btn-start-quiz"
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1.05rem', fontWeight: 700 }}
              onClick={() => {
                setQuizStarted(true);
                startedAt.current = new Date();
              }}
            >
              🚀 Start Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz in progress ────────────────────────────────────────────────────────
  const question     = questions[currentQ];
  const questionText = getText(question);
  const questionType = getType(question);
  const progress     = Math.round(((currentQ + 1) / questions.length) * 100);
  const mm           = String(Math.floor((timeLeft || 0) / 60)).padStart(2, '0');
  const ss           = String((timeLeft || 0) % 60).padStart(2, '0');
  const timeWarning  = timeLeft !== null && timeLeft < 120;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', userSelect: 'none' }}>
      {/* Violation Warning Modal */}
      <ViolationWarningModal
        violation={activeViolation}
        onDismiss={() => setActiveViolation(null)}
        maxWarnings={MAX_WARNINGS}
      />

      <Navbar />

      <div className="container" style={{ maxWidth: 800, padding: '2rem 1.5rem' }}>

        {/* ── Proctor Status Bar ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          padding: '.6rem 1rem',
          borderRadius: 'var(--radius-sm)',
          background: violationCount > 0 ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${violationCount > 0 ? '#FECACA' : '#BBF7D0'}`,
          flexWrap: 'wrap',
          gap: '.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: violationCount > 0 ? '#DC2626' : '#16A34A',
              display: 'inline-block',
              boxShadow: `0 0 0 3px ${violationCount > 0 ? '#FEE2E2' : '#DCFCE7'}`,
            }} />
            <span style={{
              fontSize: '.78rem', fontWeight: 700,
              color: violationCount > 0 ? '#DC2626' : '#15803D',
            }}>
              🛡️ EXAM PROCTORING ACTIVE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            {/* Strike indicators */}
            <div style={{ display: 'flex', gap: '.3rem' }}>
              {Array.from({ length: MAX_WARNINGS + 1 }).map((_, i) => (
                <div key={i} style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: i < violationCount ? '#DC2626' : '#E5E7EB',
                  border: `2px solid ${i < violationCount ? '#DC2626' : '#D1D5DB'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.5rem', color: i < violationCount ? '#fff' : '#9CA3AF',
                  fontWeight: 800,
                }}>
                  {i < violationCount ? '⚡' : i + 1}
                </div>
              ))}
            </div>
            {/* Fullscreen toggle */}
            {!isFullscreen && (
              <button
                onClick={requestFullscreen}
                style={{
                  fontSize: '.72rem', padding: '.25rem .6rem',
                  borderRadius: 6, border: '1px solid #D1D5DB',
                  background: '#fff', cursor: 'pointer', fontWeight: 600,
                  color: '#4B5563',
                }}
              >
                ⛶ Fullscreen
              </button>
            )}
          </div>
        </div>

        {/* ── Quiz Header ─────────────────────────────────────────────────── */}
        <div className="card" style={{
          padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
        }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', marginBottom: '.2rem' }}>{quiz.title}</h1>
            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
              Question {currentQ + 1} of {questions.length}
            </p>
          </div>
          {timeLeft !== null && (
            <div style={{
              background: timeWarning ? '#FEE2E2' : 'var(--bg)',
              borderRadius: 'var(--radius-sm)', padding: '.5rem 1rem',
              fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 800,
              color: timeWarning ? 'var(--danger)' : 'var(--text-primary)',
              minWidth: 80, textAlign: 'center',
            }}>
              {mm}:{ss}
            </div>
          )}
        </div>

        {/* ── Progress ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--border)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
              borderRadius: 99, transition: 'width .3s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
            <span>{Object.keys(answers).length} answered</span>
            <span>{questions.length - Object.keys(answers).length} remaining</span>
          </div>
        </div>

        {/* ── Question Card ───────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span className="badge badge-primary">Q{currentQ + 1}</span>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {question.topic && (
                <span className="badge badge-gray" style={{ fontSize: '.7rem', textTransform: 'capitalize' }}>
                  {question.topic}
                </span>
              )}
              <span className={`badge ${question.difficulty === 'easy' ? 'badge-success' : question.difficulty === 'hard' ? 'badge-danger' : 'badge-warning'}`}
                style={{ fontSize: '.7rem', textTransform: 'capitalize' }}>
                {question.difficulty}
              </span>
              <span className="badge badge-gray" style={{ fontSize: '.7rem' }}>+{question.points} pts</span>
            </div>
          </div>

          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {questionText}
          </p>

          {/* ── Multiple Choice ── */}
          {questionType === 'multiple-choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {(question.options || []).map((opt, idx) => {
                const optText    = getOptionText(opt);
                const isSelected = answers[question._id] === optText;
                return (
                  <button key={idx}
                    onClick={() => handleAnswer(question._id, optText)}
                    style={{
                      padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--primary-light)' : '#fff',
                      cursor: 'pointer', textAlign: 'left', fontSize: '.925rem',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      transition: 'all .15s', display: 'flex', alignItems: 'center', gap: '.75rem',
                    }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '.75rem', fontWeight: 700,
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                    }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {optText}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── True / False ── */}
          {questionType === 'true-false' && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              {['true', 'false'].map(v => (
                <button key={v} onClick={() => handleAnswer(question._id, v)}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${answers[question._id] === v ? 'var(--primary)' : 'var(--border)'}`,
                    background: answers[question._id] === v ? 'var(--primary-light)' : '#fff',
                    cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem',
                    color: answers[question._id] === v ? 'var(--primary)' : 'var(--text-secondary)',
                  }}>
                  {v === 'true' ? '✓ True' : '✗ False'}
                </button>
              ))}
            </div>
          )}

          {/* ── Short Answer ── */}
          {(questionType === 'short-answer' || questionType === 'short_answer') && (
            <input className="form-control"
              placeholder="Type your answer..."
              value={answers[question._id] || ''}
              onChange={e => handleAnswer(question._id, e.target.value)}
              style={{ fontSize: '1rem' }} />
          )}
        </div>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} className="btn btn-ghost" disabled={currentQ === 0}>
            ← Previous
          </button>

          {/* Q dots */}
          <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', justifyContent: 'center', flex: 1, padding: '0 1rem' }}>
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                style={{
                  width: 24, height: 24, borderRadius: '50%', border: 'none',
                  cursor: 'pointer', fontSize: '.7rem', fontWeight: 700,
                  background: i === currentQ ? 'var(--primary)'
                    : answers[questions[i]._id] !== undefined ? 'var(--secondary)'
                    : 'var(--border)',
                  color: i === currentQ || answers[questions[i]._id] !== undefined ? '#fff' : 'var(--text-muted)',
                }}>
                {i + 1}
              </button>
            ))}
          </div>

          {currentQ < questions.length - 1 ? (
            <button onClick={() => setCurrentQ(q => q + 1)} className="btn btn-primary">Next →</button>
          ) : (
            <button onClick={() => handleSubmit(false)} className="btn btn-secondary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Quiz ✓'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}