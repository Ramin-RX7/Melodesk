// Helpers for main-process tests. Typical use:
//
//   const electron = await freshMain();            // new profile, no handlers registered yet
//   const lib = await useLibrary();                // fixture songs + config.json pointing at them
//   const { updateLibrary } = await import("../../../src/main/services/library/libraryUpdater");
//
// Modules under src/main read app.getPath("userData") when they are imported, so import them
// (dynamically) after freshMain().

import fs from "node:fs";
import path from "node:path";
import { vi } from "vitest";

import { copyLibrary } from "../fixtures/generate.mjs";
import { makeTempDir, writeJsonFile } from "./tempdir";

type FakeElectron = typeof import("./electron");

/** The fake electron instance the code under test sees (vi.mock in main-setup.ts). */
export const fakeElectron = async () => (await import("electron")) as unknown as FakeElectron;

/**
 * A clean start: src modules are imported anew (vi.resetModules) and the fake electron is reset
 * (no handlers or windows, a new empty profile). Mocked modules survive resetModules, which is
 * why the fake is reset rather than re-created.
 */
export const freshMain = async () => {
  vi.resetModules();
  const electron = await fakeElectron();
  electron.resetFake();
  return electron;
};

export type TestLibrary = {
  /** Folder holding both library folders. */
  root: string;
  /** The two library folders (as written to config.json). */
  a: string;
  b: string;
  /** Absolute path of a fixture file, relative to `root`, e.g. "Library A/Album One/01 First Light.mp3". */
  file: (relative: string) => string;
};

/** Copies the fixture music to a temp folder and makes it the library of the current profile. */
export const useLibrary = async (config: Record<string, unknown> = {}): Promise<TestLibrary> => {
  const { userDataDir } = await fakeElectron();
  const root = copyLibrary(path.join(makeTempDir("melodesk-music-"), "music"));
  const a = path.join(root, "Library A");
  const b = path.join(root, "Library B");
  writeJsonFile(path.join(userDataDir, "config.json"), { libraryPaths: [a, b], ...config });
  return { root, a, b, file: (relative) => path.join(root, ...relative.split("/")) };
};

/** Writes files into the current profile, e.g. { "session.json": {...} }. */
export const seedUserData = async (files: Record<string, unknown>) => {
  const { userDataDir } = await fakeElectron();
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(userDataDir, name);
    if (typeof content === "string" || Buffer.isBuffer(content)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    } else {
      writeJsonFile(target, content);
    }
  }
};

/** Path inside the current profile. */
export const profilePath = async (...parts: string[]) => {
  const { userDataDir } = await fakeElectron();
  return path.join(userDataDir, ...parts);
};

/** Polls until `check` returns a truthy value (or throws after `timeout` ms). */
export const waitFor = async <T>(
  check: () => T | Promise<T>,
  timeout = 5000,
): Promise<NonNullable<T>> => {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value as NonNullable<T>;
    if (Date.now() > end) throw new Error("waitFor: condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

/** Gives an old modification time to a file (e.g. art older than a day). */
export const age = (file: string, ms: number) => {
  const t = new Date(Date.now() - ms);
  fs.utimesSync(file, t, t);
};
