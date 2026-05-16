/**
 * pages/TutorDashboard.jsx — FIXED
 *
 * BUGS FIXED:
 * 1. Was calling Flask API with numeric IDs (1–10) — now uses Node.js /api/tutor/*
 * 2. Create course link went to /tutor/courses/create (unregistered) — now registered
 * 3. Used shared/Navbar — now unified Navbar
 * 4. Missing CSS classes — now all in index.css
 */
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

const Spinner = () => (
  <div style={{
    width: 32, height: 32, border: "3px solid var(--border)",
    borderTopColor: "var(--primary)", borderRadius: "50%",
    animation: "spin 0.7s linear infinite", margin: "3rem auto",
  }} />
);

export default function TutorDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/courses/my")
      .then((r) => setCourses(r.data.data || []))
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  }, []);

  const published  = courses.filter((c) => c.isPublished).length;
  const totalStudents = courses.reduce((s, c) => s + (c.enrollmentCount || 0), 0);

  const stats = [
    { icon: "📚", label: "Total Courses",  val: courses.length,  color: "var(--primary)" },
    { icon: "✅", label: "Published",      val: published,       color: "var(--secondary)" },
    { icon: "📝", label: "Drafts",         val: courses.length - published, color: "var(--accent)" },
    { icon: "👥", label: "Total Students", val: totalStudents,   color: "#8B5CF6" },
  ];

  const levelColor = { beginner: "badge-success", intermediate: "badge-warning", advanced: "badge-danger" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #1e1b4b, #7c3aed)",
          borderRadius: "var(--radius-lg)", color: "#fff",
          padding: "2rem", marginBottom: "2rem",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "1rem",
        }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", marginBottom: ".3rem" }}>
              Tutor Dashboard 👨‍🏫
            </h1>
            <p style={{ opacity: .8, fontSize: ".9rem" }}>
              Welcome back, {user?.name}. Manage your courses and students.
            </p>
          </div>
          <Link to="/tutor/courses/create" className="btn"
            style={{ background: "#fff", color: "#7c3aed", fontWeight: 700 }}>
            + Create New Course
          </Link>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: "2rem" }}>
          {stats.map((s) => (
            <div key={s.label} className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: ".85rem" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "var(--radius-sm)",
                background: s.color + "18", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: "1.4rem",
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: ".15rem" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, lineHeight: 1 }}>
                  {s.val}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Courses Table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{
            padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <h2 style={{ fontSize: "1.05rem" }}>My Courses</h2>
            <Link to="/tutor/courses/create" className="btn btn-primary btn-sm">
              + New Course
            </Link>
          </div>

          {loading ? <Spinner /> : courses.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: ".75rem" }}>📭</div>
              <p style={{ fontWeight: 600, marginBottom: ".5rem" }}>No courses yet</p>
              <Link to="/tutor/courses/create" className="btn btn-primary btn-sm">Create your first course</Link>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg)" }}>
                  {["Course", "Category", "Level", "Students", "Status", "Actions"].map((h) => (
                    <th key={h} style={{
                      padding: ".75rem 1.25rem", textAlign: "left",
                      fontSize: ".72rem", color: "var(--text-muted)",
                      fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c._id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: ".9rem 1.25rem" }}>
                      <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{c.title}</div>
                      <div style={{ fontSize: ".72rem", color: "var(--text-muted)" }}>
                        {c.isFree ? "Free" : `$${c.price}`}
                      </div>
                    </td>
                    <td style={{ padding: ".9rem 1.25rem" }}>
                      <span className="badge badge-gray" style={{ textTransform: "capitalize" }}>
                        {c.category?.replace(/-/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: ".9rem 1.25rem" }}>
                      <span className={`badge ${levelColor[c.level] || "badge-gray"}`}>
                        {c.level}
                      </span>
                    </td>
                    <td style={{ padding: ".9rem 1.25rem", fontWeight: 700 }}>
                      {c.enrollmentCount || 0}
                    </td>
                    <td style={{ padding: ".9rem 1.25rem" }}>
                      <span className={`badge ${c.isPublished ? "badge-success" : "badge-gray"}`}>
                        {c.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td style={{ padding: ".9rem 1.25rem" }}>
                      <div style={{ display: "flex", gap: ".4rem" }}>
                        <Link to={`/tutor/courses/${c._id}`} className="btn btn-outline btn-sm">Manage</Link>
                        <Link to={`/tutor/courses/${c._id}`} className="btn btn-primary btn-sm">Quizzes</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
