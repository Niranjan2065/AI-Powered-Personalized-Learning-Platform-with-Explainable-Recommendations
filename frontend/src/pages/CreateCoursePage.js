// src/pages/CreateCoursePage.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { createCourse } from '../utils/api';

const CATEGORIES = ['programming','mathematics','science','language','arts','business','data-science','web-development','machine-learning','other'];
const LEVELS = ['beginner','intermediate','advanced'];

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', shortDescription: '', category: 'programming', level: 'beginner', price: 0, isFree: true, tags: '', topicsCovered: '', learningOutcomes: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        topicsCovered: form.topicsCovered.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
        learningOutcomes: form.learningOutcomes.split('\n').filter(Boolean),
        price: form.isFree ? 0 : parseFloat(form.price) || 0,
      };
      const { data } = await createCourse(payload);
      toast.success('Course created successfully!');
      navigate(`/tutor/courses/${data.data._id}/manage`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create course'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ maxWidth: 740, padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>Create New Course</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>Fill in the details to publish your course</p>
          </div>
          <Link to="/tutor" className="btn btn-ghost">← Back</Link>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>Basic Information</h3>
            <div className="form-group">
              <label className="form-label">Course Title *</label>
              <input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Complete Python Bootcamp 2024" required />
            </div>
            <div className="form-group">
              <label className="form-label">Short Description</label>
              <input className="form-control" value={form.shortDescription} onChange={e => setForm({...form, shortDescription: e.target.value})} placeholder="One-line course summary (shown in cards)" maxLength={300} />
            </div>
            <div className="form-group">
              <label className="form-label">Full Description *</label>
              <textarea className="form-control" rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detailed description of what students will learn..." required />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-control" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('-',' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Level *</label>
                <select className="form-control" value={form.level} onChange={e => setForm({...form, level: e.target.value})}>
                  {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase()+l.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>AI Configuration</h3>
            <div className="form-group">
              <label className="form-label">Topics Covered (comma-separated) *</label>
              <input className="form-control" value={form.topicsCovered} onChange={e => setForm({...form, topicsCovered: e.target.value})} placeholder="e.g. variables, loops, functions, arrays, objects" />
              <small style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>⚠️ Important: These topics are used by the AI recommendation engine</small>
            </div>
            <div className="form-group">
              <label className="form-label">Tags (comma-separated)</label>
              <input className="form-control" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="e.g. python, beginner, programming" />
            </div>
            <div className="form-group">
              <label className="form-label">Learning Outcomes (one per line)</label>
              <textarea className="form-control" rows={3} value={form.learningOutcomes} onChange={e => setForm({...form, learningOutcomes: e.target.value})} placeholder={"Build web applications with Python\nUnderstand OOP concepts\nWork with databases"} />
            </div>
          </div>

          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>Pricing</h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              {[true, false].map(f => (
                <div key={String(f)} onClick={() => setForm({...form, isFree: f})}
                  style={{ flex: 1, padding: '.85rem', borderRadius: 'var(--radius-sm)', border: `2px solid ${form.isFree === f ? 'var(--primary)' : 'var(--border)'}`, background: form.isFree === f ? 'var(--primary-light)' : '#fff', cursor: 'pointer', textAlign: 'center', fontWeight: 600 }}>
                  {f ? '🆓 Free' : '💰 Paid'}
                </div>
              ))}
            </div>
            {!form.isFree && (
              <div className="form-group">
                <label className="form-label">Price (USD)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="29.99" />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Link to="/tutor" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Creating...' : '✓ Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
