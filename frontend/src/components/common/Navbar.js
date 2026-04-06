// src/components/common/Navbar.js
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const dashboardLink = user
    ? user.role === 'admin' ? '/admin'
    : user.role === 'tutor' ? '/tutor'
    : '/student'
    : null;

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={styles.nav}>
      <div className="container" style={styles.inner}>
        {/* Logo */}
        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}>🎓</span>
          <span style={styles.logoText}>AI<span style={{ color: 'var(--primary)' }}>Learn</span></span>
        </Link>

        {/* Desktop Nav Links */}
        <div style={styles.links}>
          <Link to="/courses" style={{ ...styles.link, ...(isActive('/courses') ? styles.linkActive : {}) }}>
            Courses
          </Link>
          {user && (
            <Link to={dashboardLink} style={{ ...styles.link, ...(isActive(dashboardLink) ? styles.linkActive : {}) }}>
              Dashboard
            </Link>
          )}
          {user?.role === 'student' && (
            <Link to="/recommendations" style={{ ...styles.link, ...(isActive('/recommendations') ? styles.linkActive : {}) }}>
              🤖 AI Path
            </Link>
          )}
        </div>

        {/* Auth Buttons */}
        <div style={styles.authArea}>
          {user ? (
            <div style={styles.userMenu}>
              <div style={styles.avatar}>{user.name?.charAt(0).toUpperCase()}</div>
              <div style={styles.userInfo}>
                <span style={styles.userName}>{user.name}</span>
                <span style={styles.userRole}>{user.role}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ marginLeft: '1rem' }}>
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    background: '#fff',
    borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 1px 8px rgba(0,0,0,.06)',
  },
  inner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: '64px',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: '.5rem',
    textDecoration: 'none', color: 'var(--text-primary)',
  },
  logoIcon: { fontSize: '1.5rem' },
  logoText: { fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Plus Jakarta Sans' },
  links: { display: 'flex', alignItems: 'center', gap: '1.75rem' },
  link: {
    color: 'var(--text-secondary)', fontWeight: 500, fontSize: '.9rem',
    textDecoration: 'none', transition: 'color .2s',
    padding: '.25rem 0', borderBottom: '2px solid transparent',
  },
  linkActive: { color: 'var(--primary)', borderBottomColor: 'var(--primary)' },
  authArea: { display: 'flex', alignItems: 'center' },
  userMenu: { display: 'flex', alignItems: 'center', gap: '.75rem' },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '.95rem',
  },
  userInfo: { display: 'flex', flexDirection: 'column', lineHeight: 1.2 },
  userName: { fontWeight: 600, fontSize: '.875rem', color: 'var(--text-primary)' },
  userRole: { fontSize: '.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' },
};
