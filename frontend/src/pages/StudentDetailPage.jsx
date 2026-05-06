/**
 * pages/StudentDetailPage.jsx
 * Teacher's deep-dive view of one student.
 * Shows: recommendations, SHAP bar chart, LIME conditions.
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRecommendations, getLimeExplanation } from "../services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import ProgressStats  from "../components/student/ProgressStats";
import WeakTopicsPanel from "../components/student/WeakTopicsPanel";
import "./StudentDetailPage.css";

function ShapChart({ contributions }) {
  if (!contributions) return null;
  const data = Object.entries(contributions).map(([name, value]) => ({
    name, value: parseFloat(value),
  }));
  return (
    <div className="detail-chart-wrap">
      <h3 className="detail-section-title">SHAP — feature contributions</h3>
      <p className="detail-section-sub">
        Shows how much each feature pushed the AI toward this student's learning group.
        Green = helped the assignment, orange = worked against it.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 12, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category" dataKey="name" width={150}
            tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
          />
          <Tooltip
            formatter={(v) => v.toFixed(4)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e8e8e4" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.value >= 0 ? "#1d9e75" : "#d85a30"} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LimePanel({ limeData }) {
  if (!limeData || !limeData.lime_factors) return null;
  return (
    <div className="lime-panel">
      <h3 className="detail-section-title">LIME — local explanation</h3>
      <p className="detail-section-sub">
        LIME tests small variations around this student's data to find which
        conditions most influenced the recommendation.
      </p>
      <div className="lime-list">
        {limeData.lime_factors.map((f, i) => (
          <div key={i} className={`lime-row ${f.weight >= 0 ? "lime-pos" : "lime-neg"}`}>
            <span className="lime-condition">{f.condition}</span>
            <span className="lime-weight">{f.weight >= 0 ? "+" : ""}{f.weight.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  const { studentId }   = useParams();
  const navigate        = useNavigate();
  const [rec,  setRec]  = useState(null);
  const [lime, setLime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [recData, limeData] = await Promise.all([
          getRecommendations(Number(studentId), 5),
          getLimeExplanation(Number(studentId)),
        ]);
        setRec(recData);
        setLime(limeData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId]);

  if (loading) return <LoadingSpinner text="Loading student data…" />;

  if (error) return (
    <div className="detail-error">
      <p>Could not load student {studentId}: <strong>{error}</strong></p>
      <button onClick={() => navigate(-1)} className="back-btn">← Back</button>
    </div>
  );

  const { cluster, recommended_topics, weak_topics, student_features, explanation } = rec;

  return (
    <div className="detail-page">

      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <h1>Student {studentId}</h1>
          <p className="detail-subtitle">
            Full AI recommendation report with SHAP and LIME explanations
          </p>
        </div>
        <span className="detail-cluster-badge">Learning group {cluster + 1}</span>
      </div>

      <div className="detail-layout">

        {/* LEFT col */}
        <div className="detail-main">

          {/* Human-readable reason */}
          {explanation?.human_readable && (
            <div className="detail-reason-box">
              <span className="reason-label">AI recommendation reason</span>
              <p>{explanation.human_readable}</p>
              {explanation.weak_topic_note && (
                <p className="weak-note-text">{explanation.weak_topic_note}</p>
              )}
            </div>
          )}

          {/* SHAP chart */}
          <ShapChart contributions={explanation?.shap_contributions} />

          {/* LIME */}
          <LimePanel limeData={lime} />
        </div>

        {/* RIGHT col */}
        <div className="detail-sidebar">
          <WeakTopicsPanel weakTopics={weak_topics} />
          <ProgressStats   features={student_features} cluster={cluster} />

          {/* Recommended topic list */}
          <div className="detail-rec-list">
            <h3 className="detail-section-title">Recommended topics</h3>
            {recommended_topics.map((t, i) => (
              <div key={t} className="detail-rec-item">
                <span className="detail-rec-rank">#{i + 1}</span>
                <span className="detail-rec-name">Topic {t}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
