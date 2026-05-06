/**
 * components/shared/Navbar.jsx
 */

import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function isActive(path) {
    return location.pathname.startsWith(path) ? "nav-link active" : "nav-link";
  }

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">◈</span>
        <span className="brand-name">LearnAI</span>
      </div>

      <div className="navbar-links">
        {user.role === "student" && (
          <>
            <Link className={isActive("/dashboard")}  to="/dashboard">Dashboard</Link>
            <Link className={isActive("/learn")}      to="/learn">My Learning</Link>
            <Link className={isActive("/progress")}   to="/progress">Progress</Link>
          </>
        )}
        {user.role === "teacher" && (
          <>
            <Link className={isActive("/teacher")}    to="/teacher">Overview</Link>
            <Link className={isActive("/students")}   to="/students">Students</Link>
          </>
        )}
      </div>

      <div className="navbar-user">
        <span className="user-name">{user.name}</span>
        <span className="user-role">{user.role}</span>
        <button className="logout-btn" onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  );
}
