/**
 * pages/LoginPage.jsx — FIXED
 *
 * BUG FIXED: Was calling login(form.email, form.password) but old AuthContext
 *            login(userData) expected an already-built user object.
 *            Now AuthContext.login() accepts (email, pw) — fully wired.
 */
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/common/Navbar";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      toast.success(`Welcome back, ${data.user.name}! 👋`);
      const dest =
        data.user.role === "admin"  ? "/admin"
        : data.user.role === "tutor" || data.user.role === "teacher" ? "/tutor"
        : "/student";
      navigate(dest);
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    const creds = {
      admin:   { email: "admin@ailearn.com",   password: "password123" },
      tutor:   { email: "tutor@ailearn.com",   password: "password123" },
      student: { email: "student@ailearn.com", password: "password123" },
    };
    setForm(creds[role]);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "3rem 1.5rem", minHeight: "calc(100vh - 64px)",
        background: "linear-gradient(135deg, #EEF2FF 0%, #F8F7FF 60%, #D1FAE5 100%)",
      }}>
        <div className="card" style={{ width: "100%", maxWidth: 440, padding: "2.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: ".5rem" }}>🎓</div>
            <h1 style={{ fontSize: "1.5rem", marginBottom: ".25rem" }}>Welcome Back</h1>
            <p style={{ color: "var(--text-muted)", fontSize: ".875rem" }}>
              Sign in to continue learning
            </p>
          </div>

          {/* Demo Buttons */}
          <div style={{
            background: "var(--bg)", borderRadius: "var(--radius-sm)",
            padding: "1rem", marginBottom: "1.5rem",
          }}>
            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", marginBottom: ".5rem", fontWeight: 600 }}>
              🎭 Quick Demo Login:
            </p>
            <div style={{ display: "flex", gap: ".5rem" }}>
              {["student", "tutor", "admin"].map((r) => (
                <button key={r} onClick={() => fillDemo(r)}
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, fontSize: ".72rem", textTransform: "capitalize" }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Your password" required />
            </div>
            <button type="submit" className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: ".5rem" }}
              disabled={loading}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: ".875rem", color: "var(--text-muted)" }}>
            New here?{" "}
            <Link to="/register" style={{ fontWeight: 600, color: "var(--primary)" }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
