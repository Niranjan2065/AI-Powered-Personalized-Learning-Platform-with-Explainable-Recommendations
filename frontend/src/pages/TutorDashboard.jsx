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
import ResourceSubmissionForm from "../components/teacher/ResourceSubmissionForm";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

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
  const [showAnalytics, setShowAnalytics] = useState(true);

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

  const enrollmentData = courses.map((c) => ({
    name: c.title.length > 15 ? c.title.slice(0, 15) + "..." : c.title,
    Students: c.enrollmentCount || 0,
    fullName: c.title
  }));

  const levelCounts = { beginner: 0, intermediate: 0, advanced: 0 };
  courses.forEach((c) => {
    if (levelCounts[c.level] !== undefined) levelCounts[c.level]++;
    else levelCounts.beginner++;
  });

  const levelData = [
    { name: "Beginner", value: levelCounts.beginner, color: "#10B981" },
    { name: "Intermediate", value: levelCounts.intermediate, color: "#F59E0B" },
    { name: "Advanced", value: levelCounts.advanced, color: "#EF4444" },
  ].filter(d => d.value > 0);

  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: "rgba(30, 27, 75, 0.95)",
          backdropFilter: "blur(8px)",
          border: "1px solid var(--border)",
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-sm)",
          color: "#fff",
          boxShadow: "var(--shadow)"
        }}>
          <p style={{ fontWeight: 700, margin: 0, fontSize: "0.82rem", color: "var(--accent)" }}>{data.fullName}</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem" }}>
            Students Enrolled: <strong style={{ color: "#34D399", fontSize: "0.9rem" }}>{payload[0].value}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

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
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {!loading && courses.length > 0 && (
              <button onClick={() => setShowAnalytics(!showAnalytics)} className="btn btn-outline"
                style={{ borderColor: "rgba(255,255,255,.3)", color: "#fff", fontWeight: 600 }}>
                {showAnalytics ? "🙈 Hide Charts" : "📊 Show Charts"}
              </button>
            )}
            <Link to="/tutor/courses/create" className="btn"
              style={{ background: "#fff", color: "#7c3aed", fontWeight: 700 }}>
              + Create New Course
            </Link>
          </div>
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

        {/* Suggest a learning resource for a weak topic */}
        <ResourceSubmissionForm />

        {/* Analytics Panel */}
        {!loading && courses.length > 0 && showAnalytics && (
          <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
            {/* Enrollment Bar Chart */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "1rem" }}>👥 Course Enrollment Analytics</h3>
              <div style={{ width: "100%", height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollmentData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="Students" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                      {enrollmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "var(--primary)" : "#8B5CF6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Level Distribution Pie Chart */}
            <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.5rem" }}>📊 Course Difficulty Spread</h3>
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={levelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {levelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(30, 27, 75, 0.95)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        color: "#fff",
                        fontSize: "0.75rem"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.75rem", fontWeight: 600 }}>
                {levelData.map((entry) => (
                  <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }} />
                    <span style={{ color: "var(--text-muted)" }}>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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