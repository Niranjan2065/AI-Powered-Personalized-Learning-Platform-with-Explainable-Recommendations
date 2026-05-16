/**
 * context/AuthContext.js — FIXED
 *
 * BUG FIXED: login(userData) was called like login(email, password) in LoginPage
 *            and register() didn't exist at all in RegisterPage.
 *
 * Now exposes:
 *   login(email, password)  → calls /api/auth/login, stores token+user
 *   register(formData)      → calls /api/auth/register, stores token+user
 *   logout()                → clears storage, redirects
 *   user                    → current user object or null
 */
import { createContext, useContext, useState, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API = axios.create({ baseURL: "/api", withCredentials: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lp_user")) || null;
    } catch {
      return null;
    }
  });

  // Attach stored token to every outgoing request
  API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // BUG FIX: login now accepts (email, password) and calls the backend
  const login = useCallback(async (email, password) => {
    const { data } = await API.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("lp_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  // BUG FIX: register() function was completely missing
  const register = useCallback(async (formData) => {
    const { data } = await API.post("/auth/register", formData);
    localStorage.setItem("token", data.token);
    localStorage.setItem("lp_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await API.post("/auth/logout"); } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("lp_user");
    setUser(null);
  }, []);

  // Refresh user from backend (call after profile updates)
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await API.get("/auth/me");
      localStorage.setItem("lp_user", JSON.stringify(data.user));
      setUser(data.user);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
