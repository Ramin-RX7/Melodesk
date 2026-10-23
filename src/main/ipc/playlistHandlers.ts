import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { setAside, writeJson } from "../services/jsonStore";
import { notify } from "../services/notifyService";

const PLAYLISTS_DIR = path.join(app.getPath("userData"), "playlists");

interface Playlist {
  id: string;
  name: string;
  description?: string;
  songs: string[];
  sortBy?: "custom" | "title" | "artist" | "duration";
  sortDescending?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STRING_LITERAL = String.raw`"(?:[^"\\]|\\.)*"`;

// Value of `"key": "..."` in possibly broken JSON text.
const salvageString = (text: string, key: string): string | undefined => {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*(${STRING_LITERAL})`));
  try {
    return match ? JSON.parse(match[1]) : undefined;
  } catch {
    return undefined;
  }
};

// Every complete string in `"key": [ ... ]`, stopping at the end of the array or where the
// text is cut off.
const salvageStringArray = (text: string, key: string): string[] => {
  const start = text.search(new RegExp(`"${key}"\\s*:\\s*\\[`));
  if (start < 0) return [];
  const body = text.slice(text.indexOf("[", start) + 1);
  const token = new RegExp(String.raw`\s*,?\s*(${STRING_LITERAL})`, "y");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    try {
      values.push(JSON.parse(match[1]));
    } catch {
      break;
    }
  }
  return values;
};

// Fills in fields a hand-edited or older file may lack; null if it isn't a playlist at all.
const normalizePlaylist = (data: any, id: string): Playlist | null => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const now = new Date().toISOString();
  return {
    ...data,
    id,
    name: typeof data.name === "string" && data.name ? data.name : "Untitled playlist",
    songs: Array.isArray(data.songs)
      ? data.songs.filter((s: unknown) => typeof s === "string")
      : [],
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  };
};

// Last good version of a playlist (written by writeJson), or null.
const readBackup = (filePath: string, id: string): Playlist | null => {
  try {
    return normalizePlaylist(JSON.parse(fs.readFileSync(`${filePath}.bak`, "utf-8")), id);
  } catch {
    return null;
  }
};

// Reads one playlist file. A damaged file is set aside as .corrupt (it no longer ends in .json,
// so it isn't loaded again) and the playlist is restored from its .bak backup; without a usable
// backup, the name, description and every complete song path are salvaged from the damaged
// text. Either way the result is saved and the user is told what happened.
const loadPlaylistFile = (fileName: string): Playlist | null => {
  const filePath = path.join(PLAYLISTS_DIR, fileName);
  const id = path.basename(fileName, ".json");
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to read playlist ${fileName}:`, error);
    return null;
  }

  try {
    const playlist = normalizePlaylist(JSON.parse(text), id);
    if (playlist) return playlist;
  } catch {
    // Not valid JSON: fall through to recovery.
  }

  try {
    const backup = setAside(filePath);

    const fromBackup = readBackup(filePath, id);
    if (fromBackup) {
      savePlaylist(fromBackup);
      notify(
        "error",
        `The playlist "${fromBackup.name}" was damaged and has been restored from its backup. The damaged copy was kept as ${backup}.`,
      );
      return fromBackup;
    }

    const name = salvageString(text, "name");
    const songs = salvageStringArray(text, "songs");
    if (!name && songs.length === 0) {
      notify(
        "error",
        `A playlist file (${fileName}) was damaged and nothing could be recovered from it. It was kept as ${backup}.`,
      );
      return null;
    }

    const recovered = normalizePlaylist(
      { name, description: salvageString(text, "description"), songs },
      id,
    )!;
    recovered.updatedAt = new Date().toISOString();
    savePlaylist(recovered);
    notify(
      "error",
      `The playlist "${recovered.name}" was damaged. Recovered ${songs.length} song${songs.length === 1 ? "" : "s"}; the original file was kept as ${backup}.`,
    );
    return recovered;
  } catch (error) {
    console.error(`Failed to recover playlist ${fileName}:`, error);
    return null;
  }
};

export const getAllPlaylists = (): Playlist[] => {
  let files: string[];
  try {
    files = fs.readdirSync(PLAYLISTS_DIR).filter((f) => f.endsWith(".json"));
  } catch (error) {
    console.error("Failed to read playlists:", error);
    return [];
  }
  return files
    .map(loadPlaylistFile)
    .filter((p): p is Playlist => p !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

const savePlaylist = (playlist: Playlist) => {
  writeJson(path.join(PLAYLISTS_DIR, `${playlist.id}.json`), playlist, { pretty: true });
};

export function setupPlaylistHandlers() {
  if (!fs.existsSync(PLAYLISTS_DIR)) {
    fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
  }
  ipcMain.handle("get-playlists", () => {
    return getAllPlaylists();
  });

  ipcMain.handle("get-playlist", (_event, id: string) => {
    if (!fs.existsSync(path.join(PLAYLISTS_DIR, `${id}.json`))) return null;
    return loadPlaylistFile(`${id}.json`);
  });

  ipcMain.handle("create-playlist", (_event, name: string) => {
    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name,
      songs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    savePlaylist(playlist);
    return playlist;
  });

  ipcMain.handle(
    "update-playlist",
    (
      _event,
      id: string,
      data: Partial<Pick<Playlist, "name" | "songs" | "description" | "sortBy" | "sortDescending">>,
    ) => {
      const filePath = path.join(PLAYLISTS_DIR, `${id}.json`);
      try {
        if (!fs.existsSync(filePath)) return null;
        const existing = loadPlaylistFile(`${id}.json`);
        if (!existing) return null;
        const updated: Playlist = {
          ...existing,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        savePlaylist(updated);
        return updated;
      } catch (error) {
        console.error("Failed to update playlist:", error);
        return null;
      }
    },
  );

  ipcMain.handle("delete-playlist", (_event, id: string) => {
    const filePath = path.join(PLAYLISTS_DIR, `${id}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      fs.rmSync(`${filePath}.bak`, { force: true });
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    }
  });
}
