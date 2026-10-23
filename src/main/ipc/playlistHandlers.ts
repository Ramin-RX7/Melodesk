import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { getCache } from "../services/cacheService";
import { hashPath } from "../services/hashUtil";
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

// Tells every window that playlists changed, so an open playlist page reloads.
const broadcastPlaylistsChanged = () => {
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send("playlists-changed"));
};

const savePlaylist = (playlist: Playlist) => {
  writeJson(path.join(PLAYLISTS_DIR, `${playlist.id}.json`), playlist, { pretty: true });
  broadcastPlaylistsChanged();
};

// Rewrites song paths in every playlist (songs that were moved or renamed); saves only the
// playlists that changed.
export const replaceSongPaths = (replace: (songPath: string) => string) => {
  let changed = false;
  for (const playlist of getAllPlaylists()) {
    const songs = playlist.songs.map(replace);
    if (songs.every((song, i) => song === playlist.songs[i])) continue;
    writeJson(
      path.join(PLAYLISTS_DIR, `${playlist.id}.json`),
      { ...playlist, songs },
      { pretty: true },
    );
    changed = true;
  }
  if (changed) broadcastPlaylistsChanged();
};

// Song titles for messages (from the library cache), falling back to the file name.
const songNames = (paths: string[]): string[] => {
  const cache = getCache();
  return paths.map((p) => cache[hashPath(p)]?.metadata?.title || path.basename(p));
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
      broadcastPlaylistsChanged();
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    }
  });

  // Adds songs to a playlist. Songs already in it (or picked twice) are duplicates: the user
  // chooses to add them anyway, skip them, or cancel. Resolves to the playlist (null if cancelled).
  ipcMain.handle("add-songs-to-playlist", async (event, id: string, paths: string[]) => {
    const playlist = fs.existsSync(path.join(PLAYLISTS_DIR, `${id}.json`))
      ? loadPlaylistFile(`${id}.json`)
      : null;
    if (!playlist || paths.length === 0) return playlist;

    const seen = new Set(playlist.songs);
    const unique: string[] = [];
    const duplicates: string[] = [];
    for (const p of paths) {
      if (seen.has(p)) duplicates.push(p);
      else {
        seen.add(p);
        unique.push(p);
      }
    }

    let toAdd = paths;
    if (duplicates.length > 0) {
      const names = songNames(duplicates);
      const listed = names.slice(0, 10).join("\n") + (names.length > 10 ? "\n…" : "");
      const options = {
        type: "question" as const,
        buttons: ["Add anyway", "Skip duplicates", "Cancel"],
        defaultId: 1,
        cancelId: 2,
        title: "Add to playlist",
        message:
          paths.length === 1
            ? `"${names[0]}" is already in "${playlist.name}".`
            : `${duplicates.length} of the ${paths.length} songs ${duplicates.length === 1 ? "is" : "are"} already in "${playlist.name}".`,
        detail: `${listed}\n\nAdd ${duplicates.length === 1 ? "it" : "them"} again anyway, or skip ${duplicates.length === 1 ? "it" : "them"}?`,
      };
      const win = BrowserWindow.fromWebContents(event.sender);
      const { response } = win
        ? await dialog.showMessageBox(win, options)
        : await dialog.showMessageBox(options);
      if (response === 2) return null;
      if (response === 1) toAdd = unique;
    }

    if (toAdd.length === 0) {
      notify("info", `Nothing was added to "${playlist.name}".`);
      return playlist;
    }
    const updated = {
      ...playlist,
      songs: [...playlist.songs, ...toAdd],
      updatedAt: new Date().toISOString(),
    };
    savePlaylist(updated);
    notify(
      "success",
      toAdd.length === 1
        ? `Added "${songNames(toAdd)[0]}" to "${playlist.name}".`
        : `Added ${toAdd.length} songs to "${playlist.name}".`,
    );
    return updated;
  });

  // Removes repeated songs from a playlist (keeping the first copy of each) after confirmation.
  ipcMain.handle("remove-playlist-duplicates", async (event, id: string) => {
    const playlist = fs.existsSync(path.join(PLAYLISTS_DIR, `${id}.json`))
      ? loadPlaylistFile(`${id}.json`)
      : null;
    if (!playlist) return null;

    const songs = [...new Set(playlist.songs)];
    const removed = playlist.songs.length - songs.length;
    if (removed === 0) {
      notify("info", `"${playlist.name}" has no duplicate songs.`);
      return playlist;
    }

    const options = {
      type: "question" as const,
      buttons: ["Remove duplicates", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      title: "Remove duplicates",
      message: `Remove ${removed} duplicate song${removed === 1 ? "" : "s"} from "${playlist.name}"?`,
      detail: "The first copy of each song is kept.",
    };
    const win = BrowserWindow.fromWebContents(event.sender);
    const { response } = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options);
    if (response !== 0) return playlist;

    const updated = { ...playlist, songs, updatedAt: new Date().toISOString() };
    savePlaylist(updated);
    notify(
      "success",
      `Removed ${removed} duplicate song${removed === 1 ? "" : "s"} from "${playlist.name}".`,
    );
    return updated;
  });
}
