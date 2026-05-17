// pages/QuizResultPage.jsx — Enhanced with AI feedback and topic breakdown
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';

const ProgressBar = ({ pct, color }) => (
  <div style={{ background:'var(--border)', borderRadius:99, height:8, flex:1 }}>
    <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99, transition:'width .6s ease' }} />
  </div>
);

export default function QuizResultPage() {
  const { state } = useLocation();
  const result = state?.result;
  const quizTitle = state?.quizTitle || 'Quiz';

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

  const score  = result.scorePercentage ?? result.score ?? 0;
  const passed = result.isPassed;
  const scoreColor = score >= 80 ? 'var(--secondary)' : score >= 60 ? 'var(--accent)' : 'var(--danger)';

  // AI Feedback based on score
  const aiFeedback = score >= 85
    ? 'Excellent! You have a strong grasp of this topic. Keep challenging yourself with advanced material.'
    : score >= 70
    ? 'Good work! You passed this quiz. Review the topics where you lost points to strengthen your understanding.'
    : score >= 50
    ? 'You are on the right track but need to review this material. Focus on your weak topics and try again.'
    : 'This topic needs more attention. Study the explanations below carefully and revisit the lesson content before trying again.';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ maxWidth:720, padding:'2rem 1.5rem' }}>

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
              ['Score',   `${Math.round(score)}%`,                     scoreColor],
              ['Points',  `${result.pointsEarned}/${result.totalPoints}`, 'var(--primary)'],
              ['Status',  passed ? 'Passed' : 'Failed',                 scoreColor],
              ['Attempt', `#${result.attemptNumber || 1}`,             'var(--text-muted)'],
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
    </div>
  );
}