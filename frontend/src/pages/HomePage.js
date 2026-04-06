// src/pages/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';

const features = [
  { icon: '🤖', title: 'AI-Powered Recommendations', desc: 'Our intelligent engine analyzes your quiz results and learning patterns to suggest personalized lessons tailored just for you.' },
  { icon: '💡', title: 'Explainable AI (XAI)', desc: "We don't just recommend — we explain WHY. You'll always know which weak topics led to each recommendation." },
  { icon: '📊', title: 'Real-time Progress Tracking', desc: 'Track completion percentage, time spent, quiz scores, and topic-level performance across all your enrolled courses.' },
  { icon: '🎓', title: 'Expert Tutors', desc: 'Learn from experienced tutors who create structured courses with modules, lessons (video/text/PDF), and quizzes.' },
  { icon: '📝', title: 'Interactive Quizzes', desc: 'Test your knowledge with multiple choice, true/false, and short answer quizzes. Detailed explanations after each attempt.' },
  { icon: '🔒', title: 'Secure & Role-based', desc: 'JWT-secured platform with distinct student, tutor, and admin roles — each with their own tailored experience.' },
];

export default function HomePage() {
  return (
    <div>
      <Navbar />

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '6rem 0', color: '#fff', textAlign: 'center',
      }}>
        <div className="container">
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,.15)', borderRadius: 99, padding: '.4rem 1rem', fontSize: '.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
            🚀 Powered by Explainable AI
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, marginBottom: '1.25rem', lineHeight: 1.1 }}>
            Learn Smarter with<br />
            <span style={{ color: '#A5F3FC' }}>AI-Personalized</span> Education
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: .9, maxWidth: 580, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            A complete EdTech platform where AI analyzes your performance and builds a personalized learning path — with transparent explanations for every recommendation.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-lg" style={{ background: '#fff', color: '#667eea', fontWeight: 700 }}>
              Start Learning Free →
            </Link>
            <Link to="/courses" className="btn btn-lg btn-outline" style={{ borderColor: 'rgba(255,255,255,.6)', color: '#fff' }}>
              Browse Courses
            </Link>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginTop: '3.5rem', flexWrap: 'wrap' }}>
            {[['AI-Powered', 'Recommendations'], ['Explainable', 'Why each suggestion'], ['Real-time', 'Progress tracking']].map(([big, small]) => (
              <div key={big} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{big}</div>
                <div style={{ fontSize: '.8rem', opacity: .75 }}>{small}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '5rem 0', background: '#fff' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '.75rem' }}>Everything You Need to Learn</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto' }}>
              A complete learning ecosystem powered by modern AI with full transparency
            </p>
          </div>
          <div className="grid-3">
            {features.map((f, i) => (
              <div key={i} className="card" style={{ padding: '1.75rem', transition: 'transform .2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '.5rem' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '5rem 0', background: 'var(--bg)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '.75rem' }}>How It Works</h2>
            <p style={{ color: 'var(--text-muted)' }}>The AI-powered learning cycle</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            {['Enroll in a Course', 'Study Lessons', 'Take Quizzes', 'AI Analyzes Results', 'Get Personalized Path'].map((step, i) => (
              <React.Fragment key={i}>
                <div style={{ textAlign: 'center', maxWidth: 120 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', fontWeight: 800, margin: '0 auto .75rem',
                  }}>{i + 1}</div>
                  <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{step}</div>
                </div>
                {i < 4 && <div style={{ color: 'var(--primary)', fontSize: '1.5rem', opacity: .4 }}>→</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '5rem 0', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Ready to Learn Smarter?</h2>
          <p style={{ opacity: .85, marginBottom: '2rem', maxWidth: 400, margin: '0 auto 2rem' }}>
            Join thousands of students getting AI-personalized learning recommendations.
          </p>
          <Link to="/register" className="btn btn-lg" style={{ background: '#fff', color: '#667eea', fontWeight: 700 }}>
            Create Free Account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F172A', color: 'rgba(255,255,255,.5)', padding: '2rem 0', textAlign: 'center', fontSize: '.85rem' }}>
        <div className="container">
          <p>© 2025 AILearn — AI-Powered Personalized Learning Platform</p>
        </div>
      </footer>
    </div>
  );
}
