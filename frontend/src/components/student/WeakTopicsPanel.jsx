/**
 * components/student/WeakTopicsPanel.jsx
 *
 * UPGRADED: Now calls /api/students/<id>/recommendations (Python ML service)
 * and shows for each weak topic:
 *   - Real topic name + avg score badge
 *   - XAI plain-English reason (from generate_xai_reason)
 *   - Up to 3 ranked resource links (video / article / practice)
 *   - Helpful / Not helpful feedback buttons
 *
 * Props:
 *   studentId  string   MongoDB student _id (from useAuth)
 *   weakTopics array    Fallback list of topic IDs from Node.js backend
 *                       (shown while ML data loads or if ML is offline)
 */

import { useState, useEffect, useCallback } from "react";
import "./WeakTopicsPanel.css";

// ── Resource type config ──────────────────────────────────────────────────────
const TYPE_CONFIG = {
  video:    { icon: "▶", label: "Video",    color: "#4F46E5" },
  article:  { icon: "📄", label: "Article",  color: "#6B7280" },
  practice: { icon: "⌨", label: "Practice", color: "#1d9e75" },
};

// ── Score badge colour ────────────────────────────────────────────────────────
function scoreBadgeStyle(score) {
  if (score < 35) return { background: "#fee2e2", color: "#b91c1c" };
  if (score < 50) return { background: "#fef3c7", color: "#92400e" };
  return             { background: "#fff8f0", color: "#993c1d" };
}

// ── Single resource row ───────────────────────────────────────────────────────
function ResourceLink({ resource, studentId, onFeedback }) {
  const cfg = TYPE_CONFIG[resource.type] || TYPE_CONFIG.article;

  const handleFeedback = async (helpful) => {
    onFeedback(resource.id, helpful);
    try {
      await fetch(`/ml/api/students/${studentId}/resource-feedback`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id:    resource.id,
          helpful,
          time_spent_sec: 0,
        }),
      });
    } catch (_) {
      // Non-critical — feedback failure doesn't break the UI
    }
  };

  return (
    <div className="wtp-resource-row">
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="wtp-resource-link"
      >
        <span
          className="wtp-res-type"
          style={{ background: cfg.color + "18", color: cfg.color }}
        >
          {cfg.icon} {cfg.label}
        </span>
        <span className="wtp-res-title">{resource.title}</span>
        <span className="wtp-res-site">{resource.site}</span>
        <span className="wtp-res-arrow">↗</span>
      </a>
      <div className="wtp-feedback-row">
        <span className="wtp-feedback-label">Helpful?</span>
        <button
          className="wtp-feedback-btn"
          onClick={() => handleFeedback(true)}
          title="Mark as helpful"
        >
          Yes
        </button>
        <button
          className="wtp-feedback-btn"
          onClick={() => handleFeedback(false)}
          title="Mark as not helpful"
        >
          No
        </button>
      </div>
    </div>
  );
}

// ── Single weak topic card ────────────────────────────────────────────────────
function WeakTopicCard({ rec, studentId }) {
  const [expanded, setExpanded]         = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState({});

  const handleFeedback = (resourceId, helpful) => {
    setFeedbackGiven((prev) => ({ ...prev, [resourceId]: helpful }));
  };

  return (
    <div className="wtp-card">
      {/* Card header */}
      <div
        className="wtp-card-header"
        onClick={() => setExpanded((v) => !v)}
        style={{ cursor: "pointer" }}
      >
        <div className="wtp-card-left">
          <div className="weak-dot" />
          <div className="weak-info">
            <span className="weak-topic-name">{rec.topic_name}</span>
            <span
              className="wtp-score-badge"
              style={scoreBadgeStyle(rec.avg_score)}
            >
              {rec.avg_score}% avg
            </span>
          </div>
        </div>
        <div className="wtp-card-right">
          <span className="wtp-toggle">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="wtp-card-body">
          {/* XAI plain-English reason */}
          {rec.xai_reason && (
            <div className="wtp-xai-reason">
              <span className="wtp-xai-icon">◉</span>
              <p>{rec.xai_reason}</p>
            </div>
          )}

          {/* Resource links */}
          {rec.resources && rec.resources.length > 0 ? (
            <div className="wtp-resources">
              <p className="wtp-resources-label">Suggested resources</p>
              {rec.resources.map((r) =>
                feedbackGiven[r.id] !== undefined ? (
                  <div key={r.id} className="wtp-feedback-done">
                    {feedbackGiven[r.id]
                      ? "✓ Marked as helpful"
                      : "✓ Feedback recorded — we'll improve suggestions"}
                  </div>
                ) : (
                  <ResourceLink
                    key={r.id}
                    resource={r}
                    studentId={studentId}
                    onFeedback={handleFeedback}
                  />
                )
              )}
            </div>
          ) : (
            <p className="wtp-no-resources">
              No resources found for this topic yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Fallback: renders plain weak topic list (when ML is offline) ──────────────
function FallbackList({ weakTopics }) {
  if (!weakTopics || weakTopics.length === 0) return null;
  return (
    <div className="weak-list">
      {weakTopics.map((topicId) => (
        <div key={topicId} className="weak-item">
          <div className="weak-dot" />
          <div className="weak-info">
            <span className="weak-topic-name">Topic {topicId}</span>
            <span className="weak-hint">Low score detected</span>
          </div>
          <button className="weak-review-btn">Review →</button>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WeakTopicsPanel({ studentId, weakTopics }) {
  const [recs, setRecs]       = useState(null);   // ML recommendations
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchRecs = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/ml/api/students/${studentId}/recommendations?limit=5`
      );
      if (!res.ok) throw new Error(`ML service returned ${res.status}`);
      const data = await res.json();
      setRecs(data.recommendations || []);
    } catch (err) {
      // ML service offline — fall back to plain list
      setError(err.message);
      setRecs(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  // Nothing to show
  const hasMLData    = recs && recs.length > 0;
  const hasFallback  = weakTopics && weakTopics.length > 0;
  if (!loading && !hasMLData && !hasFallback) return null;

  return (
    <div className="weak-panel">
      {/* Header */}
      <div className="weak-panel-header">
        <span className="weak-panel-icon">⚑</span>
        <h3>Topics to improve</h3>
      </div>

      <p className="weak-panel-sub">
        {hasMLData
          ? "Our AI identified these weak areas and found resources to help you improve."
          : "Our AI detected you scored lowest on these topics. Revisiting them will improve your recommendations."}
      </p>

      {/* Loading state */}
      {loading && (
        <div className="wtp-loading">
          <div className="wtp-spinner" />
          <span>Analysing your performance…</span>
        </div>
      )}

      {/* ML-powered cards */}
      {!loading && hasMLData && (
        <div className="weak-list">
          {recs.map((rec) => (
            <WeakTopicCard
              key={rec.topic_id}
              rec={rec}
              studentId={studentId}
            />
          ))}
        </div>
      )}

      {/* Fallback plain list (ML offline) */}
      {!loading && !hasMLData && hasFallback && (
        <>
          {error && (
            <p className="wtp-offline-note">
              ⚠ Resource suggestions unavailable (ML service offline)
            </p>
          )}
          <FallbackList weakTopics={weakTopics} />
        </>
      )}

      {/* Retry button when ML failed */}
      {!loading && error && (
        <button className="wtp-retry-btn" onClick={fetchRecs}>
          Retry ↻
        </button>
      )}
    </div>
  );
}