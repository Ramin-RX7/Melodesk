import { ipcMain } from "electron";

import { clearSession, getSession, saveSession } from "../services/sessionService";

export function setupSessionHandlers() {
  ipcMain.handle("get-session", () => getSession());
  ipcMain.handle("save-session", (_event, data) => saveSession(data));
  ipcMain.handle("clear-session", () => clearSession());
  // Fire-and-forget (ipcRenderer.send) so it also works while the window is closing.
  ipcMain.on("save-playback-position", (_event, position: number) => {
    if (Number.isFinite(position) && getSession()?.currentTrackPath) saveSession({ position });
  });
}
