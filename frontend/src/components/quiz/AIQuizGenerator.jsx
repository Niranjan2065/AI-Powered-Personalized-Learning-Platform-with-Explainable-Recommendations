// src/components/quiz/AIQuizGenerator.jsx
// ─────────────────────────────────────────────────────────────
// Full 4-step AI quiz generation UI:
//   Step 1 — Content source (lesson text / PDF)
//   Step 2 — Settings (type, difficulty, count)
//   Step 3 — Generating animation
//   Step 4 — Review & edit questions → Save → Publish
// ─────────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { useAIQuizGenerator, STEPS } from '../../hooks/useAIQuizGenerator';
import QuestionCard from './QuestionCard';
import QuizSettingsForm from './QuizSettingsForm';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const QUESTION_TYPES = [
  { id: 'mcq',          label: 'Multiple choice' },
  { id: 'true_false',   label: 'True / False' },
  { id: 'short_answer', label: 'Short answer' },
];

// ── Styles (inline for portability) ──────────────────────────
const s = {
  wrap:        { fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 780, margin: '0 auto', padding: '2rem 1rem' },
  stepBar:     { display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem' },
  stepItem:    (active, done) => ({
    flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: 500,
    borderBottom: active ? '2px solid #2563eb' : done ? '2px solid #16a34a' : '2px solid transparent',
    color: active ? '#2563eb' : done ? '#16a34a' : '#9ca3af',
    cursor: 'default', userSelect: 'none',
  }),
  card:        { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' },
  label:       { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 },
  textarea:    { width: '100%', minHeight: 130, fontSize: 14, lineHeight: 1.6, borderRadius: 8,
                 border: '1px solid #d1d5db', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit',
                 boxSizing: 'border-box' },
  chip:        (sel) => ({
    padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: sel ? 'none' : '1px solid #d1d5db',
    background: sel ? '#dbeafe' : '#fff', color: sel ? '#1d4ed8' : '#374151',
    transition: 'all .15s',
  }),
  row:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' },
  btn:         (variant = 'primary') => ({
    padding: '11px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    border: 'none',
    background: variant === 'primary' ? '#2563eb' : variant === 'success' ? '#16a34a' : '#f3f4f6',
    color: variant === 'ghost' ? '#374151' : '#fff',
    transition: 'opacity .15s',
  }),
  btnRow:      { display: 'flex', gap: 10, marginTop: '1rem' },
  input:       { width: '100%', fontSize: 14, padding: '9px 12px', borderRadius: 8,
                 border: '1px solid #d1d5db', fontFamily: 'inherit', boxSizing: 'border-box' },
  select:      { width: '100%', fontSize: 14, padding: '9px 12px', borderRadius: 8,
                 border: '1px solid #d1d5db', background: '#fff', fontFamily: 'inherit' },
  error:       { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                 borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: '1rem' },
  genBox:      { textAlign: 'center', padding: '3rem 1rem' },
  pBar:        { height: 6, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden', margin: '1rem 0' },
  pFill:       (pct) => ({ height: '100%', background: '#2563eb', borderRadius: 6,
                           width: `${pct}%`, transition: 'width .4s ease' }),
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' },
  summCard:    { background: '#f9fafb', borderRadius: 10, padding: '1rem', textAlign: 'center' },
  summNum:     { fontSize: 24, fontWeight: 700, color: '#111827' },
  summLbl:     { fontSize: 11, color: '#6b7280', marginTop: 2 },
  doneBox:     { textAlign: 'center', padding: '2rem 0' },
  tag:         (color) => ({ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px',
                             borderRadius: 999, background: color + '22', color: color }),
};

const GEN_STEPS_LABELS = [
  'Analysing lesson content…',
  'Identifying key concepts…',
  'Generating question stems…',
  'Building answer options…',
  'Validating & ranking…',
];

export default function AIQuizGenerator({ lessonId }) {
  // ── hook ──────────────────────────────────────────────────
  const {
    step, questions, error, progress,
    preview, savedQuiz,
    generateFromLesson, generateFromPdf,
    updateQuestion, removeQuestion,
    saveQuiz, publishQuiz, reset,
  } = useAIQuizGenerator();

  // ── local config state ────────────────────────────────────
  const [source,       setSource]       = useState('lesson');
  const [pdfFile,      setPdfFile]      = useState(null);
  const [numQ,         setNumQ]         = useState(5);
  const [difficulty,   setDifficulty]   = useState('medium');
  const [types,        setTypes]        = useState(['mcq', 'true_false']);
  const [focusArea,    setFocusArea]    = useState('');
  const [genLabel,     setGenLabel]     = useState(GEN_STEPS_LABELS[0]);
  const [quizTitle,    setQuizTitle]    = useState('');
  const [timeLimit,    setTimeLimit]    = useState(0);
  const [passingScore, setPassingScore] = useState(70);
  const [uiStep,       setUiStep]       = useState(1); // 1=content, 2=settings, 3=generating, 4=review, 5=done
  const fileRef = useRef();

  // Sync hook step → uiStep
  const currentUiStep = step === STEPS.IDLE       ? uiStep
                      : step === STEPS.GENERATING ? 3
                      : step === STEPS.REVIEWING  ? 4
                      : step === STEPS.SAVING     ? 4
                      : 5;

  // ── toggle question type ──────────────────────────────────
  const toggleType = t => setTypes(prev =>
    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
  );

  // ── run generation ────────────────────────────────────────
  const handleGenerate = () => {
    if (types.length === 0) return;
    // Animate labels while generating
    let i = 0;
    const iv = setInterval(() => {
      i = (i + 1) % GEN_STEPS_LABELS.length;
      setGenLabel(GEN_STEPS_LABELS[i]);
    }, 900);
    setTimeout(() => clearInterval(iv), 8000);

    if (source === 'pdf' && pdfFile) {
      generateFromPdf({ file: pdfFile, lessonId, numQuestions: numQ, difficulty, types, focusArea });
    } else {
      generateFromLesson({ lessonId, numQuestions: numQ, difficulty, types, focusArea });
    }
  };

  // ── handle save ───────────────────────────────────────────
  const handleSave = () => {
    saveQuiz({ title: quizTitle, timeLimit, passingScore });
  };

  // ── step bar labels ───────────────────────────────────────
  const STEP_LABELS = ['Content', 'Settings', 'Generate', 'Review', 'Done'];

  // ─────────────────────────────────────────────────────────
  return (
    <div style={s.wrap}>

      {/* ── Step bar ── */}
      <div style={s.stepBar}>
        {STEP_LABELS.map((lbl, i) => (
          <div key={lbl} style={s.stepItem(currentUiStep === i + 1, currentUiStep > i + 1)}>
            {currentUiStep > i + 1 ? '✓ ' : ''}{lbl}
          </div>
        ))}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* ══════════════════════════════════════════════
          STEP 1 — Content source
      ══════════════════════════════════════════════ */}
      {currentUiStep === 1 && (
        <div>
          <div style={s.card}>
            <span style={s.label}>Content source</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
              {['lesson', 'pdf'].map(src => (
                <button key={src} style={s.chip(source === src)} onClick={() => setSource(src)}>
                  {src === 'lesson' ? 'Lesson text' : 'Upload PDF'}
                </button>
              ))}
            </div>

            {source === 'lesson' && (
              <>
                <span style={s.label}>Lesson content will be fetched automatically from the lesson.</span>
                <p style={{ fontSize: 13, color: '#6b7280' }}>
                  The AI will read your lesson text to generate relevant questions.
                  Make sure the lesson has sufficient content (at least 100 words).
                </p>
              </>
            )}

            {source === 'pdf' && (
              <>
                <span style={s.label}>Upload PDF (max 20 MB)</span>
                <div
                  style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: '2rem', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => fileRef.current.click()}
                >
                  {pdfFile
                    ? <p style={{ color: '#2563eb', fontWeight: 600 }}>{pdfFile.name}</p>
                    : <p style={{ color: '#9ca3af', fontSize: 14 }}>Click or drag a PDF here</p>
                  }
                  <input
                    ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                    onChange={e => setPdfFile(e.target.files[0])}
                  />
                </div>
              </>
            )}
          </div>
          <div style={s.btnRow}>
            <button style={s.btn()} onClick={() => setUiStep(2)}>
              Next: Configure settings →
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          STEP 2 — Settings
      ══════════════════════════════════════════════ */}
      {currentUiStep === 2 && (
        <div>
          <div style={s.card}>
            <div style={s.row}>
              <div>
                <span style={s.label}>Number of questions</span>
                <input
                  type="number" min={1} max={20} value={numQ}
                  onChange={e => setNumQ(Number(e.target.value))}
                  style={s.input}
                />
              </div>
              <div>
                <span style={s.label}>Difficulty</span>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={s.select}>
                  {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <span style={s.label}>Question types</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
              {QUESTION_TYPES.map(t => (
                <button key={t.id} style={s.chip(types.includes(t.id))} onClick={() => toggleType(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {types.length === 0 && (
              <p style={{ color: '#dc2626', fontSize: 13 }}>Select at least one question type.</p>
            )}

            <span style={s.label}>Focus area (optional)</span>
            <input
              type="text"
              placeholder="e.g. Focus on neural network architectures"
              value={focusArea}
              onChange={e => setFocusArea(e.target.value)}
              style={s.input}
            />
          </div>

          <div style={s.btnRow}>
            <button style={s.btn('ghost')} onClick={() => setUiStep(1)}>← Back</button>
            <button
              style={{ ...s.btn(), opacity: types.length === 0 ? 0.4 : 1 }}
              disabled={types.length === 0}
              onClick={handleGenerate}
            >
              ✦ Generate quiz with AI
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          STEP 3 — Generating
      ══════════════════════════════════════════════ */}
      {currentUiStep === 3 && (
        <div style={s.genBox}>
          <div style={{ fontSize: 40, marginBottom: '1rem' }}>✦</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{genLabel}</h3>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 0 }}>
            Claude is reading your content and crafting questions…
          </p>
          <div style={s.pBar}>
            <div style={s.pFill(progress || 60)} />
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>This usually takes 5–15 seconds</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          STEP 4 — Review & edit
      ══════════════════════════════════════════════ */}
      {currentUiStep === 4 && step !== STEPS.DONE && (
        <div>
          {/* Summary bar */}
          <div style={s.summaryGrid}>
            <div style={s.summCard}>
              <div style={s.summNum}>{questions.length}</div>
              <div style={s.summLbl}>Questions</div>
            </div>
            <div style={s.summCard}>
              <div style={s.summNum}>{questions.filter(q => q.type === 'mcq').length}</div>
              <div style={s.summLbl}>MCQ</div>
            </div>
            <div style={s.summCard}>
              <div style={s.summNum}>{questions.filter(q => q.type !== 'mcq').length}</div>
              <div style={s.summLbl}>Other</div>
            </div>
          </div>

          {/* Questions list */}
          {questions.map((q, i) => (
            <QuestionCard
              key={i} index={i} question={q}
              onChange={updated => updateQuestion(i, updated)}
              onRemove={() => removeQuestion(i)}
            />
          ))}

          {/* Quiz settings before saving */}
          <div style={{ ...s.card, background: '#f9fafb' }}>
            <span style={{ ...s.label, fontSize: 14, marginBottom: 12, display: 'block' }}>Quiz settings</span>
            <span style={s.label}>Title</span>
            <input
              type="text"
              placeholder={`Quiz: ${preview?.lessonTitle || 'New Quiz'}`}
              value={quizTitle}
              onChange={e => setQuizTitle(e.target.value)}
              style={{ ...s.input, marginBottom: 12 }}
            />
            <div style={s.row}>
              <div>
                <span style={s.label}>Time limit (minutes, 0 = no limit)</span>
                <input type="number" min={0} value={timeLimit}
                  onChange={e => setTimeLimit(Number(e.target.value))} style={s.input} />
              </div>
              <div>
                <span style={s.label}>Passing score (%)</span>
                <input type="number" min={0} max={100} value={passingScore}
                  onChange={e => setPassingScore(Number(e.target.value))} style={s.input} />
              </div>
            </div>
          </div>

          <div style={s.btnRow}>
            <button style={s.btn('ghost')} onClick={reset}>⟳ Start over</button>
            <button
              style={{ ...s.btn(), opacity: questions.length === 0 ? 0.4 : 1 }}
              disabled={questions.length === 0 || step === STEPS.SAVING}
              onClick={handleSave}
            >
              {step === STEPS.SAVING ? 'Saving…' : '✓ Save quiz to lesson'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          STEP 5 — Done
      ══════════════════════════════════════════════ */}
      {(currentUiStep === 5 || step === STEPS.DONE) && savedQuiz && (
        <div style={s.doneBox}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Quiz saved!</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            <strong>{savedQuiz.questions?.length}</strong> questions · saved as draft
          </p>

          {savedQuiz.isPublished ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: '#15803d', fontWeight: 600, margin: 0 }}>✓ Quiz is published — students can take it now</p>
            </div>
          ) : (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: '#92400e', fontWeight: 600, margin: 0 }}>
                Quiz is saved as draft. Publish when you're ready.
              </p>
            </div>
          )}

          <div style={{ ...s.btnRow, justifyContent: 'center' }}>
            <button style={s.btn('ghost')} onClick={reset}>Create another quiz</button>
            {!savedQuiz.isPublished && (
              <button style={s.btn('success')} onClick={publishQuiz}>
                Publish to students →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}