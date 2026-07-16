// Frontend API client with auth token management
import type { User, Project, FileEntry, AIConfig, UserSettings } from "@shared/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const API_BASE = `${API_URL}/api`;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

let tokens: AuthTokens | null = null;
let refreshPromise: Promise<string> | null = null;
let tokenListeners: Array<(token: string) => void> = [];

// Electron bridge for secure token storage (best-effort, async)
const isElectron = typeof window !== "undefined" && !!(window as Window & { cursor?: unknown }).cursor;

function setElectronToken(token: string): void {
  if (!isElectron) return;
  try {
    void (window as unknown as { cursor: { setToken: (t: string) => Promise<boolean> } }).cursor.setToken(token);
  } catch {}
}

function clearElectronToken(): void {
  if (!isElectron) return;
  try {
    void (window as unknown as { cursor: { clearToken: () => Promise<boolean> } }).cursor.clearToken();
  } catch {}
}

export function setTokens(t: AuthTokens) {
  tokens = t;
  if (isElectron) {
    setElectronToken(t.accessToken);
  } else {
    try {
      localStorage.setItem("cc_tokens", JSON.stringify(t));
    } catch {}
  }
}

export function getAccessToken(): string | null {
  if (tokens) return tokens.accessToken;
  if (isElectron) return null;
  try {
    const stored = localStorage.getItem("cc_tokens");
    if (stored) {
      tokens = JSON.parse(stored) as AuthTokens;
      return tokens.accessToken;
    }
  } catch {}
  return null;
}

export function getRefreshToken(): string | null {
  if (tokens) return tokens.refreshToken;
  if (isElectron) return null;
  try {
    const stored = localStorage.getItem("cc_tokens");
    if (stored) {
      tokens = JSON.parse(stored) as AuthTokens;
      return tokens.refreshToken;
    }
  } catch {}
  return null;
}

export function clearTokens() {
  tokens = null;
  if (isElectron) {
    clearElectronToken();
  } else {
    try { localStorage.removeItem("cc_tokens"); } catch {}
  }
}

export function onTokenRefresh(cb: (token: string) => void) {
  tokenListeners.push(cb);
  return () => { tokenListeners = tokenListeners.filter((l) => l !== cb); };
}

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error("No refresh token");

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        throw new Error("Refresh failed");
      }

      const data = await res.json() as AuthTokens;
      setTokens(data);
      tokenListeners.forEach((cb) => cb(data.accessToken));
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getAccessToken();

  const makeRequest = async (authToken: string | null): Promise<T> => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    };

    // Merge any custom headers from options
    if (options.headers) {
      const customHeaders = options.headers as Record<string, string>;
      for (const [key, value] of Object.entries(customHeaders)) {
        headers[key] = value;
      }
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && authToken && !headers["X-Retry"]) {
      try {
        const newToken = await refreshAccessToken();
        return makeRequest(newToken);
      } catch {
        throw new Error("Authentication required");
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  };

  return makeRequest(token);
}

// ─── Auth ───────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (data: { email: string; password: string; username?: string; displayName?: string }) =>
      request<{ user: User; accessToken: string; refreshToken: string }>(
        "/auth/register",
        { method: "POST", body: JSON.stringify(data) }
      ),

    login: (email: string, password: string) =>
      request<{ user: User; accessToken: string; refreshToken: string }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      ),

    logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),

    me: () => request<User>("/auth/me"),

    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  users: {
    get: (id: string) => request<User>(`/users/${id}`),
    update: (data: Partial<Pick<User, "displayName" | "username" | "avatarUrl">>) =>
      request<User>("/users/me", { method: "PUT", body: JSON.stringify(data) }),
    getSessions: () => request<Array<{ id: string; userAgent: string; ipAddress: string; createdAt: string; expiresAt: string }>>("/users/me/sessions"),
    revokeSession: (sessionId: string) =>
      request<{ message: string }>(`/users/me/sessions/${sessionId}`, { method: "DELETE" }),
  },

  projects: {
    list: () => request<Array<Project & { memberRole: string }>>("/projects"),
    create: (data: { name: string; description?: string; visibility?: "PRIVATE" | "PUBLIC" | "TEAM" }) =>
      request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
    get: (id: string) => request<Project & { members: Array<{ user: User; role: string }> }>
      (`/projects/${id}`),
    update: (id: string, data: Partial<Project>) =>
      request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ message: string }>(`/projects/${id}`, { method: "DELETE" }),
    addMember: (projectId: string, email: string, role: "ADMIN" | "MEMBER" | "VIEWER" = "MEMBER") =>
      request<{ user: User; role: string }>(`/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    removeMember: (projectId: string, userId: string) =>
      request<{ message: string }>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
  },

  files: {
    tree: (projectId: string) => request<Record<string, unknown>>(`/files/${projectId}/tree`),
    get: (projectId: string, path: string) =>
      request<{ path: string; content: string; size: number; sha256: string; updatedAt: string }>(
        `/files/${projectId}/${encodeURIComponent(path)}`
      ),
    put: (projectId: string, path: string, content: string) =>
      request<{ id: string; path: string; size: number; sha256: string }>(
        `/files/${projectId}/${encodeURIComponent(path)}`,
        { method: "PUT", body: JSON.stringify({ content }) }
      ),
    delete: (projectId: string, path: string) =>
      request<{ message: string }>(`/files/${projectId}/${encodeURIComponent(path)}`, { method: "DELETE" }),
    sync: (projectId: string, files: Array<{ path: string; content?: string; sha256?: string }>) =>
      request<Array<{ id: string; path: string }>>(`/files/${projectId}/sync`, {
        method: "POST",
        body: JSON.stringify({ files }),
      }),
  },

  settings: {
    get: () => request<UserSettings>("/settings"),
    update: (data: Partial<UserSettings>) =>
      request<UserSettings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  },

  ai: {
    getConfig: () => request<AIConfig & { hasApiKey: boolean }>("/ai/config"),
    setConfig: (data: Partial<AIConfig>) =>
      request<AIConfig & { hasApiKey: boolean }>("/ai/config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    getProjectConfig: (projectId: string) =>
      request<AIConfig & { hasApiKey: boolean }>(`/ai/config/project/${projectId}`),
    setProjectConfig: (projectId: string, data: Partial<AIConfig>) =>
      request<AIConfig & { hasApiKey: boolean }>(`/ai/config/project/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    chat: (
      messages: Array<{ role: string; content: string }>,
      options?: { model?: string; projectId?: string; stream?: boolean }
    ) => request<Record<string, unknown>>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages, ...options }),
    }),
  },

  apiKeys: {
    list: () => request<Array<{ id: string; name: string; prefix: string; scopes: string[]; expiresAt: string | null; lastUsedAt: string | null; createdAt: string }>>("/api-keys"),
    create: (name: string, scopes?: string[], expiresAt?: string) =>
      request<{ id: string; name: string; prefix: string; key: string; scopes: string[]; expiresAt: string | null; createdAt: string }>("/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes, expiresAt }),
      }),
    delete: (keyId: string) =>
      request<{ message: string }>(`/api-keys/${keyId}`, { method: "DELETE" }),
  },
};
