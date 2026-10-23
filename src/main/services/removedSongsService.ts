import { app } from "electron";
import path from "path";

import { FileItem } from "../../renderer/types";
import { readJson, writeJson } from "./jsonStore";

// Songs that left the library, kept (forever) so that a song whose file comes back later, e.g.
// moved out of the library and back in, gets its id and with it its play history back. Only
// what's needed to recognise the file is stored.
const REMOVED_PATH = path.join(app.getPath("userData"), "removed_songs.json");

export type RemovedSong = {
  id: string;
  path: string;
  size: number;
  duration?: number;
  title?: string;
  artists?: string[];
  album?: string;
  removedAt: number;
};

type RemovedSongs = Record<string, RemovedSong>;

let memory: RemovedSongs | null = null;

export const getRemovedSongs = (): RemovedSongs => {
  memory ??= readJson<RemovedSongs>(REMOVED_PATH, {}, { label: "removed songs" });
  return memory;
};

// Updates the store: adds `removed` songs and drops the ids in `returned`.
export const updateRemovedSongs = (removed: FileItem[], returned: string[]) => {
  const songs = getRemovedSongs();
  let changed = false;
  const now = Date.now();
  for (const item of removed) {
    const meta = item.metadata;
    if (!item.hash || meta?.fileSize === undefined) continue;
    songs[item.hash] = {
      id: item.hash,
      path: item.path,
      size: meta.fileSize,
      duration: meta.duration,
      title: meta.title,
      artists: meta.artists,
      album: meta.album,
      removedAt: now,
    };
    changed = true;
  }
  for (const id of returned) {
    if (songs[id]) {
      delete songs[id];
      changed = true;
    }
  }
  if (changed) writeJson(REMOVED_PATH, songs);
};
