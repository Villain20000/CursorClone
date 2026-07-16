import { create } from "zustand";
import { FileNode, ChatMessage, ComposerFileChange, OllamaSettings, OllamaModel } from "@shared/types";

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  language: string;
  dirty: boolean;
}

interface AppState {
  // File tree
  tree: FileNode | null;
  expandedDirs: Set<string>;
  // Editor
  tabs: EditorTab[];
  activeTabPath: string | null;
  // Chat
  messages: ChatMessage[];
  chatStreaming: boolean;
  contextFiles: string[];
  rightPanel: "chat" | "composer" | null;
  // Composer
  composerChanges: ComposerFileChange[];
  composerBusy: boolean;
  // Settings
  settings: OllamaSettings;
  models: OllamaModel[];
  ollamaOnline: boolean;
  showSettings: boolean;
  // Actions
  setTree: (tree: FileNode | null) => void;
  toggleDir: (path: string) => void;
  openFile: (path: string, content: string, language: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  saveTab: (path: string) => void;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  setChatStreaming: (v: boolean) => void;
  addContextFile: (path: string) => void;
  removeContextFile: (path: string) => void;
  setRightPanel: (p: "chat" | "composer" | null) => void;
  setComposerChanges: (c: ComposerFileChange[]) => void;
  updateComposerChange: (path: string, patch: Partial<ComposerFileChange>) => void;
  setComposerBusy: (v: boolean) => void;
  setSettings: (s: OllamaSettings) => void;
  setModels: (m: OllamaModel[]) => void;
  setOllamaOnline: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  clearChat: () => void;
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "cpp",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    sh: "shell",
    bash: "shell",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    sql: "sql",
    xml: "xml",
    vue: "html",
    svelte: "html",
  };
  return map[ext] || "plaintext";
}

export const useStore = create<AppState>()((set) => ({
  tree: null,
  expandedDirs: new Set<string>(),
  tabs: [],
  activeTabPath: null,
  messages: [],
  chatStreaming: false,
  contextFiles: [],
  rightPanel: "chat",
  composerChanges: [],
  composerBusy: false,
  settings: { host: "http://localhost:11434", model: "qwen2.5-coder:7b" },
  models: [],
  ollamaOnline: false,
  showSettings: false,

  setTree: (tree) => set({ tree }),

  toggleDir: (path) =>
    set((s) => {
      const next = new Set(s.expandedDirs);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedDirs: next };
    }),

  openFile: (path, content, language) =>
    set((s) => {
      const name = path.split("/").pop() || path;
      const existing = s.tabs.find((t) => t.path === path);
      if (existing) {
        return { tabs: s.tabs, activeTabPath: path };
      }
      const tab: EditorTab = {
        path,
        name,
        content,
        savedContent: content,
        language,
        dirty: false,
      };
      return { tabs: [...s.tabs, tab], activeTabPath: path };
    }),

  closeTab: (path) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path);
      let activeTabPath = s.activeTabPath;
      if (activeTabPath === path) {
        activeTabPath = tabs.length ? tabs[tabs.length - 1].path : null;
      }
      return { tabs, activeTabPath };
    }),

  setActiveTab: (path) => set({ activeTabPath: path }),

  updateTabContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, dirty: content !== t.savedContent } : t
      ),
    })),

  saveTab: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, savedContent: t.content, dirty: false } : t
      ),
    })),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, content) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),
  setChatStreaming: (v) => set({ chatStreaming: v }),

  addContextFile: (path) =>
    set((s) =>
      s.contextFiles.includes(path)
        ? s
        : { contextFiles: [...s.contextFiles, path] }
    ),
  removeContextFile: (path) =>
    set((s) => ({ contextFiles: s.contextFiles.filter((p) => p !== path) })),

  setRightPanel: (p) => set({ rightPanel: p }),

  setComposerChanges: (c) => set({ composerChanges: c }),
  updateComposerChange: (path, patch) =>
    set((s) => ({
      composerChanges: s.composerChanges.map((c) =>
        c.path === path ? { ...c, ...patch } : c
      ),
    })),
  setComposerBusy: (v: boolean) => set({ composerBusy: v }),

  setSettings: (s: OllamaSettings) => set({ settings: s }),
  setModels: (m: OllamaModel[]) => set({ models: m }),
  setOllamaOnline: (v: boolean) => set({ ollamaOnline: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  clearChat: () => set({ messages: [] }),
}));
