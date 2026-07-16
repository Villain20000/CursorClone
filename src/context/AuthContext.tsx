import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, getAccessToken, setTokens, clearTokens, onTokenRefresh } from "../services/api";
import type { User } from "@shared/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; username?: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const u = await api.auth.me();
      setUser(u);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    const off = onTokenRefresh(async () => {
      try {
        const u = await api.auth.me();
        setUser(u);
      } catch {
        setUser(null);
      }
    });
    return off;
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
  };

  const register = async (data: { email: string; password: string; username?: string; displayName?: string }) => {
    const result = await api.auth.register(data);
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    setUser(result.user);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    clearTokens();
    setUser(null);
  };

  const updateUser = (data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
