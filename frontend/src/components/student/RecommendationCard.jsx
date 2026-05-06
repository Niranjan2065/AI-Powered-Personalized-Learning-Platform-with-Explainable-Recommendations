/**
 * components/student/RecommendationCard.jsx
 * Displays a single recommended topic with the AI explanation
 * (human-readable reason + SHAP bar chart).
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import "./RecommendationCard.css";

function ShapBar({ contributions }) {
  if (!contributions) return null;

  const data = Object.entries(contributions).map(([name, value]) => ({
    name,
    value: parseFloat(value),
    abs: Math.abs(parseFloat(value)),
  }));

  return (
    <div className="shap-section">
      <p className="shap-label">What influenced this recommendation (SHAP)</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
        >
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => v.toFixed(4)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e8e8e4" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.value >= 0 ? "#1d9e75" : "#d85a30"}
                opacity={0.75 + entry.abs * 0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="shap-legend">
        <span className="shap-pos">Green = helped recommendation</span>
        <span className="shap-neg">Orange = worked against it</span>
      </p>
    </div>
  );
}

export default function RecommendationCard({ topicId, rank, explanation }) {
  const humanReason   = explanation?.human_readable   || "";
  const weakNote      = explanation?.weak_topic_note  || "";
  const contributions = explanation?.shap_contributions || null;

  return (
    <div className="rec-card">
      <div className="rec-header">
        <div className="rec-rank">#{rank}</div>
        <div>
          <h3 className="rec-topic">Topic {topicId}</h3>
          <span className="rec-badge">AI recommended</span>
        </div>
      </div>

      {humanReason && (
        <div className="rec-reason">
          <span className="reason-icon">◉</span>
          <p>{humanReason}</p>
        </div>
      )}

      {weakNote && rank === 1 && (
        <div className="rec-weak-note">
          <span className="weak-icon">⚑</span>
          <p>{weakNote}</p>
        </div>
      )}

      <ShapBar contributions={contributions} />

      <button className="rec-start-btn">Start learning →</button>
    </div>
  );
}
