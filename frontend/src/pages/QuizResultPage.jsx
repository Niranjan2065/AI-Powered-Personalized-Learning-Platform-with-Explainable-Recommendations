// pages/QuizResultPage.jsx — Enhanced with AI feedback, topic breakdown + AI Chat Tutor
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import AIChatTutor from '../components/student/AIChatTutor';

const ProgressBar = ({ pct, color }) => (
  <div style={{ background:'var(--border)', borderRadius:99, height:8, flex:1 }}>
    <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99, transition:'width .6s ease' }} />
  </div>
);

export default function QuizResultPage() {
  const { state } = useLocation();
  const navigate   = useNavigate();
  const result     = state?.result;
  const quizTitle  = state?.quizTitle || 'Quiz';
  const softBlock  = state?.softBlock;   // set when backend allowed retry but student is struggling
  const [showPathToast,   setShowPathToast]   = useState(false);
  const [showSoftWarning, setShowSoftWarning] = useState(!!softBlock);

  // Show "Learning path updated" toast when backend confirms regen
  useEffect(() => {
    if (result?.recommendationsUpdated) {
      const t = setTimeout(() => setShowPathToast(true), 1200);
      const h = setTimeout(() => setShowPathToast(false), 5500);
      return () => { clearTimeout(t); clearTimeout(h); };
    }
  }, [result]);

  if (!result) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ padding:'3rem 1.5rem', textAlign:'center' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>❓</div>
          <h2>No result data found</h2>
          <p style={{ color:'var(--text-muted)', marginBottom:'1.5rem' }}>Please take a quiz to see results here.</p>
          <Link to="/student" className="btn btn-primary">Go to Dashboard</Link>
        </div>
      </>
    );
  }

  const score      = result.scorePercentage ?? result.score ?? 0;
  const passed     = result.isPassed;
  const scoreColor = score >= 80 ? 'var(--secondary)' : score >= 60 ? 'var(--accent)' : 'var(--danger)';

  // AI Feedback based on score
  const aiFeedback = score >= 85
    ? 'Excellent! You have a strong grasp of this topic. Keep challenging yourself with advanced material.'
    : score >= 70
    ? 'Good work! You passed this quiz. Review the topics where you lost points to strengthen your understanding.'
    : score >= 50
    ? 'You are on the right track but need to review this material. Focus on your weak topics and try again.'
    : 'This topic needs more attention. Study the explanations below carefully and revisit the lesson content before trying again.';

  // Build quizStats for AIChatTutor from topicPerformance
  const quizStats = result.topicPerformance && Object.keys(result.topicPerformance).length > 0
    ? {
        weakTopics:    Object.entries(result.topicPerformance)
          .filter(([, v]) => v.percentage < 60)
          .map(([t, v]) => ({ topic: t, percentage: v.percentage })),
        averageTopics: Object.entries(result.topicPerformance)
          .filter(([, v]) => v.percentage >= 60 && v.percentage < 80)
          .map(([t, v]) => ({ topic: t, percentage: v.percentage })),
        strongTopics:  Object.entries(result.topicPerformance)
          .filter(([, v]) => v.percentage >= 80)
          .map(([t, v]) => ({ topic: t, percentage: v.percentage })),
      }
    : null;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar />

      {/* ── Real-time: Learning path updated toast ── */}
      {showPathToast && (
        <div style={{
          position:'fixed', bottom:'1.5rem', left:'1.5rem', zIndex:9999,
          background:'var(--primary)', color:'#fff',
          padding:'.85rem 1.25rem', borderRadius:'var(--radius)',
          boxShadow:'0 4px 20px rgba(0,0,0,.18)',
          display:'flex', alignItems:'center', gap:'.65rem',
          fontSize:'.875rem', fontWeight:500,
          animation:'slideUp .35s ease',
        }}>
          <span style={{ fontSize:'1.1rem' }}>🤖</span>
          <span>Your learning path was updated!</span>
          <button onClick={() => setShowPathToast(false)}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,.7)',
                     cursor:'pointer', fontSize:'1rem', marginLeft:'.25rem', padding:0 }}>✕</button>
        </div>
      )}

      <div className="container" style={{ maxWidth:720, padding:'2rem 1.5rem' }}>

        {/* ── Soft-block adaptive warning ── */}
        {showSoftWarning && softBlock && (
          <div style={{
            background:'#FFFBEB', border:'1px solid #FCD34D',
            borderRadius:12, padding:'1.25rem 1.5rem',
            marginBottom:'1.5rem', position:'relative',
          }}>
            <button onClick={() => setShowSoftWarning(false)}
              style={{ position:'absolute', top:'.75rem', right:'.75rem',
                background:'none', border:'none', cursor:'pointer',
                fontSize:'1rem', color:'var(--text-muted)' }}>✕</button>

            <div style={{ display:'flex', gap:'.75rem', alignItems:'flex-start' }}>
              <span style={{ fontSize:'1.5rem' }}>🤖</span>
              <div>
                <div style={{ fontSize:'.72rem', fontWeight:700,
                  color:'#92400E', marginBottom:'.3rem' }}>
                  AI ADAPTIVE NOTICE
                </div>
                <p style={{ fontSize:'.875rem', color:'#78350F',
                  lineHeight:1.65, margin:'0 0 .75rem' }}>
                  You have attempted this quiz <strong>{softBlock.prevAttempts} times</strong> with
                  an average score of <strong>{softBlock.avgScore}%</strong>.
                  The AI recommends reviewing the lesson before your next attempt.
                </p>

                {softBlock.weakTopics?.length > 0 && (
                  <div style={{ marginBottom:'.75rem' }}>
                    <div style={{ fontSize:'.72rem', fontWeight:600,
                      color:'#92400E', marginBottom:'.3rem' }}>
                      🔴 Topics to focus on:
                    </div>
                    <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                      {softBlock.weakTopics.map(t => (
                        <span key={t} style={{
                          background:'#FEF3C7', border:'1px solid #FCD34D',
                          borderRadius:99, padding:'.15rem .6rem',
                          fontSize:'.75rem', fontWeight:500,
                          color:'#78350F', textTransform:'capitalize',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
                  {softBlock.lessonId && (
                    <button className="btn btn-primary" style={{ fontSize:'.82rem', padding:'.45rem .9rem' }}
                      onClick={() => navigate(`/lessons/${softBlock.lessonId}`)}>
                      📖 Review Lesson First
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ fontSize:'.82rem', padding:'.45rem .9rem' }}
                    onClick={() => navigate('/recommendations')}>
                    🎯 View AI Learning Path
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Score Card */}
        <div className="card" style={{ padding:'2.5rem', textAlign:'center', marginBottom:'1.5rem', borderTop:`4px solid ${scoreColor}` }}>
          <div style={{ fontSize:'4rem', marginBottom:'.75rem' }}>{passed ? '🎉' : '📚'}</div>
          <h1 style={{ fontSize:'1.75rem', marginBottom:'.4rem' }}>
            {passed ? 'You Passed!' : 'Keep Practicing!'}
          </h1>
          <p style={{ color:'var(--text-muted)', marginBottom:'2rem' }}>
            {quizTitle}
          </p>

          <div style={{ display:'flex', justifyContent:'center', gap:'2.5rem', flexWrap:'wrap' }}>
            {[
              ['Score',   `${Math.round(score)}%`,                        scoreColor],
              ['Points',  `${result.pointsEarned}/${result.totalPoints}`, 'var(--primary)'],
              ['Status',  passed ? 'Passed' : 'Failed',                   scoreColor],
              ['Attempt', `#${result.attemptNumber || 1}`,                'var(--text-muted)'],
            ].map(([label, val, c]) => (
              <div key={label}>
                <div style={{ fontSize:'2rem', fontWeight:800, color:c }}>{val}</div>
                <div style={{ fontSize:'.8rem', color:'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Feedback */}
        <div className="card" style={{ padding:'1.25rem', marginBottom:'1.5rem', borderLeft:`3px solid var(--primary)`, background:'var(--primary-light)' }}>
          <div style={{ display:'flex', gap:'.6rem', alignItems:'flex-start' }}>
            <span style={{ fontSize:'1.25rem' }}>🤖</span>
            <div>
              <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--primary-dark)', marginBottom:'.3rem' }}>AI FEEDBACK</div>
              <p style={{ color:'var(--text-secondary)', fontSize:'.875rem', lineHeight:1.65, margin:0 }}>{aiFeedback}</p>
            </div>
          </div>
        </div>

        {/* Topic Performance */}
        {result.topicPerformance && Object.keys(result.topicPerformance).length > 0 && (
          <div className="card" style={{ padding:'1.5rem', marginBottom:'1.5rem' }}>
            <h3 style={{ fontSize:'1rem', marginBottom:'1rem' }}>📊 Performance by Topic</h3>
            {Object.entries(result.topicPerformance).map(([topic, s]) => (
              <div key={topic} style={{ marginBottom:'.85rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.3rem', fontSize:'.85rem' }}>
                  <span style={{ fontWeight:500, textTransform:'capitalize' }}>{topic}</span>
                  <span style={{ fontWeight:700, color: s.percentage >= 80 ? 'var(--secondary)' : s.percentage >= 60 ? 'var(--accent)' : 'var(--danger)' }}>
                    {s.correct}/{s.total} · {s.percentage}%
                  </span>
                </div>
                <ProgressBar pct={s.percentage} color={s.percentage >= 80 ? 'var(--secondary)' : s.percentage >= 60 ? 'var(--accent)' : 'var(--danger)'} />
              </div>
            ))}
          </div>
        )}

        {/* Question Review */}
        {result.answers?.length > 0 && (
          <div className="card" style={{ padding:'1.5rem', marginBottom:'1.5rem' }}>
            <h3 style={{ fontSize:'1rem', marginBottom:'1rem' }}>📝 Question Review</h3>
            {result.answers.map((a, i) => (
              <div key={i} style={{ marginBottom:'1.25rem', padding:'1rem', borderRadius:'var(--radius-sm)', background: a.isCorrect ? '#F0FDF4' : '#FFF1F1', border:`1px solid ${a.isCorrect ? '#D1FAE5' : '#FEE2E2'}` }}>
                <div style={{ display:'flex', gap:'.5rem', alignItems:'flex-start', marginBottom:'.5rem' }}>
                  <span style={{ fontSize:'.9rem', flexShrink:0 }}>{a.isCorrect ? '✅' : '❌'}</span>
                  <span style={{ fontSize:'.87rem', fontWeight:500, lineHeight:1.4 }}>{a.questionText}</span>
                </div>
                {!a.isCorrect && a.selectedOption && (
                  <div style={{ fontSize:'.78rem', color:'var(--danger)', marginBottom:'.3rem' }}>
                    Your answer: {a.selectedOption || a.selectedAnswer}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/student" className="btn btn-primary">Back to Dashboard</Link>
          <Link to="/recommendations" className="btn btn-outline">🤖 View AI Recommendations</Link>
          <Link to="/courses" className="btn btn-ghost">Browse More Courses</Link>
        </div>
      </div>

      {/* AI Chat Tutor — floating widget, reads real quiz data */}
      <AIChatTutor
        score={score}
        quizTitle={quizTitle !== 'Quiz' ? quizTitle : ''}
        quizStats={quizStats}
        defaultSubject={quizTitle !== 'Quiz' ? quizTitle : ''}
      />
    </div>
  );
}