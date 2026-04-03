import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("access");
    if (!token) {
      setUser(null);
      return;
    }
    if (localStorage.getItem("chat_demo") === "1") {
      setUser({ id: 0, username: "demo", is_demo: true });
      return;
    }
    try {
      const { data } = await api.get("/api/auth/profile/me/");
      setUser(data);
    } catch {
      const u = localStorage.getItem("last_username");
      if (u) setUser({ username: u });
      else setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshProfile();
      setLoading(false);
    })();
  }, [refreshProfile]);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post("/api/auth/token/", { username, password });
    localStorage.setItem("access", data.access);
    localStorage.setItem("last_username", username);
    if (data.refresh) localStorage.setItem("refresh", data.refresh);
    localStorage.removeItem("chat_demo");
    setUser({ username });
    try {
      const { data: profile } = await api.get("/api/auth/profile/me/");
      setUser(profile);
    } catch {
      /* keep username from JWT login */
    }
  }, []);

  const register = useCallback(
    async (body) => {
      const { data } = await api.post("/api/auth/register/", body);
      if (data.access) {
        localStorage.setItem("access", data.access);
        if (data.refresh) localStorage.setItem("refresh", data.refresh);
        localStorage.setItem("last_username", body.username);
        localStorage.removeItem("chat_demo");
        try {
          const { data: profile } = await api.get("/api/auth/profile/me/");
          setUser(profile);
        } catch {
          setUser(data.user ? { ...data.user } : { username: body.username });
        }
        return;
      }
      await login(body.username, body.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("last_username");
    localStorage.removeItem("chat_demo");
    setUser(null);
  }, []);

  const enableDemoUser = useCallback(() => {
    localStorage.setItem("chat_demo", "1");
    setUser({ id: 0, username: "demo", is_demo: true });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshProfile,
      enableDemoUser,
    }),
    [user, loading, login, register, logout, refreshProfile, enableDemoUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
