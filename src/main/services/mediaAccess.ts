import { ipcMain } from "electron";
import fs from "fs";
import path from "path";

import { ART_CACHE_DIR } from "./artCacheService";
import { getConfig } from "./configService";
import { isSameOrInside, isSamePath } from "./library/libraryPaths";
import { isMediaFile } from "./library/mediaUtils";
import { getSession } from "./sessionService";

// Which files media:// may serve: the library folders, the art cache, and audio files the user
// dropped onto the window (or that are in the restored queue). Anything else is refused, so even
// a compromised page can't read arbitrary files through it.

const allowed: string[] = [];

const allowFile = (filePath: string) => {
  if (!isMediaFile(filePath) || allowed.some((p) => isSamePath(p, filePath))) return;
  allowed.push(path.resolve(filePath));
};

// Sent by the preload when a real file is dropped (webUtils.getPathForFile only returns paths
// for files the user actually dropped).
ipcMain.on("allow-dropped-file", (_event, filePath: string) => {
  if (typeof filePath === "string" && fs.existsSync(filePath)) allowFile(filePath);
});

// Songs from outside the library can be in the queue saved last time (dropped files).
export const allowSessionFiles = () => {
  const session = getSession();
  for (const songPath of [...(session?.queue ?? []), ...(session?.shuffledQueue ?? [])]) {
    allowFile(songPath);
  }
};

export const canServe = (filePath: string): boolean => {
  const resolved = path.resolve(filePath);
  return (
    getConfig().libraryPaths.some((folder) => isSameOrInside(resolved, folder)) ||
    isSameOrInside(resolved, ART_CACHE_DIR) ||
    allowed.some((p) => isSamePath(p, resolved))
  );
};
