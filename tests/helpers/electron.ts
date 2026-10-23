// A fake `electron` module for main-process tests (installed for every "main" test file by
// main-setup.ts). There is one instance per test file; resetFake() (called by freshMain in
// helpers/main.ts) clears it and gives it a new temporary userData folder, so tests never touch a
// real profile or each other's data. IPC handlers registered by the code under test are captured and can be called
// with `invoke` / `send`; windows and their webContents record what is sent to them.

import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

// Every profile made in this test file, removed afterwards by main-setup.ts.
const created = ((globalThis as { __melodeskProfiles?: string[] }).__melodeskProfiles ??= []);
const newProfile = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "melodesk-test-"));
  created.push(dir);
  return dir;
};
export let userDataDir = newProfile();

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
  on: vi.fn((_event: string, _listener: (...args: never[]) => void) => {}),
  quit: vi.fn(),
  whenReady: () => Promise.resolve(),
  requestSingleInstanceLock: () => true,
};

export const dialog = {
  showOpenDialog: vi.fn(async (_options: Record<string, unknown>) => ({
    canceled: true,
    filePaths: [] as string[],
  })),
  showMessageBox: vi.fn(),
};

export const shell = {
  openExternal: vi.fn(async (_url: string) => {}),
  showItemInFolder: vi.fn((_path: string) => {}),
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

export const net = {
  fetch: vi.fn(async (_request: Request, _options?: object) => new Response("app file")),
};

type PermissionHandler = (
  contents: unknown,
  permission: string,
  callback: (granted: boolean) => void,
) => void;
export const session = {
  defaultSession: { setPermissionRequestHandler: vi.fn((_handler: PermissionHandler) => {}) },
};

export const Menu = {
  buildFromTemplate: vi.fn((template: unknown[]) => ({ template, popup: vi.fn() })),
};

export const screen = {
  getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
  getDisplayMatching: () => ({ scaleFactor: 1 }),
};

export const webUtils = { getPathForFile: vi.fn((_file: unknown) => "") };

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

/** Clears handlers, windows and stubs, and switches to a new empty profile folder. */
export const resetFake = () => {
  userDataDir = newProfile();
  handlers.clear();
  listeners.clear();
  protocolHandlers.clear();
  FakeBrowserWindow.windows = [];
  vi.clearAllMocks();
  dialog.showOpenDialog.mockImplementation(async () => ({ canceled: true, filePaths: [] }));
  net.fetch.mockImplementation(async () => new Response("app file"));
  webUtils.getPathForFile.mockImplementation(() => "");
};
