// src/pages/RegisterPage.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const data = await register(form);
      toast.success(`Welcome to AILearn, ${data.user.name}!`);
      const dest = data.user.role === 'tutor' ? '/tutor' : '/student';
      navigate(dest);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea22, #764ba222)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>🚀</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '.25rem' }}>Create Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>Join the AI-powered learning platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your full name" required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" required />
          </div>

          {/* Role Selection */}
          <div className="form-group">
            <label className="form-label">I want to join as:</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              {[
                { val: 'student', icon: '🎓', title: 'Student', desc: 'Learn and get AI recommendations' },
                { val: 'tutor', icon: '👨‍🏫', title: 'Tutor', desc: 'Create and manage courses' },
              ].map(({ val, icon, title, desc }) => (
                <div key={val} onClick={() => setForm({...form, role: val})}
                  style={{
                    padding: '1rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    border: `2px solid ${form.role === val ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.role === val ? 'var(--primary-light)' : '#fff',
                    transition: 'all .2s',
                  }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '.3rem' }}>{icon}</div>
                  <div style={{ fontWeight: 600, fontSize: '.875rem', marginBottom: '.2rem' }}>{title}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '.875rem', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
