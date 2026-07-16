import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as fsp from "fs/promises";
import { EventEmitter } from "events";
import { IPC, FileNode, OllamaSettings, OllamaModel } from "../shared/types.js";

class Store {
  private filePath: string;
  private data: Record<string, unknown> = {};

  constructor(name: string) {
    const userData = app.getPath("userData");
    this.filePath = path.join(userData, `${name}.json`);
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      }
    } catch {
      this.data = {};
    }
  }

  get(key: string, fallback: unknown) {
    return key in this.data ? this.data[key] : fallback;
  }

  set(key: string, value: unknown) {
    this.data[key] = value;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error("Failed to persist settings:", e);
    }
  }
}

let store: Store;
let openFolder: string | null = null;
const folderWatcher = new EventEmitter();

async function buildTree(dir: string, maxDepth = 5, depth = 0): Promise<FileNode> {
  const name = path.basename(dir);
  const stat = await fsp.stat(dir);
  if (stat.isFile() || depth >= maxDepth) {
    return { name, path: dir, type: stat.isFile() ? "file" : "directory" };
  }
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const children: FileNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const childPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      children.push(await buildTree(childPath, maxDepth, depth + 1));
    } else {
      children.push({ name: entry.name, path: childPath, type: "file" });
    }
  }
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { name, path: dir, type: "directory", children };
}

async function ollamaFetch(host: string, endpoint: string, init?: RequestInit) {
  const url = host.replace(/\/$/, "") + endpoint;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`Ollama ${endpoint} returned ${res.status}`);
  return res;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "CursorClone",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ---------- IPC: File system ----------
ipcMain.handle(IPC.OPEN_FOLDER, async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  openFolder = result.filePaths[0];
  return buildTree(openFolder);
});

ipcMain.handle(IPC.LIST_DIR, async (_e, dirPath: string) => {
  return buildTree(dirPath);
});

ipcMain.handle(IPC.READ_FILE, async (_e, filePath: string) => {
  return fsp.readFile(filePath, "utf-8");
});

ipcMain.handle(IPC.WRITE_FILE, async (_e, filePath: string, content: string) => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf-8");
  return true;
});

ipcMain.handle(IPC.CREATE_FILE, async (_e, filePath: string, content = "") => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf-8");
  return buildTree(openFolder!);
});

ipcMain.handle(IPC.CREATE_DIR, async (_e, dirPath: string) => {
  await fsp.mkdir(dirPath, { recursive: true });
  return buildTree(openFolder!);
});

ipcMain.handle(IPC.DELETE_PATH, async (_e, targetPath: string) => {
  await fsp.rm(targetPath, { recursive: true, force: true });
  return buildTree(openFolder!);
});

ipcMain.on(IPC.WATCH_DIR, (e) => {
  const sender = e.sender;
  const listener = () => {
    if (!sender.isDestroyed() && openFolder) {
      buildTree(openFolder).then((tree) => {
        if (!sender.isDestroyed()) sender.send("fs:tree-updated", tree);
      });
    }
  };
  folderWatcher.on("changed", listener);
  // Initial watch
  if (openFolder) {
    try {
      fs.watch(
        openFolder,
        { recursive: true },
        (_event, filename) => {
          if (filename) folderWatcher.emit("changed");
        }
      );
    } catch {
      // recursive watch may not be supported; ignore
    }
  }
});

// ---------- IPC: Ollama ----------
ipcMain.handle(IPC.OLLAMA_HEALTH, async () => {
  try {
    const settings = getSettings();
    const res = await ollamaFetch(settings.host, "/api/tags");
    return res.ok;
  } catch {
    return false;
  }
});

ipcMain.handle(IPC.OLLAMA_LIST_MODELS, async () => {
  const settings = getSettings();
  const res = await ollamaFetch(settings.host, "/api/tags");
  const data = (await res.json()) as { models?: OllamaModel[] };
  return data.models || [];
});

ipcMain.handle(
  IPC.OLLAMA_CHAT,
  async (e, messages: Array<{ role: string; content: string }>, model?: string) => {
    const settings = getSettings();
    const res = await ollamaFetch(settings.host, "/api/chat", {
      method: "POST",
      body: JSON.stringify({
        model: model || settings.model,
        messages,
        stream: true,
      }),
    });
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            e.sender.send("ollama:chat-chunk", json.message.content);
          }
          if (json.done) {
            e.sender.send("ollama:chat-done");
          }
        } catch {
          // ignore partial
        }
      }
    }
    e.sender.send("ollama:chat-done");
  }
);

ipcMain.handle(
  IPC.OLLAMA_GENERATE,
  async (e, prompt: string, model?: string, options?: Record<string, unknown>) => {
    const settings = getSettings();
    const res = await ollamaFetch(settings.host, "/api/generate", {
      method: "POST",
      body: JSON.stringify({
        model: model || settings.model,
        prompt,
        stream: true,
        options: options || {},
      }),
    });
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.response) {
            e.sender.send("ollama:generate-chunk", json.response);
          }
        } catch {
          // ignore
        }
      }
    }
    e.sender.send("ollama:generate-done");
  }
);

// ---------- IPC: Settings ----------
function getSettings(): OllamaSettings {
  return {
    host: (store.get("ollamaHost", "http://localhost:11434") as string),
    model: (store.get("ollamaModel", "qwen2.5-coder:7b") as string),
  };
}

ipcMain.handle(IPC.GET_SETTINGS, () => getSettings());

ipcMain.handle(IPC.SET_SETTINGS, (_e, settings: Partial<OllamaSettings>) => {
  if (settings.host) store.set("ollamaHost", settings.host);
  if (settings.model) store.set("ollamaModel", settings.model);
  return getSettings();
});

// ---------- IPC: Backend Auth ----------
let authStore: Store;

ipcMain.handle(IPC.GET_TOKEN, () => {
  try {
    if (!authStore) return null;
    const encrypted = authStore.get("accessToken", null) as string | null;
    if (!encrypted) return null;
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(encrypted, "hex"));
      return decrypted;
    }
    return encrypted;
  } catch {
    return null;
  }
});

ipcMain.handle(IPC.SET_TOKEN, (_e, token: string) => {
  try {
    if (!authStore) return false;
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      authStore.set("accessToken", encrypted.toString("hex"));
    } else {
      authStore.set("accessToken", token);
    }
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle(IPC.CLEAR_TOKEN, () => {
  if (authStore) authStore.set("accessToken", null);
  return true;
});

app.whenReady().then(() => {
  store = new Store("cursorclone-settings");
  authStore = new Store("cursorclone-auth");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
