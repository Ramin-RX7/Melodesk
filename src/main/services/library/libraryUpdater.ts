import { BrowserWindow } from "electron";
import fs from "fs";

import { getAllArtistPictures } from "../../ipc/artistHandlers";
import { cleanArtCache, prepareArtCache } from "../artCacheService";
import { getConfig } from "../configService";
import { LibraryScanStatus } from "../../../renderer/types";
import { CacheMap, getCache, saveCache } from "../cacheService";
import { scanLibrary } from "../library/libraryScanner";
import { notify } from "../notifyService";
import { isSameOrInside, outermostFolders } from "./libraryPaths";
import { applyMoves, detectMoves, LibraryChanges } from "./songMoves";

// Only one library update runs at a time: starting a new one aborts the previous run, which
// then exits without touching the cache.
let current: AbortController | null = null;
let status: LibraryScanStatus = { scanning: false, processed: 0, total: 0 };
// The cache plus every file parsed since it was last saved. Kept across cancelled runs so the
// next run doesn't parse those files again; dropped once a run saves the cache.
let known: CacheMap | null = null;

const setStatus = (next: LibraryScanStatus) => {
  status = next;
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("library-scan-status", status);
  });
};

export const getScanStatus = (): LibraryScanStatus => status;

export const isScanning = (): boolean => current !== null;

// Library folders that couldn't be reached (unplugged drive, moved or renamed folder); the user
// is told once when one goes missing and once when it's back.
const missingFolders = new Set<string>();

const reportFolderAvailability = (folders: string[], missing: string[]) => {
  for (const folder of missing) {
    if (missingFolders.has(folder)) continue;
    missingFolders.add(folder);
    notify(
      "error",
      `The library folder "${folder}" can't be found (an unplugged drive, or a moved or renamed folder?). Its songs are hidden until it's back.`,
    );
  }
  for (const folder of [...missingFolders]) {
    if (missing.includes(folder)) continue;
    missingFolders.delete(folder);
    if (folders.includes(folder)) notify("success", `The library folder "${folder}" is back.`);
  }
};

const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

// One message per scan saying what really changed (nothing when nothing did). Songs of a missing
// folder aren't listed as removed: that folder has its own message.
export const describeChanges = (changes: LibraryChanges, missing: string[]): string | null => {
  const removed = changes.removed.filter(
    (song) => !missing.some((folder) => isSameOrInside(song.path, folder)),
  ).length;
  const parts = [
    changes.added.length && `${count(changes.added.length, "new song")}`,
    changes.moves.length &&
      `${count(changes.moves.length, "song")} moved or renamed (play counts and playlists kept)`,
    changes.updated && `${count(changes.updated, "song")} updated`,
    removed && `${count(removed, "song")} removed`,
  ].filter(Boolean);
  return parts.length ? `Library updated: ${parts.join(", ")}.` : null;
};

export const updateLibrary = async () => {
  if (current) {
    console.log("Cancelling previous library update...");
    current.abort();
  }
  const controller = new AbortController();
  current = controller;

  console.log("Starting library update...");
  const startedAt = Date.now();
  setStatus({ scanning: true, phase: "discovering", processed: 0, total: 0 });

  try {
    const folders = outermostFolders(getConfig().libraryPaths);
    const dirs = folders.filter((dirPath) => fs.existsSync(dirPath));
    const missing = folders.filter((dirPath) => !dirs.includes(dirPath));
    const allFiles = await scanLibrary(dirs, {
      signal: controller.signal,
      previous: (known ??= { ...getCache() }),
      onProgress: (progress) => {
        if (current === controller) setStatus({ scanning: true, ...progress });
      },
    });
    if (controller.signal.aborted) return;

    await prepareArtCache(allFiles);
    if (controller.signal.aborted) return;
    // From here on nothing awaits, so a newer run can't interleave with saving.
    const changes = detectMoves(getCache(), allFiles);
    saveCache(allFiles);
    cleanArtCache(allFiles, Object.values(getAllArtistPictures()));
    known = null;
    console.log(
      `Library update complete. Found ${allFiles.length} files in ${Date.now() - startedAt} ms.`,
    );
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("library-updated", allFiles);
    });
    applyMoves(changes.moves);
    reportFolderAvailability(folders, missing);
    const summary = describeChanges(changes, missing);
    if (summary) notify("info", summary);
  } catch (error) {
    if (controller.signal.aborted) {
      console.log("Library update cancelled.");
      return;
    }
    console.error("Library update failed:", error);
  } finally {
    if (current === controller) {
      current = null;
      setStatus({ scanning: false, processed: 0, total: 0 });
    }
  }
};
