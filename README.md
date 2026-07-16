# CursorClone

An AI-powered code editor (Cursor IDE clone) built with Electron, React, and Monaco editor, with AI features powered by a local [Ollama](https://ollama.com) instance.

## Features

- **File explorer** — open folders, browse tree, open/edit/save files
- **Monaco editor** — full VS Code editing experience with tabs, syntax highlighting, minimap
- **AI Chat** — sidebar chat with `@codebase` context; right-click files in the explorer to add them as context
- **Inline edit (Cmd/Ctrl+K)** — select code (or whole file), describe an edit, preview the diff, accept/reject
- **Tab autocomplete** — ghost-text completions as you type, powered by Ollama fill-in-the-middle (FIM) prompts
- **Composer / Agent** — describe a multi-file change, get per-file diffs with accept/reject per file and "Accept all"
- **Settings** — configure Ollama host and model; test connection; auto-detect installed models

## Prerequisites

1. **Node.js** 18+ and npm
2. **Ollama** installed and running locally — https://ollama.com
3. A code model pulled, e.g.:
   ```bash
   ollama pull qwen2.5-coder:7b
   ```
   Other good options: `qwen2.5-coder:3b` (faster, lighter), `deepseek-coder:6.7b`

## Getting started

```bash
npm install
npm run dev      # start Vite dev server + Electron (hot reload)
```

For a production build:

```bash
npm run build    # type-check, build renderer + electron, package with electron-builder
```

To run the built app without packaging:

```bash
npm run build
npm start        # launches Electron pointing at dist/
```

## Usage

1. Start Ollama: `ollama serve` (or it runs as a service after install)
2. Pull a model: `ollama pull qwen2.5-coder:7b`
3. Launch CursorClone: `npm run dev`
4. Open a folder (button in explorer sidebar or empty editor state)
5. Open files by clicking them in the tree
6. **Chat**: type in the right panel. Right-click files in the explorer to add them as `@context`.
7. **Inline edit**: select code (or place cursor), press `Cmd/Ctrl+K`, type instruction, Enter.
8. **Tab autocomplete**: just type — ghost text appears; press `Tab` to accept.
9. **Composer**: switch to the Composer tab in the right panel, add context files, describe a multi-file change.
10. **Settings** (gear icon in title bar): change Ollama host/model, test connection.

## Architecture

```
electron/
  main.ts      — Electron main process: window, IPC, file system, Ollama proxy (streaming)
  preload.ts   — context bridge exposing a typed `window.cursor` API to the renderer
shared/
  types.ts     — shared types + IPC channel constants
src/
  App.tsx                  — root layout (titlebar, sidebar, editor, right panel, statusbar)
  store.ts                 — Zustand global store (tabs, chat, composer, settings)
  main.tsx                 — React entry
  styles/global.css        — VS Code-like dark theme
  services/
    ollama.ts              — streaming chat/generate wrappers over the preload bridge
    autocomplete.ts        — Monaco inline-completions provider for Tab ghost text (FIM)
    diff.ts                — dependency-free LCS line diff for previews
  components/
    FileExplorer.tsx       — folder tree with right-click "add to context"
    EditorArea.tsx         — Monaco editor + tabs + Cmd+K inline edit trigger
    InlineEditWidget.tsx   — Cmd+K prompt + diff preview + accept/reject
    ChatPanel.tsx          — AI chat with codebase context
    ComposerPanel.tsx      — multi-file agent edits with per-file accept/reject
    SettingsModal.tsx      — Ollama host/model configuration
```

### How AI features work

- All AI calls go through the Electron main process (which has Node `fetch`) to avoid renderer CSP/CORS issues, and to keep the Ollama host configurable from one place.
- **Chat** uses Ollama `/api/chat` with streaming; system prompt + codebase context (file contents) are injected.
- **Inline edit** sends the selected code (or whole file) with the instruction and asks for only the modified code back, then shows a line diff.
- **Tab autocomplete** uses Ollama `/api/generate` with a fill-in-the-middle prompt (`<|fim_prefix|>...<|fim_suffix|>...<|fim_middle|>`) and registers the result as a Monaco inline completion (ghost text). Debounced 350ms, capped context window, low temperature.
- **Composer** sends all context files and asks the model to emit `<<<FILE>>> path ... <<<END>>>` blocks, which are parsed into per-file changes with diffs.

## Notes / limitations

- This is a focused clone of Cursor's core AI-assisted editing flow, not a 1:1 reproduction of every Cursor feature (e.g., codebase semantic indexing, @web, privacy mode, background agents are not included).
- Autocomplete quality depends on the Ollama model; `qwen2.5-coder` supports FIM tokens and works best.
- Recursive file watching uses Node `fs.watch` and may not catch every change on all platforms.
