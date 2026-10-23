import { app } from "electron";
import fs from "fs";
import path from "path";

import { SessionData, WindowBounds } from "../../renderer/types";
import { readJson, writeJson } from "./jsonStore";

const SESSION_PATH = path.join(app.getPath("userData"), "session.json");

export const getSession = (): SessionData | null => {
  return readJson<SessionData | null>(SESSION_PATH, null, { label: "last session" });
};

const writeSession = (data: Partial<SessionData>): void => {
  writeJson(SESSION_PATH, data, { pretty: true });
};

export const saveSession = (data: Partial<SessionData>): void => {
  // Merge so playback state and window bounds (written separately) don't clobber each other.
  const existing = getSession();
  writeSession({ ...existing, ...data });
};

// Rewrites song paths in the saved queue (songs that were moved or renamed).
export const replaceSessionPaths = (replace: (songPath: string) => string): void => {
  const existing = getSession();
  if (!existing?.queue) return;
  writeSession({
    ...existing,
    queue: existing.queue.map(replace),
    shuffledQueue: (existing.shuffledQueue ?? []).map(replace),
    currentTrackPath: existing.currentTrackPath && replace(existing.currentTrackPath),
  });
};

export const clearSession = (): void => {
  // Only clear playback state; window bounds and picker folders persist independently of the
  // restore-session setting.
  const existing = getSession();
  if (
    existing?.windowBounds ||
    existing?.miniWindowBounds ||
    existing?.lastPickedFolder ||
    existing?.lastPickedImage
  ) {
    writeSession({
      windowBounds: existing.windowBounds,
      miniWindowBounds: existing.miniWindowBounds,
      lastPickedFolder: existing.lastPickedFolder,
      lastPickedImage: existing.lastPickedImage,
    });
  } else if (fs.existsSync(SESSION_PATH)) {
    try {
      fs.unlinkSync(SESSION_PATH);
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  }
};

export const getWindowBounds = (): WindowBounds | null => {
  return getSession()?.windowBounds ?? null;
};

export const saveWindowBounds = (bounds: WindowBounds): void => {
  saveSession({ windowBounds: bounds });
};

export const getMiniWindowBounds = (): WindowBounds | null => {
  return getSession()?.miniWindowBounds ?? null;
};

export const saveMiniWindowBounds = (bounds: WindowBounds): void => {
  saveSession({ miniWindowBounds: bounds });
};
