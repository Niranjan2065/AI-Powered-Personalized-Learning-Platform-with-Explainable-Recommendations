// src/components/shared/Navbar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FIX: Previously this was a 7-line stub with only a re-export comment,
// which caused confusion about whether the file was intentional or broken.
//
// This is a deliberate re-export. There is ONE canonical Navbar at:
//   src/components/common/Navbar.js
//
// This file exists only to satisfy legacy imports of the form:
//   import Navbar from '../components/shared/Navbar'
// (used by TeacherDashboard and some older pages)
//
// Do NOT add separate Navbar logic here. All Navbar changes go to:
//   src/components/common/Navbar.js
// ─────────────────────────────────────────────────────────────────────────────

export { default } from '../common/Navbar';