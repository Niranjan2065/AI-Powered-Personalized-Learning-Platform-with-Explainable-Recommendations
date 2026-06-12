// components/student/AIChatTutor.jsx — v2: improved UX from screenshot feedback
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './AIChatTutor.css';

const QUICK_CHIPS = [
  { label: '❓ Why did I fail?',         msg: 'Why did I fail this quiz? Explain in detail.' },
  { label: '📚 What to study first?',   msg: 'What topic should I study first to improve?' },
  { label: '🧠 Explain the weak topic', msg: 'Explain my weakest topic in simple terms with an example.' },
  { label: '⏱️ How long to improve?',   msg: 'How long will it realistically take me to improve?' },
  { label: '✏️ Give me a practice tip', msg: 'Give me one specific practice technique for my weak areas.' },
];

// Render AI response: parse sections and bullets into styled JSX
function FormatMessage({ text }) {
  const lines = text.split('\n');
  return (
    <div className="aic-response">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="aic-gap" />;
        if (line.startsWith('🔍'))
          return <div key={i} className="aic-tag aic-tag-why"><span className="aic-tag-icon">🔍</span><span>{line.replace('🔍', '').replace(/^[\s:–-]+/, '')}</span></div>;
        if (line.startsWith('✅'))
          return <div key={i} className="aic-tag aic-tag-fix"><span className="aic-tag-icon">✅</span><span>{line.replace('✅', '').replace(/^[\s:–-]+/, '')}</span></div>;
        if (line.startsWith('💡'))
          return <div key={i} className="aic-tag aic-tag-tip"><span className="aic-tag-icon">💡</span><span>{line.replace('💡', '').replace(/^[\s:–-]+/, '')}</span></div>;
        if (line.match(/^[•\-]\s/))
          return <div key={i} className="aic-bullet"><span className="aic-dot" />  <span>{line.replace(/^[•\-]\s/, '')}</span></div>;
        return <p key={i} className="aic-line">{line}</p>;
      })}
    </div>
  );
}

export default function AIChatTutor({
  quizStats       = null,   // { weakTopics, averageTopics, strongTopics }
  defaultSubject  = '',     // quiz title string
  score           = null,   // numeric score e.g. 50
  quizTitle       = '',     // e.g. "Chapter 3 Quiz"
}) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [subject, setSubject]   = useState('');
  const [showChips, setShowChips] = useState(true);
  const bottomRef               = useRef(null);

  // Build topic chips from quizStats
  const topicChips = [
    ...(quizStats?.weakTopics    || []).map(t => ({ ...t, ctx: 'weak'    })),
    ...(quizStats?.averageTopics || []).map(t => ({ ...t, ctx: 'average' })),
    ...(quizStats?.strongTopics  || []).map(t => ({ ...t, ctx: 'strong'  })),
  ];

  // Auto-select weakest topic OR quiz title
  useEffect(() => {
    if (topicChips.length) {
      setSubject(topicChips[0].topic);
    } else if (defaultSubject && defaultSubject !== 'Quiz') {
      setSubject(defaultSubject);
    }
  }, [quizStats, defaultSubject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildContext = useCallback(() => {
    const titlePart  = quizTitle && quizTitle !== 'Quiz' ? `Quiz: "${quizTitle}". ` : '';
    const scorePart  = score !== null ? `Overall score: ${Math.round(score)}%. ` : '';
    const topicFound = topicChips.find(t => t.topic === subject);
    let topicPart    = '';
    if (topicFound) {
      const lvl = topicFound.ctx === 'weak' ? 'struggling (needs urgent attention)' : topicFound.ctx === 'strong' ? 'strong at' : 'making progress in';
      topicPart = `Currently focused on topic: "${topicFound.topic}" — student is ${lvl} with ${topicFound.percentage}% accuracy. `;
    } else if (subject && subject !== 'Quiz') {
      topicPart = `Subject/topic being discussed: "${subject}". `;
    }
    const weakList = quizStats?.weakTopics?.map(t => `${t.topic} (${t.percentage}%)`).join(', ');
    const weakPart = weakList ? `Weak topics overall: ${weakList}. ` : '';
    return titlePart + scorePart + topicPart + weakPart;
  }, [subject, quizStats, score, quizTitle, topicChips]);

  const send = async (overrideText) => {
    const msg = (overrideText || input).trim();
    if (!msg || loading) return;
    setInput('');
    setShowChips(false);

    const newMsgs = [...messages, { role: 'user', content: msg }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res   = await fetch('/api/tutor-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({
          messages:       newMsgs,
          subjectContext: buildContext(),
          subject:        subject || defaultSubject || 'General',
          score,
          quizTitle,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, I could not respond. Please try again.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection issue. Check your network and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => { setMessages([]); setShowChips(true); };

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  // ── FAB (collapsed) ──
  if (!open) {
    return (
      <button className="aic-fab" onClick={() => setOpen(true)} aria-label="Open AI Tutor">
        <span className="aic-fab-icon">🤖</span>
        <span className="aic-fab-text">Ask AI Tutor</span>
        {quizStats?.weakTopics?.length > 0 && (
          <span className="aic-fab-badge">{quizStats.weakTopics.length} weak</span>
        )}
      </button>
    );
  }

  // ── Open widget ──
  return (
    <div className="aic-widget" role="dialog" aria-label="AI Chat Tutor">

      {/* Header */}
      <div className="aic-header">
        <div className="aic-hdr-left">
          <div className="aic-hdr-avatar">🤖</div>
          <div>
            <div className="aic-hdr-name">Aria — AI Learning Tutor</div>
            <div className="aic-hdr-sub">
              <span className="aic-online" />
              {subject && subject !== 'Quiz' ? `Discussing: ${subject}` : 'Ask why you failed & how to improve'}
            </div>
          </div>
        </div>
        <div className="aic-hdr-actions">
          {messages.length > 0 && (
            <button className="aic-icon-btn" onClick={clearChat} title="Clear chat" aria-label="Clear chat">
              🗑
            </button>
          )}
          <button className="aic-icon-btn" onClick={() => setOpen(false)} title="Close" aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Topic chips — only show when topics from quizStats exist */}
      {topicChips.length > 0 && (
        <div className="aic-topics-bar">
          <span className="aic-topics-label">Focus on:</span>
          {topicChips.map(t => (
            <button
              key={t.topic}
              onClick={() => setSubject(t.topic)}
              className={`aic-topic-pill aic-topic-${t.ctx}${subject === t.topic ? ' active' : ''}`}
            >
              {t.topic} {t.percentage}%
            </button>
          ))}
        </div>
      )}

      {/* Score banner — only on quiz result page */}
      {score !== null && (
        <div className={`aic-score-banner ${score >= 70 ? 'pass' : score >= 50 ? 'mid' : 'fail'}`}>
          <span className="aic-score-val">{Math.round(score)}%</span>
          <span className="aic-score-label">
            {score >= 70 ? '✅ Passed' : score >= 50 ? '⚠️ Just below passing' : '❌ Failed'}
            {quizTitle && quizTitle !== 'Quiz' ? ` · ${quizTitle}` : ''}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="aic-messages">
        {messages.length === 0 && (
          <div className="aic-empty">
            <div className="aic-empty-icon">💬</div>
            <div className="aic-empty-title">
              {score !== null && score < 70
                ? `You scored ${Math.round(score)}% — want to know why?`
                : 'Ask Aria about your performance'}
            </div>
            <div className="aic-empty-sub">
              {topicChips.length > 0
                ? `${topicChips.filter(t => t.ctx === 'weak').length} weak topic(s) detected — tap a chip to ask about one`
                : 'Tap a suggestion below or type your question'}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`aic-row aic-row-${m.role}`}>
            <div className={`aic-av aic-av-${m.role}`}>{m.role === 'user' ? 'You' : 'AI'}</div>
            <div className={`aic-bub aic-bub-${m.role}`}>
              {m.role === 'assistant'
                ? <FormatMessage text={m.content} />
                : m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="aic-row aic-row-assistant">
            <div className="aic-av aic-av-assistant">AI</div>
            <div className="aic-typing"><span/><span/><span/></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips — disappear after first message */}
      {showChips && messages.length === 0 && (
        <div className="aic-chips-row">
          {QUICK_CHIPS.map(c => (
            <button key={c.label} className="aic-qchip" onClick={() => send(c.msg)}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="aic-input-area">
        {/* Subject selector — text input only if no topic chips */}
        {topicChips.length === 0 && (
          <input
            className="aic-subj-input"
            value={subject === defaultSubject && defaultSubject !== 'Quiz' ? '' : subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={defaultSubject && defaultSubject !== 'Quiz' ? defaultSubject : 'Topic…'}
            title="Topic / subject"
          />
        )}
        <input
          className="aic-text-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            subject && subject !== 'Quiz'
              ? `Ask about "${subject}"…`
              : 'Ask why you failed, or how to improve…'
          }
          disabled={loading}
          autoComplete="off"
        />
        <button
          className="aic-send-btn"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          {loading ? <span className="aic-spin" /> : '➤'}
        </button>
      </div>
    </div>
  );
}