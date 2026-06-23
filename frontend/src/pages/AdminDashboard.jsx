/**
 * pages/AdminDashboard.jsx — Phase 4: Tutor Application Review integrated
 * Resume link fix: restored broken <a> tag for resume download
 */
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
import axios from "axios";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from "recharts";

const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Spinner = () => (
  <div style={{
    width: 32, height: 32, border: "3px solid var(--border)",
    borderTopColor: "var(--primary)", borderRadius: "50%",
    animation: "spin 0.7s linear infinite", margin: "3rem auto",
  }} />
);

const STATUS_META = {
  pending:      { bg: "#FEF3C7", color: "#92400E", border: "#F59E0B", label: "⏳ Pending" },
  under_review: { bg: "#DBEAFE", color: "#1E40AF", border: "#93C5FD", label: "🔍 Under Review" },
  approved:     { bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7", label: "✅ Approved" },
  rejected:     { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5", label: "❌ Rejected" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{
      padding: ".2rem .6rem", borderRadius: 99, fontSize: ".68rem",
      fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
};

// ── Application Review Modal ──────────────────────────────────────────────────
function ApplicationModal({ app, onClose, onDecision }) {
  const [feedback,     setFeedback]     = useState(app.adminFeedback || "");
  const [internalNote, setInternalNote] = useState(app.internalNote  || "");
  const [submitting,   setSubmitting]   = useState(false);
  const u        = app.user || {};
  const canDecide = ["pending", "under_review"].includes(app.status);

  const decide = async (status) => {
    if (status === "rejected" && !feedback.trim())
      return toast.error("Feedback is required before rejecting");
    setSubmitting(true);
    try {
      await api.patch(`/applications/${app._id}/status`, { status, adminFeedback: feedback, internalNote });
      toast.success(`Application ${status}`);
      onDecision();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }} onClick={onClose}>
      <div style={{
        background: "var(--card)", borderRadius: 16, width: "100%", maxWidth: 660,
        maxHeight: "90vh", overflowY: "auto", padding: "2rem",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", margin: 0, marginBottom: ".3rem" }}>👨‍🏫 {u.name}</h2>
            <div style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>{u.email}</div>
            <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem", flexWrap: "wrap" }}>
              <StatusBadge status={app.status} />
              <span style={{ fontSize: ".7rem", color: "var(--text-muted)" }}>
                Applied {new Date(app.createdAt).toLocaleDateString("en-GB",
                  { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {app.attemptNumber > 1 && (
                <span style={{
                  fontSize: ".68rem", background: "#FEF3C7", color: "#92400E",
                  padding: ".1rem .4rem", borderRadius: 99, fontWeight: 600,
                }}>
                  Re-application #{app.attemptNumber}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "1.25rem", color: "var(--text-muted)",
          }}>✕</button>
        </div>

        {/* Details grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".65rem", marginBottom: "1.25rem" }}>
          {[
            ["🎓 Qualification", app.highestQualification],
            ["📅 Experience",    `${app.yearsOfExperience} year${app.yearsOfExperience !== 1 ? "s" : ""}`],
            ["💼 Area",          app.areaOfExpertise],
            ["🔧 Skills",        app.specificSkills],
          ].map(([label, val]) => (
            <div key={label} style={{
              background: "var(--bg)", border: "1px solid var(--border)",
              borderRadius: 8, padding: ".65rem .85rem",
            }}>
              <div style={{ fontSize: ".65rem", color: "var(--text-muted)", marginBottom: ".15rem" }}>{label}</div>
              <div style={{ fontSize: ".82rem", fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Links — LinkedIn, Portfolio, Resume */}
        <div style={{ display: "flex", gap: ".6rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {app.linkedinUrl && (
            <a href={app.linkedinUrl} target="_blank" rel="noreferrer"
              className="btn btn-outline btn-sm" style={{ fontSize: ".76rem" }}>
              🔗 LinkedIn
            </a>
          )}
          {app.portfolioUrl && (
            <a href={app.portfolioUrl} target="_blank" rel="noreferrer"
              className="btn btn-outline btn-sm" style={{ fontSize: ".76rem" }}>
              🌐 Portfolio
            </a>
          )}
          {/* ── FIX: restored missing opening <a tag ── */}
          {app.resumeUrl && (
            <a
              href={`${API_BASE}/${app.resumeUrl}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ fontSize: ".76rem" }}
            >
              📄 {app.resumeFileName || "View Resume"}
            </a>
          )}
        </div>

        {/* Teaching statement */}
        <div style={{
          background: "#F8FAFC", border: "1px solid var(--border)",
          borderRadius: 8, padding: "1rem", marginBottom: "1.25rem",
        }}>
          <div style={{
            fontSize: ".68rem", fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".5rem",
          }}>
            Teaching Statement
          </div>
          <div style={{ fontSize: ".83rem", lineHeight: 1.7 }}>{app.teachingStatement}</div>
        </div>

        {/* Decision area */}
        {canDecide ? (
          <>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem", marginBottom: "1rem" }}>
              <div style={{
                fontSize: ".75rem", fontWeight: 700, color: "var(--text-secondary)",
                textTransform: "uppercase", marginBottom: ".75rem",
              }}>Admin Decision</div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: ".8rem" }}>
                  Feedback to Applicant
                  <span style={{ color: "var(--danger)", margin: "0 .2rem" }}>*</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                    (required for rejection, recommended for approval)
                  </span>
                </label>
                <textarea className="form-control" rows={3}
                  style={{ resize: "vertical", fontSize: ".83rem" }}
                  value={feedback} onChange={e => setFeedback(e.target.value)}
                  placeholder="e.g. 'Your qualifications are excellent — welcome aboard!' or specific improvement notes for rejection." />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: ".8rem" }}>
                  Internal Note{" "}
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(not shown to applicant)</span>
                </label>
                <textarea className="form-control" rows={2}
                  style={{ resize: "vertical", fontSize: ".83rem" }}
                  value={internalNote} onChange={e => setInternalNote(e.target.value)}
                  placeholder="Optional private admin notes…" />
              </div>
            </div>

            <div style={{ display: "flex", gap: ".65rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn btn-outline" style={{ fontSize: ".83rem" }}
                onClick={() => decide("under_review")} disabled={submitting}>
                🔍 Mark Under Review
              </button>
              <button style={{
                padding: ".45rem 1.1rem", borderRadius: "var(--radius-sm)",
                background: "#DC2626", color: "#fff", border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: ".83rem", opacity: submitting ? .6 : 1,
              }} onClick={() => decide("rejected")} disabled={submitting}>
                ❌ Reject
              </button>
              <button className="btn btn-primary" style={{ fontSize: ".83rem" }}
                onClick={() => decide("approved")} disabled={submitting}>
                {submitting ? "Saving…" : "✅ Approve"}
              </button>
            </div>
          </>
        ) : (
          app.adminFeedback && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <div style={{
                fontSize: ".68rem", fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", marginBottom: ".4rem",
              }}>Feedback Sent</div>
              <div style={{
                fontSize: ".83rem", lineHeight: 1.65, background: "var(--bg)",
                borderRadius: 8, padding: ".75rem",
              }}>{app.adminFeedback}</div>
              {app.reviewedBy && (
                <div style={{ fontSize: ".7rem", color: "var(--text-muted)", marginTop: ".4rem" }}>
                  Reviewed by {app.reviewedBy.name} on{" "}
                  {new Date(app.reviewedAt).toLocaleDateString("en-GB",
                    { day: "numeric", month: "short", year: "numeric" })}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [users,          setUsers]          = useState([]);
  const [courses,        setCourses]        = useState([]);
  const [stats,          setStats]          = useState(null);
  const [applications,   setApplications]   = useState([]);
  const [appSummary,     setAppSummary]     = useState({ pending:0, under_review:0, approved:0, rejected:0 });
  const [appTab,         setAppTab]         = useState("pending");
  const [selectedApp,    setSelectedApp]    = useState(null);
  const [tab,            setTab]            = useState("overview");
  const [loading,        setLoading]        = useState(true);
  const [userSearch,     setUserSearch]     = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const [uRes, cRes, sRes, aRes] = await Promise.allSettled([
        api.get("/admin/users"),
        api.get("/admin/courses"),
        api.get("/admin/stats"),
        api.get("/applications?limit=100"),
      ]);
      if (uRes.status === "fulfilled") setUsers(uRes.value.data.data || []);
      if (cRes.status === "fulfilled") setCourses(cRes.value.data.data || []);
      if (sRes.status === "fulfilled") setStats(sRes.value.data.data);
      if (aRes.status === "fulfilled") {
        setApplications(aRes.value.data.data || []);
        setAppSummary(aRes.value.data.summary || {});
      }
    } catch { toast.error("Failed to load admin data"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadApplications = useCallback(async () => {
    try {
      const { data } = await api.get(`/applications?status=${appTab}&limit=100`);
      setApplications(data.data || []);
      setAppSummary(data.summary || {});
    } catch { toast.error("Failed to load applications"); }
  }, [appTab]);

  useEffect(() => {
    if (tab === "applications") loadApplications();
  }, [tab, appTab, loadApplications]);

  const toggleUser = async (userId, isActive) => {
    try {
      await api.put(`/admin/users/${userId}/toggle-status`);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: !isActive } : u));
      toast.success(`User ${isActive ? "deactivated" : "activated"}`);
    } catch { toast.error("Failed to update user status"); }
  };

  const students      = users.filter(u => u.role === "student");
  const tutors        = users.filter(u => u.role === "tutor" || u.role === "teacher");
  const published     = courses.filter(c => c.isPublished).length;
  const totalEnrolled = courses.reduce((s, c) => s + (c.enrollmentCount || 0), 0);
  const pendingCount  = appSummary.pending + (appSummary.under_review || 0);

  const filteredUsers = users.filter(u => {
    const matchRole   = userRoleFilter === "all" || u.role === userRoleFilter;
    const matchSearch = !userSearch ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase());
    return matchRole && matchSearch;
  });

  const filteredApps = applications.filter(a => a.status === appTab);

  const userRoleData = [
    { name: "Students", value: students.length, color: "var(--primary)" },
    { name: "Tutors",   value: tutors.length,   color: "#8B5CF6" },
    { name: "Admins",   value: users.filter(u => u.role === "admin").length, color: "var(--accent)" },
  ].filter(d => d.value > 0);

  const healthData = [
    { name: "Course Publish Rate", Percentage: courses.length > 0 ? Math.round((published / courses.length) * 100) : 0 },
    { name: "Active Users Rate",   Percentage: users.length   > 0 ? Math.round((users.filter(u => u.isActive).length / users.length) * 100) : 0 },
    { name: "Quiz Pass Rate",      Percentage: stats?.quizPassRate || 74 },
  ];

  const popularCoursesData = [...courses]
    .sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0))
    .slice(0, 5)
    .map(c => ({
      name:     c.title.length > 15 ? c.title.slice(0, 15) + "…" : c.title,
      Students: c.enrollmentCount || 0,
    }));

  const statCards = [
    { icon: "👥", label: "Students",    val: students.length,  color: "var(--primary)"   },
    { icon: "👨‍🏫", label: "Tutors",      val: tutors.length,    color: "#8B5CF6"          },
    { icon: "📚", label: "Courses",     val: courses.length,   color: "var(--secondary)" },
    { icon: "🎓", label: "Enrollments", val: totalEnrolled,    color: "var(--accent)"    },
  ];

  const APP_TABS = [
    { key: "pending",      label: "⏳ Pending",      count: appSummary.pending      },
    { key: "under_review", label: "🔍 Under Review",  count: appSummary.under_review },
    { key: "approved",     label: "✅ Approved",      count: appSummary.approved     },
    { key: "rejected",     label: "❌ Rejected",      count: appSummary.rejected     },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg,#0f172a,#1e293b)",
          borderRadius: "var(--radius-lg)", color: "#fff", padding: "2rem",
          marginBottom: "2rem", display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "1rem",
        }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", marginBottom: ".3rem" }}>🛡️ Admin Dashboard</h1>
            <p style={{ opacity: .7, fontSize: ".875rem", margin: 0 }}>Platform overview and management</p>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {[
              { label: "Users",    val: users.length   },
              { label: "Courses",  val: courses.length },
              { label: "Enrolled", val: totalEnrolled  },
              ...(pendingCount > 0 ? [{ label: "Pending Apps", val: pendingCount, alert: true }] : []),
            ].map(s => (
              <div key={s.label} style={{
                textAlign: "center",
                background: s.alert ? "rgba(245,158,11,.25)" : "rgba(255,255,255,.1)",
                border:     s.alert ? "1px solid #F59E0B" : "none",
                borderRadius: "var(--radius-sm)", padding: ".6rem 1.1rem",
              }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.alert ? "#FCD34D" : "#fff" }}>{s.val}</div>
                <div style={{ fontSize: ".7rem", opacity: .8, color: s.alert ? "#FDE68A" : undefined }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending alert banner */}
        {pendingCount > 0 && (
          <div style={{
            background: "linear-gradient(135deg,#FEF3C7,#FDE68A)",
            border: "1px solid #F59E0B", borderRadius: 12, padding: "1rem 1.25rem",
            marginBottom: "1.5rem", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: "1rem", flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>📋</span>
              <div>
                <div style={{ fontWeight: 700, color: "#92400E", fontSize: ".9rem" }}>
                  {pendingCount} tutor application{pendingCount !== 1 ? "s" : ""} awaiting review
                </div>
                <div style={{ fontSize: ".78rem", color: "#78350F" }}>
                  {appSummary.pending} pending · {appSummary.under_review} under review
                </div>
              </div>
            </div>
            <button className="btn btn-sm"
              style={{ background: "#F59E0B", color: "#fff", border: "none", fontWeight: 600 }}
              onClick={() => setTab("applications")}>
              Review Applications →
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid-4" style={{ marginBottom: "2rem" }}>
          {statCards.map(s => (
            <div key={s.label} className="card"
              style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: ".85rem" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "var(--radius-sm)",
                background: s.color + "18", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "1.4rem",
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: ".15rem" }}>{s.label}</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div style={{
          display: "flex", gap: ".4rem", marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border)", paddingBottom: ".5rem", flexWrap: "wrap",
        }}>
          {[
            { id: "overview",     label: "📊 Overview"     },
            { id: "users",        label: "👥 Users"        },
            { id: "courses",      label: "📚 Courses"      },
            { id: "applications", label: "📋 Applications", badge: pendingCount },
            { id: "performance",  label: "🏆 Performance"  },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
              style={{ position: "relative" }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{
                  position: "absolute", top: -6, right: -6,
                  background: "#EF4444", color: "#fff", borderRadius: 99,
                  fontSize: ".58rem", fontWeight: 800, padding: ".1rem .35rem",
                  minWidth: 16, textAlign: "center", lineHeight: 1.4,
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : (
          <>
            {/* ── Overview ── */}
            {tab === "overview" && (
              <>
                <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
                  <div className="card" style={{ padding: "1.25rem" }}>
                    <h3 style={{ fontSize: ".95rem", marginBottom: "1.25rem" }}>📈 Platform Health Indices</h3>
                    <div style={{ width: "100%", height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={healthData} layout="vertical"
                          margin={{ top:5, right:10, left:10, bottom:5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" domain={[0,100]} tick={{ fill:"var(--text-muted)", fontSize:10 }} />
                          <YAxis dataKey="name" type="category" width={110} tick={{ fill:"var(--text)", fontSize:9 }} />
                          <Tooltip contentStyle={{ background:"rgba(30,27,75,.95)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"#fff", fontSize:".75rem" }} />
                          <Bar dataKey="Percentage" radius={[0,4,4,0]} barSize={16}>
                            {healthData.map((_,i) => <Cell key={i} fill={["var(--secondary)","var(--primary)","var(--accent)"][i%3]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card" style={{ padding: "1.25rem" }}>
                    <h3 style={{ fontSize: ".95rem", marginBottom: ".5rem" }}>👥 User Base Distribution</h3>
                    <div style={{ width: "100%", height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={userRoleData} cx="50%" cy="50%"
                            innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                            {userRoleData.map((e,i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background:"rgba(30,27,75,.95)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"#fff", fontSize:".75rem" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-around", fontSize:".72rem", fontWeight:600, marginTop:".5rem" }}>
                      {userRoleData.map(e => (
                        <div key={e.name} style={{ display:"flex", alignItems:"center", gap:".3rem" }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:e.color }} />
                          <span style={{ color:"var(--text-muted)" }}>{e.name} ({e.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: ".95rem", marginBottom: "1rem" }}>🆕 Recent Platform Users</h3>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"1rem" }}>
                    {users.slice(0,6).map(u => (
                      <div key={u._id} style={{ display:"flex", alignItems:"center", gap:".6rem", padding:".5rem", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)" }}>
                        <div style={{ width:34, height:34, borderRadius:"50%", background: u.role==="admin"?"#FEF3C7":u.role==="tutor"||u.role==="teacher"?"var(--secondary-light)":"var(--primary-light)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:".82rem", color: u.role==="admin"?"#92400E":u.role==="tutor"||u.role==="teacher"?"#065F46":"var(--primary-dark)" }}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:".82rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.name}</div>
                          <div style={{ fontSize:".7rem", color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                        </div>
                        <span className={`badge ${u.role==="admin"?"badge-warning":u.role==="tutor"||u.role==="teacher"?"badge-success":"badge-primary"}`} style={{ fontSize:".6rem" }}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Users ── */}
            {tab === "users" && (
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ display:"flex", gap:".75rem", padding:"1rem 1.25rem", borderBottom:"1px solid var(--border)", flexWrap:"wrap", alignItems:"center" }}>
                  <input className="form-control" style={{ flex:1, minWidth:180, fontSize:".84rem" }}
                    placeholder="Search by name or email…"
                    value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                  <select className="form-control" style={{ width:140, fontSize:".84rem" }}
                    value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
                    <option value="all">All Roles</option>
                    <option value="student">Students</option>
                    <option value="tutor">Tutors</option>
                    <option value="admin">Admins</option>
                  </select>
                  <span style={{ fontSize:".78rem", color:"var(--text-muted)", whiteSpace:"nowrap" }}>
                    {filteredUsers.length} of {users.length} users
                  </span>
                </div>

                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"var(--bg)" }}>
                      {["User","Role","Level","Status","Joined","Actions"].map(h => (
                        <th key={h} style={{ padding:".75rem 1.25rem", textAlign:"left", fontSize:".72rem", color:"var(--text-muted)", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding:"3rem", textAlign:"center", color:"var(--text-muted)" }}>No users match your filter</td></tr>
                    ) : filteredUsers.map(u => (
                      <tr key={u._id} style={{ borderTop:"1px solid var(--border)" }}>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:".6rem" }}>
                            <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--primary-light)", color:"var(--primary-dark)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:".78rem" }}>
                              {u.name?.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontWeight:600, fontSize:".85rem" }}>{u.name}</div>
                              <div style={{ fontSize:".7rem", color:"var(--text-muted)" }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          <span className={`badge ${u.role==="admin"?"badge-warning":u.role==="tutor"||u.role==="teacher"?"badge-success":"badge-primary"}`}>{u.role}</span>
                          {u.tutorStatus && u.tutorStatus !== "approved" && (
                            <div style={{ marginTop:".25rem" }}><StatusBadge status={u.tutorStatus} /></div>
                          )}
                        </td>
                        <td style={{ padding:".85rem 1.25rem", fontSize:".82rem", color:"var(--text-muted)", textTransform:"capitalize" }}>{u.learningLevel||"—"}</td>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          <span className={`badge ${u.isActive?"badge-success":"badge-danger"}`}>{u.isActive?"Active":"Inactive"}</span>
                        </td>
                        <td style={{ padding:".85rem 1.25rem", fontSize:".78rem", color:"var(--text-muted)" }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB",{ day:"numeric", month:"short", year:"numeric" }) : "—"}
                        </td>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          {u.role !== "admin" && (
                            <div style={{ display:"flex", gap:".4rem", flexWrap:"wrap" }}>
                              {(u.role==="tutor"||u.role==="teacher") && u.tutorApplication?._id && (
                                <button className="btn btn-outline btn-sm" style={{ fontSize:".75rem" }}
                                  onClick={() => {
                                    const appId = u.tutorApplication?._id || u.tutorApplication;
                                    api.get(`/applications/${appId}`)
                                      .then(r => { setSelectedApp(r.data.data); setTab("applications"); })
                                      .catch(() => toast.error("Could not load application"));
                                  }}>
                                  📋 Application
                                </button>
                              )}
                              {u.role==="student" && (
                                <Link to={`/students/${u._id}`} className="btn btn-outline btn-sm">View</Link>
                              )}
                              <button onClick={() => toggleUser(u._id, u.isActive)}
                                className={`btn btn-sm ${u.isActive?"btn-danger":"btn-success"}`}>
                                {u.isActive?"Deactivate":"Activate"}
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
              <div className="card" style={{ overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"var(--bg)" }}>
                      {["Course","Tutor","Category","Level","Students","Status"].map(h => (
                        <th key={h} style={{ padding:".75rem 1.25rem", textAlign:"left", fontSize:".72rem", color:"var(--text-muted)", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(c => (
                      <tr key={c._id} style={{ borderTop:"1px solid var(--border)" }}>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          <div style={{ fontWeight:600, fontSize:".88rem" }}>{c.title}</div>
                          <div style={{ fontSize:".72rem", color:"var(--text-muted)" }}>{c.isFree?"Free":`$${c.price}`}</div>
                        </td>
                        <td style={{ padding:".85rem 1.25rem", fontSize:".82rem" }}>{c.tutor?.name||"—"}</td>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          <span className="badge badge-gray" style={{ textTransform:"capitalize" }}>{c.category?.replace(/-/g," ")}</span>
                        </td>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          <span className={`badge ${c.level==="beginner"?"badge-success":c.level==="advanced"?"badge-danger":"badge-warning"}`}>{c.level}</span>
                        </td>
                        <td style={{ padding:".85rem 1.25rem", fontWeight:700 }}>{c.enrollmentCount||0}</td>
                        <td style={{ padding:".85rem 1.25rem" }}>
                          <span className={`badge ${c.isPublished?"badge-success":"badge-gray"}`}>{c.isPublished?"Published":"Draft"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Applications ── */}
            {tab === "applications" && (
              <div>
                <div style={{ display:"flex", gap:".5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
                  {APP_TABS.map(t => (
                    <button key={t.key} onClick={() => setAppTab(t.key)}
                      style={{ padding:".45rem 1rem", borderRadius:"var(--radius-sm)", cursor:"pointer", fontSize:".82rem", fontWeight:appTab===t.key?700:400, background:appTab===t.key?"var(--primary)":"var(--bg)", color:appTab===t.key?"#fff":"var(--text-secondary)", border:`1px solid ${appTab===t.key?"var(--primary)":"var(--border)"}` }}>
                      {t.label}
                      {t.count > 0 && (
                        <span style={{ marginLeft:".35rem", background:appTab===t.key?"rgba(255,255,255,.25)":"var(--border)", borderRadius:99, padding:".05rem .4rem", fontSize:".68rem" }}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:".75rem", marginBottom:"1.25rem" }}>
                  {APP_TABS.map(t => (
                    <div key={t.key} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, padding:".85rem", textAlign:"center", borderTop:`3px solid ${STATUS_META[t.key].border}`, cursor:"pointer" }}
                      onClick={() => setAppTab(t.key)}>
                      <div style={{ fontSize:"1.6rem", fontWeight:800, color:STATUS_META[t.key].color }}>{t.count}</div>
                      <div style={{ fontSize:".72rem", color:"var(--text-muted)", marginTop:".2rem" }}>{t.label}</div>
                    </div>
                  ))}
                </div>

                {filteredApps.length === 0 ? (
                  <div className="card" style={{ padding:"3rem", textAlign:"center" }}>
                    <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>📭</div>
                    <p style={{ color:"var(--text-muted)" }}>No {appTab.replace("_"," ")} applications</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:".65rem" }}>
                    {filteredApps.map(app => (
                      <div key={app._id} className="card"
                        style={{ padding:"1rem 1.25rem", cursor:"pointer", borderLeft:`4px solid ${STATUS_META[app.status]?.border||"var(--border)"}` }}
                        onClick={() => setSelectedApp(app)}>
                        <div style={{ display:"flex", alignItems:"center", gap:".85rem", flexWrap:"wrap" }}>
                          <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,var(--primary),#7C3AED)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:".95rem" }}>
                            {app.user?.name?.[0]?.toUpperCase()||"?"}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:".88rem" }}>{app.user?.name}</div>
                            <div style={{ fontSize:".73rem", color:"var(--text-muted)" }}>{app.user?.email}</div>
                          </div>
                          <div style={{ textAlign:"center", minWidth:130 }}>
                            <div style={{ fontSize:".78rem", fontWeight:600 }}>{app.areaOfExpertise}</div>
                            <div style={{ fontSize:".7rem", color:"var(--text-muted)" }}>
                              {app.yearsOfExperience}yr · {app.highestQualification?.split(" ").slice(-1)[0]}
                            </div>
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <StatusBadge status={app.status} />
                            <div style={{ fontSize:".68rem", color:"var(--text-muted)", marginTop:".3rem" }}>
                              {new Date(app.createdAt).toLocaleDateString("en-GB",{ day:"numeric", month:"short", year:"numeric" })}
                            </div>
                          </div>
                          <div style={{ color:"var(--text-muted)", fontSize:"1rem" }}>›</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Performance ── */}
            {tab === "performance" && (
              <div className="grid-2">
                <div className="card" style={{ padding:"1.25rem" }}>
                  <h3 style={{ fontSize:".95rem", marginBottom:"1rem" }}>🏆 Top Academic Performers</h3>
                  {students.length===0 ? (
                    <p style={{ color:"var(--text-muted)", fontSize:".85rem" }}>No students yet.</p>
                  ) : students.slice(0,5).map((s,i) => (
                    <div key={s._id} style={{ display:"flex", alignItems:"center", gap:".6rem", marginBottom:".7rem" }}>
                      <span style={{ fontSize:"1.1rem" }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:".85rem" }}>{s.name}</div>
                        <div style={{ fontSize:".7rem", color:"var(--text-muted)", textTransform:"capitalize" }}>{s.learningLevel} Level</div>
                      </div>
                      <Link to={`/students/${s._id}`} className="btn btn-outline btn-sm">View Path</Link>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ padding:"1.25rem" }}>
                  <h3 style={{ fontSize:".95rem", marginBottom:"1.25rem" }}>📈 Course Popularity</h3>
                  {popularCoursesData.length > 0 ? (
                    <div style={{ width:"100%", height:200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={popularCoursesData} margin={{ top:5, right:5, left:-25, bottom:5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill:"var(--text-muted)", fontSize:8 }} />
                          <YAxis tick={{ fill:"var(--text-muted)", fontSize:9 }} />
                          <Tooltip contentStyle={{ background:"rgba(30,27,75,.95)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"#fff", fontSize:".75rem" }} />
                          <Bar dataKey="Students" radius={[4,4,0,0]}>
                            {popularCoursesData.map((_,i) => <Cell key={i} fill={i%2===0?"var(--primary)":"#8B5CF6"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{ padding:"3rem", textAlign:"center", color:"var(--text-muted)" }}>
                      <span style={{ fontSize:"2rem" }}>📭</span>
                      <p>No enrollment statistics yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedApp && (
        <ApplicationModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onDecision={() => { loadApplications(); load(); }}
        />
      )}
    </div>
  );
}