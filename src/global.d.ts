import type { CursorAPI } from "../electron/preload";

declare global {
  interface Window {
    cursor: CursorAPI;
  }
}

export {};
