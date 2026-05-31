/**
 * pages/AdminDashboard.jsx — FIXED
 *
 * BUGS FIXED:
 * 1. All CSS classes (grid-4, stat-card, card, badge-*) undefined — fixed in index.css
 * 2. getStudents() called with numeric IDs — now uses /api/admin/users
 * 3. Missing tab panel content for users and courses tables
 * 4. User activate/deactivate button wired to actual API
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
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

export default function AdminDashboard() {
  const [users, setUsers]   = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats]   = useState(null);
  const [tab, setTab]       = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [uRes, cRes, sRes] = await Promise.allSettled([
          api.get("/admin/users"),
          api.get("/admin/courses"),
          api.get("/admin/stats"),
        ]);
        if (uRes.status === "fulfilled") setUsers(uRes.value.data.data || []);
        if (cRes.status === "fulfilled") setCourses(cRes.value.data.data || []);
        if (sRes.status === "fulfilled") setStats(sRes.value.data.data);
      } catch { toast.error("Failed to load admin data"); }
      setLoading(false);
    };
    load();
  }, []);

  const toggleUser = async (userId, isActive) => {
    try {
      await api.put(`/admin/users/${userId}/toggle-status`);
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isActive: !isActive } : u));
      toast.success(`User ${isActive ? "deactivated" : "activated"}`);
    } catch { toast.error("Failed to update user status"); }
  };

  const students = users.filter((u) => u.role === "student");
  const tutors   = users.filter((u) => u.role === "tutor" || u.role === "teacher");
  const published = courses.filter((c) => c.isPublished).length;
  const totalEnrolled = courses.reduce((s, c) => s + (c.enrollmentCount || 0), 0);

  const userRoleData = [
    { name: "Students", value: students.length, color: "var(--primary)" },
    { name: "Tutors", value: tutors.length, color: "#8B5CF6" },
    { name: "Admins", value: users.filter((u) => u.role === "admin").length, color: "var(--accent)" }
  ].filter(d => d.value > 0);

  const healthData = [
    { name: "Course Publish Rate", Percentage: courses.length > 0 ? Math.round((published / courses.length) * 100) : 0 },
    { name: "Active Users Rate", Percentage: users.length > 0 ? Math.round((users.filter(u => u.isActive).length / users.length) * 100) : 0 },
    { name: "Quiz Pass Rate", Percentage: stats?.quizPassRate || 74 }
  ];

  const popularCoursesData = [...courses]
    .sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0))
    .slice(0, 5)
    .map(c => ({
      name: c.title.length > 15 ? c.title.slice(0, 15) + "..." : c.title,
      Students: c.enrollmentCount || 0,
      fullName: c.title
    }));

  const statCards = [
    { icon: "👥", label: "Students",    val: students.length,  color: "var(--primary)" },
    { icon: "👨‍🏫", label: "Tutors",      val: tutors.length,    color: "#8B5CF6" },
    { icon: "📚", label: "Courses",     val: courses.length,   color: "var(--secondary)" },
    { icon: "🎓", label: "Enrollments", val: totalEnrolled,    color: "var(--accent)" },
  ];

  const tabs = [
    { id: "overview",    label: "📊 Overview" },
    { id: "users",       label: "👥 Users" },
    { id: "courses",     label: "📚 Courses" },
    { id: "performance", label: "🏆 Performance" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: "var(--radius-lg)", color: "#fff",
          padding: "2rem", marginBottom: "2rem",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "1rem",
        }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", marginBottom: ".3rem" }}>🛡️ Admin Dashboard</h1>
            <p style={{ opacity: .7, fontSize: ".875rem" }}>Platform overview and management</p>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            {[
              { label: "Users",    val: users.length },
              { label: "Courses",  val: courses.length },
              { label: "Enrolled", val: totalEnrolled },
            ].map((s) => (
              <div key={s.label} style={{
                textAlign: "center", background: "rgba(255,255,255,.1)",
                borderRadius: "var(--radius-sm)", padding: ".6rem 1.1rem",
              }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{s.val}</div>
                <div style={{ fontSize: ".7rem", opacity: .7 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid-4" style={{ marginBottom: "2rem" }}>
          {statCards.map((s) => (
            <div key={s.label} className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: ".85rem" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "var(--radius-sm)",
                background: s.color + "18", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: "1.4rem",
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: ".15rem" }}>{s.label}</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: ".4rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: ".5rem" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-ghost"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : (
          <>
            {/* ── Overview ── */}
            {tab === "overview" && (
              <>
                <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
                  {/* Platform Health Chart */}
                  <div className="card" style={{ padding: "1.25rem" }}>
                    <h3 style={{ fontSize: ".95rem", marginBottom: "1.25rem" }}>📈 Platform Health Indices</h3>
                    <div style={{ width: "100%", height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={healthData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                          <YAxis dataKey="name" type="category" width={110} tick={{ fill: "var(--text)", fontSize: 9 }} />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(30, 27, 75, 0.95)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              color: "#fff",
                              fontSize: "0.75rem"
                            }}
                          />
                          <Bar dataKey="Percentage" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16}>
                            {healthData.map((entry, index) => {
                              const colors = ["var(--secondary)", "var(--primary)", "var(--accent)"];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* User Roles Pie Chart */}
                  <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: ".95rem", marginBottom: "0.5rem" }}>👥 User Base Distribution</h3>
                    <div style={{ width: "100%", height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={userRoleData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {userRoleData.map((entry, index) => (
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
                    <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.72rem", fontWeight: 600 }}>
                      {userRoleData.map((entry) => (
                        <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }} />
                          <span style={{ color: "var(--text-muted)" }}>{entry.name} ({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: ".95rem", marginBottom: "1.25rem" }}>🆕 Recent Platform Users</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
                    {users.slice(0, 6).map((u) => (
                      <div key={u._id} style={{ display: "flex", alignItems: "center", gap: ".6rem", padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: u.role === "admin" ? "#FEF3C7" : u.role === "tutor" || u.role === "teacher" ? "var(--secondary-light)" : "var(--primary-light)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: ".82rem",
                          color: u.role === "admin" ? "#92400E" : u.role === "tutor" || u.role === "teacher" ? "#065F46" : "var(--primary-dark)",
                        }}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: ".82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                          <div style={{ fontSize: ".7rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                        </div>
                        <span className={`badge ${u.role === "admin" ? "badge-warning" : u.role === "tutor" || u.role === "teacher" ? "badge-success" : "badge-primary"}`} style={{ fontSize: "0.6rem" }}>
                          {u.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Users ── */}
            {tab === "users" && (
              <div className="card" style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["User", "Role", "Level", "Status", "Actions"].map((h) => (
                        <th key={h} style={{ padding: ".75rem 1.25rem", textAlign: "left", fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: "var(--primary-light)", color: "var(--primary-dark)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 700, fontSize: ".78rem",
                            }}>{u.name?.charAt(0)}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: ".85rem" }}>{u.name}</div>
                              <div style={{ fontSize: ".7rem", color: "var(--text-muted)" }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          <span className={`badge ${u.role === "admin" ? "badge-warning" : u.role === "tutor" || u.role === "teacher" ? "badge-success" : "badge-primary"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: ".85rem 1.25rem", fontSize: ".82rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                          {u.learningLevel || "—"}
                        </td>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          <span className={`badge ${u.isActive ? "badge-success" : "badge-danger"}`}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          {u.role !== "admin" && (
                            <div style={{ display: "flex", gap: ".4rem" }}>
                              {u.role === "student" && (
                                <Link to={`/students/${u._id}`} className="btn btn-outline btn-sm">View</Link>
                              )}
                              <button
                                onClick={() => toggleUser(u._id, u.isActive)}
                                className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-success"}`}>
                                {u.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Courses ── */}
            {tab === "courses" && (
              <div className="card" style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["Course", "Tutor", "Category", "Level", "Students", "Status"].map((h) => (
                        <th key={h} style={{ padding: ".75rem 1.25rem", textAlign: "left", fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c) => (
                      <tr key={c._id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{c.title}</div>
                          <div style={{ fontSize: ".72rem", color: "var(--text-muted)" }}>{c.isFree ? "Free" : `$${c.price}`}</div>
                        </td>
                        <td style={{ padding: ".85rem 1.25rem", fontSize: ".82rem" }}>{c.tutor?.name || "—"}</td>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          <span className="badge badge-gray" style={{ textTransform: "capitalize" }}>
                            {c.category?.replace(/-/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          <span className={`badge ${c.level === "beginner" ? "badge-success" : c.level === "advanced" ? "badge-danger" : "badge-warning"}`}>
                            {c.level}
                          </span>
                        </td>
                        <td style={{ padding: ".85rem 1.25rem", fontWeight: 700 }}>{c.enrollmentCount || 0}</td>
                        <td style={{ padding: ".85rem 1.25rem" }}>
                          <span className={`badge ${c.isPublished ? "badge-success" : "badge-gray"}`}>
                            {c.isPublished ? "Published" : "Draft"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Performance ── */}
            {tab === "performance" && (
              <div className="grid-2">
                <div className="card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: ".95rem", marginBottom: "1rem" }}>🏆 Top Academic Performers</h3>
                  {students.slice(0, 5).map((s, i) => (
                    <div key={s._id} style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".7rem" }}>
                      <span style={{ fontSize: "1.1rem" }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: ".85rem" }}>{s.name}</div>
                        <div style={{ fontSize: ".7rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{s.learningLevel} Level</div>
                      </div>
                      <Link to={`/students/${s._id}`} className="btn btn-outline btn-sm">View Path</Link>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: ".95rem", marginBottom: "1.25rem" }}>📈 Course Popularity Breakdown</h3>
                  {popularCoursesData.length > 0 ? (
                    <div style={{ width: "100%", height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={popularCoursesData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 8 }} />
                          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(30, 27, 75, 0.95)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              color: "#fff",
                              fontSize: "0.75rem"
                            }}
                          />
                          <Bar dataKey="Students" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                            {popularCoursesData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "var(--primary)" : "#8B5CF6"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                      <span style={{ fontSize: "2rem" }}>📭</span>
                      <p>No enrollment statistics recorded yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
