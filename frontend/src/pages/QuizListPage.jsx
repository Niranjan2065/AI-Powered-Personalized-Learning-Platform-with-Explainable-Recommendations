/**
 * pages/QuizListPage.jsx — NEW PAGE
 *
 * BUG FIXED: /courses/:id/quizzes route was not registered and had no page component.
 *            Links from CourseDetailPage would 404.
 */
import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
import axios from "axios";

const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export default function QuizListPage() {
  const { id } = useParams();
  const [quizzes, setQuizzes] = useState([]);
  const [course,  setCourse]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, qRes] = await Promise.all([
          api.get(`/courses/${id}`),
          api.get(`/quizzes/course/${id}`),
        ]);
        setCourse(cRes.data.data);
        setQuizzes(qRes.data.data || []);
      } catch { toast.error("Failed to load quizzes"); }
      setLoading(false);
    };
    load();
  }, [id]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", marginBottom: ".25rem" }}>
              Quizzes — {course?.title || "Course"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: ".875rem" }}>
              Test your knowledge and earn XAI-powered recommendations
            </p>
          </div>
          <Link to={`/courses/${id}`} className="btn btn-ghost btn-sm">← Back to Course</Link>
        </div>

        {loading ? (
          <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "3rem auto" }} />
        ) : quizzes.length === 0 ? (
          <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📝</div>
            <h3>No quizzes yet</h3>
            <p>Quizzes will appear here when the tutor adds them.</p>
          </div>
        ) : (
          <div className="grid-2">
            {quizzes.map((q) => (
              <div key={q._id} className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: ".75rem" }}>
                  <h3 style={{ fontSize: ".95rem", lineHeight: 1.4 }}>{q.title}</h3>
                  <span className={`badge ${q.difficulty === "easy" ? "badge-success" : q.difficulty === "hard" ? "badge-danger" : "badge-warning"}`}>
                    {q.difficulty}
                  </span>
                </div>
                <div style={{ display: "flex", gap: ".75rem", fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".85rem" }}>
                  <span>📝 {q.questions?.length || 0} questions</span>
                  {q.timeLimit > 0 && <span>⏱ {q.timeLimit} min</span>}
                  <span>🎯 Pass: {q.passingScore || 70}%</span>
                </div>
                <div style={{ marginTop: "auto" }}>
                  <Link to={`/quiz/${q._id}`} className="btn btn-primary btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}>
                    Start Quiz →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
