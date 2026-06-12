// src/components/quiz/ViolationWarningModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal shown whenever the proctoring system detects a violation.
// Automatically dismisses after AUTO_DISMISS_SEC seconds.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';

const AUTO_DISMISS_SEC = 6;

// Map violation types to human-friendly labels
const VIOLATION_META = {
  tab_switch:          { icon: '🚨', label: 'Tab Switch Detected',           color: '#DC2626' },
  window_blur:         { icon: '🚪', label: 'Quiz Window Left',              color: '#DC2626' },
  copy_attempt:        { icon: '📋', label: 'Copy Attempt Blocked',          color: '#D97706' },
  cut_attempt:         { icon: '✂️',  label: 'Cut Attempt Blocked',           color: '#D97706' },
  keyboard_copy:       { icon: '⌨️',  label: 'Keyboard Shortcut Blocked',    color: '#D97706' },
  screenshot_attempt:  { icon: '📸', label: 'Screenshot Attempt Blocked',    color: '#D97706' },
  fullscreen_exit:     { icon: '🔓', label: 'Fullscreen Exited',             color: '#7C3AED' },
};

export default function ViolationWarningModal({ violation, onDismiss, maxWarnings }) {
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SEC);

  useEffect(() => {
    if (!violation) return;
    setCountdown(AUTO_DISMISS_SEC);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(interval); onDismiss(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [violation]);

  if (!violation) return null;

  const meta      = VIOLATION_META[violation.type] || { icon: '⚠️', label: 'Violation Detected', color: '#DC2626' };
  const remaining = maxWarnings - violation.count;    // warnings still left after this one
  const isFinal   = remaining <= 0;

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     'rgba(0,0,0,0.75)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         99999,
      backdropFilter: 'blur(6px)',
      animation:      'fadeIn .2s ease',
    }}>
      {/* Modal box */}
      <div style={{
        background:   '#fff',
        borderRadius: 16,
        maxWidth:     480,
        width:        '92%',
        overflow:     'hidden',
        boxShadow:    '0 25px 60px rgba(0,0,0,0.35)',
        animation:    'slideUp .25s ease',
      }}>
        {/* Top color bar */}
        <div style={{ height: 6, background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)` }} />

        <div style={{ padding: '2rem 2rem 1.5rem' }}>

          {/* Icon + title */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{
              fontSize:    '3.5rem',
              lineHeight:  1,
              marginBottom: '.6rem',
              animation:   'pulse 1s ease infinite',
            }}>
              {meta.icon}
            </div>
            <h2 style={{
              fontSize:   '1.3rem',
              fontWeight: 800,
              color:      meta.color,
              margin:     0,
            }}>
              {meta.label}
            </h2>
          </div>

          {/* Violation message */}
          <div style={{
            background:   `${meta.color}11`,
            border:       `1.5px solid ${meta.color}44`,
            borderRadius: 10,
            padding:      '.9rem 1.1rem',
            marginBottom: '1.25rem',
            textAlign:    'center',
          }}>
            <p style={{ margin: 0, fontSize: '.93rem', color: '#1F2937', lineHeight: 1.55, fontWeight: 500 }}>
              {violation.message}
            </p>
          </div>

          {/* Warning strike counter */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {Array.from({ length: maxWarnings + 1 }).map((_, i) => (
              <div key={i} style={{
                width:        36,
                height:       36,
                borderRadius: '50%',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                fontSize:     '1rem',
                fontWeight:   800,
                background:   i < violation.count ? meta.color : '#F3F4F6',
                color:        i < violation.count ? '#fff'      : '#9CA3AF',
                border:       i < violation.count ? `2px solid ${meta.color}` : '2px solid #E5E7EB',
                transition:   'all .3s',
              }}>
                {i < violation.count ? '⚡' : i + 1}
              </div>
            ))}
          </div>

          {/* Status message */}
          {isFinal ? (
            <div style={{
              background:   '#FEF2F2',
              border:       '1.5px solid #FECACA',
              borderRadius: 10,
              padding:      '.85rem 1rem',
              textAlign:    'center',
              marginBottom: '1.25rem',
            }}>
              <p style={{ margin: 0, fontSize: '.88rem', color: '#DC2626', fontWeight: 700 }}>
                🚫 Maximum violations reached — your quiz has been auto-submitted and flagged.
              </p>
            </div>
          ) : (
            <div style={{
              background:   '#FFFBEB',
              border:       '1.5px solid #FCD34D',
              borderRadius: 10,
              padding:      '.85rem 1rem',
              textAlign:    'center',
              marginBottom: '1.25rem',
            }}>
              <p style={{ margin: 0, fontSize: '.88rem', color: '#92400E', fontWeight: 600 }}>
                ⚠️ Warning {violation.count} of {maxWarnings + 1} — {remaining} more violation{remaining !== 1 ? 's' : ''} will auto-submit your quiz!
              </p>
            </div>
          )}

          {/* Dismiss button + countdown */}
          {!isFinal && (
            <button
              onClick={onDismiss}
              style={{
                width:        '100%',
                padding:      '.8rem',
                borderRadius: 10,
                border:       'none',
                background:   meta.color,
                color:        '#fff',
                fontWeight:   700,
                fontSize:     '.95rem',
                cursor:       'pointer',
                transition:   'opacity .15s',
              }}
            >
              Continue Quiz ({countdown}s)
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 }           to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes pulse   { 0%,100% { transform: scale(1) } 50% { transform: scale(1.08) } }
      `}</style>
    </div>
  );
}
