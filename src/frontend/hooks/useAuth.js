// hooks/useAuth.js
// Global auth state using Supabase
// Wrap your app: <AuthProvider>{children}</AuthProvider>

"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/src/frontend/lib/supabase/client";

const AuthContext = createContext(null);

// Safe JSON reader: returns null instead of throwing on empty or invalid bodies
async function readJson(res) {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const checkAdmin = async (accessToken) => {
    setAdminChecked(false);
    if (!accessToken) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await readJson(res);
      setIsAdmin(Boolean(data?.user?.role === "admin"));
    } catch {
      setIsAdmin(false);
    } finally {
      setAdminChecked(true);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setToken(session?.access_token ?? null);
      setLoading(false);
      checkAdmin(session?.access_token ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setToken(session?.access_token ?? null);
      checkAdmin(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await readJson(res);
    if (!data) {
      return { success: false, error: `Login failed (status ${res.status})` };
    }
    if (data.success) {
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      }
    }
    return data;
  };

  const register = async (name, email, password, phone, dob, city, state, gender) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone, dob, city, state, gender }),
    });
    const data = await readJson(res);
    return data || { success: false, error: `Registration failed (status ${res.status})` };
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await supabase.auth.signOut();
    // Clear cart/wishlist from localStorage to prevent data leaking to next user
    if (user?.id) {
      localStorage.removeItem(`cartItems_${user.id}`);
      localStorage.removeItem(`wishlistItems_${user.id}`);
    }
    // Also clear legacy un-keyed entries
    localStorage.removeItem("cartItems");
    localStorage.removeItem("wishlistItems");
    setUser(null);
    setToken(null);
    setIsAdmin(false);
  };

  // useCallback keeps authFetch stable between renders, so effects that
  // depend on it don't re-run (and re-fetch) on every render.
  const authFetch = useCallback((url, options = {}) => {
    // If no token, redirect to login instead of making the request
    if (!token) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Not authenticated'));
    }
    
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, authFetch, isAdmin, adminChecked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}