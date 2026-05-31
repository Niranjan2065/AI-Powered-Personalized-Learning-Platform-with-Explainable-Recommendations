/**
 * pages/StudentDashboard.jsx — FIXED
 *
 * BUGS FIXED:
 * 1. Route was /dashboard — now /student (consistent with Navbar + App.jsx)
 * 2. Used common/Navbar — now unified Navbar
 * 3. CSS classes (grid-4, stat-card, card, badge-*) were undefined — now in index.css
 * 4. API calls used wrong endpoints — fixed to /api/enrollments/my + /api/quizzes/attempts/stats
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
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

export default function StudentDashboard() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [quizStats, setQuizStats]     = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [enRes, qRes] = await Promise.allSettled([
          api.get("/enrollments/my"),
          api.get("/recommendations/analysis"),
        ]);
        if (enRes.status === "fulfilled") setEnrollments(enRes.value.data.data || []);
        if (qRes.status === "fulfilled") setQuizStats(qRes.value.data.data);
      } catch (err) {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const completed  = enrollments.filter((e) => e.progress >= 100).length;
  const inProgress = enrollments.filter((e) => e.progress > 0 && e.progress < 100).length;

  const radarData = [];
  if (quizStats?.hasData) {
    const capitalize = (str) => {
      if (!str) return "";
      return str.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    };
    if (quizStats.weakTopics) {
      quizStats.weakTopics.forEach((t) => {
        radarData.push({ subject: capitalize(t.topic), score: t.percentage });
      });
    }
    if (quizStats.averageTopics) {
      quizStats.averageTopics.forEach((t) => {
        radarData.push({ subject: capitalize(t.topic), score: t.percentage });
      });
    }
    if (quizStats.strongTopics) {
      quizStats.strongTopics.forEach((t) => {
        radarData.push({ subject: capitalize(t.topic), score: t.percentage });
      });
    }
  }

  const historyData = quizStats?.recentHistory
    ? [...quizStats.recentHistory].reverse().map((h, i) => ({
        name: `Quiz ${i + 1}`,
        title: h.quizTitle,
        Score: h.score || 0,
        date: new Date(h.date).toLocaleDateString([], { month: "short", day: "numeric" })
      }))
    : [];

  const CustomTooltip = ({ active, payload }) => {
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
          <p style={{ fontWeight: 700, margin: 0, fontSize: "0.85rem", color: "var(--accent)" }}>{data.title}</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
            Score: <strong style={{ color: "#34D399", fontSize: "0.95rem" }}>{payload[0].value}%</strong>
          </p>
          <p style={{ margin: 0, fontSize: "0.7rem", opacity: 0.7 }}>Date: {data.date}</p>
        </div>
      );
    }
    return null;
  };

  const stats = [
    { icon: "📚", label: "Enrolled",    val: enrollments.length,     color: "var(--primary)" },
    { icon: "✅", label: "Completed",   val: completed,              color: "var(--secondary)" },
    { icon: "📝", label: "Quizzes",     val: quizStats?.total  ?? 0, color: "var(--accent)" },
    { icon: "🏆", label: "Avg Score",   val: quizStats?.avgScore
        ? `${Math.round(quizStats.avgScore)}%` : "—",               color: "#8B5CF6" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #6C63FF, #4F46E5)",
          borderRadius: "var(--radius-lg)", color: "#fff",
          padding: "2rem", marginBottom: "2rem",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "1rem",
        }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", marginBottom: ".3rem" }}>
              Welcome back, {user?.name?.split(" ")[0]} 👋
            </h1>
            <p style={{ opacity: .8, fontSize: ".9rem" }}>
              Continue your AI-powered learning journey
            </p>
          </div>
          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            <Link to="/courses" className="btn btn-outline"
              style={{ borderColor: "rgba(255,255,255,.4)", color: "#fff" }}>
              Browse Courses
            </Link>
            <Link to="/recommendations" className="btn"
              style={{ background: "#fff", color: "var(--primary-dark)", fontWeight: 700 }}>
              🤖 AI Recommendations
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

        {loading ? <Spinner /> : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>

            {/* Left Column: Enrollments & Quiz History */}
            <div>
              {/* Enrollments */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h2 style={{ fontSize: "1.1rem" }}>My Courses</h2>
                <Link to="/courses" className="btn btn-outline btn-sm">+ Enroll More</Link>
              </div>
              {enrollments.length === 0 ? (
                <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: ".75rem" }}>📚</div>
                  <p style={{ fontWeight: 600, marginBottom: ".5rem" }}>No courses yet</p>
                  <Link to="/courses" className="btn btn-primary btn-sm">Browse Courses</Link>
                </div>
              ) : (
                enrollments.map((en) => (
                  <div key={en._id} className="card"
                    style={{ padding: "1.1rem 1.25rem", marginBottom: ".75rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "var(--radius-sm)",
                      background: "var(--primary-light)", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0,
                    }}>📚</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: ".9rem", marginBottom: ".4rem",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {en.course?.title || "Unknown Course"}
                      </div>
                      <div style={{ background: "var(--border)", borderRadius: 99, height: 6, marginBottom: ".3rem" }}>
                        <div style={{
                          width: `${en.progress || 0}%`, height: "100%", borderRadius: 99,
                          background: en.progress >= 80 ? "var(--secondary)" : en.progress >= 40 ? "var(--accent)" : "var(--primary)",
                          transition: "width .5s ease",
                        }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".72rem", color: "var(--text-muted)" }}>
                        <span>{en.progress || 0}% complete</span>
                        <span>
                          <span className={`badge badge-${en.progress >= 100 ? "success" : "warning"}`}>
                            {en.progress >= 100 ? "Completed" : "In Progress"}
                          </span>
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/courses/${en.course?._id}`}
                      className="btn btn-primary btn-sm">
                      {en.progress >= 100 ? "Review" : "Continue"}
                    </Link>
                  </div>
                ))
              )}

              {/* Quiz Score History Chart */}
              {historyData.length > 0 && (
                <div className="card" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>📈 Quiz Progress & Score History</h3>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="Score"
                          stroke="var(--primary)"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#scoreColor)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Performance Radar & Highlights */}
            <div>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Performance Analysis</h2>

              {/* Radar Chart for topic performance */}
              {radarData.length > 0 ? (
                <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.75rem" }}>🎯 Topic Mastery</h3>
                  <div style={{ width: "100%", height: 210 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text)", fontSize: 8, fontWeight: 500 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 8 }} />
                        <Radar
                          name="Mastery"
                          dataKey="score"
                          stroke="var(--primary)"
                          fill="var(--primary)"
                          fillOpacity={0.25}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(30, 27, 75, 0.95)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            color: "#fff",
                            fontSize: "0.75rem",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: "1.5rem", textAlign: "center", marginBottom: "1rem", color: "var(--text-muted)" }}>
                  <span style={{ fontSize: "1.5rem" }}>📊</span>
                  <p style={{ fontSize: "0.78rem", margin: "0.5rem 0 0" }}>Take quizzes to generate topic analytics charts!</p>
                </div>
              )}

              {/* Topic Lists */}
              {quizStats?.weakTopics?.length > 0 && (
                <div className="card" style={{ padding: "1.1rem", borderLeft: "3px solid var(--danger)", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: ".9rem", color: "var(--danger)", marginBottom: ".75rem" }}>🔴 Needs Work</h3>
                  {quizStats.weakTopics.slice(0, 4).map(({ topic, percentage }) => (
                    <div key={topic} style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", marginBottom: ".3rem" }}>
                      <span style={{ textTransform: "capitalize" }}>{topic}</span>
                      <span style={{ fontWeight: 700, color: "var(--danger)" }}>{percentage}%</span>
                    </div>
                  ))}
                </div>
              )}

              {quizStats?.strongTopics?.length > 0 && (
                <div className="card" style={{ padding: "1.1rem", borderLeft: "3px solid var(--secondary)", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: ".9rem", color: "var(--secondary)", marginBottom: ".75rem" }}>🟢 Strengths</h3>
                  {quizStats.strongTopics.slice(0, 4).map(({ topic, percentage }) => (
                    <div key={topic} style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", marginBottom: ".3rem" }}>
                      <span style={{ textTransform: "capitalize" }}>{topic}</span>
                      <span style={{ fontWeight: 700, color: "var(--secondary)" }}>{percentage}%</span>
                    </div>
                  ))}
                </div>
              )}

              <Link to="/recommendations"
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}>
                🤖 Get AI Recommendations
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
