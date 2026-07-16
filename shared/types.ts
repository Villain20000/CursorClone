// Shared types between Electron main process, renderer, and backend

// ─── File System ────────────────────────────────────────────────────
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface FileEntry {
  path: string;
  size: number;
  sha256?: string;
  updatedAt: string;
}

// ─── Chat / AI ──────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  fileRefs?: string[];
  streaming?: boolean;
}

export interface ComposerFileChange {
  path: string;
  original: string;
  updated: string;
  status: "pending" | "accepted" | "rejected";
}

export interface OllamaModel {
  name: string;
  size?: number;
  modifiedAt?: string;
}

export interface OllamaSettings {
  host: string;
  model: string;
}

export interface AutocompleteRequest {
  text: string;
  language: string;
  suffix: string;
}

export interface AutocompleteResponse {
  suggestion: string;
}

// ─── User ───────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  role: "USER" | "ADMIN";
  settings?: UserSettings;
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: "dark" | "light" | "system";
  fontSize: number;
  keymap: "default" | "vim" | "emacs";
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
}

// ─── Project ────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description?: string;
  visibility: "PRIVATE" | "PUBLIC" | "TEAM";
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner?: Pick<User, "id" | "username" | "displayName">;
}

// ─── AI Config ──────────────────────────────────────────────────────
export interface AIConfig {
  id: string;
  userId?: string;
  projectId?: string;
  provider: "OLLAMA" | "OPENAI" | "ANTHROPIC" | "CUSTOM";
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

// ─── WebSocket Messages ─────────────────────────────────────────────
export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

export interface WSCursorPayload {
  userId: string;
  username: string;
  position: { line: number; column: number };
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export interface WSFileEditPayload {
  userId: string;
  username: string;
  path: string;
  changes: Array<{
    type: "insert" | "delete" | "replace";
    offset?: number;
    length?: number;
    text?: string;
  }>;
}

// ─── IPC channel names ──────────────────────────────────────────────
export const IPC = {
  // File system
  OPEN_FOLDER: "fs:open-folder",
  READ_FILE: "fs:read-file",
  WRITE_FILE: "fs:write-file",
  LIST_DIR: "fs:list-dir",
  CREATE_FILE: "fs:create-file",
  CREATE_DIR: "fs:create-dir",
  DELETE_PATH: "fs:delete-path",
  WATCH_DIR: "fs:watch-dir",
  // Ollama
  OLLAMA_LIST_MODELS: "ollama:list-models",
  OLLAMA_CHAT: "ollama:chat",
  OLLAMA_GENERATE: "ollama:generate",
  OLLAMA_HEALTH: "ollama:health",
  // Settings
  GET_SETTINGS: "settings:get",
  SET_SETTINGS: "settings:set",
  // Backend auth
  GET_TOKEN: "auth:get-token",
  SET_TOKEN: "auth:set-token",
  CLEAR_TOKEN: "auth:clear-token",
} as const;
