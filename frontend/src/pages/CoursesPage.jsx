/**
 * pages/CoursesPage.jsx — FIXED
 *
 * BUGS FIXED:
 * 1. Search input change never fired API call — search wasn't in useEffect deps
 * 2. setFilters(f=>({...f})) changed nothing — now correctly updates filters.search
 * 3. Missing debounce on search input
 * 4. CSS classes undefined — now all in index.css
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
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

const catEmoji = {
  "programming":      "🐍",
  "data-science":     "📊",
  "web-development":  "🌐",
  "machine-learning": "🤖",
  "mathematics":      "📐",
};

const levelColor = {
  beginner:     "badge-success",
  intermediate: "badge-warning",
  advanced:     "badge-danger",
};

export default function CoursesPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", category: "", level: "" });
  const debounceRef = useRef(null);

  // BUG FIX: all three filter values are now in deps array
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search)   params.search   = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.level)    params.level    = filters.level;
      const { data } = await api.get("/courses", { params });
      setCourses(data.data || []);
    } catch {
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.category, filters.level]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // BUG FIX: debounced search properly updates filters.search
  const handleSearch = (val) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: val }));
    }, 350);
  };

  const enrollInCourse = async (courseId) => {
    if (!user) { navigate("/login"); return; }
    try {
      await api.post(`/enrollments/${courseId}`);
      toast.success("Enrolled successfully! 🎉");
      navigate("/student");
    } catch (err) {
      toast.error(err.response?.data?.message || "Enrollment failed");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", marginBottom: ".25rem" }}>Browse Courses</h1>
            <p style={{ color: "var(--text-muted)", fontSize: ".875rem" }}>
              {loading ? "Loading…" : `${courses.length} course${courses.length !== 1 ? "s" : ""} available`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: "flex", gap: ".75rem", flexWrap: "wrap",
          marginBottom: "1.5rem", background: "#fff",
          padding: "1rem", borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}>
          <input
            className="form-control"
            style={{ flex: "1 1 220px", minWidth: 180 }}
            placeholder="🔍 Search courses…"
            defaultValue={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <select className="form-control" style={{ flex: "0 1 180px" }}
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            <option value="programming">Programming</option>
            <option value="data-science">Data Science</option>
            <option value="web-development">Web Development</option>
            <option value="machine-learning">Machine Learning</option>
            <option value="mathematics">Mathematics</option>
          </select>
          <select className="form-control" style={{ flex: "0 1 160px" }}
            value={filters.level}
            onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}>
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          {(filters.search || filters.category || filters.level) && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => setFilters({ search: "", category: "", level: "" })}>
              Clear ✕
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{
            width: 32, height: 32, border: "3px solid var(--border)",
            borderTopColor: "var(--primary)", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", margin: "3rem auto",
          }} />
        ) : courses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
            <h3>No courses found</h3>
            <p>Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid-3">
            {courses.map((course) => (
              <div key={course._id} className="card"
                style={{ display: "flex", flexDirection: "column", overflow: "hidden",
                  transition: "transform .2s, box-shadow .2s", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "var(--shadow)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}>

                {/* Thumbnail */}
                <div style={{
                  background: "linear-gradient(135deg, var(--primary-light), #c7d2fe)",
                  height: 130, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "3rem",
                }}>
                  {catEmoji[course.category] || "📚"}
                </div>

                <div style={{ padding: "1.1rem", flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* Badges */}
                  <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", marginBottom: ".6rem" }}>
                    <span className="badge badge-gray" style={{ textTransform: "capitalize" }}>
                      {course.category?.replace(/-/g, " ")}
                    </span>
                    <span className={`badge ${levelColor[course.level] || "badge-gray"}`}>
                      {course.level}
                    </span>
                    {course.isFree && <span className="badge badge-success">Free</span>}
                  </div>

                  <h3 style={{ fontSize: ".95rem", marginBottom: ".4rem", lineHeight: 1.4 }}>
                    {course.title}
                  </h3>
                  <p style={{ fontSize: ".8rem", color: "var(--text-muted)", lineHeight: 1.5, flex: 1, marginBottom: ".9rem" }}>
                    {course.description?.substring(0, 90)}…
                  </p>

                  {/* Footer */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: ".8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, color: course.isFree ? "var(--secondary)" : "var(--text-primary)" }}>
                      {course.isFree ? "FREE" : `$${course.price}`}
                    </span>
                    <div style={{ fontSize: ".72rem", color: "var(--text-muted)" }}>
                      ⭐ {course.rating?.toFixed(1) || "4.5"} · {course.enrollmentCount || 0} students
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem" }}>
                    <Link to={`/courses/${course._id}`}
                      className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                      Details
                    </Link>
                    {user?.role === "student" && (
                      <button onClick={() => enrollInCourse(course._id)}
                        className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                        {course.isFree ? "Enroll Free" : "Enroll"}
                      </button>
                    )}
                    {!user && (
                      <Link to="/login" className="btn btn-primary btn-sm"
                        style={{ flex: 1, justifyContent: "center" }}>
                        Login to Enroll
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
