// High-level Ollama service wrapping the preload bridge.
// All streaming is handled via the window.cursor API exposed by the main process.

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

let chatChunkCb: ((chunk: string) => void) | null = null;
let chatDoneCb: (() => void) | null = null;
let genChunkCb: ((chunk: string) => void) | null = null;
let genDoneCb: (() => void) | null = null;

function ensureListeners() {
  const w = window.cursor;
  w.onChatChunk((chunk) => chatChunkCb?.(chunk));
  w.onChatDone(() => {
    chatDoneCb?.();
    chatChunkCb = null;
    chatDoneCb = null;
  });
  w.onGenerateChunk((chunk) => genChunkCb?.(chunk));
  w.onGenerateDone(() => {
    genDoneCb?.();
    genChunkCb = null;
    genDoneCb = null;
  });
}

export async function streamChat(
  messages: ChatTurn[],
  onChunk: (chunk: string) => void,
  onDone: () => void
): Promise<void> {
  ensureListeners();
  chatChunkCb = onChunk;
  chatDoneCb = onDone;
  try {
    await window.cursor.ollamaChat(messages);
  } catch (e) {
    chatChunkCb = null;
    chatDoneCb = null;
    onDone();
    throw e;
  }
}

export async function streamGenerate(
  prompt: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  options?: Record<string, unknown>
): Promise<void> {
  ensureListeners();
  genChunkCb = onChunk;
  genDoneCb = onDone;
  try {
    await window.cursor.ollamaGenerate(prompt, undefined, options);
  } catch (e) {
    genChunkCb = null;
    genDoneCb = null;
    onDone();
    throw e;
  }
}

export async function listModels() {
  return window.cursor.ollamaListModels();
}

export async function checkHealth() {
  return window.cursor.ollamaHealth();
}

// Build a codebase context string from a list of file paths + contents.
export function buildCodebaseContext(
  files: Array<{ path: string; content: string }>
): string {
  if (!files.length) return "";
  const parts = files.map(
    (f) => `File: ${f.path}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``
  );
  return `The following files are part of the user's codebase:\n\n${parts.join(
    "\n\n"
  )}\n\nUse this context to answer accurately. When suggesting code, reference the file paths.`;
}
