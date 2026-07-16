import type * as Monaco from "monaco-editor";
import { useStore } from "../store";
import { streamGenerate } from "./ollama";

// Tab autocomplete (ghost text) powered by Ollama.
// We debounce, send the prefix + a small suffix to Ollama via /api/generate
// using a fill-in-the-middle (FIM) prompt, and register the result as an
// inline completion that Monaco renders as ghost text.

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let loading = false;

function setLoading(v: boolean) {
  if (loading === v) return;
  loading = v;
  window.dispatchEvent(new CustomEvent("autocomplete-loading", { detail: v }));
}

export function isAutocompleteLoading() {
  return loading;
}

export function setupAutocomplete(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
) {
  let cachedSuggestion = "";
  let cachedPosition: {
    line: number;
    column: number;
    modelUri: string;
  } | null = null;

  const setSuggestion = (s: string) => {
    cachedSuggestion = s;
    const pos = editor.getPosition();
    if (pos) {
      cachedPosition = {
        line: pos.lineNumber,
        column: pos.column,
        modelUri: editor.getModel()?.uri.toString() || "",
      };
    }
    if (s) {
      // Trigger the inline suggest widget to render our cached suggestion
      setTimeout(() => {
        editor.trigger("autocomplete", "editor.action.inlineSuggest.trigger", {});
      }, 0);
    }
  };

  monaco.languages.registerInlineCompletionsProvider("*", {
    provideInlineCompletions: async (_model, position) => {
      if (
        !cachedSuggestion ||
        !cachedPosition ||
        cachedPosition.modelUri !== _model.uri.toString() ||
        cachedPosition.line !== position.lineNumber ||
        cachedPosition.column !== position.column
      ) {
        return { items: [] };
      }
      const suggestion = cachedSuggestion;
      cachedSuggestion = "";
      return {
        items: [
          {
            insertText: suggestion,
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
          },
        ],
      };
    },
    freeInlineCompletions: () => {},
  });

  const trigger = () => {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => requestCompletion(editor, setSuggestion), 350);
  };

  editor.onDidChangeModelContent(() => trigger());
  editor.onDidChangeCursorPosition(() => {
    cachedSuggestion = "";
    cachedPosition = null;
  });
}

async function requestCompletion(
  editor: Monaco.editor.IStandaloneCodeEditor,
  setSuggestion: (s: string) => void
) {
  const model = editor.getModel();
  if (!model) return;
  const position = editor.getPosition();
  if (!position) return;

  const settings = useStore.getState().settings;
  if (!settings) return;

  const fullText = model.getValue();
  const offset = model.getOffsetAt(position);
  const prefix = fullText.slice(0, Math.min(offset, 4000));
  const suffix = fullText.slice(offset, Math.min(offset + 2000, fullText.length));

  const lineUntilCursor = model
    .getLineContent(position.lineNumber)
    .slice(0, position.column - 1);
  if (lineUntilCursor.trim() === "" && fullText.trim() === "") return;

  // Fill-in-the-middle prompt (works with qwen2.5-coder, deepseek-coder, etc.)
  const prompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;

  setLoading(true);
  let collected = "";
  let stopped = false;

  const stopTokens = ["<|fim_end|>", "<|end|>", "```"];
  const checkStop = () => {
    for (const tok of stopTokens) {
      if (collected.includes(tok)) {
        collected = collected.split(tok)[0];
        return true;
      }
    }
    return false;
  };

  try {
    await streamGenerate(
      prompt,
      (chunk) => {
        collected += chunk;
        if (checkStop()) {
          stopped = true;
          setSuggestion(collected.trimStart());
          setLoading(false);
          // Throw to short-circuit further chunk processing on our side.
          throw new Error("__stop__");
        }
      },
      () => {
        if (stopped) return;
        const cleaned = collected.replace(/<\|fim_end\|>/g, "").replace(/<\|end\|>/g, "").trimStart();
        if (cleaned) setSuggestion(cleaned);
        setLoading(false);
      },
      {
        temperature: 0.2,
        num_predict: 60,
        stop: ["\n\n\n", "<|fim_end|>", "<|end|>", "```"],
      }
    );
  } catch {
    setLoading(false);
  }
}
