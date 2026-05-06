/**
 * App.jsx
 * Router setup with protected routes.
 * Students → /dashboard
 * Teachers → /teacher, /students/:id
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar              from "./components/shared/Navbar";
import LoginPage           from "./pages/LoginPage";
import StudentDashboard    from "./pages/StudentDashboard";
import TeacherDashboard    from "./pages/TeacherDashboard";
import StudentDetailPage   from "./pages/StudentDetailPage";

/** Redirect to login if not authenticated */
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Redirect to correct dashboard based on role */
function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "teacher" ? "/teacher" : "/dashboard"} replace />;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login"   element={<LoginPage />} />
        <Route path="/"        element={<RoleRedirect />} />

        {/* Student routes */}
        <Route path="/dashboard" element={
          <RequireAuth><StudentDashboard /></RequireAuth>
        } />

        {/* Teacher routes */}
        <Route path="/teacher" element={
          <RequireAuth><TeacherDashboard /></RequireAuth>
        } />
        <Route path="/students/:studentId" element={
          <RequireAuth><StudentDetailPage /></RequireAuth>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
