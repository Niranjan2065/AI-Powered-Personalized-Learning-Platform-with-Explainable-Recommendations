// src/components/recommendations/RecommendationCard.js
import React from 'react';
import { Link } from 'react-router-dom';

const TYPE_ICONS = { lesson: '📖', quiz: '📝', course: '🎓', module: '📦' };
const TYPE_COLORS = { lesson: '#6C63FF', quiz: '#F59E0B', course: '#10B981', module: '#3B82F6' };

export default function RecommendationCard({ item, onDismiss }) {
  const icon = TYPE_ICONS[item.type] || '📌';
  const color = TYPE_COLORS[item.type] || 'var(--primary)';
  const itemData = item.itemId;

  return (
    <div className="card fade-in" style={{ padding: '1.25rem', borderLeft: `4px solid ${color}`, position: 'relative' }}>
      {/* Dismiss button */}
      {onDismiss && (
        <button onClick={onDismiss} style={{
          position: 'absolute', top: 10, right: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '.9rem', padding: '.2rem',
        }} title="Dismiss">✕</button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', marginBottom: '.75rem' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 'var(--radius-sm)',
          background: `${color}15`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.2rem' }}>
            <span className="badge" style={{ background: `${color}15`, color, padding: '.15rem .5rem' }}>
              {item.type}
            </span>
            {item.addressesTopic && (
              <span className="badge badge-gray" style={{ fontSize: '.68rem' }}>
                Topic: {item.addressesTopic}
              </span>
            )}
          </div>
          <h4 style={{ fontSize: '.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {itemData?.title || 'Recommended Content'}
          </h4>
          {itemData?.estimatedDuration && (
            <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
              ⏱ {itemData.estimatedDuration} min
            </span>
          )}
        </div>

        {/* Confidence */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{item.confidence}%</div>
          <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>match</div>
        </div>
      </div>

      {/* XAI Explanation Box */}
      <div className="xai-explanation" style={{ marginBottom: '1rem' }}>
        <span className="xai-icon">🤖</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--primary)', marginBottom: '.2rem' }}>
            Why this is recommended:
          </div>
          <div style={{ lineHeight: 1.5 }}>{item.explanation}</div>
        </div>
      </div>

      {/* Reason Factors */}
      {item.reasonFactors?.length > 0 && (
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {item.reasonFactors.map((f, i) => (
            <div key={i} style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '.3rem .6rem',
              fontSize: '.73rem', color: 'var(--text-secondary)',
            }}>
              📊 {f.description}
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      {item.type === 'lesson' && itemData && (
        <Link
          to={`/learn/${itemData.course}/lesson/${itemData._id}`}
          className="btn btn-primary btn-sm"
        >
          Start Lesson →
        </Link>
      )}
      {item.type === 'quiz' && itemData && (
        <Link to={`/quiz/${itemData._id}`} className="btn btn-sm" style={{ background: color, color: '#fff' }}>
          Take Quiz →
        </Link>
      )}
    </div>
  );
}
