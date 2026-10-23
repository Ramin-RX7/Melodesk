// A fake `electron` module for main-process tests (installed for every "main" test file by
// main-setup.ts). Each test file gets its own temporary userData folder, so tests never touch a
// real profile. IPC handlers registered by the code under test are captured and can be called
// with `invoke` / `send`; windows and their webContents record what is sent to them.

import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

export const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "melodesk-test-"));

/* ---------------- webContents / windows ---------------- */

export class FakeWebContents extends EventEmitter {
  readonly id: number;
  /** Everything sent to the page: [channel, ...args]. */
  readonly sent: unknown[][] = [];
  destroyed = false;
  private static nextId = 1;

  constructor() {
    super();
    this.id = FakeWebContents.nextId++;
  }
  send(channel: string, ...args: unknown[]) {
    this.sent.push([channel, ...args]);
    this.emit("__sent", channel, ...args);
  }
  isDestroyed() {
    return this.destroyed;
  }
  /** Messages sent on one channel (their first argument). */
  sentOn<T = unknown>(channel: string): T[] {
    return this.sent.filter(([c]) => c === channel).map(([, value]) => value as T);
  }
  setWindowOpenHandler = vi.fn();
}

export class FakeBrowserWindow extends EventEmitter {
  readonly webContents = new FakeWebContents();
  destroyed = false;
  isDestroyed() {
    return this.destroyed;
  }
  static windows: FakeBrowserWindow[] = [];
  static getAllWindows() {
    return FakeBrowserWindow.windows.filter((w) => !w.destroyed);
  }
  static fromWebContents(contents: FakeWebContents) {
    return FakeBrowserWindow.windows.find((w) => w.webContents === contents) ?? null;
  }
}

/** Opens a fake window (so broadcasts and questions reach someone). */
export const openWindow = () => {
  const win = new FakeBrowserWindow();
  FakeBrowserWindow.windows.push(win);
  return win;
};

/* ---------------- ipcMain ---------------- */

type Handler = (event: { sender: FakeWebContents }, ...args: unknown[]) => unknown;
const handlers = new Map<string, Handler>();
const listeners = new Map<string, Handler[]>();

export const ipcMain = {
  handle: (channel: string, handler: Handler) => {
    if (handlers.has(channel)) throw new Error(`Second handler for ${channel}`);
    handlers.set(channel, handler);
  },
  removeHandler: (channel: string) => handlers.delete(channel),
  on: (channel: string, listener: Handler) => {
    listeners.set(channel, [...(listeners.get(channel) ?? []), listener]);
  },
};

/** Calls an `ipcMain.handle` handler the way `ipcRenderer.invoke` would. */
export const invoke = async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  const sender = FakeBrowserWindow.getAllWindows()[0]?.webContents ?? new FakeWebContents();
  return (await handler({ sender }, ...args)) as T;
};

/** Delivers an `ipcRenderer.send` message to the `ipcMain.on` listeners. */
export const send = (channel: string, ...args: unknown[]) => {
  const sender = FakeBrowserWindow.getAllWindows()[0]?.webContents ?? new FakeWebContents();
  for (const listener of listeners.get(channel) ?? []) listener({ sender }, ...args);
};

export const hasHandler = (channel: string) => handlers.has(channel);

/* ---------------- other modules ---------------- */

export const app = {
  getPath: (name: string) => (name === "userData" ? userDataDir : path.join(userDataDir, name)),
  getAppPath: () => process.cwd(),
  on: vi.fn(),
  quit: vi.fn(),
  whenReady: () => Promise.resolve(),
  requestSingleInstanceLock: () => true,
};

export const dialog = {
  showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] as string[] })),
  showMessageBox: vi.fn(),
};

export const shell = {
  openExternal: vi.fn(async () => {}),
  showItemInFolder: vi.fn(),
};

/** Handlers registered with protocol.handle, by scheme. */
export const protocolHandlers = new Map<
  string,
  (request: Request) => Response | Promise<Response>
>();
export const protocol = {
  handle: (scheme: string, handler: (request: Request) => Response | Promise<Response>) => {
    protocolHandlers.set(scheme, handler);
  },
  registerSchemesAsPrivileged: vi.fn(),
};

export const net = { fetch: vi.fn(async () => new Response("app file")) };

export const session = { defaultSession: { setPermissionRequestHandler: vi.fn() } };

export const Menu = {
  buildFromTemplate: vi.fn((template: unknown[]) => ({ template, popup: vi.fn() })),
};

export const screen = {
  getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
  getDisplayMatching: () => ({ scaleFactor: 1 }),
};

export const webUtils = { getPathForFile: vi.fn(() => "") };

export const BrowserWindow = FakeBrowserWindow;

export default {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  screen,
  session,
  shell,
  webUtils,
};
