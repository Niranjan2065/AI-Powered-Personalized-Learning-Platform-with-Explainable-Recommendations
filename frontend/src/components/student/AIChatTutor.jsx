// components/student/AIChatTutor.jsx
// Drop-in AI Chat Tutor widget — powered by Groq via /api/tutor-chat
// Usage: <AIChatTutor quizStats={quizStats} defaultSubject="Math" />

import React, { useState, useEffect, useRef } from 'react';
import './AIChatTutor.css';

const SUBJECT_SUGGESTIONS = {
  math:        'Try: "Why did I fail Math?" or "Explain quadratic equations simply"',
  physics:     'Try: "Why do I keep getting Newton\'s laws wrong?"',
  chemistry:   'Try: "I failed organic chemistry — what should I focus on?"',
  english:     'Try: "How do I improve my essay structure?"',
  biology:     'Try: "Explain mitosis in simple terms"',
  default:     'Try: "Why did I fail?" or "What should I study first?"',
};

const QUICK_CHIPS = [
  'Why did I fail?',
  'What should I study first?',
  'Give me a practice tip',
  'Explain the topic simply',
  'How long to improve?',
];

// Format AI markdown-like responses into JSX
function formatMessage(text) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('🔍')) return <div key={i} className="aic-section aic-section-why">{line}</div>;
    if (line.startsWith('✅')) return <div key={i} className="aic-section aic-section-fix">{line}</div>;
    if (line.startsWith('💡')) return <div key={i} className="aic-section aic-section-tip">{line}</div>;
    if (line.startsWith('•')) return <div key={i} className="aic-bullet">{line}</div>;
    if (line.trim() === '') return <div key={i} className="aic-spacer" />;
    return <div key={i}>{line}</div>;
  });
}

export default function AIChatTutor({ quizStats, defaultSubject = '' }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [subject, setSubject]     = useState('');
  const [open, setOpen]           = useState(false);
  const messagesEndRef             = useRef(null);

  // Build subject list from quizStats
  const subjectOptions = quizStats?.weakTopics || quizStats?.averageTopics || quizStats?.strongTopics
    ? [
        ...(quizStats.weakTopics    || []).map(t => ({ label: `${t.topic} (${t.percentage}%) ⚠️`,  value: t.topic, score: t.percentage, ctx: `weak`    })),
        ...(quizStats.averageTopics || []).map(t => ({ label: `${t.topic} (${t.percentage}%) 📈`, value: t.topic, score: t.percentage, ctx: `average` })),
        ...(quizStats.strongTopics  || []).map(t => ({ label: `${t.topic} (${t.percentage}%) ✅`, value: t.topic, score: t.percentage, ctx: `strong`  })),
      ]
    : [];

  // Pre-select weakest subject
  useEffect(() => {
    if (subjectOptions.length && !subject) {
      setSubject(subjectOptions[0].value);
    } else if (defaultSubject) {
      setSubject(defaultSubject);
    }
  }, [quizStats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const getSubjectContext = () => {
    const found = subjectOptions.find(s => s.value === subject);
    if (!found) return subject ? `Student is asking about ${subject}` : '';
    const level = found.ctx === 'weak' ? 'struggling' : found.ctx === 'strong' ? 'excelling' : 'making progress';
    return `Student is ${level} in ${found.value} with a score of ${found.score}%. ${
      found.ctx === 'weak'
        ? `They need targeted help understanding core concepts.`
        : found.ctx === 'average'
        ? `They understand basics but need help with application.`
        : `They are doing well but want to go deeper.`
    }`;
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg  = { role: 'user', content: msg };
    const newMsgs  = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res   = await fetch('/api/tutor-chat', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          messages:       newMsgs,
          subjectContext: getSubjectContext(),
          subject:        subject || 'General',
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, no response received.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestion = SUBJECT_SUGGESTIONS[subject?.toLowerCase()] || SUBJECT_SUGGESTIONS.default;

  if (!open) {
    return (
      <button className="aic-fab" onClick={() => setOpen(true)} aria-label="Open AI Tutor Chat">
        <span style={{ fontSize: '1.5rem' }}>🤖</span>
        <span className="aic-fab-label">Ask AI Tutor</span>
      </button>
    );
  }

  return (
    <div className="aic-widget">
      {/* Header */}
      <div className="aic-header">
        <div className="aic-header-avatar">🤖</div>
        <div className="aic-header-info">
          <div className="aic-header-name">Aria — AI Learning Tutor</div>
          <div className="aic-header-sub">Explains why you struggle &amp; how to improve</div>
        </div>
        <button className="aic-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
      </div>

      {/* Subject selector (if quiz data available) */}
      {subjectOptions.length > 0 && (
        <div className="aic-subjects">
          {subjectOptions.map(s => (
            <button
              key={s.value}
              className={`aic-subject-chip ${subject === s.value ? 'active' : ''} aic-chip-${s.ctx}`}
              onClick={() => setSubject(s.value)}
            >
              {s.value} {s.score}%
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="aic-messages">
        {messages.length === 0 && (
          <div className="aic-empty">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
            <div className="aic-empty-title">Ask Aria anything about your results</div>
            <div className="aic-empty-sub">{suggestion}</div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`aic-msg-row ${m.role}`}>
            <div className={`aic-avatar ${m.role}`}>{m.role === 'user' ? 'You' : 'AI'}</div>
            <div className={`aic-bubble ${m.role}`}>
              {m.role === 'assistant' ? formatMessage(m.content) : m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="aic-msg-row assistant">
            <div className="aic-avatar assistant">AI</div>
            <div className="aic-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick chips */}
      {messages.length === 0 && (
        <div className="aic-chips">
          {QUICK_CHIPS.map(c => (
            <button key={c} className="aic-chip" onClick={() => send(c)}>{c}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="aic-input-row">
        {subjectOptions.length === 0 && (
          <input
            className="aic-subject-input"
            placeholder="Subject…"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        )}
        <input
          className="aic-input"
          placeholder={`Ask about ${subject || 'your results'}…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          autoComplete="off"
        />
        <button
          className="aic-send"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}