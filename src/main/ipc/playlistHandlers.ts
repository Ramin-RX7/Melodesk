import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

export const getAllPlaylists = (): Playlist[] => {
  try {
    const files = fs.readdirSync(PLAYLISTS_DIR).filter((f) => f.endsWith(".json"));
    return files
      .map((f) => {
        const data = fs.readFileSync(path.join(PLAYLISTS_DIR, f), "utf-8");
        return JSON.parse(data) as Playlist;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error("Failed to read playlists:", error);
    return [];
  }
};

const savePlaylist = (playlist: Playlist) => {
  const filePath = path.join(PLAYLISTS_DIR, `${playlist.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(playlist, null, 2));
};

export function setupPlaylistHandlers() {
  if (!fs.existsSync(PLAYLISTS_DIR)) {
    fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
  }
  ipcMain.handle("get-playlists", () => {
    return getAllPlaylists();
  });

  ipcMain.handle("get-playlist", (_event, id: string) => {
    const filePath = path.join(PLAYLISTS_DIR, `${id}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(data) as Playlist;
      }
    } catch (error) {
      console.error("Failed to read playlist:", error);
    }
    return null;
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
        const existing = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Playlist;
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
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    }
  });
}
