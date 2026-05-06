/**
 * components/teacher/StudentRow.jsx
 * One row in the teacher's class overview table.
 */

import "./StudentRow.css";

function ClusterPill({ cluster }) {
  const colors = ["pill-blue", "pill-teal", "pill-amber", "pill-coral", "pill-purple"];
  const cls    = colors[cluster % colors.length];
  return <span className={`cluster-pill ${cls}`}>Group {cluster + 1}</span>;
}

export default function StudentRow({ student, onView }) {
  const { student_id, cluster, recommended_topics, weak_topics, student_features } = student;
  const score = student_features?.avg_quiz_score ?? 0;
  const errors = student_features?.total_errors ?? 0;

  const scoreClass =
    score >= 0.5 ? "score-good" : score >= -0.5 ? "score-mid" : "score-poor";

  return (
    <tr className="student-row">
      <td className="td-id">Student {student_id}</td>
      <td><ClusterPill cluster={cluster} /></td>
      <td>
        <span className={`score-tag ${scoreClass}`}>
          {score >= 0.5 ? "Above avg" : score >= -0.5 ? "Average" : "Needs help"}
        </span>
      </td>
      <td className="td-topics">
        {(recommended_topics || []).slice(0, 3).map((t) => (
          <span key={t} className="topic-chip">T{t}</span>
        ))}
      </td>
      <td className="td-topics">
        {(weak_topics || []).map((t) => (
          <span key={t} className="topic-chip weak-chip">T{t}</span>
        ))}
      </td>
      <td>
        <button className="view-btn" onClick={() => onView(student_id)}>
          View →
        </button>
      </td>
    </tr>
  );
}
