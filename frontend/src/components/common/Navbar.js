/**
 * components/common/Navbar.js — v2 Redesign
 * ✨ Glassmorphic sticky nav, dark mode toggle, user dropdown, smooth animations
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [dropOpen,    setDropOpen]    = useState(false);
  const [scrolled,    setScrolled]    = useState(false);
  const [darkMode,    setDarkMode]    = useState(() => localStorage.getItem('theme') === 'dark');
  const dropRef = useRef(null);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Restore theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropOpen(false);
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const isActive = (path) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const dashLink =
    !user ? null
    : user.role === 'admin'  ? '/admin'
    : user.role === 'tutor' || user.role === 'teacher' ? '/tutor'
    : '/student';

  const linkStyle = (path) => ({
    color: isActive(path) ? 'var(--primary)' : 'var(--text-secondary)',
    fontWeight: isActive(path) ? 700 : 500,
    fontSize: '.875rem',
    textDecoration: 'none',
    padding: '.3rem .1rem',
    borderBottom: `2px solid ${isActive(path) ? 'var(--primary)' : 'transparent'}`,
    transition: 'all .2s',
    whiteSpace: 'nowrap',
  });

  // Role → avatar gradient
  const avatarGrad =
    user?.role === 'admin'  ? 'linear-gradient(135deg,#F59E0B,#EF4444)' :
    user?.role === 'tutor'  ? 'linear-gradient(135deg,#10B981,#3B82F6)' :
                              'linear-gradient(135deg,#6C63FF,#764ba2)';

  return (
    <nav style={{
      position:       'sticky',
      top:            0,
      zIndex:         200,
      background:     'var(--nav-bg)',
      backdropFilter: `blur(var(--nav-blur))`,
      WebkitBackdropFilter: `blur(var(--nav-blur))`,
      borderBottom:   '1px solid var(--glass-border)',
      boxShadow:      scrolled ? 'var(--shadow)' : 'none',
      transition:     'box-shadow .3s ease',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 66,
      }}>

        {/* ── Logo ─────────────────────────────────────────── */}
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: '.5rem',
          textDecoration: 'none', color: 'var(--text-primary)',
          fontWeight: 800, fontSize: '1.2rem',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--grad-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(108,99,255,0.35)',
            flexShrink: 0,
          }}>
            🎓
          </div>
          <span>
            AI<span style={{ color: 'var(--primary)' }}>Learn</span>
          </span>
        </Link>

        {/* ── Desktop Nav Links ─────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2rem',
        }}>
          <Link to="/courses" style={linkStyle('/courses')}>Courses</Link>

          {user && dashLink && (
            <Link to={dashLink} style={linkStyle(dashLink)}>Dashboard</Link>
          )}

          {user?.role === 'student' && (
            <Link to="/recommendations" style={linkStyle('/recommendations')}>
              <span style={{
                background: 'var(--grad-primary)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', fontWeight: 700,
              }}>
                🤖 AI Path
              </span>
            </Link>
          )}
        </div>

        {/* ── Right Side ───────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1.5px solid var(--border)',
              background: 'var(--surface-2)',
              cursor: 'pointer', fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .2s',
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {user ? (
            <div ref={dropRef} style={{ position: 'relative' }}>
              {/* Avatar trigger */}
              <button
                onClick={() => setDropOpen(d => !d)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '.6rem',
                  background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                  borderRadius: 12, padding: '.35rem .75rem .35rem .35rem',
                  cursor: 'pointer', transition: 'all .2s',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: avatarGrad,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: '.9rem',
                  flexShrink: 0,
                }}>
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user.name?.split(' ')[0]}
                  </div>
                  <div style={{
                    fontSize: '.67rem', fontWeight: 600, textTransform: 'capitalize',
                    color: 'var(--primary)',
                  }}>
                    {user.role}
                  </div>
                </div>
                <span style={{
                  fontSize: '.65rem', color: 'var(--text-muted)',
                  transition: 'transform .2s',
                  transform: dropOpen ? 'rotate(180deg)' : 'none',
                }}>▼</span>
              </button>

              {/* Dropdown */}
              {dropOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: var_radius,
                  boxShadow: 'var(--shadow-lg)',
                  minWidth: 200, overflow: 'hidden',
                  animation: 'fadeInDown .2s ease',
                  zIndex: 300,
                }}>
                  {/* User info header */}
                  <div style={{
                    padding: '1rem', borderBottom: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text-primary)' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                      {user.email}
                    </div>
                  </div>

                  {/* Menu items */}
                  {[
                    dashLink && { icon: '🏠', label: 'Dashboard', to: dashLink },
                    user.role === 'student' && { icon: '🤖', label: 'AI Recommendations', to: '/recommendations' },
                    user.role === 'student' && { icon: '📚', label: 'My Courses', to: '/courses' },
                  ].filter(Boolean).map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={() => setDropOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '.65rem',
                        padding: '.75rem 1rem', fontSize: '.875rem',
                        color: 'var(--text-secondary)', fontWeight: 500,
                        borderBottom: '1px solid var(--border)',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{item.icon}</span> {item.label}
                    </Link>
                  ))}

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', padding: '.75rem 1rem',
                      display: 'flex', alignItems: 'center', gap: '.65rem',
                      background: 'none', border: 'none',
                      fontSize: '.875rem', fontWeight: 600,
                      color: 'var(--danger)', cursor: 'pointer',
                      transition: 'background .15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started →</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// tiny helper to avoid template literal issues
const var_radius = 'var(--radius)';
