import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOAuth = (provider: "google" | "github") => {
    window.location.href = `${API_URL}/api/auth/oauth/${provider}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>CursorClone</h1>
        <p className="auth-subtitle">Sign in to your account</p>
        {error && <div className="auth-error">{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            style={{
              background: "#fff",
              color: "#333",
              border: "1px solid #ccc",
              padding: "8px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("github")}
            style={{
              background: "#24292f",
              color: "#fff",
              border: "1px solid #24292f",
              padding: "8px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Continue with GitHub
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="auth-footer">
          <span>Don't have an account? </span>
          <button className="link-button" onClick={() => navigate("/register")}>
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
