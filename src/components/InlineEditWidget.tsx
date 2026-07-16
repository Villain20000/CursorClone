import React, { useState, useRef, useEffect } from "react";
import type * as Monaco from "monaco-editor";
import { EditorTab, useStore } from "../store";
import { streamChat } from "../services/ollama";
import { computeDiff, DiffLine } from "../services/diff";

interface Props {
  editor: Monaco.editor.IStandaloneCodeEditor;
  monaco: typeof Monaco;
  tab: EditorTab;
  onClose: () => void;
}

function positionWidget(editor: Monaco.editor.IStandaloneCodeEditor, el: HTMLElement) {
  const selection = editor.getSelection();
  if (!selection) return;
  const startPos = selection.getStartPosition();
  const pos = editor.getScrolledVisiblePosition(startPos);
  if (!pos) return;
  const containerRect = editor.getDomNode()?.getBoundingClientRect();
  if (!containerRect) return;
  el.style.top = `${pos.top + 24}px`;
  el.style.left = `${Math.min(pos.left, (containerRect.width || 800) - 480 - 20)}px`;
}

export function InlineEditWidget({ editor, monaco, tab, onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [newContent, setNewContent] = useState<string | null>(null);
  const [editRange, setEditRange] = useState<Monaco.Range | Monaco.Selection | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) positionWidget(editor, ref.current);
    textareaRef.current?.focus();
    const onScroll = () => ref.current && positionWidget(editor, ref.current);
    editor.onDidScrollChange(onScroll);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [editor]);

  const selection = editor.getSelection();
  const hasSelection = selection
    ? selection.startLineNumber !== selection.endLineNumber ||
      selection.startColumn !== selection.endColumn
    : false;

  const selectedText = hasSelection
    ? editor.getModel()?.getValueInRange(selection!) || ""
    : "";

  const runEdit = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setDiff(null);
    setNewContent(null);

    const model = editor.getModel();
    if (!model) {
      setBusy(false);
      return;
    }

    let targetText = selectedText;
    let range: Monaco.Range | Monaco.Selection | null = selection;
    if (!hasSelection) {
      // Edit the whole file if no selection
      targetText = model.getValue();
      range = model.getFullModelRange();
    }
    setEditRange(range);

    const systemMsg =
      "You are an expert code editor. The user wants to modify the given code. " +
      "Return ONLY the modified code, no explanations, no markdown fences. " +
      "Preserve indentation and style. Keep changes minimal and correct.";

    const userMsg = `File: ${tab.path}\nLanguage: ${tab.language}\n\nInstruction: ${prompt}\n\nCode to edit:\n\`\`\`\n${targetText}\n\`\`\`\n\nReturn the full edited code only.`;

    let result = "";
    try {
      await streamChat(
        [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        (chunk) => {
          result += chunk;
        },
        () => {
          // Strip markdown fences if present
          let cleaned = result.trim();
          const fenceMatch = cleaned.match(/^```[\w]*\n([\s\S]*?)\n```$/);
          if (fenceMatch) cleaned = fenceMatch[1];
          setNewContent(cleaned);
          setDiff(computeDiff(targetText, cleaned));
          setBusy(false);
        }
      );
    } catch (e) {
      console.error("Inline edit failed", e);
      setBusy(false);
    }
  };

  const accept = async () => {
    if (newContent === null || !editRange) return;
    editor.executeEdits("inline-edit", [
      {
        range: editRange,
        text: newContent,
        forceMoveMarkers: true,
      },
    ]);
    const updated = editor.getModel()?.getValue() || "";
    useStore.getState().updateTabContent(tab.path, updated);
    onClose();
  };

  const reject = () => {
    setDiff(null);
    setNewContent(null);
  };

  return (
    <div className="inline-edit-widget" ref={ref}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {hasSelection
          ? `Editing selection (${selection?.startLineNumber}-${selection?.endLineNumber})`
          : "Editing entire file"}
      </div>
      <textarea
        ref={textareaRef}
        className="chat-input"
        placeholder="Describe the edit… (Enter to run, Esc to cancel)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            runEdit();
          }
        }}
        disabled={busy}
      />
      <div className="actions">
        <button className="icon" onClick={onClose} title="Cancel (Esc)">
          ✕
        </button>
        <button className="primary" onClick={runEdit} disabled={busy || !prompt.trim()}>
          {busy ? <span className="spinner" /> : null}
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
      {diff && (
        <>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Preview:</div>
          <div className="inline-edit-diff">
            {diff.map((line, i) => (
              <div
                key={i}
                className={
                  line.type === "add" ? "diff-add" : line.type === "del" ? "diff-del" : ""
                }
              >
                {line.type === "add" ? "+ " : line.type === "del" ? "- " : "  "}
                {line.text}
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="danger" onClick={reject}>
              Reject
            </button>
            <button className="primary" onClick={accept}>
              Accept
            </button>
          </div>
        </>
      )}
    </div>
  );
}
