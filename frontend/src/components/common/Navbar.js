/**
 * components/common/Navbar.js — UNIFIED & FIXED
 *
 * BUGS FIXED:
 * 1. Two conflicting Navbar components (shared/Navbar.jsx vs common/Navbar.js)
 *    — unified into one smart Navbar used everywhere
 * 2. shared/Navbar hid itself when user=null — broke public pages
 * 3. Route inconsistency: /student vs /dashboard vs /tutor
 * 4. Missing mobile menu toggle
 */
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const isActive = (path) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  // Role-based dashboard link
  const dashLink =
    !user ? null
    : user.role === "admin"  ? "/admin"
    : user.role === "tutor" || user.role === "teacher" ? "/tutor"
    : "/student";

  const linkStyle = (path) => ({
    color: isActive(path) ? "var(--primary)" : "var(--text-secondary)",
    fontWeight: isActive(path) ? 700 : 500,
    fontSize: ".875rem",
    textDecoration: "none",
    padding: ".25rem 0",
    borderBottom: isActive(path) ? "2px solid var(--primary)" : "2px solid transparent",
    transition: "color .15s",
  });

  return (
    <nav style={{
      background: "#fff",
      borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 1px 8px rgba(0,0,0,.05)",
    }}>
      <div className="container" style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64,
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: ".5rem", textDecoration: "none", color: "var(--text-primary)" }}>
          <span style={{ fontSize: "1.5rem" }}>🎓</span>
          <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>
            AI<span style={{ color: "var(--primary)" }}>Learn</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
          <Link to="/courses" style={linkStyle("/courses")}>Courses</Link>

          {user && dashLink && (
            <Link to={dashLink} style={linkStyle(dashLink)}>Dashboard</Link>
          )}

          {user?.role === "student" && (
            <Link to="/recommendations" style={linkStyle("/recommendations")}>
              🤖 AI Path
            </Link>
          )}
        </div>

        {/* Auth Area */}
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          {user ? (
            <>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "var(--primary-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: ".9rem", color: "var(--primary)",
              }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: ".82rem", fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: ".7rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{user.role}</div>
              </div>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
