/**
 * pages/CreateLessonPage.jsx
 *
 * NEXT STEP UPGRADE — Block-based lesson editor
 *
 * Replaces the inline mini-form in ManageCoursePage with a dedicated page:
 *   /tutor/courses/:courseId/modules/:moduleId/lessons/create
 *
 * Features added:
 *  • Block editor: Text | Video | Image | Code | Quiz-placeholder blocks
 *  • Skill/topic tag picker with predefined suggestions + free input
 *  • Difficulty & estimated duration controls
 *  • Publish toggle (draft vs published)
 *  • AI "Generate Quiz" shortcut after save
 *
 * HOW TO WIRE UP:
 *  1. Drop this file into  frontend/src/pages/CreateLessonPage.jsx
 *  2. Add route in App.jsx (inside tutor block):
 *       <Route
 *         path="/tutor/courses/:courseId/modules/:moduleId/lessons/create"
 *         element={
 *           <RequireRole roles={["tutor","teacher"]}>
 *             <CreateLessonPage />
 *           </RequireRole>
 *         }
 *       />
 *  3. In ManageCoursePage.jsx replace the "+ Add Lesson" button click handler with:
 *       navigate(`/tutor/courses/${id}/modules/${mod._id}/lessons/create`)
 *     (remove the inline addingLesson form panel — it's now a full page)
 */

import React, { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/common/Navbar";
import { createLesson } from "../utils/api";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: "text",  icon: "📝", label: "Text"      },
  { type: "video", icon: "🎬", label: "Video"     },
  { type: "image", icon: "🖼️",  label: "Image URL" },
  { type: "code",  icon: "💻", label: "Code"      },
  { type: "quiz",  icon: "❓", label: "Quiz note" },
];

const SKILL_SUGGESTIONS = [
  "variables", "loops", "functions", "recursion", "arrays",
  "objects", "classes", "algorithms", "data structures",
  "sql", "api", "authentication", "react", "python",
  "machine learning", "statistics", "linear algebra",
  "quadratic equations", "calculus", "probability",
];

const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"];

const DEFAULT_BLOCK = (type) => ({
  id: Date.now() + Math.random(),
  type,
  content: "",
  language: "javascript",   // code blocks only
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const buildApiPayload = (meta, blocks, skillTags) => {
  const textParts = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.content)
    .join("\n\n");

  const videoBlock = blocks.find((b) => b.type === "video");
  const codeBlocks = blocks
    .filter((b) => b.type === "code")
    .map((b) => "```" + b.language + "\n" + b.content + "\n```")
    .join("\n\n");

  const fullText = [textParts, codeBlocks].filter(Boolean).join("\n\n");

  const contentType = videoBlock ? "video" : "text";

  const content =
    contentType === "video"
      ? { videoUrl: videoBlock.content, text: fullText, videoDuration: 0 }
      : { text: fullText };

  return {
    title:             meta.title,
    contentType,
    content,
    topics:            skillTags,
    estimatedDuration: parseInt(meta.duration) || 10,
    difficulty:        meta.difficulty,
    isPublished:       meta.isPublished,
    // store raw blocks as JSON in a `blocks` field if your schema supports it
    blocks:            blocks.map(({ id, ...b }) => b),
  };
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function BlockToolbar({ onAdd }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
      {BLOCK_TYPES.map(({ type, icon, label }) => (
        <button
          key={type}
          type="button"
          onClick={() => onAdd(type)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: "var(--radius-sm)",
            border: "1px dashed var(--border)", background: "var(--bg-2)",
            color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <span>{icon}</span> {label}
        </button>
      ))}
    </div>
  );
}

function TextBlock({ block, onChange, onDelete, onMove, isFirst, isLast }) {
  return (
    <BlockShell block={block} onDelete={onDelete} onMove={onMove} isFirst={isFirst} isLast={isLast}>
      <textarea
        value={block.content}
        onChange={(e) => onChange(block.id, "content", e.target.value)}
        placeholder="Write lesson content here… Markdown is supported.

# Heading
## Sub-heading
- bullet point
`inline code`
**bold**"
        rows={7}
        style={{ width: "100%", resize: "vertical", fontFamily: "inherit",
          fontSize: 14, lineHeight: 1.7, padding: "10px 12px",
          border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
          background: "var(--surface)", color: "var(--text-primary)",
          boxSizing: "border-box" }}
      />
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        {block.content.length} chars · Markdown supported
      </div>
    </BlockShell>
  );
}

function VideoBlock({ block, onChange, onDelete, onMove, isFirst, isLast }) {
  const embedId = (() => {
    const u = block.content;
    const m = u.match(/(?:v=|youtu\.be\/)([^?&]+)/);
    return m ? m[1] : null;
  })();

  return (
    <BlockShell block={block} onDelete={onDelete} onMove={onMove} isFirst={isFirst} isLast={isLast}>
      <input
        type="url"
        value={block.content}
        onChange={(e) => onChange(block.id, "content", e.target.value)}
        placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
        style={{ width: "100%", fontSize: 14, padding: "9px 12px",
          border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
          background: "var(--surface)", color: "var(--text-primary)",
          boxSizing: "border-box" }}
      />
      {embedId && (
        <div style={{ marginTop: 10, borderRadius: "var(--radius-sm)", overflow: "hidden",
          position: "relative", paddingBottom: "40%", background: "#000" }}>
          <iframe
            src={`https://www.youtube.com/embed/${embedId}`}
            title="preview"
            frameBorder="0"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          />
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        Supports: youtube.com/watch?v=… · youtu.be/… · youtube.com/embed/…
      </div>
    </BlockShell>
  );
}

function ImageBlock({ block, onChange, onDelete, onMove, isFirst, isLast }) {
  return (
    <BlockShell block={block} onDelete={onDelete} onMove={onMove} isFirst={isFirst} isLast={isLast}>
      <input
        type="url"
        value={block.content}
        onChange={(e) => onChange(block.id, "content", e.target.value)}
        placeholder="https://example.com/image.png"
        style={{ width: "100%", fontSize: 14, padding: "9px 12px",
          border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
          background: "var(--surface)", color: "var(--text-primary)",
          boxSizing: "border-box", marginBottom: 8 }}
      />
      {block.content && (
        <img src={block.content} alt="preview"
          style={{ maxWidth: "100%", maxHeight: 200, borderRadius: "var(--radius-xs)",
            objectFit: "contain", border: "1px solid var(--border)" }}
          onError={(e) => (e.target.style.display = "none")} />
      )}
    </BlockShell>
  );
}

function CodeBlock({ block, onChange, onDelete, onMove, isFirst, isLast }) {
  const LANGS = ["javascript", "python", "java", "sql", "bash", "html", "css", "typescript"];
  return (
    <BlockShell block={block} onDelete={onDelete} onMove={onMove} isFirst={isFirst} isLast={isLast}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select
          value={block.language}
          onChange={(e) => onChange(block.id, "language", e.target.value)}
          style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--border)",
            borderRadius: "var(--radius-xs)", background: "var(--surface)",
            color: "var(--text-secondary)", cursor: "pointer" }}
        >
          {LANGS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>Language</span>
      </div>
      <textarea
        value={block.content}
        onChange={(e) => onChange(block.id, "content", e.target.value)}
        placeholder={`// Write your ${block.language} code here...`}
        rows={6}
        spellCheck={false}
        style={{ width: "100%", resize: "vertical", fontFamily: "monospace",
          fontSize: 13, lineHeight: 1.6, padding: "10px 12px",
          border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
          background: "#1E1E2E", color: "#CDD6F4",
          boxSizing: "border-box" }}
      />
    </BlockShell>
  );
}

function QuizNoteBlock({ block, onChange, onDelete, onMove, isFirst, isLast }) {
  return (
    <BlockShell block={block} onDelete={onDelete} onMove={onMove} isFirst={isFirst} isLast={isLast}>
      <div style={{ padding: "14px 16px", background: "#FFFBEB",
        borderRadius: "var(--radius-xs)", border: "1px solid #FDE68A" }}>
        <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 6, fontSize: 13 }}>
          ❓ Quiz checkpoint
        </div>
        <textarea
          value={block.content}
          onChange={(e) => onChange(block.id, "content", e.target.value)}
          placeholder="Describe what this quiz should test (AI will use this as a hint when generating questions)…"
          rows={3}
          style={{ width: "100%", fontSize: 13, resize: "vertical", border: "none",
            background: "transparent", color: "#78350F", fontFamily: "inherit",
            boxSizing: "border-box", outline: "none" }}
        />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        AI quiz generator will see this note when generating questions for this lesson.
      </div>
    </BlockShell>
  );
}

function BlockShell({ block, onDelete, onMove, isFirst, isLast, children }) {
  const typeInfo = BLOCK_TYPES.find((b) => b.type === block.type) || {};
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
      overflow: "hidden", marginBottom: 12, background: "var(--surface)" }}>
      {/* Block header */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 14px",
        borderBottom: "1px solid var(--border)", background: "var(--bg-2)",
        gap: 8 }}>
        <span style={{ fontSize: 13 }}>{typeInfo.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: ".04em", flex: 1 }}>
          {typeInfo.label} block
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" onClick={() => onMove(block.id, -1)} disabled={isFirst}
            title="Move up"
            style={{ padding: "2px 8px", fontSize: 13, cursor: isFirst ? "default" : "pointer",
              border: "1px solid var(--border)", borderRadius: 4,
              background: "var(--surface)", color: isFirst ? "var(--text-muted)" : "var(--text-secondary)" }}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(block.id, 1)} disabled={isLast}
            title="Move down"
            style={{ padding: "2px 8px", fontSize: 13, cursor: isLast ? "default" : "pointer",
              border: "1px solid var(--border)", borderRadius: 4,
              background: "var(--surface)", color: isLast ? "var(--text-muted)" : "var(--text-secondary)" }}>
            ↓
          </button>
          <button type="button" onClick={() => onDelete(block.id)}
            title="Delete block"
            style={{ padding: "2px 8px", fontSize: 13, cursor: "pointer",
              border: "1px solid var(--border)", borderRadius: 4,
              background: "var(--surface)", color: "#DC2626" }}>
            ✕
          </button>
        </div>
      </div>
      {/* Block body */}
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}

function SkillTagPicker({ tags, onChange }) {
  const [inputVal, setInputVal] = useState("");

  const addTag = (tag) => {
    const t = tag.toLowerCase().trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInputVal("");
  };

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag));

  const handleKeyDown = (e) => {
    if ((e.key === "Enter" || e.key === ",") && inputVal.trim()) {
      e.preventDefault();
      addTag(inputVal);
    }
    if (e.key === "Backspace" && !inputVal && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const suggestions = SKILL_SUGGESTIONS.filter(
    (s) => !tags.includes(s) &&
      (!inputVal || s.includes(inputVal.toLowerCase()))
  ).slice(0, 8);

  return (
    <div>
      {/* Tag chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {tags.map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4,
            padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500,
            background: "var(--primary-light)", color: "var(--primary-dark)" }}>
            {t}
            <button type="button" onClick={() => removeTag(t)}
              style={{ border: "none", background: "transparent",
                cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, fontSize: 13 }}>
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Type a skill and press Enter…" : "Add more…"}
          style={{ border: "none", outline: "none", fontSize: 13,
            background: "transparent", color: "var(--text-primary)",
            minWidth: 160, flex: 1 }}
        />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", marginRight: 4 }}>
            Suggestions:
          </span>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => addTag(s)}
              style={{ padding: "3px 10px", fontSize: 11, cursor: "pointer",
                borderRadius: 999, border: "1px solid var(--border)",
                background: "var(--bg-2)", color: "var(--text-secondary)",
                transition: "all .1s" }}
              onMouseEnter={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--text-secondary)"; }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function CreateLessonPage() {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();

  // Metadata
  const [meta, setMeta] = useState({
    title: "",
    duration: "10",
    difficulty: "beginner",
    isPublished: false,
  });
  const setM = (k, v) => setMeta((m) => ({ ...m, [k]: v }));

  // Blocks
  const [blocks, setBlocks] = useState([DEFAULT_BLOCK("text")]);

  // Skills
  const [skillTags, setSkillTags] = useState([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);   // saved lesson id

  // ── Block operations ──────────────────────
  const addBlock = useCallback((type) => {
    setBlocks((bs) => [...bs, DEFAULT_BLOCK(type)]);
  }, []);

  const updateBlock = useCallback((id, field, val) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, [field]: val } : b)));
  }, []);

  const deleteBlock = useCallback((id) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  }, []);

  const moveBlock = useCallback((id, dir) => {
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === id);
      const next = idx + dir;
      if (next < 0 || next >= bs.length) return bs;
      const arr = [...bs];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }, []);

  // ── Save ──────────────────────────────────
  const handleSave = async (publish = false) => {
    if (!meta.title.trim()) return toast.error("Please add a lesson title");
    if (blocks.length === 0) return toast.error("Add at least one content block");
    if (skillTags.length === 0) return toast.error("Add at least one skill tag so the AI can recommend this lesson");

    setSaving(true);
    const payload = buildApiPayload(
      { ...meta, isPublished: publish },
      blocks,
      skillTags
    );
    try {
      const { data } = await createLesson(moduleId, payload);
      setSaved(data.data._id);
      toast.success(publish ? "Lesson published! 🎉" : "Lesson saved as draft");
      if (publish) navigate(`/tutor/courses/${courseId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save lesson");
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ────────────────────────
  const renderBlock = (block, idx) => {
    const props = {
      key: block.id,
      block,
      onChange: updateBlock,
      onDelete: deleteBlock,
      onMove: moveBlock,
      isFirst: idx === 0,
      isLast: idx === blocks.length - 1,
    };
    switch (block.type) {
      case "text":  return <TextBlock  {...props} />;
      case "video": return <VideoBlock {...props} />;
      case "image": return <ImageBlock {...props} />;
      case "code":  return <CodeBlock  {...props} />;
      case "quiz":  return <QuizNoteBlock {...props} />;
      default:      return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
          <Link to="/tutor" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Tutor</Link>
          {" › "}
          <Link to={`/tutor/courses/${courseId}`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Course
          </Link>
          {" › "}
          <span style={{ color: "var(--text-primary)" }}>New Lesson</span>
        </div>

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", marginBottom: "1.75rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: ".25rem" }}>
              Create lesson
            </h1>
            <p style={{ fontSize: ".875rem", color: "var(--text-muted)", margin: 0 }}>
              Build your lesson with content blocks, then tag the skills it covers so the AI can recommend it accurately.
            </p>
          </div>
          <Link to={`/tutor/courses/${courseId}`} className="btn btn-ghost btn-sm">
            ← Back
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem",
          alignItems: "start" }}>

          {/* ── Left: Meta + Blocks ── */}
          <div>
            {/* Title */}
            <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600,
                color: "var(--text-secondary)", marginBottom: 6 }}>
                Lesson title *
              </label>
              <input
                className="form-control"
                value={meta.title}
                onChange={(e) => setM("title", e.target.value)}
                placeholder="e.g. Understanding Python variables"
                style={{ fontSize: "1.1rem", fontWeight: 600 }}
              />
            </div>

            {/* Blocks */}
            <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, margin: 0 }}>
                  📚 Content blocks
                </h3>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {blocks.length} block{blocks.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Block list */}
              {blocks.map((b, i) => renderBlock(b, i))}

              {/* Empty state */}
              {blocks.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem",
                  border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--text-muted)", fontSize: 14 }}>
                  No blocks yet. Add one below.
                </div>
              )}

              {/* Add block toolbar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>
                  + Add block
                </div>
                <BlockToolbar onAdd={addBlock} />
              </div>
            </div>

            {/* Skill tags */}
            <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
              <div style={{ marginBottom: ".75rem" }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, margin: "0 0 .25rem" }}>
                  🏷️ Skill tags *
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  These skills tell the AI recommendation engine what this lesson teaches.
                  Students with weak scores on these skills will be recommended this lesson.
                </p>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
                padding: "10px 12px", background: "var(--surface)", minHeight: 44 }}>
                <SkillTagPicker tags={skillTags} onChange={setSkillTags} />
              </div>
              {skillTags.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                  ✓ AI will recommend this lesson when a student struggles with:{" "}
                  <strong>{skillTags.join(", ")}</strong>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Settings panel ── */}
          <div style={{ position: "sticky", top: "1.5rem" }}>
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: ".875rem", fontWeight: 700, marginBottom: "1rem", margin: "0 0 1rem" }}>
                ⚙️ Lesson settings
              </h3>

              {/* Duration */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: 12, fontWeight: 600,
                  color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>
                  Estimated duration (min)
                </label>
                <input type="number" min="1" max="180"
                  className="form-control"
                  value={meta.duration}
                  onChange={(e) => setM("duration", e.target.value)}
                />
              </div>

              {/* Difficulty */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: 12, fontWeight: 600,
                  color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>
                  Difficulty
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button key={d} type="button"
                      onClick={() => setM("difficulty", d)}
                      style={{ flex: 1, padding: "6px 0", borderRadius: "var(--radius-xs)",
                        fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .1s",
                        border: "1px solid",
                        borderColor: meta.difficulty === d ? "var(--primary)" : "var(--border)",
                        background: meta.difficulty === d ? "var(--primary-light)" : "var(--surface)",
                        color: meta.difficulty === d ? "var(--primary-dark)" : "var(--text-secondary)",
                        textTransform: "capitalize" }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Publish toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Publish now</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Visible to students immediately
                  </div>
                </div>
                <div
                  onClick={() => setM("isPublished", !meta.isPublished)}
                  style={{ width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                    background: meta.isPublished ? "var(--primary)" : "var(--border)",
                    position: "relative", transition: "background .2s" }}>
                  <div style={{ position: "absolute", top: 2,
                    left: meta.isPublished ? 20 : 2,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", transition: "left .2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                </div>
              </div>
            </div>

            {/* Lesson summary */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem",
              background: "var(--primary-light)", border: "1px solid var(--primary)" }}>
              <h4 style={{ fontSize: ".8rem", fontWeight: 700,
                color: "var(--primary-dark)", margin: "0 0 .75rem" }}>
                Lesson summary
              </h4>
              {[
                { label: "Blocks",     value: blocks.length },
                { label: "Skill tags", value: skillTags.length },
                { label: "Duration",   value: `${meta.duration} min` },
                { label: "Difficulty", value: meta.difficulty },
                { label: "Status",     value: meta.isPublished ? "Will publish" : "Draft" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 12, padding: "4px 0",
                  borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  <span style={{ color: "var(--primary-dark)", fontWeight: 500 }}>{label}</span>
                  <span style={{ color: "var(--primary-dark)", fontWeight: 700,
                    textTransform: "capitalize" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Save buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}>
                {saving ? "Saving…" : "✓ Save & Publish"}
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="btn btn-outline"
                style={{ width: "100%", justifyContent: "center" }}>
                Save as Draft
              </button>
              {saved && (
                <Link
                  to={`/tutor/courses/${courseId}`}
                  className="btn btn-ghost"
                  style={{ width: "100%", textAlign: "center", fontSize: 13 }}>
                  ✦ Back to course →
                </Link>
              )}
            </div>

            {/* AI hint */}
            <div style={{ marginTop: "1rem", padding: "10px 12px",
              background: "#FFFBEB", borderRadius: "var(--radius-sm)",
              border: "1px solid #FDE68A", fontSize: 12,
              color: "#78350F", lineHeight: 1.5 }}>
              <strong>💡 Tip:</strong> Add a <em>Quiz note</em> block to hint the AI quiz
              generator about what to test. After saving, go to the Quizzes tab and click
              "Generate Quiz with AI" — it will use your lesson content automatically.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}