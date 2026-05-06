/**
 * components/student/WeakTopicsPanel.jsx
 * Highlights topics where the student scored lowest.
 */

import "./WeakTopicsPanel.css";

export default function WeakTopicsPanel({ weakTopics }) {
  if (!weakTopics || weakTopics.length === 0) return null;

  return (
    <div className="weak-panel">
      <div className="weak-panel-header">
        <span className="weak-panel-icon">⚑</span>
        <h3>Topics to review</h3>
      </div>
      <p className="weak-panel-sub">
        Our AI detected you scored lowest on these topics. Revisiting them will improve your recommendations.
      </p>
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
    </div>
  );
}
