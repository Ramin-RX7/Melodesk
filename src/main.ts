import { app, BrowserWindow, ipcMain, protocol, screen } from "electron";
import path from "path";

import { WindowBounds } from "./renderer/types";

import { registerMediaProtocol } from "./main/protocols/mediaProtocol";
import { updateLibrary } from "./main/services/library/libraryUpdater";
import { setupWatcher } from "./main/services/library/libraryWatcher";
import { registerIpcHandlers } from "./main/ipc/index";
import {
  getWindowBounds,
  saveWindowBounds,
  getMiniWindowBounds,
  saveMiniWindowBounds,
} from "./main/services/sessionService";

// Register the custom protocol before the app is ready
protocol.registerSchemesAsPrivileged([
  // corsEnabled lets Web Audio's createMediaElementSource read the stream
  // without tainting it (a tainted source plays as silence through the graph).
  { scheme: "media", privileges: { bypassCSP: true, stream: true, corsEnabled: true } },
]);

const MIN_WIDTH = 600;
const MIN_HEIGHT = 300;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

// Mini-player ("floating widget") mode: a small always-on-top window.
const MINI_MIN_WIDTH = 160;
const MINI_MIN_HEIGHT = 160;
const MINI_DEFAULT_WIDTH = 260;
const MINI_DEFAULT_HEIGHT = 260;

// Validate saved bounds against the currently connected displays so the window
// is never restored off-screen (e.g. a second monitor was disconnected) or
// larger than any available screen.
function sanitizeBounds(
  b: WindowBounds | null,
  minW: number = MIN_WIDTH,
  minH: number = MIN_HEIGHT,
): { width: number; height: number; x?: number; y?: number } {
  if (!b) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

  const displays = screen.getAllDisplays();
  const maxWidth = Math.max(...displays.map((d) => d.workArea.width));
  const maxHeight = Math.max(...displays.map((d) => d.workArea.height));

  const width = Math.min(Math.max(b.width, minW), maxWidth);
  const height = Math.min(Math.max(b.height, minH), maxHeight);

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
    frame: false,
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

  // Tracks whether the window is currently in the small mini-player mode. Bounds
  // are persisted to a separate slot per mode so each size is remembered.
  let isMiniMode = false;
  // The mini player's intended size: set when it opens and when the user resizes it. Moves and
  // saves reuse it, because every setBounds on a scaled display can come out 1-2 px off and
  // reading the size back would let that build up over many drags.
  let miniSize: { width: number; height: number } | null = null;
  // Only emitted for resizes by the user, not for setBounds.
  win.on("will-resize", (_e, newBounds) => {
    if (isMiniMode) miniSize = { width: newBounds.width, height: newBounds.height };
  });

  // Write the current bounds straight to the appropriate slot (no debounce).
  const flushBounds = () => {
    if (win.isDestroyed()) return;
    if (isMiniMode) {
      const b = win.getBounds();
      saveMiniWindowBounds({ ...b, ...miniSize, x: b.x, y: b.y });
    } else {
      // getNormalBounds returns the un-maximized size so we can restore it later.
      const b = win.getNormalBounds();
      saveWindowBounds({
        width: b.width,
        height: b.height,
        x: b.x,
        y: b.y,
        isMaximized: win.isMaximized(),
      });
    }
  };

  // Persist window size/position (debounced) so it is restored on next launch.
  let saveTimer: NodeJS.Timeout | null = null;
  const persistBounds = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushBounds, 400);
  };

  win.on("resize", persistBounds);
  win.on("move", persistBounds);
  win.on("maximize", persistBounds);
  win.on("unmaximize", persistBounds);

  // Keep the renderer's custom maximize/restore icon in sync.
  win.on("maximize", () => win.webContents.send("window-maximized-changed", true));
  win.on("unmaximize", () => win.webContents.send("window-maximized-changed", false));

  win.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    flushBounds();
  });

  /* ---------------- WINDOW CONTROL + MINI-MODE IPC ---------------- */
  // Registered here (once) because they operate on this window instance.
  ipcMain.handle("window-minimize", () => win.minimize());
  ipcMain.handle("window-maximize-toggle", () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("window-close", () => win.close());
  ipcMain.handle("window-is-maximized", () => win.isMaximized());

  // Used by the mini player to implement custom window dragging (a frameless
  // -webkit-app-region drag area would suppress the hover events it needs).
  ipcMain.handle("get-window-bounds", () => {
    const b = win.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  // Move via setBounds with an explicit size rather than setPosition. On high-DPI displays
  // setPosition round-trips the size through DIP<->physical pixels and the rounding accumulates,
  // so the window visibly grows in the drag direction. In mini mode the remembered size is used
  // (see miniSize); otherwise the size the renderer captured when the drag started.
  ipcMain.on("set-window-position", (_e, x: number, y: number, width: number, height: number) => {
    if (win.isDestroyed()) return;
    const size = (isMiniMode && miniSize) || { width, height };
    win.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(size.width),
      height: Math.round(size.height),
    });
  });

  ipcMain.handle("enter-mini-mode", () => {
    if (isMiniMode) return;
    // Persist the current normal bounds before shrinking so we can restore them.
    if (saveTimer) clearTimeout(saveTimer);
    flushBounds();
    if (win.isMaximized()) win.unmaximize();

    isMiniMode = true;
    // Lower the minimum size BEFORE shrinking, otherwise the resize is clamped.
    win.setMinimumSize(MINI_MIN_WIDTH, MINI_MIN_HEIGHT);
    const mini = sanitizeBounds(
      getMiniWindowBounds() ?? { width: MINI_DEFAULT_WIDTH, height: MINI_DEFAULT_HEIGHT },
      MINI_MIN_WIDTH,
      MINI_MIN_HEIGHT,
    );
    win.setBounds(mini);
    miniSize = { width: mini.width, height: mini.height };
    // Highest level so nothing (even other always-on-top windows) covers it.
    win.setAlwaysOnTop(true, "screen-saver");
  });

  ipcMain.handle("exit-mini-mode", () => {
    if (!isMiniMode) return;
    // Persist the mini bounds before restoring the normal window.
    if (saveTimer) clearTimeout(saveTimer);
    flushBounds();

    isMiniMode = false;
    win.setAlwaysOnTop(false);
    win.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
    const saved = getWindowBounds();
    const normal = sanitizeBounds(saved);
    win.setBounds(normal);
    if (saved?.isMaximized) win.maximize();
  });

  win.loadFile(path.join(__dirname, "renderer/index.html"));
  return win;
}

// Only one MeloDesk may run per profile: two processes would both write the same JSON files
// (play counts, cache, session) and overwrite each other's changes. A second launch just brings
// the running window to the front.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    // Register IPC handlers
    registerIpcHandlers();
    // Setup file watcher
    await setupWatcher();
    updateLibrary(); // Also run a background update on startup
    // Handle media:// protocol
    registerMediaProtocol();
    // Create the main application window
    mainWindow = createWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
