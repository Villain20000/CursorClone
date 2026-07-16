import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { streamChat, buildCodebaseContext, ChatTurn } from "../services/ollama";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ChatPanel() {
  const messages = useStore((s) => s.messages);
  const chatStreaming = useStore((s) => s.chatStreaming);
  const contextFiles = useStore((s) => s.contextFiles);
  const addContextFile = useStore((s) => s.addContextFile);
  const removeContextFile = useStore((s) => s.removeContextFile);
  const addMessage = useStore((s) => s.addMessage);
  const updateMessage = useStore((s) => s.updateMessage);
  const setChatStreaming = useStore((s) => s.setChatStreaming);
  const clearChat = useStore((s) => s.clearChat);
  const setRightPanel = useStore((s) => s.setRightPanel);
  const tabs = useStore((s) => s.tabs);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || chatStreaming) return;
    const userText = input.trim();
    setInput("");

    // Build context from selected files + currently open tabs
    const ctxPaths = new Set([...contextFiles, ...tabs.map((t) => t.path)]);
    const ctxFiles: Array<{ path: string; content: string }> = [];
    for (const p of ctxPaths) {
      const tab = tabs.find((t) => t.path === p);
      if (tab) {
        ctxFiles.push({ path: p, content: tab.content });
      } else {
        try {
          const content = await window.cursor.readFile(p);
          ctxFiles.push({ path: p, content });
        } catch {}
      }
    }

    const userMsg = {
      id: uid(),
      role: "user" as const,
      content: userText,
      fileRefs: [...ctxPaths],
    };
    addMessage(userMsg);

    const assistantId = uid();
    addMessage({ id: assistantId, role: "assistant", content: "", streaming: true });
    setChatStreaming(true);

    const turns: ChatTurn[] = [
      {
        role: "system",
        content:
          "You are CursorClone's AI assistant, an expert pair programmer. " +
          "Be concise and correct. When suggesting code, use fenced code blocks with the language. " +
          "Reference file paths when relevant. If the user provides codebase context, use it.",
      },
    ];
    const codebaseCtx = buildCodebaseContext(ctxFiles);
    if (codebaseCtx) {
      turns.push({ role: "system", content: codebaseCtx });
    }
    turns.push({ role: "user", content: userText });

    let acc = "";
    try {
      await streamChat(
        turns,
        (chunk) => {
          acc += chunk;
          updateMessage(assistantId, acc);
        },
        () => {
          updateMessage(assistantId, acc);
          setChatStreaming(false);
        }
      );
    } catch (e) {
      updateMessage(
        assistantId,
        acc + `\n\n[Error: ${(e as Error).message}]\n\nIs Ollama running? Check Settings.`
      );
      setChatStreaming(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-tabs">
          <div className="chat-tab active">Chat</div>
          <div className="chat-tab" onClick={() => setRightPanel("composer")}>
            Composer
          </div>
        </div>
        <button className="icon" title="Clear chat" onClick={clearChat}>
          🗑
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state" style={{ height: "100%" }}>
            <p>Ask anything about your code.</p>
            <p style={{ fontSize: 11 }}>
              Right-click files in the explorer to add them as context (@).
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            <div className="role">{m.role === "user" ? "You" : "AI"}</div>
            {m.role === "user" && m.fileRefs && m.fileRefs.length > 0 && (
              <div>
                {m.fileRefs.map((p) => (
                  <span key={p} className="file-ref">
                    {p.split("/").pop()}
                  </span>
                ))}
              </div>
            )}
            <div className="bubble">
              {m.content || (m.streaming ? <span className="cursor-blink" /> : "")}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {contextFiles.length > 0 && (
          <div className="context-chips">
            {contextFiles.map((p) => (
              <span key={p} className="context-badge">
                @{p.split("/").pop()}
                <span className="remove" onClick={() => removeContextFile(p)}>
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask about your code… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={chatStreaming}
        />
        <div className="chat-input-actions">
          <span className="chat-input-hint">
            {contextFiles.length > 0
              ? `${contextFiles.length} file(s) in context`
              : "No context files"}
          </span>
          <button className="primary" onClick={send} disabled={chatStreaming || !input.trim()}>
            {chatStreaming ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
