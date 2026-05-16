/**
 * components/shared/Navbar.jsx — REDIRECTS to unified Navbar
 *
 * BUG FIXED: This was a second conflicting Navbar used only by TeacherDashboard.
 *            Now simply re-exports the unified Navbar so no old imports break.
 */
export { default } from "../common/Navbar";
