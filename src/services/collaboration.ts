import type { WSMessage, WSCursorPayload, WSFileEditPayload } from "@shared/types";

// Use native browser WebSocket in renderer
type WebSocketType = globalThis.WebSocket;

type MessageHandler = (msg: WSMessage) => void;

export class CollaborationClient {
  private ws: WebSocketType | null = null;
  private url: string;
  private token: string;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private projectId: string | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(projectId: string) {
    this.projectId = projectId;
    this.wsConnect();
  }

  private wsConnect() {
    try {
      const url = new URL(this.url);
      url.searchParams.set("token", this.token);
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        console.log("[WS] Connected");
        if (this.projectId) {
          this.send({ type: "join", payload: { projectId: this.projectId } });
        }
        this.startPing();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as WSMessage;
          this.handlers.forEach((h) => h(msg));
        } catch {
          // ignore malformed
        }
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected");
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        console.error("[WS] Error");
        this.stopPing();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.projectId) this.wsConnect();
    }, 3000);
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping", payload: {} });
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  send(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  join(projectId: string) {
    this.projectId = projectId;
    this.send({ type: "join", payload: { projectId } });
  }

  leave() {
    this.send({ type: "leave", payload: {} });
    this.projectId = null;
  }

  sendCursor(position: WSCursorPayload["position"], selection?: WSCursorPayload["selection"]) {
    this.send({ type: "cursor", payload: { position, selection } });
  }

  sendFileEdit(path: string, changes: WSFileEditPayload["changes"]) {
    this.send({ type: "file-edit", payload: { path, changes } });
  }

  sendFileOpen(path: string) {
    this.send({ type: "file-open", payload: { path } });
  }

  sendFileClose(path: string) {
    this.send({ type: "file-close", payload: { path } });
  }

  sendChatMessage(content: string, fileRefs?: string[]) {
    this.send({ type: "chat-message", payload: { content, fileRefs } });
  }

  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.send({ type: "leave", payload: {} });
    this.ws?.close();
    this.ws = null;
    this.projectId = null;
  }
}
