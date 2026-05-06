/**
 * components/shared/LoadingSpinner.jsx
 */

import "./LoadingSpinner.css";

export default function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <p className="spinner-text">{text}</p>
    </div>
  );
}
