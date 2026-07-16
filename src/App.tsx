import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { AuthCallbackPage } from "./components/AuthCallbackPage";
import { useStore } from "./store";
import { FileExplorer } from "./components/FileExplorer";
import { EditorArea } from "./components/EditorArea";
import { ChatPanel } from "./components/ChatPanel";
import { ComposerPanel } from "./components/ComposerPanel";
import { SettingsModal } from "./components/SettingsModal";
import { isAutocompleteLoading } from "./services/autocomplete";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

function EditorLayout() {
  const rightPanel = useStore((s) => s.rightPanel);
  const setRightPanel = useStore((s) => s.setRightPanel);
  const ollamaOnline = useStore((s) => s.ollamaOnline);
  const setOllamaOnline = useStore((s) => s.setOllamaOnline);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setModels = useStore((s) => s.setModels);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const activeTabPath = useStore((s) => s.activeTabPath);
  const tabs = useStore((s) => s.tabs);
  const [acLoading, setAcLoading] = React.useState(false);

  useEffect(() => {
    (async () => {
      const s = await window.cursor.getSettings();
      setSettings(s);
      try {
        const online = await window.cursor.ollamaHealth();
        setOllamaOnline(online);
        if (online) {
          const list = await window.cursor.ollamaListModels();
          setModels(list);
          if (list.length && !list.find((m) => m.name === s.model)) {
            const updated = await window.cursor.setSettings({ model: list[0].name });
            setSettings(updated);
          }
        }
      } catch {
        setOllamaOnline(false);
      }
    })();

    const onAc = (e: Event) =>
      setAcLoading((e as CustomEvent).detail);
    window.addEventListener("autocomplete-loading", onAc);
    return () => window.removeEventListener("autocomplete-loading", onAc);
  }, []);

  useEffect(() => {
    window.cursor.watchTree((tree) => useStore.getState().setTree(tree));
  }, []);

  const activeTab = tabs.find((t) => t.path === activeTabPath);

  return (
    <div className="app">
      <div className="titlebar">
        <div className="actions">
          <button
            className="icon"
            title="Toggle chat panel"
            onClick={() =>
              setRightPanel(rightPanel === null ? "chat" : null)
            }
          >
            💬
          </button>
          <button
            className="icon"
            title="Toggle composer"
            onClick={() =>
              setRightPanel(rightPanel === "composer" ? null : "composer")
            }
          >
            ✏️
          </button>
        </div>
        <span className="title">CursorClone</span>
        <span className="spacer" />
        <div className="actions">
          <button
            className="icon"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙
          </button>
        </div>
      </div>

      <div
        className={`main ${rightPanel === null ? "chat-hidden" : ""} ${
          rightPanel === "composer" ? "composer-mode" : ""
        }`}
      >
        <FileExplorer />
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <EditorArea />
          <div className="statusbar">
            <span className={`dot ${ollamaOnline ? "" : "offline"}`} />
            <span>
              Ollama {ollamaOnline ? "online" : "offline"} · {settings.model}
            </span>
            <span className="spacer" />
            {acLoading && (
              <span>
                <span className="spinner" /> autocomplete
              </span>
            )}
            {activeTab && <span>{activeTab.language}</span>}
            {activeTab && activeTab.dirty && <span>● unsaved</span>}
          </div>
        </div>
        {rightPanel === "chat" && <ChatPanel />}
        {rightPanel === "composer" && <ComposerPanel />}
      </div>

      <SettingsModal />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <EditorLayout />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
