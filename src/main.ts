import { app, BrowserWindow, protocol, screen } from "electron";
import path from "path";

import { WindowBounds } from "./renderer/types";

import { registerMediaProtocol } from "./main/protocols/mediaProtocol";
import { updateLibrary } from "./main/services/library/libraryUpdater";
import { setupWatcher } from "./main/services/library/libraryWatcher";
import { registerIpcHandlers } from "./main/ipc/index";
import { getWindowBounds, saveWindowBounds } from "./main/services/sessionService";


// Register the custom protocol before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "media", privileges: { bypassCSP: true, stream: true } }
]);

const MIN_WIDTH = 600;
const MIN_HEIGHT = 300;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

// Validate saved bounds against the currently connected displays so the window
// is never restored off-screen (e.g. a second monitor was disconnected) or
// larger than any available screen.
function sanitizeBounds(
  b: WindowBounds | null
): { width: number; height: number; x?: number; y?: number } {
  if (!b) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

  const displays = screen.getAllDisplays();
  const maxWidth = Math.max(...displays.map((d) => d.workArea.width));
  const maxHeight = Math.max(...displays.map((d) => d.workArea.height));

  const width = Math.min(Math.max(b.width, MIN_WIDTH), maxWidth);
  const height = Math.min(Math.max(b.height, MIN_HEIGHT), maxHeight);

  if (b.x === undefined || b.y === undefined) {
    return { width, height };
  }

  // Keep the saved position only if a meaningful part of the window lands on a display.
  const onScreen = displays.some((d) => {
    const wa = d.workArea;
    const overlapW = Math.min(b.x! + width, wa.x + wa.width) - Math.max(b.x!, wa.x);
    const overlapH = Math.min(b.y! + height, wa.y + wa.height) - Math.max(b.y!, wa.y);
    if (overlapW <= 0 || overlapH <= 0) return false;
    return overlapW * overlapH >= width * height * 0.3;
  });

  // Dropping x/y lets Electron center the window on the primary display.
  return onScreen ? { width, height, x: b.x, y: b.y } : { width, height };
}

/* ---------------- WINDOW ---------------- */
function createWindow() {
  const savedBounds = getWindowBounds();
  const bounds = sanitizeBounds(savedBounds);

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
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

  win.once("ready-to-show", () => {
    if (savedBounds?.isMaximized) win.maximize();
    win.show();
  });

  // Persist window size/position (debounced) so it is restored on next launch.
  let saveTimer: NodeJS.Timeout | null = null;
  const persistBounds = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const isMaximized = win.isMaximized();
      // getNormalBounds returns the un-maximized size so we can restore it later.
      const bounds = win.getNormalBounds();
      saveWindowBounds({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized,
      });
    }, 400);
  };

  win.on("resize", persistBounds);
  win.on("move", persistBounds);
  win.on("maximize", persistBounds);
  win.on("unmaximize", persistBounds);

  win.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    const bounds = win.getNormalBounds();
    saveWindowBounds({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized(),
    });
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
