import { app, BrowserWindow, protocol } from "electron";
import path from "path";

import { registerMediaProtocol } from "./main/protocols/mediaProtocol";
import { updateLibrary } from "./main/services/library/libraryUpdater";
import { setupWatcher } from "./main/services/library/libraryWatcher";
import { registerIpcHandlers } from "./main/ipc/index";


// Register the custom protocol before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "media", privileges: { bypassCSP: true, stream: true } }
]);

/* ---------------- WINDOW ---------------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 300,
    backgroundColor: "#121212",
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets/icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      spellcheck: false,
    },
  });
  console.log(path.join(__dirname, "assets/icon.ico"));
  // Main window
  // win.setMenuBarVisibility(false);
  win.once("ready-to-show", () => {
    win.show();
  });
  win.loadFile(path.join(__dirname, "renderer/index.html"));

}

app.whenReady().then(async () => {
  // Register IPC handlers
  registerIpcHandlers();
  // Setup file watcher
  await setupWatcher();
  updateLibrary();  // Also run a background update on startup
  // Handle media:// protocol
  registerMediaProtocol();
  // Create the main application window
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
