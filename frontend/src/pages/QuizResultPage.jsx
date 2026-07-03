// pages/QuizResultPage.jsx
//
// CHANGES in this version:
//
//  NEW — ShapExplanationPanel (core XAI feature)
//    Reads result.analysisSummary.shapExplanation from the quiz attempt response.
//    Shows a per-factor bar chart (green = strength, red = weakness) with:
//      • Human-readable label for each SHAP feature
//      • Tooltip tip per factor
//      • Key insight sentence summarising the top driver
//      • Legend
//    Only shown for ML-powered attempts (when shapExplanation is present).
//
//  NEW — WeakTopicsFromResult
//    Derives weak/average/strong topics directly from result.topicPerformance
//    (already on the result object) and shows them as colour-coded rows with
//    progress bars — no extra API call needed.
//
//  NEW — NextStepCard
//    After the SHAP panel, shows a contextual "What to do next" card:
//      • Passed  → nudges toward the next lesson / AI recommendations
//      • Failed  → sends to lesson review + AI path
//
//  KEPT — all existing sections unchanged (score card, soft-block warning,
//    question review, AI feedback, topic breakdown, action buttons, AIChatTutor)

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import AIChatTutor from '../components/student/AIChatTutor';

// ─────────────────────────────────────────────────────────────
// Shared mini-components
// ─────────────────────────────────────────────────────────────
const ProgressBar = ({ pct, color }) => (
  <div style={{ background: 'var(--border)', borderRadius: 99, height: 8, flex: 1 }}>
    <div style={{
      width: `${Math.min(100, pct || 0)}%`, height: '100%',
      background: color, borderRadius: 99, transition: 'width .6s ease',
    }} />
  </div>
);

// ─────────────────────────────────────────────────────────────
// SHAP feature label + tip lookup
// ─────────────────────────────────────────────────────────────
const FEATURE_LABELS = {
  avg_quiz_score:     'Average Quiz Score',
  error_count:        'Error Rate',
  attempts:           'Number of Attempts',
  time_spent_minutes: 'Time Spent Studying',
  quiz_score:         'Latest Quiz Score',
  completion_rate:    'Course Completion',
  streak_days:        'Study Streak',
};

const FEATURE_TIPS = {
  avg_quiz_score:     { pos: 'Your strong quiz history boosted this.',            neg: 'Low historical quiz scores flagged this topic for review.' },
  error_count:        { pos: 'Low error rate — your accuracy is solid.',          neg: 'High error count — this lesson targets your mistake patterns.' },
  attempts:           { pos: 'Multiple attempts show real commitment.',            neg: 'Several attempts needed — this concept needs more reinforcement.' },
  time_spent_minutes: { pos: 'Good study time investment detected.',              neg: 'More time spent studying this topic will improve retention.' },
  quiz_score:         { pos: 'This quiz score shows solid understanding.',        neg: 'This quiz score flagged this topic for immediate review.' },
  completion_rate:    { pos: 'Great course completion rate!',                     neg: 'Low completion rate — focus on finishing lessons in order.' },
  streak_days:        { pos: 'Consistent study streak — excellent habit!',        neg: 'Study more consistently to lock in long-term retention.' },
};

// ─────────────────────────────────────────────────────────────
// ShapExplanationPanel — the core XAI component shown to students
// after taking a quiz whose attempt triggered ML analysis.
// ─────────────────────────────────────────────────────────────
function ShapExplanationPanel({ shapExplanation, topicName, score }) {
  const [expanded, setExpanded] = useState(score < 70); // auto-open on fail

  if (!shapExplanation) return null;

  const contributions = shapExplanation.shap_contributions || {};
  const humanReadable = shapExplanation.human_readable;
  const weakTopicNote = shapExplanation.weak_topic_note;

  const entries = Object.entries(contributions)
    .map(([key, value]) => ({
      key,
      label:    FEATURE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      rawValue: parseFloat(value),
      abs:      Math.abs(parseFloat(value)),
    }))
    .sort((a, b) => b.abs - a.abs)
    .slice(0, 6);

  if (!entries.length) return null;

  const maxAbs  = Math.max(...entries.map(e => e.abs), 0.001);
  const topNeg  = entries.find(e => e.rawValue < 0);
  const topPos  = entries.find(e => e.rawValue >= 0);

  return (
    <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>

      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          width: '100%', textAlign: 'left', background: 'linear-gradient(135deg,#EEF2FF,#DBEAFE)',
          border: 'none', borderBottom: expanded ? '1px solid var(--border)' : 'none',
          padding: '1rem 1.25rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#1D4ED8', marginBottom: '.2rem' }}>
            🧠 Why AI made this recommendation for you
          </div>
          <div style={{ fontSize: '.75rem', color: '#3B82F6' }}>
            SHAP explainability — powered by your real learning data
          </div>
        </div>
        <span style={{ fontSize: '1rem', color: '#3B82F6', flexShrink: 0 }}>
          {expanded ? '▲' : '▼ Show'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '1.25rem' }}>

          {/* Human-readable summary */}
          {humanReadable && (
            <div style={{
              padding: '.85rem 1rem', background: '#EFF6FF',
              borderRadius: 8, border: '1px solid #BFDBFE',
              fontSize: '.85rem', color: '#1E40AF', lineHeight: 1.65,
              marginBottom: '1.25rem',
            }}>
              <strong>📌 Summary: </strong>{humanReadable}
            </div>
          )}

          {/* Weak topic note */}
          {weakTopicNote && (
            <div style={{
              padding: '.6rem .9rem', background: '#FEF3C7',
              borderRadius: 6, border: '1px solid #FDE68A',
              fontSize: '.8rem', color: '#92400E', marginBottom: '1.25rem',
            }}>
              ⚠️ {weakTopicNote}
            </div>
          )}

          {/* Factor bars */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Factors that influenced this recommendation
            </div>
            {entries.map(e => {
              const pct      = (e.abs / maxAbs) * 100;
              const isPos    = e.rawValue >= 0;
              const barColor = isPos ? '#059669' : '#DC2626';
              const bgColor  = isPos ? '#D1FAE5' : '#FEE2E2';
              const tip      = (FEATURE_TIPS[e.key] || {})[isPos ? 'pos' : 'neg'];
              return (
                <div key={e.key} style={{ marginBottom: '.85rem' }} title={tip || ''}>
                  {/* Label + value row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.3rem' }}>
                    <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {isPos ? '↑' : '↓'} {e.label}
                    </span>
                    <span style={{ fontSize: '.75rem', fontWeight: 700, color: barColor }}>
                      {isPos ? '+' : '−'}{(e.abs * 100).toFixed(1)}
                    </span>
                  </div>
                  {/* Bar */}
                  <div style={{ background: 'var(--border)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', background: barColor,
                      borderRadius: 99, transition: 'width .7s cubic-bezier(.4,0,.2,1)',
                      position: 'relative',
                    }}>
                      <div style={{ position: 'absolute', inset: 0, background: bgColor, opacity: .3, borderRadius: 99 }} />
                    </div>
                  </div>
                  {/* Tip */}
                  {tip && (
                    <div style={{ fontSize: '.7rem', color: isPos ? '#065F46' : '#991B1B', marginTop: '.2rem', lineHeight: 1.4 }}>
                      {tip}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Key insight */}
          {(topNeg || topPos) && (
            <div style={{
              padding: '.75rem 1rem', background: '#EFF6FF',
              borderRadius: 8, border: '1px solid #BFDBFE',
              fontSize: '.8rem', color: '#1E40AF', lineHeight: 1.65, marginBottom: '.75rem',
            }}>
              <strong>📌 Key insight: </strong>
              {topNeg
                ? `Your ${topNeg.label.toLowerCase()} is the main factor the AI flagged for improvement.`
                : `Your ${topPos?.label.toLowerCase()} is your biggest strength contributing to this result.`}
              {topNeg && topPos && ` Meanwhile, your ${topPos.label.toLowerCase()} is a strong point to build on.`}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '.7rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#059669', display: 'inline-block' }} />
              Positive factor (strength)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#DC2626', display: 'inline-block' }} />
              Negative factor (needs work)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WeakTopicsFromResult
// Derives topic bands from result.topicPerformance and displays
// colour-coded rows — no extra API call needed.
// ─────────────────────────────────────────────────────────────
function WeakTopicsFromResult({ topicPerformance }) {
  if (!topicPerformance || !Object.keys(topicPerformance).length) return null;

  const entries = Object.entries(topicPerformance)
    .map(([topic, s]) => ({ topic, ...s }))
    .sort((a, b) => a.percentage - b.percentage); // weakest first

  const weak    = entries.filter(e => e.percentage <  60);
  const average = entries.filter(e => e.percentage >= 60 && e.percentage < 80);
  const strong  = entries.filter(e => e.percentage >= 80);

  const Section = ({ label, items, color, bg }) => items.length === 0 ? null : (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '.75rem', fontWeight: 700, color, marginBottom: '.5rem' }}>{label}</div>
      {items.map(({ topic, percentage, correct, total }) => (
        <div key={topic} style={{ marginBottom: '.6rem' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '.82rem', marginBottom: '.25rem',
          }}>
            <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{topic}</span>
            <span style={{ fontWeight: 700, color }}>
              {correct}/{total} · {percentage}%
            </span>
          </div>
          <ProgressBar pct={percentage} color={color} />
          {percentage < 60 && (
            <div style={{ fontSize: '.7rem', color: '#991B1B', marginTop: '.2rem' }}>
              ⚠️ Focus on this topic — below passing threshold
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '1.1rem' }}>📊 Performance by Topic</h3>
      <Section label="🔴 Needs Work (< 60%)" items={weak}    color="#DC2626" />
      <Section label="🟡 Average (60–79%)"   items={average} color="#D97706" />
      <Section label="🟢 Strong (80%+)"      items={strong}  color="#059669" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NextStepCard — contextual CTA shown below the SHAP panel
// ─────────────────────────────────────────────────────────────
function NextStepCard({ passed, score, softBlock, lessonId, courseId }) {
  if (passed) {
    return (
      <div className="card" style={{
        padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
        borderLeft: '4px solid var(--secondary)',
        background: 'var(--secondary-light)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#065F46', marginBottom: '.35rem' }}>
          🎉 Great work — what's next?
        </div>
        <p style={{ fontSize: '.82rem', color: '#047857', lineHeight: 1.6, margin: '0 0 .85rem' }}>
          You passed! The AI has updated your learning path with a fresh recommendation based on this result.
        </p>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <Link to="/recommendations" className="btn btn-primary" style={{ fontSize: '.82rem', padding: '.45rem .9rem' }}>
            🤖 View Updated AI Path
          </Link>
          {courseId && (
            <Link to={`/courses/${courseId}`} className="btn btn-outline" style={{ fontSize: '.82rem', padding: '.45rem .9rem' }}>
              Continue Course →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{
      padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
      borderLeft: '4px solid var(--danger)',
      background: '#FFF1F1',
    }}>
      <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#991B1B', marginBottom: '.35rem' }}>
        📚 Don't worry — here's your study plan
      </div>
      <p style={{ fontSize: '.82rem', color: '#7F1D1D', lineHeight: 1.6, margin: '0 0 .85rem' }}>
        Score of <strong>{Math.round(score)}%</strong> — review the lesson content, then retake when you feel ready.
        The AI recommendation above shows exactly which areas to focus on.
      </p>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        {lessonId && (
          <Link
            to={lessonId ? `/learn/${courseId}/lesson/${lessonId}` : '/courses'}
            className="btn btn-primary"
            style={{ fontSize: '.82rem', padding: '.45rem .9rem', background: '#DC2626', borderColor: '#DC2626' }}>
            📖 Review Lesson
          </Link>
        )}
        <Link to="/recommendations" className="btn btn-outline" style={{ fontSize: '.82rem', padding: '.45rem .9rem' }}>
          🎯 See AI Learning Path
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export default function QuizResultPage() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const result     = state?.result;
  const quizTitle  = state?.quizTitle  || 'Quiz';
  const softBlock  = state?.softBlock;

  const [showPathToast,   setShowPathToast]   = useState(false);
  const [showSoftWarning, setShowSoftWarning] = useState(!!softBlock);

  useEffect(() => {
    if (result?.recommendationsUpdated) {
      const t = setTimeout(() => setShowPathToast(true),  1200);
      const h = setTimeout(() => setShowPathToast(false), 5500);
      return () => { clearTimeout(t); clearTimeout(h); };
    }
  }, [result]);

  if (!result) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❓</div>
          <h2>No result data found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Please take a quiz to see results here.
          </p>
          <Link to="/student" className="btn btn-primary">Go to Dashboard</Link>
        </div>
      </>
    );
  }

  const score      = result.scorePercentage ?? result.score ?? 0;
  const passed     = result.isPassed;
  const scoreColor = score >= 80 ? 'var(--secondary)' : score >= 60 ? 'var(--accent)' : 'var(--danger)';

  // Static AI feedback (unchanged)
  const aiFeedback =
    score >= 85 ? 'Excellent! You have a strong grasp of this topic. Keep challenging yourself with advanced material.'
    : score >= 70 ? 'Good work! You passed. Review the topics where you lost points to strengthen your understanding.'
    : score >= 50 ? 'You are on the right track but need to review this material. Focus on your weak topics and try again.'
    : 'This topic needs more attention. Study the explanations below carefully and revisit the lesson before trying again.';

  // SHAP data — from quiz attempt response
  const shapExplanation =
    result.analysisSummary?.shapExplanation ||
    result.shapExplanation ||
    null;

  const topTopic =
    result.topicPerformance
      ? Object.entries(result.topicPerformance)
          .sort(([, a], [, b]) => a.percentage - b.percentage)[0]?.[0]
      : null;

  // Build quizStats for AIChatTutor
  const quizStats = result.topicPerformance && Object.keys(result.topicPerformance).length > 0
    ? {
        weakTopics:    Object.entries(result.topicPerformance).filter(([, v]) => v.percentage <  60).map(([t, v]) => ({ topic: t, percentage: v.percentage })),
        averageTopics: Object.entries(result.topicPerformance).filter(([, v]) => v.percentage >= 60 && v.percentage < 80).map(([t, v]) => ({ topic: t, percentage: v.percentage })),
        strongTopics:  Object.entries(result.topicPerformance).filter(([, v]) => v.percentage >= 80).map(([t, v]) => ({ topic: t, percentage: v.percentage })),
      }
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* ── Learning path updated toast ── */}
      {showPathToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '1.5rem', zIndex: 9999,
          background: 'var(--primary)', color: '#fff',
          padding: '.85rem 1.25rem', borderRadius: 'var(--radius)',
          boxShadow: '0 4px 20px rgba(0,0,0,.18)',
          display: 'flex', alignItems: 'center', gap: '.65rem',
          fontSize: '.875rem', fontWeight: 500, animation: 'slideUp .35s ease',
        }}>
          <span style={{ fontSize: '1.1rem' }}>🤖</span>
          <span>Your learning path was updated!</span>
          <button onClick={() => setShowPathToast(false)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,.7)',
            cursor: 'pointer', fontSize: '1rem', marginLeft: '.25rem', padding: 0,
          }}>✕</button>
        </div>
      )}

      <div className="container" style={{ maxWidth: 720, padding: '2rem 1.5rem' }}>

        {/* ── Soft-block adaptive warning (unchanged) ── */}
        {showSoftWarning && softBlock && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FCD34D',
            borderRadius: 12, padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem', position: 'relative',
          }}>
            <button onClick={() => setShowSoftWarning(false)} style={{
              position: 'absolute', top: '.75rem', right: '.75rem',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1rem', color: 'var(--text-muted)',
            }}>✕</button>
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem' }}>🤖</span>
              <div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#92400E', marginBottom: '.3rem' }}>
                  AI ADAPTIVE NOTICE
                </div>
                <p style={{ fontSize: '.875rem', color: '#78350F', lineHeight: 1.65, margin: '0 0 .75rem' }}>
                  You have attempted this quiz <strong>{softBlock.prevAttempts} times</strong> with
                  an average score of <strong>{softBlock.avgScore}%</strong>.
                  The AI recommends reviewing the lesson before your next attempt.
                </p>
                {softBlock.weakTopics?.length > 0 && (
                  <div style={{ marginBottom: '.75rem' }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 600, color: '#92400E', marginBottom: '.3rem' }}>
                      🔴 Topics to focus on:
                    </div>
                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                      {softBlock.weakTopics.map(t => (
                        <span key={t} style={{
                          background: '#FEF3C7', border: '1px solid #FCD34D',
                          borderRadius: 99, padding: '.15rem .6rem',
                          fontSize: '.75rem', fontWeight: 500,
                          color: '#78350F', textTransform: 'capitalize',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                  {softBlock.lessonId && (
                    <button className="btn btn-primary" style={{ fontSize: '.82rem', padding: '.45rem .9rem' }}
                      onClick={() => navigate(`/lessons/${softBlock.lessonId}`)}>
                      📖 Review Lesson First
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ fontSize: '.82rem', padding: '.45rem .9rem' }}
                    onClick={() => navigate('/recommendations')}>
                    🎯 View AI Learning Path
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Score Card (unchanged) ── */}
        <div className="card" style={{
          padding: '2.5rem', textAlign: 'center',
          marginBottom: '1.5rem', borderTop: `4px solid ${scoreColor}`,
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '.75rem' }}>{passed ? '🎉' : '📚'}</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>
            {passed ? 'You Passed!' : 'Keep Practicing!'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{quizTitle}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
            {[
              ['Score',   `${Math.round(score)}%`,                        scoreColor],
              ['Points',  `${result.pointsEarned}/${result.totalPoints}`, 'var(--primary)'],
              ['Status',  passed ? 'Passed' : 'Failed',                   scoreColor],
              ['Attempt', `#${result.attemptNumber || 1}`,                'var(--text-muted)'],
            ].map(([label, val, c]) => (
              <div key={label}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: c }}>{val}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── AI Feedback (unchanged) ── */}
        <div className="card" style={{
          padding: '1.25rem', marginBottom: '1.5rem',
          borderLeft: '3px solid var(--primary)', background: 'var(--primary-light)',
        }}>
          <div style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.25rem' }}>🤖</span>
            <div>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '.3rem' }}>
                AI FEEDBACK
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', lineHeight: 1.65, margin: 0 }}>
                {aiFeedback}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ NEW — SHAP Explanation Panel */}
        <ShapExplanationPanel
          shapExplanation={shapExplanation}
          topicName={topTopic}
          score={score}
        />

        {/* ✅ NEW — Next step CTA (contextual based on pass/fail) */}
        <NextStepCard
          passed={passed}
          score={score}
          softBlock={softBlock}
          lessonId={result.lessonId}
          courseId={result.courseId}
        />

        {/* ✅ UPGRADED — Topic breakdown (now shows weak/avg/strong sections) */}
        <WeakTopicsFromResult topicPerformance={result.topicPerformance} />

        {/* ── Question Review (unchanged) ── */}
        {result.answers?.length > 0 && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📝 Question Review</h3>
            {result.answers.map((a, i) => (
              <div key={i} style={{
                marginBottom: '1.25rem', padding: '1rem', borderRadius: 'var(--radius-sm)',
                background: a.isCorrect ? '#F0FDF4' : '#FFF1F1',
                border: `1px solid ${a.isCorrect ? '#D1FAE5' : '#FEE2E2'}`,
              }}>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', marginBottom: '.5rem' }}>
                  <span style={{ fontSize: '.9rem', flexShrink: 0 }}>{a.isCorrect ? '✅' : '❌'}</span>
                  <span style={{ fontSize: '.87rem', fontWeight: 500, lineHeight: 1.4 }}>{a.questionText}</span>
                </div>
                {!a.isCorrect && (a.selectedOption || a.selectedAnswer) && (
                  <div style={{ fontSize: '.78rem', color: 'var(--danger)', marginBottom: '.3rem' }}>
                    Your answer: {a.selectedOption || a.selectedAnswer}
                  </div>
                )}
                {a.explanation && (
                  <div style={{ fontSize: '.78rem', color: '#065F46', marginTop: '.3rem', fontStyle: 'italic' }}>
                    💡 {a.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <Link to="/student"         className="btn btn-primary">Back to Dashboard</Link>
          <Link to="/recommendations" className="btn btn-outline">🤖 View AI Recommendations</Link>
          <Link to="/courses"         className="btn btn-ghost">Browse More Courses</Link>
        </div>
      </div>

      {/* AI Chat Tutor — reads real quiz data (unchanged) */}
      <AIChatTutor
        score={score}
        quizTitle={quizTitle !== 'Quiz' ? quizTitle : ''}
        quizStats={quizStats}
        defaultSubject={quizTitle !== 'Quiz' ? quizTitle : ''}
      />
    </div>
  );
}