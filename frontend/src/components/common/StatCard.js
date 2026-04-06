// src/components/common/StatCard.js
import React from 'react';

export function StatCard({ icon, label, value, color = 'var(--primary)', trend }) {
  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 'var(--radius-sm)',
        background: `${color}18`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '.15rem' }}>{label}</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        {trend && <div style={{ fontSize: '.75rem', color: 'var(--secondary)', marginTop: '.2rem' }}>{trend}</div>}
      </div>
    </div>
  );
}

// Spinner
export function Spinner({ size = 'md', center = false }) {
  const dim = size === 'sm' ? 18 : size === 'lg' ? 48 : 28;
  const bw = size === 'sm' ? 2 : 3;
  const el = (
    <div style={{
      width: dim, height: dim,
      border: `${bw}px solid var(--border)`,
      borderTopColor: 'var(--primary)',
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  );
  if (center) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>{el}</div>;
  return el;
}

// Empty State
export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{icon}</div>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '.5rem', color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', marginBottom: '1.5rem' }}>{message}</p>
      {action}
    </div>
  );
}

// Section Header
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '.2rem' }}>{title}</h2>
        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Score Badge
export function ScoreBadge({ score }) {
  const color = score >= 80 ? 'var(--secondary)' : score >= 60 ? 'var(--accent)' : 'var(--danger)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 44, height: 28, borderRadius: 99,
      background: `${color}18`, color, fontWeight: 700, fontSize: '.8rem',
    }}>
      {score}%
    </span>
  );
}

// Progress Bar
export function ProgressBar({ value, color, showLabel = true }) {
  const bg = color || (value >= 80 ? 'var(--secondary)' : value >= 60 ? 'var(--accent)' : 'var(--primary)');
  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.3rem', fontSize: '.75rem', color: 'var(--text-muted)' }}>
          <span>Progress</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}%</span>
        </div>
      )}
      <div style={{ background: 'var(--border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: bg, borderRadius: 99, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}
