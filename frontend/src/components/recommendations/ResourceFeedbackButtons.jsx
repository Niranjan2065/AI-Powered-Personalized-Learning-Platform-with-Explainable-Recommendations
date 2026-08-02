// components/recommendations/ResourceFeedbackButtons.jsx
// Compact thumbs up/down for a single curated external resource (shown on
// the quiz result page's Weak Topics breakdown). Deliberately smaller and
// simpler than FeedbackButtons.jsx (just 2 signals, no comment box) since
// these sit inline next to a link rather than as a standalone card action.
import React, { useState } from 'react';
import { IoThumbsUpOutline, IoThumbsUpSharp, IoThumbsDownOutline, IoThumbsDownSharp } from 'react-icons/io5';
import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export default function ResourceFeedbackButtons({ resourceId, topic, initialSignal = null }) {
  const [selected, setSelected]     = useState(initialSignal);
  const [submitting, setSubmitting] = useState(false);

  const vote = async (signal) => {
    if (selected === signal || submitting) return;
    setSubmitting(true);
    const previous = selected;
    setSelected(signal); // optimistic — feels instant
    try {
      await api.post(`/resource-feedback/${resourceId}`, { signal, topic });
    } catch {
      setSelected(previous); // roll back on failure
      toast.error('Could not save feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const upActive   = selected === 'thumbs_up';
  const downActive = selected === 'thumbs_down';

  const btnStyle = (active, activeColor) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent',
    color: active ? activeColor : 'var(--text-muted)',
    cursor: submitting ? 'not-allowed' : 'pointer',
    opacity: submitting ? .5 : 1,
    padding: 0,
  });

  return (
    <span style={{ display: 'inline-flex', gap: '.15rem', marginLeft: '.5rem' }}>
      <button
        type="button"
        title="Helpful"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); vote('thumbs_up'); }}
        style={btnStyle(upActive, '#059669')}
      >
        {upActive ? <IoThumbsUpSharp size={13} /> : <IoThumbsUpOutline size={13} />}
      </button>
      <button
        type="button"
        title="Not helpful"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); vote('thumbs_down'); }}
        style={btnStyle(downActive, '#DC2626')}
      >
        {downActive ? <IoThumbsDownSharp size={13} /> : <IoThumbsDownOutline size={13} />}
      </button>
    </span>
  );
}