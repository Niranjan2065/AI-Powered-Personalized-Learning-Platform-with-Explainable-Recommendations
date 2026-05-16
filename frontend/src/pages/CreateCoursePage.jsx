/**
 * pages/CreateCoursePage.jsx — FIXED
 *
 * BUG FIXED: Route /tutor/courses/create was not registered in App.jsx
 *            Now registered with proper tutor role guard.
 */
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
import axios from "axios";

const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "programming",
    level: "beginner", price: 0, isFree: true,
    thumbnail: "", tags: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim())
      return toast.error("Title and description are required");
    setLoading(true);
    try {
      const payload = {
        ...form,
        price: form.isFree ? 0 : Number(form.price),
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      const { data } = await api.post("/courses", payload);
      toast.success("Course created! 🎉");
      navigate(`/tutor/courses/${data.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="container" style={{ padding: "2rem 1.5rem", maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.4rem" }}>Create New Course</h1>
          <Link to="/tutor" className="btn btn-ghost btn-sm">← Back</Link>
        </div>

        <div className="card" style={{ padding: "2rem" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Course Title *</label>
              <input className="form-control"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Python for Beginners" required />
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-control"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="What will students learn in this course?"
                rows={4} required />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={form.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="programming">Programming</option>
                  <option value="data-science">Data Science</option>
                  <option value="web-development">Web Development</option>
                  <option value="machine-learning">Machine Learning</option>
                  <option value="mathematics">Mathematics</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Level</label>
                <select className="form-control" value={form.level} onChange={(e) => set("level", e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Pricing */}
            <div className="form-group">
              <label className="form-label">Pricing</label>
              <div style={{ display: "flex", gap: ".75rem", marginBottom: ".5rem" }}>
                <button type="button"
                  className={`btn btn-sm ${form.isFree ? "btn-primary" : "btn-outline"}`}
                  onClick={() => { set("isFree", true); set("price", 0); }}>
                  Free
                </button>
                <button type="button"
                  className={`btn btn-sm ${!form.isFree ? "btn-primary" : "btn-outline"}`}
                  onClick={() => set("isFree", false)}>
                  Paid
                </button>
              </div>
              {!form.isFree && (
                <input className="form-control" type="number" min="0"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="Price in USD" />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Tags (comma-separated)</label>
              <input className="form-control"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="python, beginner, data" />
            </div>

            <div style={{ display: "flex", gap: ".75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <Link to="/tutor" className="btn btn-outline">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Creating…" : "Create Course →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
