import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { streamChat, ChatTurn } from "../services/ollama";
import { computeDiff } from "../services/diff";
import { ComposerFileChange } from "@shared/types";

// Parse the model's response into per-file changes.
// Expected format from the model:
//   <<<FILE>>> path/to/file
//   <full new content>
//   <<<END>>>
const FILE_START = "<<<FILE>>>";
const FILE_END = "<<<END>>>";

function parseFileChanges(raw: string): ComposerFileChange[] {
  const changes: ComposerFileChange[] = [];
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith(FILE_START)) {
      const path = line.slice(FILE_START.length).trim();
      i++;
      const contentLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith(FILE_END) && !lines[i].startsWith(FILE_START)) {
        contentLines.push(lines[i]);
        i++;
      }
      const updated = contentLines.join("\n").replace(/```$/g, "").trimEnd();
      changes.push({
        path,
        original: "",
        updated,
        status: "pending",
      });
    } else {
      i++;
    }
  }
  return changes;
}

export function ComposerPanel() {
  const composerBusy = useStore((s) => s.composerBusy);
  const composerChanges = useStore((s) => s.composerChanges);
  const setComposerChanges = useStore((s) => s.setComposerChanges);
  const updateComposerChange = useStore((s) => s.updateComposerChange);
  const setComposerBusy = useStore((s) => s.setComposerBusy);
  const setRightPanel = useStore((s) => s.setRightPanel);
  const contextFiles = useStore((s) => s.contextFiles);
  const tabs = useStore((s) => s.tabs);
  const openFile = useStore((s) => s.openFile);
  const updateTabContent = useStore((s) => s.updateTabContent);
  const saveTab = useStore((s) => s.saveTab);

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [composerChanges, composerBusy]);

  const run = async () => {
    if (!input.trim() || composerBusy) return;
    const instruction = input.trim();
    setInput("");
    setError(null);
    setComposerBusy(true);
    setComposerChanges([]);

    // Gather context: explicitly added files + open tabs
    const ctxPaths = new Set([...contextFiles, ...tabs.map((t) => t.path)]);
    const ctxFiles: Array<{ path: string; content: string }> = [];
    for (const p of ctxPaths) {
      const tab = tabs.find((t) => t.path === p);
      if (tab) ctxFiles.push({ path: p, content: tab.content });
      else {
        try {
          const content = await window.cursor.readFile(p);
          ctxFiles.push({ path: p, content });
        } catch {}
      }
    }

    const fileListing = ctxFiles
      .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 6000)}`)
      .join("\n\n");

    const systemMsg =
      "You are CursorClone Composer, an agent that edits multiple files at once. " +
      `For each file you want to create or modify, output the FULL new file content wrapped in delimiters:\n` +
      `${FILE_START} <relative path>\n<full file content>\n${FILE_END}\n\n` +
      "Output ONLY the file blocks, no explanations. Preserve existing code that doesn't need changes. " +
      "Use the exact relative paths from the project.";

    const userMsg = `Instruction: ${instruction}\n\nCurrent files in context:\n\n${fileListing}`;

    const turns: ChatTurn[] = [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ];

    let acc = "";
    try {
      await streamChat(
        turns,
        (chunk) => {
          acc += chunk;
          // Live-parse to show progress
          const parsed = parseFileChanges(acc);
          // Attach originals from context
          const enriched = parsed.map((c) => {
            const ctx = ctxFiles.find((f) => f.path === c.path);
            return { ...c, original: ctx?.content || "" };
          });
          setComposerChanges(enriched);
        },
        () => {
          const parsed = parseFileChanges(acc);
          const enriched = parsed.map((c) => {
            const ctx = ctxFiles.find((f) => f.path === c.path);
            return { ...c, original: ctx?.content || "" };
          });
          setComposerChanges(enriched);
          setComposerBusy(false);
          if (enriched.length === 0) {
            setError(
              "No file changes detected. The model may not have used the <<<FILE>>> format. Try rephrasing."
            );
          }
        }
      );
    } catch (e) {
      setError((e as Error).message);
      setComposerBusy(false);
    }
  };

  const acceptOne = async (change: ComposerFileChange) => {
    // Write the file and open it in the editor
    await window.cursor.writeFile(change.path, change.updated);
    openFile(change.path, change.updated, change.path.split(".").pop() || "plaintext");
    updateComposerChange(change.path, { status: "accepted" });
  };

  const rejectOne = (change: ComposerFileChange) => {
    updateComposerChange(change.path, { status: "rejected" });
  };

  const acceptAll = async () => {
    for (const c of composerChanges) {
      if (c.status === "pending") await acceptOne(c);
    }
  };

  const pendingCount = composerChanges.filter((c) => c.status === "pending").length;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-tabs">
          <div className="chat-tab" onClick={() => setRightPanel("chat")}>
            Chat
          </div>
          <div className="chat-tab active">Composer</div>
        </div>
        {composerChanges.length > 0 && pendingCount > 0 && (
          <button className="primary" onClick={acceptAll} style={{ fontSize: 11 }}>
            Accept all ({pendingCount})
          </button>
        )}
      </div>

      <div className="composer-files">
        {composerChanges.length === 0 && !composerBusy && (
          <div className="composer-empty">
            <p>Composer applies edits across multiple files at once.</p>
            <p style={{ fontSize: 11 }}>
              Add files to context (right-click in explorer), then describe the change.
            </p>
            {error && (
              <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>
            )}
          </div>
        )}
        {composerBusy && composerChanges.length === 0 && (
          <div className="composer-empty">
            <span className="spinner" /> Generating edits…
          </div>
        )}
        {composerChanges.map((change) => {
          const diff = computeDiff(change.original, change.updated);
          return (
            <div key={change.path} className="composer-file">
              <div className="composer-file-header">
                <span className="path" title={change.path}>
                  {change.path}
                </span>
                <div className="composer-file-actions">
                  {change.status === "pending" ? (
                    <>
                      <button
                        className="icon"
                        title="Reject"
                        onClick={() => rejectOne(change)}
                        style={{ color: "var(--danger)" }}
                      >
                        ✕
                      </button>
                      <button
                        className="primary"
                        style={{ fontSize: 11, padding: "2px 8px" }}
                        onClick={() => acceptOne(change)}
                      >
                        Accept
                      </button>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color:
                          change.status === "accepted"
                            ? "var(--success)"
                            : "var(--text-muted)",
                      }}
                    >
                      {change.status === "accepted" ? "✓ accepted" : "✕ rejected"}
                    </span>
                  )}
                </div>
              </div>
              <div className="composer-diff">
                {diff.slice(0, 200).map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.type === "add"
                        ? "diff-add"
                        : line.type === "del"
                        ? "diff-del"
                        : ""
                    }
                  >
                    {line.type === "add" ? "+ " : line.type === "del" ? "- " : "  "}
                    {line.text}
                  </div>
                ))}
                {diff.length > 200 && (
                  <div style={{ color: "var(--text-muted)" }}>
                    … ({diff.length - 200} more lines)
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {contextFiles.length > 0 && (
          <div className="context-chips">
            {contextFiles.map((p) => (
              <span key={p} className="context-badge">
                @{p.split("/").pop()}
              </span>
            ))}
          </div>
        )}
        <textarea
          className="chat-input"
          placeholder="Describe a multi-file change… (Enter to run)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run();
            }
          }}
          disabled={composerBusy}
        />
        <div className="chat-input-actions">
          <span className="chat-input-hint">
            {contextFiles.length} file(s) in context
          </span>
          <button className="primary" onClick={run} disabled={composerBusy || !input.trim()}>
            {composerBusy ? "Working…" : "Generate edits"}
          </button>
        </div>
      </div>
    </div>
  );
}
