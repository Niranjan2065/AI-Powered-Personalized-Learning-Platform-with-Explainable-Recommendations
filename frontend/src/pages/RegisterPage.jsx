// pages/RegisterPage.jsx — Phase 4: Tutor Application Flow
// Step 1: Basic info + role selection (everyone)
// Step 2: Professional details + resume upload (tutors only)
// Step 3: Confirmation screen (tutors) or instant redirect (students)
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/common/Navbar";
import axios from "axios";

// ── Field meta ────────────────────────────────────────────────────────────────
const QUALIFICATIONS = [
  "High School Diploma", "Associate's Degree", "Bachelor's Degree",
  "Master's Degree", "Doctorate (PhD)", "Professional Certification", "Other",
];
const EXPERTISE_AREAS = [
  "Web Development", "Data Science", "Machine Learning / AI",
  "Mobile Development", "DevOps & Cloud", "Cybersecurity",
  "Database Administration", "UI/UX Design", "Programming Fundamentals", "Other",
];

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const Field = ({ label, required, hint, children }) => (
  <div className="form-group">
    <label className="form-label">
      {label}{required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
    </label>
    {children}
    {hint && <div style={{ fontSize: ".72rem", color: "var(--text-muted)", marginTop: ".25rem" }}>{hint}</div>}
  </div>
);

const StepDot = ({ num, active, done }) => (
  <div style={{
    width: 32, height: 32, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: ".8rem",
    fontWeight: 700, flexShrink: 0,
    background: done ? "#059669" : active ? "var(--primary)" : "var(--border)",
    color: done || active ? "#fff" : "var(--text-muted)",
    transition: "all .3s",
  }}>
    {done ? "✓" : num}
  </div>
);

const StepBar = ({ step, isTutor }) => {
  const steps = isTutor
    ? ["Basic Info", "Professional Details", "Confirmation"]
    : ["Basic Info", "Done"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "2rem" }}>
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".3rem" }}>
            <StepDot num={i + 1} active={step === i + 1} done={step > i + 1} />
            <span style={{ fontSize: ".65rem", color: step === i + 1 ? "var(--primary)" : "var(--text-muted)", fontWeight: step === i + 1 ? 700 : 400, whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: step > i + 1 ? "#059669" : "var(--border)", margin: "0 .5rem", marginBottom: "1.2rem", transition: "background .3s" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [basic, setBasic] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "student" });

  // Step 2 tutor fields
  const [tutor, setTutor] = useState({
    highestQualification: "",
    yearsOfExperience:    "",
    areaOfExpertise:      "",
    specificSkills:       "",
    linkedinUrl:          "",
    portfolioUrl:         "",
    teachingStatement:    "",
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState("");

  const isTutor = basic.role === "tutor";

  // ── Step 1 validation ───────────────────────────────────────────────────────
  const handleStep1 = (e) => {
    e.preventDefault();
    if (basic.password.length < 6)      return toast.error("Password must be at least 6 characters");
    if (basic.password !== basic.confirmPassword) return toast.error("Passwords do not match");
    setStep(isTutor ? 2 : "submit");
    if (!isTutor) submitStudent();
  };

  // ── Student submit (no extra steps) ────────────────────────────────────────
  const submitStudent = async () => {
    setLoading(true);
    try {
      const data = await register({ name: basic.name, email: basic.email, password: basic.password, role: "student" });
      toast.success(`Welcome to AILearn, ${data.user.name}! 🎉`);
      navigate("/student");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
      setStep(1);
    } finally { setLoading(false); }
  };

  // ── Resume validation ───────────────────────────────────────────────────────
  const handleResume = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ["application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      setResumeError("Only PDF, DOC, or DOCX files are accepted");
      setResumeFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeError("File must be under 5 MB");
      setResumeFile(null);
      return;
    }
    setResumeError("");
    setResumeFile(file);
  };

  // ── Tutor submit ─────────────────────────────────────────────────────────────
  const handleStep2 = async (e) => {
    e.preventDefault();
    if (!resumeFile) { setResumeError("Please upload your resume"); return; }
    if (tutor.teachingStatement.length < 100) {
      return toast.error("Teaching statement must be at least 100 characters");
    }

    setLoading(true);
    try {
      // Use FormData so multer can receive the file
      const fd = new FormData();
      Object.entries({ ...basic, ...tutor }).forEach(([k, v]) => fd.append(k, v));
      fd.append("resume", resumeFile);

      const { data } = await axios.post("/api/auth/register", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data.pendingApproval) {
        setStep(3); // Confirmation screen
      } else {
        toast.success("Registration successful!");
        navigate("/student");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  // ── Shared input style ───────────────────────────────────────────────────────
  const inp = { className: "form-control" };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "2.5rem 1.5rem",
        background: "linear-gradient(135deg,#EEF2FF 0%,#F8F7FF 60%,#D1FAE5 100%)",
        minHeight: "calc(100vh - 64px)",
      }}>
        <div className="card" style={{ width: "100%", maxWidth: isTutor ? 560 : 480, padding: "2.5rem" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: ".5rem" }}>
              {step === 3 ? "🎉" : isTutor ? "👨‍🏫" : "🚀"}
            </div>
            <h1 style={{ fontSize: "1.4rem", marginBottom: ".25rem" }}>
              {step === 1 && "Create Account"}
              {step === 2 && "Professional Details"}
              {step === 3 && "Application Submitted!"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: ".875rem", margin: 0 }}>
              {step === 1 && "Join the AI-powered learning platform"}
              {step === 2 && "Tell us about your teaching experience"}
              {step === 3 && "We'll review and get back to you in 2-3 business days"}
            </p>
          </div>

          <StepBar step={step} isTutor={isTutor} />

          {/* ── STEP 1 ────────────────────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleStep1}>
              <Field label="Full Name" required>
                <input {...inp} value={basic.name}
                  onChange={e => setBasic({ ...basic, name: e.target.value })}
                  placeholder="Your full name" required />
              </Field>
              <Field label="Email" required>
                <input {...inp} type="email" value={basic.email}
                  onChange={e => setBasic({ ...basic, email: e.target.value })}
                  placeholder="you@example.com" required />
              </Field>
              <Field label="Password" required>
                <input {...inp} type="password" value={basic.password}
                  onChange={e => setBasic({ ...basic, password: e.target.value })}
                  placeholder="Min 6 characters" required />
              </Field>
              <Field label="Confirm Password" required>
                <input {...inp} type="password" value={basic.confirmPassword}
                  onChange={e => setBasic({ ...basic, confirmPassword: e.target.value })}
                  placeholder="Re-enter your password" required />
              </Field>

              {/* Role selection */}
              <Field label="I want to join as:" required>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem", marginTop: ".3rem" }}>
                  {[
                    { val: "student", icon: "🎓", title: "Student", desc: "Learn and get AI recommendations" },
                    { val: "tutor",   icon: "👨‍🏫", title: "Tutor",   desc: "Apply to teach and create courses" },
                  ].map(({ val, icon, title, desc }) => (
                    <div key={val}
                      onClick={() => setBasic({ ...basic, role: val })}
                      style={{
                        padding: "1rem", borderRadius: "var(--radius-sm)", cursor: "pointer",
                        border: `2px solid ${basic.role === val ? "var(--primary)" : "var(--border)"}`,
                        background: basic.role === val ? "var(--primary-light)" : "#fff",
                        transition: "all .2s",
                      }}>
                      <div style={{ fontSize: "1.5rem", marginBottom: ".3rem" }}>{icon}</div>
                      <div style={{ fontWeight: 600, fontSize: ".875rem", marginBottom: ".2rem" }}>{title}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>{desc}</div>
                      {val === "tutor" && (
                        <div style={{ fontSize: ".68rem", color: "#7C3AED", marginTop: ".3rem",
                          background: "#EDE9FE", borderRadius: 4, padding: ".2rem .4rem", display: "inline-block" }}>
                          Requires admin approval
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Field>

              <button type="submit" className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={loading}>
                {isTutor ? "Next: Professional Details →" : (loading ? "Creating account…" : "Create Account →")}
              </button>
            </form>
          )}

          {/* ── STEP 2 (tutors only) ──────────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleStep2}>

              {/* Qualification + Experience row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
                <Field label="Highest Qualification" required>
                  <select {...inp} value={tutor.highestQualification}
                    onChange={e => setTutor({ ...tutor, highestQualification: e.target.value })}
                    required>
                    <option value="">Select…</option>
                    {QUALIFICATIONS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </Field>
                <Field label="Years of Experience" required>
                  <input {...inp} type="number" min="0" max="50"
                    value={tutor.yearsOfExperience}
                    onChange={e => setTutor({ ...tutor, yearsOfExperience: e.target.value })}
                    placeholder="e.g. 5" required />
                </Field>
              </div>

              <Field label="Primary Area of Expertise" required>
                <select {...inp} value={tutor.areaOfExpertise}
                  onChange={e => setTutor({ ...tutor, areaOfExpertise: e.target.value })}
                  required>
                  <option value="">Select your main teaching domain…</option>
                  {EXPERTISE_AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
              </Field>

              <Field label="Specific Skills / Technologies" required
                hint="e.g. React, Node.js, Python, TensorFlow — comma separated (max 500 chars)">
                <input {...inp} value={tutor.specificSkills}
                  onChange={e => setTutor({ ...tutor, specificSkills: e.target.value })}
                  placeholder="React, Node.js, MongoDB, TypeScript…" required />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
                <Field label="LinkedIn Profile" hint="Optional but recommended">
                  <input {...inp} type="url" value={tutor.linkedinUrl}
                    onChange={e => setTutor({ ...tutor, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/…" />
                </Field>
                <Field label="Portfolio / GitHub URL" hint="Optional">
                  <input {...inp} type="url" value={tutor.portfolioUrl}
                    onChange={e => setTutor({ ...tutor, portfolioUrl: e.target.value })}
                    placeholder="https://github.com/…" />
                </Field>
              </div>

              <Field label="Why do you want to teach on AILearn?" required
                hint={`Minimum 100 characters. ${tutor.teachingStatement.length}/1000`}>
                <textarea {...inp}
                  value={tutor.teachingStatement}
                  onChange={e => setTutor({ ...tutor, teachingStatement: e.target.value })}
                  placeholder="Describe your passion for teaching, what you'll bring to students, and your teaching philosophy…"
                  rows={4} maxLength={1000} required
                  style={{ resize: "vertical" }} />
              </Field>

              {/* Resume upload */}
              <Field label="Upload Resume" required hint="PDF, DOC, or DOCX · Max 5 MB">
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: ".5rem", padding: "1.25rem",
                  border: `2px dashed ${resumeError ? "var(--danger)" : resumeFile ? "#059669" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  background: resumeFile ? "#F0FDF4" : "var(--bg)",
                  transition: "all .2s",
                }}>
                  <span style={{ fontSize: "1.75rem" }}>{resumeFile ? "✅" : "📄"}</span>
                  <span style={{ fontSize: ".82rem", fontWeight: 600, color: resumeFile ? "#059669" : "var(--text-secondary)" }}>
                    {resumeFile ? resumeFile.name : "Click to upload resume"}
                  </span>
                  {resumeFile && (
                    <span style={{ fontSize: ".72rem", color: "var(--text-muted)" }}>
                      {(resumeFile.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResume} style={{ display: "none" }} />
                </label>
                {resumeError && (
                  <div style={{ fontSize: ".75rem", color: "var(--danger)", marginTop: ".3rem" }}>{resumeError}</div>
                )}
              </Field>

              {/* What happens next info box */}
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE",
                borderRadius: 8, padding: ".85rem 1rem", marginBottom: "1.25rem",
                fontSize: ".78rem", color: "#1E40AF", lineHeight: 1.65 }}>
                <strong>📋 What happens next?</strong>
                <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>
                  <li>Our admin team reviews your application within 2-3 business days</li>
                  <li>You'll receive an email with the decision and feedback</li>
                  <li>If approved, you can log in and start creating courses immediately</li>
                  <li>If not approved, you'll receive specific feedback to reapply</li>
                </ul>
              </div>

              <div style={{ display: "flex", gap: ".75rem" }}>
                <button type="button" className="btn btn-outline"
                  style={{ flex: 1 }} onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button type="submit" className="btn btn-primary"
                  style={{ flex: 2, justifyContent: "center" }}
                  disabled={loading}>
                  {loading ? "Submitting application…" : "Submit Application →"}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3: Confirmation (tutors) ─────────────────────────────── */}
          {step === 3 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC",
                borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
                <div style={{ fontSize: ".9rem", color: "#166534", lineHeight: 1.75 }}>
                  <strong>✅ Application received!</strong><br />
                  We've sent a confirmation to <strong>{basic.email}</strong>.<br />
                  Our team will review your credentials and teaching statement.
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "1rem", marginBottom: "1.5rem",
                textAlign: "left", fontSize: ".82rem" }}>
                <div style={{ fontWeight: 700, marginBottom: ".6rem", color: "var(--text-secondary)" }}>
                  📋 Application Summary
                </div>
                {[
                  ["Name",            basic.name],
                  ["Email",           basic.email],
                  ["Qualification",   tutor.highestQualification],
                  ["Experience",      `${tutor.yearsOfExperience} years`],
                  ["Expertise Area",  tutor.areaOfExpertise],
                  ["Resume",          resumeFile?.name || "Uploaded"],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", gap: ".5rem",
                    padding: ".3rem 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-muted)", width: 110, flexShrink: 0 }}>{label}:</span>
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: ".75rem", justifyContent: "center" }}>
                <Link to="/login" className="btn btn-outline">Sign In (after approval)</Link>
                <Link to="/"      className="btn btn-primary">Back to Home</Link>
              </div>
            </div>
          )}

          {step !== 3 && (
            <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: ".875rem", color: "var(--text-muted)" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ fontWeight: 600, color: "var(--primary)" }}>Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}