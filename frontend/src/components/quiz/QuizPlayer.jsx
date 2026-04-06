// src/components/quiz/QuizPlayer.jsx
// ─────────────────────────────────────────────────────────────
// Student-facing quiz player:
//   - Loads quiz (no correct answers from server)
//   - Countdown timer if timeLimit is set
//   - One question per screen with progress bar
//   - Shows results + weak/strong topics after submission
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const s = {
  wrap:    { maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', fontFamily: "'DM Sans', system-ui, sans-serif" },
  card:    { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '1.5rem' },
  prog:    { height: 4, background: '#e5e7eb', borderRadius: 4, marginBottom: '1.5rem', overflow: 'hidden' },
  fill:    (pct) => ({ height: '100%', background: '#2563eb', borderRadius: 4, width: `${pct}%`, transition: 'width .3s' }),
  qNum:    { fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8 },
  qText:   { fontSize: 18, fontWeight: 700, lineHeight: 1.5, marginBottom: '1.5rem', color: '#111827' },
  opt:     (sel, correct, show) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
    borderRadius: 10, marginBottom: 8, fontSize: 14, cursor: show ? 'default' : 'pointer',
    border: `2px solid ${show ? (correct ? '#16a34a' : sel ? '#dc2626' : '#e5e7eb') : sel ? '#2563eb' : '#e5e7eb'}`,
    background: show ? (correct ? '#f0fdf4' : sel ? '#fef2f2' : '#fff') : sel ? '#eff6ff' : '#fff',
    color: '#111827', fontWeight: sel ? 600 : 400, transition: 'all .15s',
  }),
  navRow:  { display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: 10 },
  btn:     (v) => ({
    padding: '10px 24px', fontSize: 14, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none',
    background: v === 'primary' ? '#2563eb' : '#f3f4f6', color: v === 'primary' ? '#fff' : '#374151',
  }),
  timer:   (warn) => ({ fontSize: 13, fontWeight: 600, color: warn ? '#dc2626' : '#374151', marginBottom: '1rem' }),
  // Results
  scoreBox:  { textAlign: 'center', padding: '2rem 0', marginBottom: '1.5rem' },
  circle:    (pass) => ({
    width: 100, height: 100, borderRadius: '50%', margin: '0 auto 1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 800,
    background: pass ? '#f0fdf4' : '#fef2f2',
    color: pass ? '#16a34a' : '#dc2626',
    border: `4px solid ${pass ? '#86efac' : '#fca5a5'}`,
  }),
  topicPill: (type) => ({
    display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, margin: '3px',
    background: type === 'weak' ? '#fef2f2' : '#f0fdf4',
    color:      type === 'weak' ? '#dc2626' : '#16a34a',
  }),
};

export default function QuizPlayer({ quizId }) {
  const [quiz,    setQuiz]    = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});  // questionId → { selectedOption?, selectedAnswer?, timeTaken }
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [qStart,  setQStart]  = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(null);

  // Load quiz
  useEffect(() => {
    axios.get(`${API}/quizzes/${quizId}`, { withCredentials: true })
      .then(r => {
        setQuiz(r.data.data);
        if (r.data.data.timeLimit > 0) setTimeLeft(r.data.data.timeLimit * 60);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [quizId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { clearInterval(t); handleSubmit(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [timeLeft, result]);

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const question = quiz?.questions?.[current];

  const selectAnswer = useCallback((field, value) => {
    if (result) return;
    const qid = String(question._id);
    const timeTaken = Math.round((Date.now() - qStart) / 1000);
    setAnswers(prev => ({ ...prev, [qid]: { questionId: qid, [field]: value, timeTaken } }));
  }, [question, qStart, result]);

  const goNext = () => {
    setQStart(Date.now());
    setCurrent(p => p + 1);
  };

  const handleSubmit = useCallback(async () => {
    const payload = Object.values(answers);
    try {
      const { data } = await axios.post(
        `${API}/quizzes/${quizId}/attempt`,
        { answers: payload, timeTaken: quiz.timeLimit > 0 ? quiz.timeLimit * 60 - timeLeft : 0 },
        { withCredentials: true }
      );
      setResult(data.data);
    } catch (e) {
      alert(e.response?.data?.message || 'Submission failed');
    }
  }, [answers, quizId, quiz, timeLeft]);

  if (loading) return <div style={s.wrap}><p style={{ color: '#9ca3af' }}>Loading quiz…</p></div>;
  if (!quiz)   return <div style={s.wrap}><p style={{ color: '#dc2626' }}>Quiz not found.</p></div>;

  // ── Results screen ───────────────────────────────────────────
  if (result) return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.scoreBox}>
          <div style={s.circle(result.isPassed)}>{result.score}%</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
            {result.isPassed ? 'Passed! 🎉' : 'Not passed'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            {result.pointsEarned} / {result.totalPoints} points · Attempt #{result.attemptNumber}
          </p>
        </div>

        {result.weakTopics?.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Areas to review:</p>
            {result.weakTopics.map(t => <span key={t} style={s.topicPill('weak')}>{t}</span>)}
          </div>
        )}
        {result.strongTopics?.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Strong topics:</p>
            {result.strongTopics.map(t => <span key={t} style={s.topicPill('strong')}>{t}</span>)}
          </div>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
          {result.answers?.map((a, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {i + 1}. {a.questionText}
                <span style={{ marginLeft: 8, fontSize: 11,
                  color: a.isCorrect ? '#16a34a' : '#dc2626',
                  background: a.isCorrect ? '#f0fdf4' : '#fef2f2',
                  padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                  {a.isCorrect ? '✓ Correct' : '✗ Wrong'}
                </span>
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                Your answer: {a.selectedOption || a.selectedAnswer || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Quiz player ──────────────────────────────────────────────
  const progress = ((current) / quiz.questions.length) * 100;
  const answered = answers[String(question?._id)];

  return (
    <div style={s.wrap}>
      <div style={s.prog}><div style={s.fill(progress)} /></div>

      {timeLeft !== null && (
        <div style={s.timer(timeLeft < 60)}>
          ⏱ {fmtTime(timeLeft)} remaining
        </div>
      )}

      {question && (
        <div style={s.card}>
          <div style={s.qNum}>Question {current + 1} of {quiz.questions.length}</div>
          <div style={s.qText}>{question.questionText}</div>

          {/* MCQ */}
          {question.type === 'mcq' && question.options?.map((opt, i) => (
            <div key={i}
              style={s.opt(answered?.selectedOption === opt.text, false, false)}
              onClick={() => selectAnswer('selectedOption', opt.text)}
            >
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #d1d5db',
                background: answered?.selectedOption === opt.text ? '#2563eb' : '#fff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {answered?.selectedOption === opt.text &&
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
              </span>
              {opt.text}
            </div>
          ))}

          {/* True / False */}
          {question.type === 'true_false' && ['true', 'false'].map(v => (
            <div key={v}
              style={s.opt(answered?.selectedAnswer === v, false, false)}
              onClick={() => selectAnswer('selectedAnswer', v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </div>
          ))}

          {/* Short answer */}
          {question.type === 'short_answer' && (
            <textarea
              placeholder="Type your answer…"
              rows={3}
              style={{ width: '100%', fontSize: 14, padding: '10px 12px', borderRadius: 8,
                border: '1px solid #d1d5db', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              value={answered?.selectedAnswer || ''}
              onChange={e => selectAnswer('selectedAnswer', e.target.value)}
            />
          )}

          <div style={s.navRow}>
            {current < quiz.questions.length - 1 ? (
              <button style={s.btn('primary')} onClick={goNext} disabled={!answered}>
                Next →
              </button>
            ) : (
              <button style={s.btn('primary')} onClick={handleSubmit} disabled={!answered}>
                Submit quiz ✓
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}