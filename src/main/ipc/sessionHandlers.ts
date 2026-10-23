import { ipcMain } from "electron";

import { clearSession, getSession, saveSession } from "../services/sessionService";

export function setupSessionHandlers() {
  ipcMain.handle("get-session", () => getSession());
  ipcMain.handle("save-session", (_event, data) => saveSession(data));
  ipcMain.handle("clear-session", () => clearSession());
}
