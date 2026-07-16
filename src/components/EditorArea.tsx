import React, { useRef, useEffect, useState } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useStore, EditorTab } from "../store";
import { InlineEditWidget } from "./InlineEditWidget";
import { setupAutocomplete } from "../services/autocomplete";

function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabPath = useStore((s) => s.activeTabPath);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const saveTab = useStore((s) => s.saveTab);

  if (!tabs.length) return null;

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          className={`tab ${tab.path === activeTabPath ? "active" : ""}`}
          onClick={() => setActiveTab(tab.path)}
          onAuxClick={(e) => {
            if (e.button === 1) closeTab(tab.path);
          }}
          title={tab.path}
        >
          <span>{tab.name}</span>
          {tab.dirty ? (
            <span
              className="dirty"
              onClick={(e) => {
                e.stopPropagation();
                window.cursor.writeFile(tab.path, tab.content).then(() => saveTab(tab.path));
              }}
              title="Save"
            />
          ) : (
            <span
              className="close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.path);
              }}
            >
              ×
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyEditor() {
  const openFolder = async () => {
    const t = await window.cursor.openFolder();
    if (t) useStore.getState().setTree(t);
  };
  return (
    <div className="empty-state">
      <h2>CursorClone</h2>
      <p>An AI-powered code editor</p>
      <p style={{ fontSize: 12 }}>
        Open a folder to start, then use the chat panel on the right.
      </p>
      <button className="primary" onClick={openFolder}>
        Open Folder
      </button>
      <div style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
        <div>⌘K / Ctrl+K — Inline edit selection</div>
        <div>Tab — Accept autocomplete suggestion</div>
        <div>Right-click a file — Add to chat context</div>
      </div>
    </div>
  );
}

export function EditorArea() {
  const tabs = useStore((s) => s.tabs);
  const activeTabPath = useStore((s) => s.activeTabPath);
  const updateTabContent = useStore((s) => s.updateTabContent);
  const saveTab = useStore((s) => s.saveTab);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [inlineEditOpen, setInlineEditOpen] = useState(false);

  const activeTab = tabs.find((t) => t.path === activeTabPath) || null;

  const beforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    // Define a dark theme matching the app
    monaco.editor.defineTheme("cursorclone-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1e1e1e",
        "editorGutter.background": "#1e1e1e",
        "editorLineNumber.foreground": "#858585",
        "editor.lineHighlightBackground": "#2a2a2a",
      },
    });
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.setTheme("cursorclone-dark");

    // Cmd/Ctrl+K => inline edit
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      setInlineEditOpen(true);
    });

    // Cmd/Ctrl+S => save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const path = useStore.getState().activeTabPath;
      if (!path) return;
      const tab = useStore.getState().tabs.find((t) => t.path === path);
      if (!tab) return;
      window.cursor.writeFile(path, tab.content).then(() => saveTab(path));
    });

    // Setup tab autocomplete (ghost text)
    setupAutocomplete(editor, monaco);
  };

  useEffect(() => {
    if (editorRef.current && activeTab) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== activeTab.content) {
        editorRef.current.setValue(activeTab.content);
      }
    }
  }, [activeTabPath]);

  return (
    <div className="editor-area">
      <TabBar />
      <div className="editor-container">
        {activeTab ? (
          <>
            <Editor
              height="100%"
              language={activeTab.language}
              value={activeTab.content}
              beforeMount={beforeMount}
              onMount={onMount}
              onChange={(value) => {
                if (activeTab && value !== undefined) {
                  updateTabContent(activeTab.path, value);
                }
              }}
              options={{
                fontSize: 14,
                fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                tabSize: 2,
                automaticLayout: true,
                inlineSuggest: { enabled: true },
                suggestOnTriggerCharacters: true,
                quickSuggestions: { other: true, comments: false, strings: false },
              }}
              loading="Loading editor..."
            />
            {inlineEditOpen && editorRef.current && monacoRef.current && (
              <InlineEditWidget
                editor={editorRef.current}
                monaco={monacoRef.current}
                tab={activeTab}
                onClose={() => setInlineEditOpen(false)}
              />
            )}
          </>
        ) : (
          <EmptyEditor />
        )}
      </div>
    </div>
  );
}
