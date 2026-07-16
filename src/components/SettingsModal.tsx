import React, { useState, useEffect } from "react";
import { useStore } from "../store";

export function SettingsModal() {
  const show = useStore((s) => s.showSettings);
  const setShow = useStore((s) => s.setShowSettings);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const setOllamaOnline = useStore((s) => s.setOllamaOnline);

  const [host, setHost] = useState(settings.host);
  const [model, setModel] = useState(settings.model);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setHost(settings.host);
    setModel(settings.model);
  }, [settings, show]);

  if (!show) return null;

  const refreshModels = async (hostToUse: string) => {
    try {
      const s = await window.cursor.setSettings({ host: hostToUse });
      const list = await window.cursor.ollamaListModels();
      setModels(list);
      setOllamaOnline(true);
      if (list.length && !list.find((m) => m.name === model)) {
        setModel(list[0].name);
      }
      return list;
    } catch {
      setModels([]);
      setOllamaOnline(false);
      return [];
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await window.cursor.setSettings({ host });
      const list = await refreshModels(host);
      setTestResult(
        list.length
          ? `Connected. ${list.length} model(s) available.`
          : "Connected, but no models installed. Run: ollama pull qwen2.5-coder:7b"
      );
    } catch (e) {
      setTestResult(`Failed: ${(e as Error).message}`);
      setOllamaOnline(false);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const s = await window.cursor.setSettings({ host, model });
    setSettings(s);
    setShow(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShow(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Ollama Settings</h2>
        <div className="field">
          <label>Ollama host</label>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>
        <div className="field">
          <label>Model</label>
          {models.length > 0 ? (
            <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                  {m.size ? ` (${(m.size / 1e9).toFixed(1)} GB)` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="qwen2.5-coder:7b"
            />
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={test} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </button>
          {testResult && (
            <span
              style={{
                fontSize: 12,
                color: testResult.startsWith("Failed")
                  ? "var(--danger)"
                  : "var(--success)",
              }}
            >
              {testResult}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Tip: install a code model with{" "}
          <code style={{ background: "var(--bg-2)", padding: "1px 4px", borderRadius: 3 }}>
            ollama pull qwen2.5-coder:7b
          </code>
        </div>
        <div className="actions">
          <button onClick={() => setShow(false)}>Cancel</button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
