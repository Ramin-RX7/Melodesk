import { BrowserWindow } from "electron";
import fs from "fs";

import { getConfig } from "../configService";
import { LibraryScanStatus } from "../../../renderer/types";
import { CacheMap, getCache, saveCache } from "../cacheService";
import { scanLibrary } from "../library/libraryScanner";
import { outermostFolders } from "./libraryPaths";

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
    const dirs = outermostFolders(getConfig().libraryPaths).filter((dirPath) =>
      fs.existsSync(dirPath),
    );
    const allFiles = await scanLibrary(dirs, {
      signal: controller.signal,
      previous: (known ??= getCache()),
      onProgress: (progress) => {
        if (current === controller) setStatus({ scanning: true, ...progress });
      },
    });
    if (controller.signal.aborted) return;

    saveCache(allFiles);
    known = null;
    console.log(
      `Library update complete. Found ${allFiles.length} files in ${Date.now() - startedAt} ms.`,
    );
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("library-updated", allFiles);
    });
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
