// components/recommendations/FeedbackButtons.jsx
// Thumbs up / down / already know / too hard buttons shown on each
// recommendation card. Persists signal to the backend and updates
// local state immediately for snappy UX.
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// Signal metadata — label, icon, tooltip, colors
const SIGNALS = [
  {
    key:     'thumbs_up',
    icon:    '👍',
    label:   'Helpful',
    tip:     'This recommendation was useful',
    active:  { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
    hover:   '#F0FDF4',
  },
  {
    key:     'thumbs_down',
    icon:    '👎',
    label:   'Not helpful',
    tip:     'This recommendation was not relevant',
    active:  { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' },
    hover:   '#FFF5F5',
  },
  {
    key:     'already_know',
    icon:    '✓',
    label:   'Already know',
    tip:     'I already understand this topic',
    active:  { bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' },
    hover:   '#EFF6FF',
  },
  {
    key:     'too_hard',
    icon:    '🧠',
    label:   'Too advanced',
    tip:     'This topic is beyond my current level',
    active:  { bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
    hover:   '#FFFBEB',
  },
];

export default function FeedbackButtons({ recId, itemId, topic, initialSignal = null }) {
  const [selected,    setSelected]    = useState(initialSignal);
  const [submitting,  setSubmitting]  = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment,     setComment]     = useState('');

  const submit = async (signal) => {
    // Toggle off if clicking same button again
    if (selected === signal) return;
    setSubmitting(true);
    try {
      await api.post(`/recommendations/${recId}/items/${itemId}/feedback`, {
        signal,
        comment,
      });
      setSelected(signal);
      // Show comment box only for negative signals
      if (signal === 'thumbs_down' || signal === 'too_hard') {
        setShowComment(true);
      } else {
        setShowComment(false);
      }
      const labels = { thumbs_up: 'Thanks for the feedback! 👍', thumbs_down: 'Got it — we\'ll adjust your path', already_know: 'Noted! We\'ll show you harder content', too_hard: 'We\'ll pace things better for you' };
      toast.success(labels[signal], { autoClose: 2000 });
    } catch (err) {
      toast.error('Could not save feedback');
    } finally { setSubmitting(false); }
  };

  const submitComment = async () => {
    if (!comment.trim() || !selected) return;
    try {
      await api.post(`/recommendations/${recId}/items/${itemId}/feedback`, {
        signal: selected, comment,
      });
      setShowComment(false);
      toast.success('Comment saved');
    } catch { /* silent */ }
  };

  return (
    <div style={{ marginTop: '.75rem' }}>
      {/* Label row */}
      <div style={{ fontSize: '.68rem', color: 'var(--text-muted)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.4rem' }}>
        Was this recommendation helpful?
      </div>

      {/* Signal buttons */}
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
        {SIGNALS.map(s => {
          const isActive = selected === s.key;
          return (
            <button
              key={s.key}
              title={s.tip}
              disabled={submitting}
              onClick={() => submit(s.key)}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '.3rem',
                padding:      '.3rem .65rem',
                borderRadius: 99,
                border:       `1px solid ${isActive ? s.active.border : 'var(--border)'}`,
                background:   isActive ? s.active.bg : 'var(--bg)',
                color:        isActive ? s.active.color : 'var(--text-muted)',
                cursor:       submitting ? 'not-allowed' : 'pointer',
                fontSize:     '.72rem',
                fontWeight:   isActive ? 700 : 400,
                transition:   'all .15s',
                opacity:      submitting ? .6 : 1,
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Optional comment box for negative signals */}
      {showComment && (
        <div style={{ marginTop: '.6rem', display: 'flex', gap: '.4rem' }}>
          <input
            className="form-control"
            style={{ flex: 1, fontSize: '.78rem', padding: '.35rem .6rem' }}
            placeholder="Tell us more (optional)…"
            value={comment}
            maxLength={300}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitComment()}
          />
          <button className="btn btn-primary btn-sm" style={{ fontSize: '.75rem' }}
            onClick={submitComment}>
            Send
          </button>
          <button className="btn btn-outline btn-sm" style={{ fontSize: '.75rem' }}
            onClick={() => setShowComment(false)}>
            Skip
          </button>
        </div>
      )}
    </div>
  );
}