import fs from "fs";
import path from "path";

import { notify } from "./notifyService";

// Crash-safe JSON persistence for every file under userData.
//
// - writeJson writes `<file>.tmp`, flushes it to disk and renames it over `<file>`, so a crash or
//   power loss leaves either the old or the new file, never half of one. The previous good
//   version is kept as `<file>.bak`.
// - readJson never lets a damaged file be overwritten with defaults: the file is moved aside as
//   `<file>.corrupt`, restored from `<file>.bak` when possible, and the user is told.

type ReadOptions = {
  /** What the file holds, in user terms ("settings", "play counts"); used in notifications. */
  label: string;
  /** Show a notification when the file was damaged (off for data that is simply rebuilt). */
  notifyUser?: boolean;
};

type WriteOptions = {
  pretty?: boolean;
  /** Keep the previous version as `<file>.bak` (off for large files that can be rebuilt). */
  backup?: boolean;
};

const parseFile = (filePath: string): unknown => JSON.parse(fs.readFileSync(filePath, "utf-8"));

// Brief synchronous pause; used between rename retries.
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// On Windows a rename can fail for a moment while an antivirus or indexer has the file open.
const replaceFile = (from: string, to: string) => {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code ?? "";
      if (attempt >= 4 || !["EPERM", "EBUSY", "EACCES"].includes(code)) throw error;
      pause(50 * (attempt + 1));
    }
  }
};

// Moves a damaged file out of the way without overwriting an earlier one. Returns its new name.
export const setAside = (filePath: string): string => {
  let target = `${filePath}.corrupt`;
  if (fs.existsSync(target)) target = `${filePath}.${Date.now()}.corrupt`;
  fs.renameSync(filePath, target);
  return path.basename(target);
};

export const writeJson = (
  filePath: string,
  data: unknown,
  { pretty = false, backup = true }: WriteOptions = {},
): boolean => {
  const tmpPath = `${filePath}.tmp`;
  try {
    const fd = fs.openSync(tmpPath, "w");
    try {
      fs.writeSync(fd, JSON.stringify(data, null, pretty ? 2 : undefined));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    // Only a version that still parses is worth keeping as the backup.
    if (backup && fs.existsSync(filePath)) {
      try {
        parseFile(filePath);
        fs.copyFileSync(filePath, `${filePath}.bak`);
      } catch {
        // Current file is damaged: keep the existing backup instead.
      }
    }

    replaceFile(tmpPath, filePath);
    return true;
  } catch (error) {
    console.error(`Failed to save ${filePath}:`, error);
    fs.rmSync(tmpPath, { force: true });
    return false;
  }
};

export const readJson = <T>(
  filePath: string,
  fallback: T,
  { label, notifyUser = true }: ReadOptions,
): T => {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return parseFile(filePath) as T;
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
  }

  let keptAs: string;
  try {
    keptAs = setAside(filePath);
  } catch (error) {
    console.error(`Failed to set aside ${filePath}:`, error);
    return fallback;
  }

  const backupPath = `${filePath}.bak`;
  if (fs.existsSync(backupPath)) {
    try {
      const restored = parseFile(backupPath) as T;
      writeJson(filePath, restored, { pretty: true, backup: false });
      if (notifyUser) {
        notify(
          "error",
          `Your ${label} file was damaged and has been restored from its backup. The damaged copy was kept as ${keptAs}.`,
        );
      }
      return restored;
    } catch (error) {
      console.error(`Failed to read backup ${backupPath}:`, error);
    }
  }

  if (notifyUser) {
    notify(
      "error",
      `Your ${label} file was damaged and no backup could be read, so it was reset. The damaged copy was kept as ${keptAs}.`,
    );
  }
  return fallback;
};
