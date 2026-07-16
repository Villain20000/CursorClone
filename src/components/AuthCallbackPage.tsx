import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { setTokens } from "../services/api";

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      setTokens({ accessToken, refreshToken });
      // Navigate to home — the AuthProvider will pick up the token
      navigate("/");
    } else {
      const error = searchParams.get("error");
      navigate(`/login${error ? `?error=${encodeURIComponent(error)}` : ""}`);
    }
  }, [searchParams, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="spinner" />
        <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
          Completing sign in...
        </p>
      </div>
    </div>
  );
}
