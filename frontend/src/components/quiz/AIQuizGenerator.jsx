// src/components/quiz/AIQuizGenerator.jsx
// ─────────────────────────────────────────────────────────────
// Full 4-step AI quiz generation UI:
//   Step 1 — Content source (lesson text / PDF)
//   Step 2 — Settings (type, difficulty, count)
//   Step 3 — Generating animation
//   Step 4 — Review & edit questions → Save → Publish
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { useAIQuizGenerator, STEPS } from '../../hooks/useAIQuizGenerator';
import QuestionCard from './QuestionCard';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const QUESTION_TYPES = [
  { id: 'mcq',          label: 'Multiple choice' },
  { id: 'true_false',   label: 'True / False' },
  { id: 'short_answer', label: 'Short answer' },
];

// ── Styles (using CSS variables for theme portability) ────────
const s = {
  wrap:        { maxWidth: 780, margin: '0 auto', padding: '1rem' },
  stepBar:     { display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '2rem' },
  stepItem:    (active, done) => ({
    flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: 500,
    borderBottom: active ? '2px solid var(--primary)' : done ? '2px solid var(--secondary)' : '2px solid transparent',
    color: active ? 'var(--primary)' : done ? 'var(--secondary)' : 'var(--text-muted)',
    cursor: 'default', userSelect: 'none',
  }),
  card:        { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', marginBottom: '1rem' },
  label:       { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 },
  textarea:    { width: '100%', minHeight: 130, fontSize: 14, lineHeight: 1.6, borderRadius: 'var(--radius-xs)',
                 border: '1px solid var(--border-dark)', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit',
                 boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-primary)' },
  chip:        (sel) => ({
    padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: sel ? 'none' : '1px solid var(--border)',
    background: sel ? 'var(--primary-light)' : 'var(--surface)', color: sel ? 'var(--primary-dark)' : 'var(--text-secondary)',
    transition: 'all .15s',
  }),
  row:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' },
  btn:         (variant = 'primary') => ({
    padding: '11px 20px', borderRadius: 'var(--radius-xs)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    border: 'none',
    background: variant === 'primary' ? 'var(--primary)' : variant === 'success' ? 'var(--secondary)' : 'var(--surface-2)',
    color: variant === 'ghost' ? 'var(--text-secondary)' : '#fff',
    transition: 'opacity .15s',
  }),
  btnRow:      { display: 'flex', gap: 10, marginTop: '1rem' },
  input:       { width: '100%', fontSize: 14, padding: '9px 12px', borderRadius: 'var(--radius-xs)',
                 border: '1px solid var(--border-dark)', fontFamily: 'inherit', boxSizing: 'border-box',
                 background: 'var(--surface)', color: 'var(--text-primary)' },
  select:      { width: '100%', fontSize: 14, padding: '9px 12px', borderRadius: 'var(--radius-xs)',
                 border: '1px solid var(--border-dark)', background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'inherit' },
  error:       { background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)',
                 borderRadius: 'var(--radius-xs)', padding: '10px 14px', fontSize: 13, marginBottom: '1rem' },
  genBox:      { textAlign: 'center', padding: '3rem 1rem' },
  pBar:        { height: 6, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden', margin: '1rem 0' },
  pFill:       (pct) => ({ height: '100%', background: 'var(--primary)', borderRadius: 6,
                            width: `${pct}%`, transition: 'width .4s ease' }),
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' },
  summCard:    { background: 'var(--surface-2)', borderRadius: 10, padding: '1rem', textAlign: 'center' },
  summNum:     { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' },
  summLbl:     { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
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

export default function AIQuizGenerator({ lesson, onClose, onSaveSuccess }) {
  const lessonId = lesson?._id;
  const lessonContentType = lesson?.contentType;

  // ── hook ──────────────────────────────────────────────────
  const {
    step, questions, error, progress,
    preview, savedQuiz,
    generateFromLesson, generateFromPdf,
    updateQuestion, removeQuestion, addQuestion,
    saveQuiz, publishQuiz, reset,
  } = useAIQuizGenerator();

  // ── local config state ────────────────────────────────────
  const [source,           setSource]           = useState(
    (lessonContentType === 'video' || lessonContentType === 'pdf') ? 'pdf' : 'lesson'
  );
  const [pdfFile,          setPdfFile]          = useState(null);
  const [numQ,             setNumQ]             = useState(5);
  const [difficulty,       setDifficulty]       = useState('medium');
  const [types,            setTypes]            = useState(['mcq', 'true_false']);
  const [focusArea,        setFocusArea]        = useState('');
  const [genLabel,         setGenLabel]         = useState(GEN_STEPS_LABELS[0]);
  const [quizTitle,        setQuizTitle]        = useState('');
  const [timeLimit,        setTimeLimit]        = useState(0);
  const [passingScore,     setPassingScore]     = useState(70);
  const [maxAttempts,      setMaxAttempts]      = useState(3);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions,   setShuffleOptions]   = useState(true);
  const [uiStep,           setUiStep]           = useState(1); // 1=content, 2=settings, 3=generating, 4=review, 5=done
  const fileRef = useRef();

  // Sync hook step → uiStep
  const currentUiStep = step === STEPS.IDLE       ? uiStep
                      : step === STEPS.GENERATING ? 3
                      : step === STEPS.REVIEWING  ? 4
                      : step === STEPS.SAVING     ? 4
                      : 5;

  // Auto-refresh course details on successfully saving quiz
  useEffect(() => {
    if (step === STEPS.DONE && savedQuiz) {
      if (onSaveSuccess) onSaveSuccess();
    }
  }, [step, savedQuiz, onSaveSuccess]);

  // ── toggle question type ──────────────────────────────────
  const toggleType = t => setTypes(prev =>
    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
  );

  // ── run generation ────────────────────────────────────────
  const handleGenerate = () => {
    if (types.length === 0) return;
    if (source === 'pdf' && !pdfFile) {
      alert('Please upload a PDF file first.');
      return;
    }
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
    saveQuiz({ title: quizTitle, timeLimit, passingScore, shuffleQuestions, shuffleOptions, maxAttempts });
  };

  // ── manual add question ───────────────────────────────────
  const handleAddQuestion = () => {
    addQuestion({
      type: 'mcq',
      questionText: 'New Question Text',
      difficulty: 'medium',
      topic: '',
      bloomLevel: 'understand',
      explanation: '',
      points: 1,
      options: [
        { text: 'Option A (Correct)', isCorrect: true },
        { text: 'Option B', isCorrect: false },
        { text: 'Option C', isCorrect: false },
        { text: 'Option D', isCorrect: false }
      ]
    });
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
                {!lessonId ? (
                  <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--danger)', background: 'var(--danger-light)', padding: '6px 12px', borderRadius: 6 }}>
                    ⚠ This module has no lessons yet. Add a text lesson to this module first, or upload a PDF.
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    The AI will read your lesson text to generate relevant questions.
                    Make sure the lesson has sufficient content (at least 100 words).
                  </p>
                )}
              </>
            )}

            {source === 'pdf' && (
              <>
                <span style={s.label}>Upload PDF (max 20 MB)</span>
                {!lessonId && (
                  <div style={{ marginBottom: 10, fontSize: '0.8rem', color: 'var(--danger)', background: 'var(--danger-light)', padding: '6px 12px', borderRadius: 6 }}>
                    ⚠ Please add a lesson to this module first. Quizzes must be linked to a lesson to save.
                  </div>
                )}
                <div
                  style={{ border: '2px dashed var(--border-dark)', borderRadius: 10, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)' }}
                  onClick={() => fileRef.current.click()}
                >
                  {pdfFile
                    ? <p style={{ color: 'var(--primary)', fontWeight: 600 }}>{pdfFile.name}</p>
                    : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Click or drag a PDF here</p>
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
            <button
              style={{ ...s.btn(), opacity: !lessonId ? 0.5 : 1 }}
              disabled={!lessonId}
              onClick={() => setUiStep(2)}
            >
              Next: Configure settings →
            </button>
            {onClose && (
              <button style={s.btn('ghost')} onClick={onClose}>
                Cancel
              </button>
            )}
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
                  onChange={e => setNumQ(Math.max(1, Math.min(20, Number(e.target.value))))}
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
              <p style={{ color: 'var(--danger)', fontSize: 13 }}>Select at least one question type.</p>
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
          <div style={{ fontSize: 40, marginBottom: '1rem', color: 'var(--primary)' }}>✦</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{genLabel}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 0 }}>
            AI is reading your content and crafting questions…
          </p>
          <div style={s.pBar}>
            <div style={s.pFill(progress || 60)} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>This usually takes 5–15 seconds</p>
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

          {/* Add Question Button */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0 2rem' }}>
            <button style={s.btn('ghost')} onClick={handleAddQuestion}>
              ➕ Add Question Manually
            </button>
          </div>

          {/* Quiz settings before saving */}
          <div style={{ ...s.card, background: 'var(--surface-2)' }}>
            <span style={{ ...s.label, fontSize: 14, marginBottom: 12, display: 'block', color: 'var(--text-primary)' }}>Quiz settings</span>
            
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

            <div style={s.row}>
              <div>
                <span style={s.label}>Max Attempts (0 = unlimited)</span>
                <input type="number" min={0} value={maxAttempts}
                  onChange={e => setMaxAttempts(Number(e.target.value))} style={s.input} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                  Shuffle questions order
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={shuffleOptions} onChange={e => setShuffleOptions(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                  Shuffle options (MCQ)
                </label>
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
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Quiz saved!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <strong>{savedQuiz.questions?.length}</strong> questions · saved as draft
          </p>

          {savedQuiz.isPublished ? (
            <div style={{ background: 'var(--primary-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--primary-dark)', fontWeight: 600, margin: 0 }}>✓ Quiz is published — students can take it now</p>
            </div>
          ) : (
            <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--accent)', fontWeight: 600, margin: 0 }}>
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
            {onClose && (
              <button style={s.btn('primary')} onClick={onClose}>
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}