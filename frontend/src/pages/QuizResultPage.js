// src/pages/QuizResultPage.js
import React from 'react';
import { useLocation, Link, useParams } from 'react-router-dom';
import Navbar from '../components/common/Navbar';

export default function QuizResultPage() {
  const { state } = useLocation();
  const result = state?.result;

  if (!result) return <><Navbar /><div className="container" style={{padding:'3rem',textAlign:'center'}}><h2>No result data</h2><Link to="/student" className="btn btn-primary">Dashboard</Link></div></>;

  const score = result.scorePercentage;
  const passed = result.isPassed;
  const color = score >= 80 ? 'var(--secondary)' : score >= 60 ? 'var(--accent)' : 'var(--danger)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ maxWidth: 760, padding: '2rem 1.5rem' }}>
        {/* Result Card */}
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', marginBottom: '2rem', borderTop: `4px solid ${color}` }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{passed ? '🎉' : '📚'}</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '.5rem' }}>{passed ? 'Congratulations! You Passed!' : 'Keep Practicing!'}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{passed ? 'Great job on completing this quiz.' : 'Review the explanations below and try again.'}</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            {[
              ['Score', `${score}%`, color],
              ['Points', `${result.pointsEarned}/${result.totalPoints}`, 'var(--primary)'],
              ['Status', passed ? 'Passed' : 'Failed', color],
              ['Attempt', `#${result.attemptNumber}`, 'var(--text-muted)'],
            ].map(([label, val, c]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: c }}>{val}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Performance */}
        {result.topicPerformance && Object.keys(result.topicPerformance).length > 0 && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📊 Performance by Topic</h3>
            {Object.entries(result.topicPerformance).map(([topic, stats]) => (
              <div key={topic} style={{ marginBottom: '.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.25rem', fontSize: '.85rem' }}>
                  <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{topic}</span>
                  <span style={{ fontWeight: 700, color: stats.percentage >= 80 ? 'var(--secondary)' : stats.percentage >= 60 ? 'var(--accent)' : 'var(--danger)' }}>
                    {stats.correct}/{stats.total} ({stats.percentage}%)
                  </span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 99, height: 6 }}>
                  <div style={{ width: `${stats.percentage}%`, height: '100%', background: stats.percentage >= 80 ? 'var(--secondary)' : stats.percentage >= 60 ? 'var(--accent)' : 'var(--danger)', borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Question Review */}
        {result.questions && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Question Review</h3>
            {result.questions.map((q, i) => (
              <div key={i} className="card" style={{ padding: '1.25rem', marginBottom: '1rem', borderLeft: `4px solid ${q.isCorrect ? 'var(--secondary)' : 'var(--danger)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '.9rem' }}>Q{i+1}: {q.question}</span>
                  <span style={{ fontWeight: 700, color: q.isCorrect ? 'var(--secondary)' : 'var(--danger)', fontSize: '.875rem' }}>
                    {q.isCorrect ? '✓ Correct' : '✗ Wrong'}
                  </span>
                </div>
                {!q.isCorrect && (
                  <div style={{ fontSize: '.82rem', marginBottom: '.5rem' }}>
                    <span style={{ color: 'var(--danger)' }}>Your answer: {q.studentAnswer ?? 'No answer'}</span>
                    <span style={{ margin: '0 .5rem', color: 'var(--text-muted)' }}>|</span>
                    <span style={{ color: 'var(--secondary)' }}>Correct: {q.correctAnswer}</span>
                  </div>
                )}
                {q.explanation && (
                  <div className="xai-explanation" style={{ marginTop: '.5rem' }}>
                    <span className="xai-icon">💡</span>
                    <div><strong style={{ fontSize: '.78rem', color: 'var(--primary)' }}>Explanation: </strong>{q.explanation}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
          <Link to="/student" className="btn btn-outline">← Dashboard</Link>
          <Link to="/recommendations" className="btn btn-primary">🤖 Get AI Recommendations</Link>
        </div>
      </div>
    </div>
  );
}
