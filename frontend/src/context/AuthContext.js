/**
 * context/AuthContext.js
 * Lightweight session context.
 * In production this connects to your backend auth (JWT / session).
 * For now it stores the current user in localStorage.
 */

import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lp_user")) || null;
    } catch {
      return null;
    }
  });

  function login(userData) {
    localStorage.setItem("lp_user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("lp_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
