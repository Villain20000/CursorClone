import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { IPC, FileNode, OllamaModel, OllamaSettings, ChatMessage } from "../shared/types.js";

const api = {
  // File system
  openFolder: (): Promise<FileNode | null> => ipcRenderer.invoke(IPC.OPEN_FOLDER),
  listDir: (dir: string): Promise<FileNode> => ipcRenderer.invoke(IPC.LIST_DIR, dir),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke(IPC.READ_FILE, filePath),
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.WRITE_FILE, filePath, content),
  createFile: (filePath: string, content?: string): Promise<FileNode> =>
    ipcRenderer.invoke(IPC.CREATE_FILE, filePath, content),
  createDir: (dirPath: string): Promise<FileNode> => ipcRenderer.invoke(IPC.CREATE_DIR, dirPath),
  deletePath: (targetPath: string): Promise<FileNode> => ipcRenderer.invoke(IPC.DELETE_PATH, targetPath),
  watchTree: (cb: (tree: FileNode) => void) => {
    ipcRenderer.send(IPC.WATCH_DIR);
    ipcRenderer.on("fs:tree-updated", (_e: IpcRendererEvent, tree: FileNode) => cb(tree));
  },

  // Ollama
  ollamaHealth: (): Promise<boolean> => ipcRenderer.invoke(IPC.OLLAMA_HEALTH),
  ollamaListModels: (): Promise<OllamaModel[]> => ipcRenderer.invoke(IPC.OLLAMA_LIST_MODELS),
  ollamaChat: (
    messages: Array<{ role: string; content: string }>,
    model?: string
  ): Promise<void> => ipcRenderer.invoke(IPC.OLLAMA_CHAT, messages, model),
  ollamaGenerate: (
    prompt: string,
    model?: string,
    options?: Record<string, unknown>
  ): Promise<void> => ipcRenderer.invoke(IPC.OLLAMA_GENERATE, prompt, model, options),
  onChatChunk: (cb: (chunk: string) => void) =>
    ipcRenderer.on("ollama:chat-chunk", (_e: IpcRendererEvent, chunk: string) => cb(chunk)),
  onChatDone: (cb: () => void) =>
    ipcRenderer.on("ollama:chat-done", () => cb()),
  onGenerateChunk: (cb: (chunk: string) => void) =>
    ipcRenderer.on("ollama:generate-chunk", (_e: IpcRendererEvent, chunk: string) => cb(chunk)),
  onGenerateDone: (cb: () => void) =>
    ipcRenderer.on("ollama:generate-done", () => cb()),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

  // Settings
  getSettings: (): Promise<OllamaSettings> => ipcRenderer.invoke(IPC.GET_SETTINGS),
  setSettings: (settings: Partial<OllamaSettings>): Promise<OllamaSettings> =>
    ipcRenderer.invoke(IPC.SET_SETTINGS, settings),

  // Backend Auth
  getToken: (): Promise<string | null> => ipcRenderer.invoke(IPC.GET_TOKEN),
  setToken: (token: string): Promise<boolean> => ipcRenderer.invoke(IPC.SET_TOKEN, token),
  clearToken: (): Promise<boolean> => ipcRenderer.invoke(IPC.CLEAR_TOKEN),
};

contextBridge.exposeInMainWorld("cursor", api);

export type CursorAPI = typeof api;
