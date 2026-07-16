# CursorClone Backend

Node.js + Express + TypeScript REST API and WebSocket server for the CursorClone full-stack application.

## Features

- **Authentication**: JWT access + refresh tokens (bcrypt-hashed passwords), OAuth (Google/GitHub) scaffolding
- **Authorization**: Role-based (USER/ADMIN), project membership roles (OWNER/ADMIN/MEMBER/VIEWER)
- **Users**: Profile, settings, session management
- **Projects**: CRUD, members/invites, visibility (PRIVATE/PUBLIC/TEAM)
- **File Sync**: Cloud-synced files per project (tree, read, write, delete, batch sync)
- **AI Config**: Per-user and per-project AI provider settings (Ollama/OpenAI/Anthropic/Custom), proxying chat requests
- **Real-time Collaboration**: WebSocket server — cursors, selections, file edits, chat
- **API Keys**: Programmatic access tokens (hashed at rest)
- **Rate limiting** and input validation (Zod)

## Setup

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL + JWT secrets
npm install
npx prisma generate
npx prisma db push          # or: npx prisma migrate dev
npm run dev                 # tsx watch, port 3000
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Seed database |

## API Overview

- `POST /api/auth/register` — register with email/password
- `POST /api/auth/login` — login, returns access + refresh tokens
- `POST /api/auth/refresh` — rotate tokens
- `POST /api/auth/logout` — revoke sessions
- `GET  /api/auth/me` — current user + settings
- `POST /api/auth/change-password`
- `GET  /api/auth/oauth/google` / `/github` — begin OAuth (optional)
- `GET  /api/auth/oauth/callback` — OAuth callback
- `GET/PUT /api/users/me` — profile + sessions
- `GET/POST /api/projects` — list/create projects
- `GET/PUT/DELETE /api/projects/:id` — project ops
- `POST/DELETE /api/projects/:id/members` — collaboration
- `GET/PUT/DELETE /api/files/:projectId/*` — file sync
- `POST /api/files/:projectId/sync` — batch sync
- `GET/PUT /api/settings` — user editor settings
- `GET/PUT /api/ai/config` — AI provider config (user + project)
- `POST /api/ai/chat` — proxied chat completion (streaming supported)
- `GET/POST/DELETE /api/api-keys` — API key management

## WebSocket

Connect to `ws://localhost:3000/ws?token=<ACCESS_TOKEN>` (or `Authorization: Bearer` header).
Message types: `join`, `leave`, `cursor`, `selection`, `file-edit`, `file-open`, `file-close`, `chat-message`, `ping`.

## Architecture

```
backend/
├── prisma/schema.prisma     # PostgreSQL schema
├── src/
│   ├── config/              # env validation (Zod) + dotenv
│   ├── db/                  # Prisma client singleton
│   ├── middleware/          # auth + project-access guards
│   ├── routes/              # auth, users, projects, files, settings, ai, apikeys, oauth
│   ├── websocket/           # real-time collaboration server
│   └── server.ts            # Express app + HTTP server + WS
```
