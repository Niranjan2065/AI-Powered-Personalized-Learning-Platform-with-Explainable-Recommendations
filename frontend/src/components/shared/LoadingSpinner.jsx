import React from "react";
export default function LoadingSpinner({ size = 32, center = false }) {
  const spinner = (
    <div style={{
      width: size, height: size,
      border: `${size / 10}px solid var(--border)`,
      borderTopColor: "var(--primary)",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  );
  if (center) return <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>{spinner}</div>;
  return spinner;
}
