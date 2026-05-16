/**
 * pages/RecommendationsPage.jsx — FIXED
 *
 * BUGS FIXED:
 * 1. No empty-state for students with 0 quiz attempts — now shows CTA
 * 2. XAI feature bars had no CSS — fully styled inline
 * 3. generateRecommendations() error left page blank — now shows helpful UI
 * 4. Used shared/Navbar — now unified Navbar
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

const XAIBar = ({ label, weight, color = "var(--primary)" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".45rem" }}>
    <span style={{ fontSize: ".75rem", color: "var(--text-secondary)", width: 110, flexShrink: 0 }}>
      {label}
    </span>
    <div style={{ flex: 1, background: "var(--border)", borderRadius: 99, height: 7, overflow: "hidden" }}>
      <div style={{
        width: `${Math.round(weight * 100)}%`, height: "100%",
        background: color, borderRadius: 99, transition: "width .6s ease",
      }} />
    </div>
    <span style={{ fontSize: ".72rem", color: "var(--text-muted)", width: 35, textAlign: "right", flexShrink: 0 }}>
      {Math.round(weight * 100)}%
    </span>
  </div>
);

const priorityColors = {
  high:   { badge: "#EDE9FE", text: "#5B21B6", border: "var(--primary)" },
  medium: { badge: "#D1FAE5", text: "#065F46", border: "var(--secondary)" },
  low:    { badge: "#FEF3C7", text: "#92400E", border: "var(--accent)" },
};

export default function RecommendationsPage() {
  const { user } = useAuth();
  const [recs, setRecs]       = useState([]);
  const [xai, setXai]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData]   = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    setNoData(false);
    try {
      const { data } = await api.get("/recommendations/my");
      if (data.data && data.data.length > 0) {
        setRecs(data.data);
        setXai(data.xai || null);
      } else {
        // Try to generate
        await generate(false);
      }
    } catch {
      await generate(false);
    } finally {
      setLoading(false);
    }
  };

  const generate = async (showToast = true) => {
    setRegenerating(true);
    try {
      const { data } = await api.post("/recommendations/generate");
      setRecs(data.data || []);
      setXai(data.xai || null);
      if (showToast) toast.success("✨ Recommendations refreshed!");
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (msg.includes("quiz") || msg.includes("data")) {
        setNoData(true);
      } else {
        toast.error("Failed to generate recommendations");
      }
    } finally {
      setRegenerating(false);
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const defaultXAI = [
    { label: "Quiz Score",   weight: 0.42, color: "var(--primary)" },
    { label: "Weak Topics",  weight: 0.28, color: "#EF4444" },
    { label: "Completion %", weight: 0.18, color: "var(--secondary)" },
    { label: "Time Spent",   weight: 0.12, color: "var(--accent)" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #1e1b4b, #4f46e5)",
          borderRadius: "var(--radius-lg)", color: "#fff",
          padding: "2rem", marginBottom: "2rem",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "1rem",
        }}>
          <div>
            <div style={{ fontSize: "2rem", marginBottom: ".35rem" }}>🤖</div>
            <h1 style={{ fontSize: "1.5rem", marginBottom: ".3rem" }}>AI Learning Path</h1>
            <p style={{ opacity: .8, fontSize: ".875rem" }}>
              Personalised recommendations powered by your quiz performance
            </p>
          </div>
          <button className="btn"
            style={{ background: "#fff", color: "#4f46e5", fontWeight: 700 }}
            onClick={() => generate(true)}
            disabled={regenerating}>
            {regenerating ? "Analysing…" : "✨ Refresh Recommendations"}
          </button>
        </div>

        {loading ? <Spinner /> : noData ? (
          /* ── BUG FIX: Empty state for 0 quiz attempts ── */
          <div className="card" style={{ padding: "3rem", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📝</div>
            <h2 style={{ marginBottom: ".75rem" }}>No quiz data yet</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              The AI needs at least one completed quiz to generate personalised recommendations.
              Take a quiz in any of your enrolled courses to get started!
            </p>
            <div style={{ display: "flex", gap: ".75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/courses" className="btn btn-outline">Browse Courses</Link>
              <Link to="/student" className="btn btn-primary">View My Courses →</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "1.5rem", alignItems: "start" }}>

            {/* Recommendations */}
            <div>
              {recs.length === 0 ? (
                <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  <p>No recommendations found.</p>
                </div>
              ) : recs.map((r, i) => {
                const p = r.priority || (i === 0 ? "high" : i === 1 ? "medium" : "low");
                const pc = priorityColors[p] || priorityColors.low;
                const course = r.course || {};
                return (
                  <div key={r._id || i} className="card"
                    style={{ padding: "1.25rem", marginBottom: "1rem", borderLeft: `3px solid ${pc.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "1rem", marginBottom: ".75rem" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ background: pc.badge, color: pc.text, borderRadius: 99, padding: ".2rem .6rem", fontSize: ".68rem", fontWeight: 700, display: "inline-block", marginBottom: ".4rem" }}>
                          {p.toUpperCase()} PRIORITY
                        </span>
                        <h3 style={{ fontSize: "1rem", marginBottom: ".2rem" }}>{course.title || r.reason}</h3>
                        <div style={{ fontSize: ".75rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                          {course.category?.replace(/-/g, " ")} · {course.level}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1.1rem", color: course.isFree ? "var(--secondary)" : "var(--text-primary)", flexShrink: 0 }}>
                        {course.isFree ? "FREE" : course.price ? `$${course.price}` : ""}
                      </div>
                    </div>

                    {r.reason && (
                      <div className="xai-explanation" style={{ marginBottom: ".85rem" }}>
                        <span className="xai-icon">💡</span>
                        <div><strong>Why: </strong>{r.reason}</div>
                      </div>
                    )}

                    {r.xaiExplanation && (
                      <div style={{ marginBottom: ".85rem" }}>
                        <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: ".4rem" }}>
                          XAI — Feature Importance:
                        </div>
                        {Object.entries(r.xaiExplanation).map(([k, v]) => (
                          <XAIBar key={k} label={k.replace(/_/g, " ")} weight={v} />
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: ".5rem" }}>
                      {course._id && <Link to={`/courses/${course._id}`} className="btn btn-primary btn-sm">Enroll Now →</Link>}
                      {course._id && <Link to={`/courses/${course._id}`} className="btn btn-outline btn-sm">View Details</Link>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sidebar */}
            <div>
              <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: ".95rem", marginBottom: ".75rem" }}>🧠 Why These?</h3>
                <p style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                  Feature importance from the AI model:
                </p>
                {(xai?.features || defaultXAI).map((f) => (
                  <XAIBar key={f.label} label={f.label} weight={f.weight} color={f.color} />
                ))}
              </div>

              <div className="card" style={{ padding: "1.25rem" }}>
                <h3 style={{ fontSize: ".95rem", marginBottom: ".75rem" }}>📊 Your Stats</h3>
                {[
                  ["Avg Score", xai?.avgScore ? `${Math.round(xai.avgScore)}%` : "—"],
                  ["Quizzes",   xai?.quizCount ?? "—"],
                  ["Enrolled",  xai?.enrolled  ?? "—"],
                  ["Weak Topics", xai?.weakTopics?.length ?? "—"],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: ".5rem 0", borderBottom: "1px solid var(--border)", fontSize: ".82rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>{l}</span>
                    <span style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
