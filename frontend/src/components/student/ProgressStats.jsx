/**
 * components/student/ProgressStats.jsx
 * Shows the student's 7 AI features as metric cards.
 */

import "./ProgressStats.css";

const STAT_META = {
  avg_quiz_score:      { label: "Avg quiz score",     unit: "",   good: "high", icon: "◎" },
  avg_accuracy:        { label: "Accuracy rate",       unit: "",   good: "high", icon: "◈" },
  avg_time_efficiency: { label: "Time efficiency",     unit: "",   good: "high", icon: "◷" },
  avg_time_spent:      { label: "Avg time per topic",  unit: "min",good: "low",  icon: "◶" },
  total_errors:        { label: "Total errors",        unit: "",   good: "low",  icon: "◌" },
  struggle_topics:     { label: "Struggling topics",   unit: "",   good: "low",  icon: "◍" },
  topics_attempted:    { label: "Topics attempted",    unit: "",   good: "high", icon: "◉" },
};

function toneClass(key, scaledValue) {
  const meta = STAT_META[key];
  if (!meta) return "";
  const goodWhenHigh = meta.good === "high";
  if (goodWhenHigh)  return scaledValue >= 0.5 ? "stat-good" : scaledValue >= -0.5 ? "stat-mid" : "stat-poor";
  return scaledValue <= -0.5 ? "stat-good" : scaledValue <= 0.5 ? "stat-mid" : "stat-poor";
}

export default function ProgressStats({ features, cluster }) {
  if (!features) return null;

  return (
    <div className="progress-stats">
      <div className="stats-header">
        <h2>Your learning profile</h2>
        <span className="cluster-badge">Learning group {cluster + 1}</span>
      </div>
      <p className="stats-sub">
        These are the 7 features our AI uses to personalise your recommendations.
      </p>

      <div className="stats-grid">
        {Object.entries(features).map(([key, val]) => {
          const meta = STAT_META[key] || { label: key, unit: "", icon: "●" };
          const tone = toneClass(key, val);
          return (
            <div key={key} className={`stat-card ${tone}`}>
              <span className="stat-icon">{meta.icon}</span>
              <div className="stat-body">
                <span className="stat-label">{meta.label}</span>
                <span className="stat-value">
                  {parseFloat(val).toFixed(2)}
                  {meta.unit && <span className="stat-unit"> {meta.unit}</span>}
                </span>
                <span className="stat-note">scaled value</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="stats-footnote">
        Values are standardised (z-scores) — 0 = average, positive = above average, negative = below average.
      </p>
    </div>
  );
}
