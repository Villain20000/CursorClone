# CursorClone — agent notes

## Build / verify commands

### Frontend / Electron
- `npm install` — install deps
- `npx tsc -b` — typecheck (must pass clean)
- `npx vite build` — build renderer + electron (outputs `dist/` and `dist-electron/`)
- `npm run dev` — Vite dev server + Electron with hot reload (requires a desktop/GUI environment; will NOT run in a headless container — Electron needs libatk and other X libs)
- `npm start` — run built Electron app from `dist/`

### Backend (`backend/`)
- `cd backend && npm install` — install backend deps
- `cd backend && npm run build` — typecheck + compile backend to `backend/dist/`
- `cd backend && npm run dev` — dev server (tsx watch) on port 3000
- `cd backend && npx prisma generate` — generate Prisma client
- `cd backend && npx prisma db push` — push schema to DB (or `npx prisma migrate dev`)

## Key gotchas

- **zustand v5**: must use the curried `create<T>()((set) => ({...}))` form in TypeScript, otherwise setters get mis-inferred.
- **preload path**: `vite-plugin-electron` outputs preload as `preload.mjs` (ESM), so `electron/main.ts` must reference `preload.mjs`, not `preload.js`.
- **Electron can't run headless**: launching `npx electron .` in a container fails with `libatk-1.0.so.0` missing. Verify via `npx tsc -b` + `npx vite build` instead.
- **Ollama streaming**: the main process proxies `/api/chat` and `/api/generate` with NDJSON streaming and forwards chunks to the renderer via `ipcRenderer.send`. The preload re-registers listeners each call; `removeAllListeners` is available if listeners stack up.
- **Autocomplete FIM**: uses `<|fim_prefix|>...<|fim_suffix|>...<|fim_middle|>` tokens — works with `qwen2.5-coder` and `deepseek-coder`. Stop tokens: `<|fim_end|>`, `<|end|>`, triple-backtick.
- **Prisma relation naming**: models starting with uppercase acronyms (e.g. `AIConfig`) are exposed on the client as `prisma.aIConfig` (camelCase keeps the leading capital of the acronym). Use `aIConfig`, not `aiConfig`.
- **Express 5 `req.params` typing**: `req.params[0]` (wildcard) and `req.params.x` are typed `string | string[]`. Cast to `string` (e.g. `req.params.x as string`) when passing to Prisma `where` clauses.
- **JWT `expiresIn`**: `jsonwebtoken` v9 expects `number | StringValue`; cast env-string expiry values (`JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"]`).
- **ws token auth**: browser `WebSocket` cannot send custom headers, so the client appends `?token=<ACCESS_TOKEN>` to the WS URL and the server reads it from the query when no `Authorization` header is present.

## Architecture in one breath

Hybrid model: the Electron desktop app keeps local file system access and the Ollama proxy, and now also authenticates against and syncs with a standalone backend API.

- **Backend** (`backend/`): Node.js + Express + TypeScript. PostgreSQL via Prisma. JWT auth (access + refresh, bcrypt), OAuth scaffolding (Google/GitHub), projects, file sync, AI provider config, API keys, and a `ws://` collaboration server.
- **Electron main** (`electron/main.ts`) owns FS + Ollama proxy + secure token storage (safeStorage) → **preload** (`electron/preload.ts`) exposes typed `window.cursor` (now including `getToken`/`setToken`/`clearToken`) → **React renderer** (`src/`) with Zustand store (`src/store.ts`), Monaco editor, and four AI features (chat, inline edit, tab autocomplete, composer) all calling Ollama via the bridge.
- **Frontend auth layer**: `src/services/api.ts` (typed fetch client with token refresh + Electron bridge), `src/context/AuthContext.tsx` (provider), `src/components/LoginPage.tsx` / `RegisterPage.tsx` / `AuthCallbackPage.tsx`, routes guarded by `ProtectedRoute` in `src/App.tsx`.
- **Collaboration**: `src/services/collaboration.ts` wraps the native browser `WebSocket` for real-time cursors/edits/chat.

