import { app, ipcMain, dialog } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { readJson, writeJson } from "../services/jsonStore";

const ARTISTS_DIR = path.join(app.getPath("userData"), "artists");
const ART_CACHE_DIR = path.join(app.getPath("userData"), "art_cache");

interface ArtistInfo {
  name: string;
  bio?: string;
  picture?: string;
}

const artistPath = (name: string) =>
  path.join(ARTISTS_DIR, `${crypto.createHash("md5").update(name).digest("hex")}.json`);

const readArtist = (name: string): ArtistInfo =>
  readJson<ArtistInfo>(artistPath(name), { name }, { label: `artist info for "${name}"` });

export function setupArtistHandlers() {
  if (!fs.existsSync(ARTISTS_DIR)) fs.mkdirSync(ARTISTS_DIR);
  if (!fs.existsSync(ART_CACHE_DIR)) fs.mkdirSync(ART_CACHE_DIR);

  ipcMain.handle("get-artist-info", async (_event, name: string) => {
    return readArtist(name);
  });

  // Pictures of every artist that has one, by artist name: one call for a whole grid of cards.
  ipcMain.handle("get-artist-pictures", async () => {
    const pictures: Record<string, string> = {};
    for (const file of fs.readdirSync(ARTISTS_DIR).filter((f) => f.endsWith(".json"))) {
      const info = readJson<ArtistInfo | null>(path.join(ARTISTS_DIR, file), null, {
        label: "artist info",
      });
      if (info?.name && info.picture) pictures[info.name] = info.picture;
    }
    return pictures;
  });

  ipcMain.handle("update-artist-info", async (_event, name: string, data: Partial<ArtistInfo>) => {
    const updatedInfo = { ...readArtist(name), ...data, name }; // Ensure name isn't overwritten
    writeJson(artistPath(name), updatedInfo, { pretty: true });
    return updatedInfo;
  });

  ipcMain.handle("select-artist-image", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });

    if (canceled || filePaths.length === 0) return null;

    const sourcePath = filePaths[0];
    const ext = path.extname(sourcePath);
    const hash = crypto
      .createHash("md5")
      .update(sourcePath + Date.now().toString())
      .digest("hex");
    const destName = `artist_${hash}${ext}`;
    const destPath = path.join(ART_CACHE_DIR, destName);

    fs.copyFileSync(sourcePath, destPath);
    return destPath;
  });
}
