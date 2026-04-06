// src/pages/QuizPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { Spinner } from '../components/common/StatCard';
import { getQuiz, submitQuiz } from '../utils/api';

// ─────────────────────────────────────────────────────────────
// FIX: AI-generated quizzes use different field names
//   questionText  vs  question
//   type (mcq / true_false)  vs  questionType (multiple-choice / true-false)
// These helpers normalise both formats into one shape.
// ─────────────────────────────────────────────────────────────
const getText  = (q) => q.questionText || q.question || '';
const getType  = (q) => {
  const t = q.type || q.questionType || '';
  if (t === 'mcq')        return 'multiple-choice';
  if (t === 'true_false') return 'true-false';
  return t; // already 'multiple-choice' / 'true-false' / 'short-answer'
};

// For MCQ: AI stores selected answer as the option TEXT,
// manual quizzes store it as the option INDEX.
// We normalise to always store the option TEXT in answers state.
const getOptionText = (opt) => opt.text || opt.label || String(opt);

export default function QuizPage() {
  const { quizId } = useParams();
  const navigate   = useNavigate();
  const [quiz,       setQuiz]       = useState(null);
  const [answers,    setAnswers]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft,   setTimeLeft]   = useState(null);
  const [currentQ,   setCurrentQ]   = useState(0);
  const startedAt = useRef(new Date());
  const timerRef  = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await getQuiz(quizId);
        setQuiz(data.data);
        if (data.data.timeLimit > 0) setTimeLeft(data.data.timeLimit * 60);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load quiz');
        navigate(-1);
      }
      setLoading(false);
    };
    load();
  }, [quizId]);

  useEffect(() => {
    if (timeLeft === null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft !== null]);

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit) {
      const unanswered = quiz.questions.filter(q => answers[q._id] === undefined).length;
      if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      const timeTaken = Math.round((new Date() - startedAt.current) / 1000);

      // Build answer array — backend quizController.scoreAttempt() expects:
      //   { questionId, selectedOption (for mcq), selectedAnswer (for t/f & short) }
      const answerArray = quiz.questions.map(q => {
        const type = getType(q);
        const ans  = answers[q._id];
        return {
          questionId:     q._id,
          selectedOption: type === 'multiple-choice' ? (ans ?? null) : null,
          selectedAnswer: type !== 'multiple-choice' ? (ans ?? null) : null,
          timeTaken:      0,
        };
      });

      const { data } = await submitQuiz(quizId, {
        answers: answerArray,
        timeTaken,
        startedAt: startedAt.current,
      });
      navigate(`/quiz/${quizId}/result`, { state: { result: data.data } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
      setSubmitting(false);
    }
  };

  if (loading) return <><Navbar /><Spinner center /></>;

  const question    = quiz.questions[currentQ];
  const questionText = getText(question);
  const questionType = getType(question);
  const progress    = Math.round(((currentQ + 1) / quiz.questions.length) * 100);
  const mm          = String(Math.floor((timeLeft || 0) / 60)).padStart(2, '0');
  const ss          = String((timeLeft || 0) % 60).padStart(2, '0');
  const timeWarning = timeLeft !== null && timeLeft < 120;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ maxWidth: 800, padding: '2rem 1.5rem' }}>

        {/* Quiz Header */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', marginBottom: '.2rem' }}>{quiz.title}</h1>
            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Question {currentQ + 1} of {quiz.questions.length}</p>
          </div>
          {timeLeft !== null && (
            <div style={{ background: timeWarning ? '#FEE2E2' : 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '.5rem 1rem', fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 800, color: timeWarning ? 'var(--danger)' : 'var(--text-primary)', minWidth: 80, textAlign: 'center' }}>
              {mm}:{ss}
            </div>
          )}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--border)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 99, transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
            <span>{Object.keys(answers).length} answered</span>
            <span>{quiz.questions.length - Object.keys(answers).length} remaining</span>
          </div>
        </div>

        {/* Question Card */}
        <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span className="badge badge-primary">Q{currentQ + 1}</span>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {question.topic && (
                <span className="badge badge-gray" style={{ fontSize: '.7rem', textTransform: 'capitalize' }}>{question.topic}</span>
              )}
              <span className={`badge ${question.difficulty === 'easy' ? 'badge-success' : question.difficulty === 'hard' ? 'badge-danger' : 'badge-warning'}`}
                style={{ fontSize: '.7rem', textTransform: 'capitalize' }}>
                {question.difficulty}
              </span>
              <span className="badge badge-gray" style={{ fontSize: '.7rem' }}>+{question.points} pts</span>
            </div>
          </div>

          {/* ✅ FIX: use normalised questionText */}
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {questionText}
          </p>

          {/* ── Multiple Choice ── */}
          {questionType === 'multiple-choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {(question.options || []).map((opt, idx) => {
                const optText   = getOptionText(opt);
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

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} className="btn btn-ghost" disabled={currentQ === 0}>← Previous</button>

          {/* Q dots */}
          <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', justifyContent: 'center', flex: 1, padding: '0 1rem' }}>
            {quiz.questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                style={{
                  width: 24, height: 24, borderRadius: '50%', border: 'none',
                  cursor: 'pointer', fontSize: '.7rem', fontWeight: 700,
                  background: i === currentQ ? 'var(--primary)'
                    : answers[quiz.questions[i]._id] !== undefined ? 'var(--secondary)'
                    : 'var(--border)',
                  color: i === currentQ || answers[quiz.questions[i]._id] !== undefined ? '#fff' : 'var(--text-muted)',
                }}>
                {i + 1}
              </button>
            ))}
          </div>

          {currentQ < quiz.questions.length - 1 ? (
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