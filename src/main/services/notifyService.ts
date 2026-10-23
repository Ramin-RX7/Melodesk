import { BrowserWindow, ipcMain } from "electron";

import { AppNotification } from "../../renderer/types";

// Notifications raised before the renderer is listening (e.g. a damaged settings file found at
// startup) are held here and handed over by "take-pending-notifications".
let rendererReady = false;
const pending: AppNotification[] = [];

ipcMain.handle("take-pending-notifications", () => {
  rendererReady = true;
  return pending.splice(0);
});

// Shows a toast in every open window (the renderer's useToasts hook listens on "notification").
export const notify = (level: AppNotification["level"], message: string) => {
  const notification: AppNotification = { level, message };
  if (!rendererReady) {
    pending.push(notification);
    return;
  }
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("notification", notification);
  });
};
