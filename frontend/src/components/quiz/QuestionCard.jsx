// src/components/quiz/QuestionCard.jsx
// ─────────────────────────────────────────────────────────────
// Renders one generated question with inline edit capability.
// Supports MCQ, true_false, short_answer.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';

const DIFFICULTY_COLORS = {
  easy:   '#16a34a',
  medium: '#d97706',
  hard:   '#dc2626',
};

const TYPE_LABELS = {
  mcq:          'MCQ',
  true_false:   'True / False',
  short_answer: 'Short answer',
};

const s = {
  card:     { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', marginBottom: 12, transition: 'box-shadow .15s' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badges:   { display: 'flex', gap: 6 },
  badge:    (color) => ({ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: color + '1a', color }),
  actions:  { display: 'flex', gap: 6 },
  iconBtn:  (danger) => ({
    padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
    border: '1px solid #e5e7eb', background: '#fff',
    color: danger ? '#dc2626' : '#374151',
  }),
  qText:    { fontSize: 15, fontWeight: 600, lineHeight: 1.5, marginBottom: 12, color: '#111827' },
  opt:      (correct) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    borderRadius: 8, marginBottom: 6, fontSize: 13,
    background: correct ? '#f0fdf4' : '#f9fafb',
    border: `1px solid ${correct ? '#86efac' : '#e5e7eb'}`,
    color: correct ? '#15803d' : '#374151',
    fontWeight: correct ? 600 : 400,
  }),
  dot:      (correct) => ({
    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
    background: correct ? '#16a34a' : '#e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, color: '#fff',
  }),
  explain:  { fontSize: 12, color: '#6b7280', marginTop: 10, padding: '8px 12px',
              background: '#f0f9ff', borderRadius: 8, borderLeft: '3px solid #60a5fa' },
  editArea: { width: '100%', fontSize: 14, padding: '8px 12px', borderRadius: 8,
              border: '1px solid #d1d5db', fontFamily: 'inherit', resize: 'vertical',
              marginBottom: 8, boxSizing: 'border-box' },
  editInput:{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 7,
              border: '1px solid #d1d5db', fontFamily: 'inherit', marginBottom: 6, boxSizing: 'border-box' },
  saveBtn:  { padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 7,
              border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' },
  cancelBtn:{ padding: '7px 16px', fontSize: 13, borderRadius: 7,
              border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', marginRight: 8 },
};

export default function QuestionCard({ index, question, onChange, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(() => JSON.parse(JSON.stringify(question)));

  const saveEdit = () => { onChange(draft); setEditing(false); };
  const cancel   = () => { setDraft(JSON.parse(JSON.stringify(question))); setEditing(false); };

  const updateOption = (i, field, value) => {
    setDraft(prev => {
      const opts = prev.options.map((o, idx) => {
        if (field === 'isCorrect') {
          // Only one correct at a time for MCQ
          return { ...o, isCorrect: idx === i };
        }
        return idx === i ? { ...o, [field]: value } : o;
      });
      return { ...prev, options: opts };
    });
  };

  const diffColor = DIFFICULTY_COLORS[question.difficulty] || '#6b7280';

  // ── View mode ───────────────────────────────────────────────
  if (!editing) return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.badges}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Q{index + 1}</span>
          <span style={s.badge('#2563eb')}>{TYPE_LABELS[question.type] || question.type}</span>
          <span style={s.badge(diffColor)}>{question.difficulty}</span>
          {question.topic && <span style={s.badge('#7c3aed')}>{question.topic}</span>}
        </div>
        <div style={s.actions}>
          <button style={s.iconBtn(false)} onClick={() => setEditing(true)}>✎ Edit</button>
          <button style={s.iconBtn(true)}  onClick={onRemove}>✕ Remove</button>
        </div>
      </div>

      <div style={s.qText}>{question.questionText}</div>

      {/* MCQ options */}
      {question.type === 'mcq' && (
        <div>
          {question.options?.map((opt, i) => (
            <div key={i} style={s.opt(opt.isCorrect)}>
              <div style={s.dot(opt.isCorrect)}>{opt.isCorrect ? '✓' : ''}</div>
              {opt.text}
            </div>
          ))}
        </div>
      )}

      {/* True/False */}
      {question.type === 'true_false' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {['true', 'false'].map(v => (
            <div key={v} style={s.opt(question.correctAnswer === v)}>
              <div style={s.dot(question.correctAnswer === v)}>{question.correctAnswer === v ? '✓' : ''}</div>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </div>
          ))}
        </div>
      )}

      {/* Short answer */}
      {question.type === 'short_answer' && (
        <div style={s.opt(true)}>
          <div style={s.dot(true)}>✓</div>
          {question.correctAnswer}
        </div>
      )}

      {question.explanation && (
        <div style={s.explain}>
          <strong>Explanation:</strong> {question.explanation}
        </div>
      )}
    </div>
  );

  // ── Edit mode ────────────────────────────────────────────────
  return (
    <div style={{ ...s.card, borderColor: '#60a5fa', boxShadow: '0 0 0 3px #dbeafe' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#2563eb' }}>
        Editing Q{index + 1}
      </div>

      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Question</label>
      <textarea
        style={s.editArea} rows={3}
        value={draft.questionText}
        onChange={e => setDraft(prev => ({ ...prev, questionText: e.target.value }))}
      />

      {draft.type === 'mcq' && (
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>
            Options (click radio to mark correct)
          </label>
          {draft.options?.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input
                type="radio" name={`correct-${index}`}
                checked={opt.isCorrect}
                onChange={() => updateOption(i, 'isCorrect', true)}
                style={{ accentColor: '#16a34a', width: 16, height: 16 }}
              />
              <input
                type="text" style={{ ...s.editInput, marginBottom: 0, flex: 1 }}
                value={opt.text}
                onChange={e => updateOption(i, 'text', e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {draft.type === 'true_false' && (
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Correct answer</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['true', 'false'].map(v => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                <input type="radio" name={`tf-${index}`} checked={draft.correctAnswer === v}
                  onChange={() => setDraft(prev => ({ ...prev, correctAnswer: v }))} />
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </label>
            ))}
          </div>
        </div>
      )}

      {draft.type === 'short_answer' && (
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Expected answer</label>
          <input type="text" style={s.editInput}
            value={draft.correctAnswer}
            onChange={e => setDraft(prev => ({ ...prev, correctAnswer: e.target.value }))}
          />
        </div>
      )}

      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4, marginTop: 8 }}>Explanation</label>
      <textarea
        style={{ ...s.editArea, minHeight: 60 }} rows={2}
        value={draft.explanation}
        onChange={e => setDraft(prev => ({ ...prev, explanation: e.target.value }))}
      />

      <div>
        <button style={s.cancelBtn} onClick={cancel}>Cancel</button>
        <button style={s.saveBtn}   onClick={saveEdit}>Save changes</button>
      </div>
    </div>
  );
}