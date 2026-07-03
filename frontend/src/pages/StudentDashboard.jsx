/**
 * pages/StudentDashboard.jsx
 *
 * CHANGES in this version:
 *
 *  Empty state (hasData === false):
 *   • Shows a friendly onboarding panel instead of a blank/broken screen
 *   • Lists enrolled courses with their progress bars and "Start" / "Continue" CTAs
 *   • 3-step "Get Started" guide explaining the AI learning loop
 *   • "Browse Courses" CTA when the student has no enrollments at all
 *   • Stat cards still render (with 0 values) so the layout doesn't jump on first quiz
 *
 *  Data state (hasData === true):
 *   • All existing charts, radar, weak topics, and AI recommendations — unchanged
 *
 *  Other fixes:
 *   • completionPercentage now reads en.completionPercentage (correct field name)
 *     instead of en.progress (which doesn't exist on the Enrollment model)
 *   • Due-for-review count from quizStats.stats.dueReviewCount shown in stat cards
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
import AIChatTutor from "../components/student/AIChatTutor";
import WeakTopicsPanel from "../components/student/WeakTopicsPanel";
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
  Tooltip,
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

// ─────────────────────────────────────────────────────────────
// Empty State — shown when hasData === false
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// DueForReviewCard — shows individual lessons overdue for SR review
// Data comes from GET /api/recommendations/review-due
// Each item: { lessonId, lessonTitle, courseTitle, topics[],
//              lastScore, daysSinceReview, reviewCount }
// ─────────────────────────────────────────────────────────────
function DueForReviewCard({ reviewDue, courseIdMap }) {
  if (!reviewDue || reviewDue.totalDue === 0) return null;

  const { totalDue, headline, items = [] } = reviewDue;

  const urgencyColor = (days) => {
    if (days >= 7)  return { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#DC2626" };
    if (days >= 3)  return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E", dot: "#F59E0B" };
    return           { bg: "#F5F3FF", border: "#C4B5FD", text: "#5B21B6", dot: "#8B5CF6" };
  };

  return (
    <div className="card" style={{
      overflow: "hidden", marginBottom: "1.5rem",
      border: "1px solid #8B5CF6",
    }}>
      {/* Header */}
      <div style={{
        padding: "1rem 1.25rem",
        background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)",
        borderBottom: "1px solid #C4B5FD",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#4C1D95" }}>
            📅 Due for Review
          </div>
          <div style={{ fontSize: ".75rem", color: "#6D28D9", marginTop: ".15rem" }}>
            {headline} — spaced repetition scheduler
          </div>
        </div>
        <span style={{
          background: "#8B5CF6", color: "#fff",
          fontSize: ".75rem", fontWeight: 700,
          padding: ".25rem .65rem", borderRadius: 999,
        }}>
          {totalDue}
        </span>
      </div>

      {/* Lesson list */}
      {items.slice(0, 5).map((item, i) => {
        const days  = item.daysSinceReview ?? 0;
        const urg   = urgencyColor(days);
        const score = item.lastScore ?? 0;
        const courseId = courseIdMap?.[item.lessonId] || "";

        return (
          <div key={item.lessonId || i} style={{
            padding: ".85rem 1.25rem",
            borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
            display: "flex", gap: ".85rem", alignItems: "flex-start",
          }}>
            {/* Urgency dot */}
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: urg.dot, flexShrink: 0, marginTop: 5,
            }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Lesson title */}
              <div style={{
                fontWeight: 600, fontSize: ".875rem",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.lessonTitle}
              </div>

              {/* Meta row */}
              <div style={{
                display: "flex", gap: ".75rem", marginTop: ".25rem",
                fontSize: ".72rem", color: "var(--text-muted)", flexWrap: "wrap",
              }}>
                {item.courseTitle && (
                  <span>📚 {item.courseTitle}</span>
                )}
                {item.topics?.slice(0, 2).map(t => (
                  <span key={t} style={{ textTransform: "capitalize" }}>🏷 {t}</span>
                ))}
                {typeof score === "number" && (
                  <span>Last score: <strong style={{ color: score >= 70 ? "var(--secondary)" : "#DC2626" }}>{score}%</strong></span>
                )}
                {item.reviewCount > 0 && (
                  <span>Reviewed {item.reviewCount}×</span>
                )}
              </div>
            </div>

            {/* Overdue badge + action */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".35rem", flexShrink: 0 }}>
              <span style={{
                background: urg.bg, border: `1px solid ${urg.border}`,
                color: urg.text, fontSize: ".68rem", fontWeight: 700,
                padding: ".15rem .55rem", borderRadius: 999, whiteSpace: "nowrap",
              }}>
                {days === 0 ? "Due today" : `${days}d overdue`}
              </span>
              <Link
                to={courseId ? `/learn/${courseId}/lesson/${item.lessonId}` : "/recommendations"}
                className="btn btn-sm"
                style={{
                  background: "#8B5CF6", color: "#fff", border: "none",
                  fontSize: ".7rem", padding: ".25rem .65rem",
                }}>
                Review →
              </Link>
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div style={{
        padding: ".75rem 1.25rem",
        background: "#FAFAFA", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
          {totalDue > 5 ? `+${totalDue - 5} more due` : "Reviewing keeps knowledge in long-term memory"}
        </span>
        <Link to="/recommendations" style={{
          fontSize: ".75rem", color: "#8B5CF6", fontWeight: 600, textDecoration: "none",
        }}>
          View all →
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ enrollments, userName }) {
  const hasEnrollments = enrollments.length > 0;

  return (
    <div>
      {/* Welcome panel */}
      <div style={{
        background: "var(--primary-light)", border: "1px solid var(--primary)",
        borderRadius: "var(--radius)", padding: "1.75rem",
        marginBottom: "1.5rem", textAlign: "center",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: ".75rem" }}>🎓</div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: ".4rem", color: "var(--primary-dark)" }}>
          Welcome, {userName}! Your dashboard is ready.
        </h2>
        <p style={{ fontSize: ".875rem", color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto .75rem" }}>
          Complete your first quiz to unlock performance charts, AI topic recommendations, and your personalised learning path.
        </p>
        <Link to="/recommendations" className="btn btn-primary" style={{ marginRight: ".5rem" }}>
          🤖 Get AI Recommendations
        </Link>
        <Link to="/courses" className="btn btn-outline">
          Browse Courses
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* Left — enrolled courses or browse CTA */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
              {hasEnrollments ? "Your courses" : "No courses yet"}
            </h3>
            <Link to="/courses" className="btn btn-outline btn-sm">+ Enroll</Link>
          </div>

          {!hasEnrollments ? (
            <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: ".75rem" }}>📚</div>
              <p style={{ fontWeight: 600, marginBottom: ".25rem" }}>No courses enrolled yet</p>
              <p style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                Browse the catalogue and enrol in a course to start learning.
              </p>
              <Link to="/courses" className="btn btn-primary btn-sm">Browse Courses</Link>
            </div>
          ) : (
            enrollments.map((en) => {
              const pct   = en.completionPercentage ?? 0;
              const cid   = en.course?._id;
              const title = en.course?.title || "Course";
              const barColor = pct >= 80
                ? "var(--secondary)"
                : pct >= 40 ? "var(--accent)" : "var(--primary)";

              return (
                <div key={en._id} className="card" style={{
                  padding: "1rem 1.25rem", marginBottom: ".75rem",
                  display: "flex", gap: "1rem", alignItems: "center",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "var(--radius-sm)",
                    background: "var(--primary-light)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem", flexShrink: 0,
                  }}>📚</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: ".875rem", marginBottom: ".4rem",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {title}
                    </div>

                    {/* Progress bar */}
                    <div style={{ background: "var(--border)", borderRadius: 99, height: 6, marginBottom: ".3rem" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%", borderRadius: 99,
                        background: barColor, transition: "width .5s ease",
                      }} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".72rem", color: "var(--text-muted)" }}>
                      <span>{pct}% complete</span>
                      <span className={`badge badge-${pct >= 100 ? "success" : pct > 0 ? "warning" : "gray"}`}>
                        {pct >= 100 ? "Completed" : pct > 0 ? "In Progress" : "Not started"}
                      </span>
                    </div>
                  </div>

                  {cid && (
                    <Link to={`/courses/${cid}`} className="btn btn-primary btn-sm">
                      {pct >= 100 ? "Review" : pct > 0 ? "Continue" : "Start"}
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right — Get Started guide */}
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
            How it works
          </h3>
          <div className="card" style={{ padding: "1.25rem" }}>
            {[
              {
                step: "1",
                icon: "📚",
                title: "Enrol and start a lesson",
                desc: "Pick any course and open a lesson. Your progress is tracked automatically.",
                color: "var(--primary)",
              },
              {
                step: "2",
                icon: "📝",
                title: "Take the quiz",
                desc: "After each lesson there's a short quiz. Your answers train the AI on your strengths and gaps.",
                color: "var(--accent)",
              },
              {
                step: "3",
                icon: "🤖",
                title: "Get AI recommendations",
                desc: "The AI analyses your quiz results using KMeans clustering and SHAP explainability to recommend your next lesson.",
                color: "var(--secondary)",
              },
              {
                step: "4",
                icon: "📅",
                title: "Review on schedule",
                desc: "The forgetting curve scheduler reminds you when to revisit topics before you forget them.",
                color: "#8B5CF6",
              },
            ].map(({ step, icon, title, desc, color }) => (
              <div key={step} style={{ display: "flex", gap: "1rem", marginBottom: "1.1rem" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: color + "18", border: `1.5px solid ${color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ".8rem", fontWeight: 700, color,
                }}>
                  {step}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: ".875rem", marginBottom: ".2rem" }}>
                    {icon} {title}
                  </div>
                  <div style={{ fontSize: ".78rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}

            <Link to="/courses" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: ".5rem" }}>
              Start your first lesson →
            </Link>
          </div>

          {/* Quick tip card */}
          <div className="card" style={{
            padding: "1rem 1.25rem", marginTop: "1rem",
            borderLeft: "3px solid var(--accent)",
            borderRadius: 0,
          }}>
            <div style={{ fontWeight: 600, fontSize: ".8rem", color: "var(--accent)", marginBottom: ".3rem" }}>
              💡 Tip
            </div>
            <div style={{ fontSize: ".78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              You need at least <strong>3 quiz attempts</strong> before the AI recommendation engine can personalise your learning path. The more quizzes you take, the smarter the recommendations get.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [quizStats,   setQuizStats]   = useState(null);
  const [reviewDue,   setReviewDue]   = useState(null);  // { totalDue, headline, items[] }
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [enRes, qRes, rvRes] = await Promise.allSettled([
          api.get("/enrollments/my"),
          api.get("/recommendations/analysis"),
          api.get("/recommendations/review-due?limit=5"),
        ]);
        if (enRes.status  === "fulfilled") setEnrollments(enRes.value.data.data || []);
        if (qRes.status   === "fulfilled") setQuizStats(qRes.value.data.data);
        if (rvRes.status  === "fulfilled") setReviewDue(rvRes.value.data.data);
      } catch {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Derived values ──────────────────────────────────────────
  const completed  = enrollments.filter((e) => (e.completionPercentage ?? 0) >= 100).length;
  const inProgress = enrollments.filter((e) => {
    const p = e.completionPercentage ?? 0;
    return p > 0 && p < 100;
  }).length;

  const capitalize = (str) =>
    str ? str.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "";

  const radarData = [];
  if (quizStats?.hasData) {
    quizStats.weakTopics?.forEach((t)    => radarData.push({ subject: capitalize(t.topic), score: t.percentage }));
    quizStats.averageTopics?.forEach((t) => radarData.push({ subject: capitalize(t.topic), score: t.percentage }));
    quizStats.strongTopics?.forEach((t)  => radarData.push({ subject: capitalize(t.topic), score: t.percentage }));
  }

  const historyData = quizStats?.recentHistory
    ? [...quizStats.recentHistory].reverse().map((h, i) => ({
        name:  `Quiz ${i + 1}`,
        title: h.quizTitle,
        Score: h.score || 0,
        date:  new Date(h.date).toLocaleDateString([], { month: "short", day: "numeric" }),
      }))
    : [];

  const dueReviews = reviewDue?.totalDue ?? quizStats?.stats?.dueReviewCount ?? 0;

  // Map lessonId -> courseId so DueForReviewCard can build direct lesson URLs.
  // Built from enrollments which already have course populated.
  const courseIdMap = {};
  for (const en of enrollments) {
    const cid = en.course?._id;
    if (!cid) continue;
    for (const mod of en.course?.modules || []) {
      for (const l of mod.lessons || []) {
        courseIdMap[l._id] = cid;
      }
    }
  }

  const stats = [
    { icon: "📚", label: "Enrolled",    val: enrollments.length,                           color: "var(--primary)"   },
    { icon: "✅", label: "Completed",   val: completed,                                    color: "var(--secondary)" },
    { icon: "📝", label: "Quizzes",     val: quizStats?.stats?.totalQuizzesTaken ?? 0,     color: "var(--accent)"    },
    {
      icon:  dueReviews > 0 ? "📅" : "🏆",
      label: dueReviews > 0 ? "Due for review" : "Avg Score",
      val:   dueReviews > 0
        ? dueReviews
        : quizStats?.stats?.avgScore ? `${Math.round(quizStats.stats.avgScore)}%` : "—",
      color: dueReviews > 0 ? "#8B5CF6" : "var(--accent)",
    },
  ];

  // ── Tooltip for area chart ──────────────────────────────────
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{
        background: "rgba(30,27,75,.95)", border: "1px solid var(--border)",
        padding: ".75rem 1rem", borderRadius: "var(--radius-sm)", color: "#fff",
      }}>
        <p style={{ fontWeight: 700, margin: 0, fontSize: ".85rem", color: "var(--accent)" }}>{d.title}</p>
        <p style={{ margin: ".25rem 0 0", fontSize: ".8rem" }}>
          Score: <strong style={{ color: "#34D399" }}>{payload[0].value}%</strong>
        </p>
        <p style={{ margin: 0, fontSize: ".7rem", opacity: .7 }}>Date: {d.date}</p>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>

        {/* ── Hero banner ── */}
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
              {quizStats?.hasData
                ? "Continue your AI-powered learning journey"
                : "Let's get your learning journey started"}
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

        {/* ── Stat cards (always visible) ── */}
        <div className="grid-4" style={{ marginBottom: "2rem" }}>
          {stats.map((s) => (
            <div key={s.label} className="card" style={{
              padding: "1.25rem", display: "flex", alignItems: "center", gap: ".85rem",
            }}>
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

        {/* ── Main content ── */}
        {loading ? (
          <Spinner />
        ) : !quizStats?.hasData ? (
          // ── EMPTY STATE ────────────────────────────────────────────────────
          <EmptyState
            enrollments={enrollments}
            userName={user?.name?.split(" ")[0] || "there"}
          />
        ) : (
          // ── DATA STATE ─────────────────────────────────────────────────────
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>

            {/* Left — course list + quiz history */}
            <div>
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
                enrollments.map((en) => {
                  const pct      = en.completionPercentage ?? 0;
                  const barColor = pct >= 80 ? "var(--secondary)" : pct >= 40 ? "var(--accent)" : "var(--primary)";
                  return (
                    <div key={en._id} className="card" style={{
                      padding: "1.1rem 1.25rem", marginBottom: ".75rem",
                      display: "flex", gap: "1rem", alignItems: "center",
                    }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: "var(--radius-sm)",
                        background: "var(--primary-light)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: "1.6rem", flexShrink: 0,
                      }}>📚</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600, fontSize: ".9rem", marginBottom: ".4rem",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {en.course?.title || "Unknown Course"}
                        </div>
                        <div style={{ background: "var(--border)", borderRadius: 99, height: 6, marginBottom: ".3rem" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%", borderRadius: 99,
                            background: barColor, transition: "width .5s ease",
                          }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".72rem", color: "var(--text-muted)" }}>
                          <span>{pct}% complete</span>
                          <span className={`badge badge-${pct >= 100 ? "success" : "warning"}`}>
                            {pct >= 100 ? "Completed" : "In Progress"}
                          </span>
                        </div>
                      </div>
                      <Link to={`/courses/${en.course?._id}`} className="btn btn-primary btn-sm">
                        {pct >= 100 ? "Review" : "Continue"}
                      </Link>
                    </div>
                  );
                })
              )}

              {/* Quiz Score History */}
              {historyData.length > 0 && (
                <div className="card" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
                  <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: "1rem" }}>
                    📈 Quiz Score History
                  </h3>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone" dataKey="Score"
                          stroke="var(--primary)" strokeWidth={2.5}
                          fillOpacity={1} fill="url(#scoreColor)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Right — radar + weak topics + AI button */}
            <div>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Performance Analysis</h2>

              {radarData.length > 0 ? (
                <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: ".85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: ".75rem" }}>
                    🎯 Topic Mastery
                  </h3>
                  <div style={{ width: "100%", height: 210 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text)", fontSize: 8, fontWeight: 500 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 8 }} />
                        <Radar name="Mastery" dataKey="score"
                          stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(30,27,75,.95)", border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)", color: "#fff", fontSize: ".75rem",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: "1.5rem", textAlign: "center", marginBottom: "1rem", color: "var(--text-muted)" }}>
                  <span style={{ fontSize: "1.5rem" }}>📊</span>
                  <p style={{ fontSize: ".78rem", margin: ".5rem 0 0" }}>
                    Take quizzes to generate topic analytics
                  </p>
                </div>
              )}

              <WeakTopicsPanel
                studentId={user?._id}
                weakTopics={quizStats?.weakTopics?.map((t) => t.topic) || []}
              />

              {quizStats?.strongTopics?.length > 0 && (
                <div className="card" style={{
                  padding: "1.1rem", marginBottom: "1rem",
                  borderLeft: "3px solid var(--secondary)", borderRadius: 0,
                }}>
                  <h3 style={{ fontSize: ".9rem", color: "var(--secondary)", marginBottom: ".75rem" }}>
                    🟢 Strengths
                  </h3>
                  {quizStats.strongTopics.slice(0, 4).map(({ topic, percentage }) => (
                    <div key={topic} style={{
                      display: "flex", justifyContent: "space-between",
                      fontSize: ".8rem", marginBottom: ".3rem",
                    }}>
                      <span style={{ textTransform: "capitalize" }}>{topic}</span>
                      <span style={{ fontWeight: 700, color: "var(--secondary)" }}>{percentage}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ✅ UPGRADED — Full Due for Review card with individual lessons */}
              <DueForReviewCard reviewDue={reviewDue} courseIdMap={courseIdMap} />

              <Link to="/recommendations" className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}>
                🤖 Get AI Recommendations
              </Link>
            </div>
          </div>
        )}
      </div>

      <AIChatTutor quizStats={quizStats} />
    </div>
  );
}