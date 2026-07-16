import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/index.js";
import { prisma } from "../db/index.js";

interface AuthPayload {
  userId: string;
  role: string;
}

interface Client {
  ws: WebSocket;
  userId: string;
  projectId?: string;
  username: string;
}

const clients = new Map<string, Client[]>(); // projectId -> clients[]
const userClients = new Map<string, Client>(); // userId -> primary client

export function setupWebSocket(server: import("http").Server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  // Authenticate upgrade requests
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    if (!request.url || !request.url.startsWith("/ws")) return;

    // Token from Authorization header OR ?token= query param (browser fallback)
    let token: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      try {
        const url = new URL(request.url, "http://localhost");
        const q = url.searchParams.get("token");
        if (q) token = q;
      } catch {}
    }

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const { JWT_ACCESS_SECRET } = getEnv();

    try {
      const payload = jwt.verify(token, JWT_ACCESS_SECRET) as AuthPayload;

      // Fetch user info
      prisma.user
        .findFirst({ where: { id: payload.userId } })
        .then((user) => {
          if (!user) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }

          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, { ...payload, username: user.username || user.email });
          });
        })
        .catch(() => {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
        });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket, user: AuthPayload & { username: string }) => {
    const client: Client = {
      ws,
      userId: user.userId,
      username: user.username,
    };

    ws.on("message", (data: Buffer) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
        return;
      }

      const { type, payload } = message;

      switch (type) {
        case "join": {
          const { projectId } = payload as { projectId: string };
          client.projectId = projectId;

          // Register in project room
          if (!clients.has(projectId)) clients.set(projectId, []);
          clients.get(projectId)!.push(client);

          // Track user's primary client
          userClients.set(user.userId, client);

          // Notify others in the room
          broadcastToProject(projectId, {
            type: "user-joined",
            payload: {
              userId: user.userId,
              username: user.username,
            },
          }, client.ws);

          // Send current users in room
          const roomClients = clients.get(projectId) || [];
          ws.send(JSON.stringify({
            type: "room-users",
            payload: roomClients
              .filter((c) => c.ws !== ws)
              .map((c) => ({ userId: c.userId, username: c.username })),
          }));
          break;
        }

        case "leave": {
          removeClient(client);
          break;
        }

        case "cursor": {
          if (!client.projectId) return;
          const { position, selection } = payload as {
            position: { line: number; column: number };
            selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
          };
          broadcastToProject(client.projectId, {
            type: "cursor",
            payload: {
              userId: user.userId,
              username: user.username,
              position,
              selection,
            },
          }, client.ws);
          break;
        }

        case "selection": {
          if (!client.projectId) return;
          broadcastToProject(client.projectId, {
            type: "selection",
            payload: {
              userId: user.userId,
              username: user.username,
              selection: payload,
            },
          }, client.ws);
          break;
        }

        case "file-edit": {
          if (!client.projectId) return;
          const { path, changes } = payload as {
            path: string;
            changes: Array<{
              type: "insert" | "delete" | "replace";
              offset?: number;
              length?: number;
              text?: string;
            }>;
          };
          broadcastToProject(client.projectId, {
            type: "file-edit",
            payload: {
              userId: user.userId,
              username: user.username,
              path,
              changes,
            },
          }, client.ws);
          break;
        }

        case "file-open": {
          if (!client.projectId) return;
          const { path } = payload as { path: string };
          broadcastToProject(client.projectId, {
            type: "file-open",
            payload: {
              userId: user.userId,
              username: user.username,
              path,
            },
          }, client.ws);
          break;
        }

        case "file-close": {
          if (!client.projectId) return;
          const { path } = payload as { path: string };
          broadcastToProject(client.projectId, {
            type: "file-close",
            payload: {
              userId: user.userId,
              username: user.username,
              path,
            },
          }, client.ws);
          break;
        }

        case "chat-message": {
          if (!client.projectId) return;
          const { content, fileRefs } = payload as { content: string; fileRefs?: string[] };
          broadcastToProject(client.projectId, {
            type: "chat-message",
            payload: {
              userId: user.userId,
              username: user.username,
              content,
              fileRefs,
              timestamp: Date.now(),
            },
          }, client.ws);
          break;
        }

        default:
          ws.send(JSON.stringify({ type: "error", error: `Unknown message type: ${type}` }));
      }
    });

    ws.on("close", () => {
      removeClient(client);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      removeClient(client);
    });
  });
}

function removeClient(client: Client) {
  if (client.projectId) {
    const room = clients.get(client.projectId);
    if (room) {
      const idx = room.indexOf(client);
      if (idx !== -1) room.splice(idx, 1);
      if (room.length === 0) clients.delete(client.projectId);

      broadcastToProject(client.projectId, {
        type: "user-left",
        payload: {
          userId: client.userId,
          username: client.username,
        },
      });
    }
  }
  userClients.delete(client.userId);
  try { client.ws.close(); } catch {}
}

function broadcastToProject(
  projectId: string,
  message: unknown,
  exclude?: WebSocket
) {
  const room = clients.get(projectId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const client of room) {
    if (client.ws !== exclude && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}
