import React from "react";

export function Spinner({ center = false, size = 32 }) {
  const el = (
    <div style={{
      width: size, height: size,
      border: `${Math.max(2, size / 10)}px solid var(--border)`,
      borderTopColor: "var(--primary)",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
  if (center) return <div style={{ display:"flex", justifyContent:"center", padding:"3rem" }}>{el}</div>;
  return el;
}

export default function StatCard({ icon, label, value, color = "var(--primary)", suffix = "" }) {
  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: ".85rem" }}>
      <div style={{
        width: 48, height: 48, borderRadius: "var(--radius-sm)",
        background: color + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.4rem", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: ".15rem" }}>
          {label}
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color, lineHeight: 1 }}>
          {value}{suffix}
        </div>
      </div>
    </div>
  );
}
