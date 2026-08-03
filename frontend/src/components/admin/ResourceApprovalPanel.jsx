// components/admin/ResourceApprovalPanel.jsx
// Item #2 of the coverage-expansion plan: admin review queue for
// tutor-submitted resources (see ResourceSubmissionForm.jsx). Approving
// makes a resource immediately visible to students on the quiz-result
// "Weak Topics" breakdown — topicResourceService.getTopicResources()
// queries TopicResource with status:'approved' directly, no cache to bust.
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

const TYPE_ICON = { video: '🎥', article: '📄', practice: '💻' };

export default function ResourceApprovalPanel() {
  const [status, setStatus]   = useState('pending');
  const [items, setItems]     = useState(null);
  const [busyId, setBusyId]   = useState(null);
  const [rejectNote, setRejectNote] = useState({}); // { [id]: text }

  const load = useCallback(async () => {
    setItems(null);
    try {
      const res = await api.get(`/tutor-resources/admin/all?status=${status}`);
      setItems(res.data?.data || []);
    } catch {
      toast.error('Could not load submissions');
      setItems([]);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const review = async (id, decision) => {
    const note = rejectNote[id] || '';
    if (decision === 'rejected' && !note.trim()) {
      toast.error('Please add a reason before rejecting');
      return;
    }
    setBusyId(id);
    try {
      await api.put(`/tutor-resources/admin/${id}/review`, {
        status: decision,
        reviewNote: note,
      });
      toast.success(decision === 'approved' ? 'Resource approved ✅' : 'Resource rejected');
      setItems(prev => prev.filter(i => i._id !== id)); // remove from current (pending) view
    } catch (err) {
      toast.error(err.response?.data?.message || 'Review failed');
    } finally { setBusyId(null); }
  };

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>📚 Resource Submissions</h3>
        <div style={{ display: 'flex', gap: '.4rem' }}>
          {['pending', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={status === s ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              style={{ fontSize: '.72rem', textTransform: 'capitalize' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {items === null && <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Loading…</div>}
      {items?.length === 0 && (
        <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
          No {status} submissions.
        </div>
      )}

      {items?.map(item => (
        <div key={item._id} style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: '.85rem', marginBottom: '.6rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '.85rem', fontWeight: 600 }}>
                {TYPE_ICON[item.type] || '🔗'} {item.title}
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                Topic: <strong>{item.topic}</strong> · {item.difficulty} · submitted by {item.submittedBy?.name || 'unknown'}
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '.75rem', color: 'var(--primary)', wordBreak: 'break-all' }}>
                {item.url}
              </a>
              {item.description && (
                <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: '.3rem' }}>
                  "{item.description}"
                </div>
              )}
              {item.status !== 'pending' && item.reviewNote && (
                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
                  Review note: {item.reviewNote}
                </div>
              )}
            </div>
          </div>

          {status === 'pending' && (
            <div style={{ marginTop: '.6rem', display: 'flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={busyId === item._id}
                onClick={() => review(item._id, 'approved')}
                style={{ fontSize: '.75rem' }}
              >
                ✓ Approve
              </button>
              <input
                className="form-control"
                style={{ fontSize: '.75rem', padding: '.3rem .5rem', flex: 1, minWidth: 160 }}
                placeholder="Reason if rejecting…"
                value={rejectNote[item._id] || ''}
                onChange={e => setRejectNote(prev => ({ ...prev, [item._id]: e.target.value }))}
              />
              <button
                className="btn btn-outline btn-sm"
                disabled={busyId === item._id}
                onClick={() => review(item._id, 'rejected')}
                style={{ fontSize: '.75rem', color: '#991B1B', borderColor: '#FCA5A5' }}
              >
                ✕ Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}