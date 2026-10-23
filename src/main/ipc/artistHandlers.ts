import { app, ipcMain, dialog } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ARTISTS_DIR = path.join(app.getPath("userData"), "artists");
const ART_CACHE_DIR = path.join(app.getPath("userData"), "art_cache");

interface ArtistInfo {
  name: string;
  bio?: string;
  picture?: string;
}

export function setupArtistHandlers() {
  if (!fs.existsSync(ARTISTS_DIR)) fs.mkdirSync(ARTISTS_DIR);
  if (!fs.existsSync(ART_CACHE_DIR)) fs.mkdirSync(ART_CACHE_DIR);

  ipcMain.handle("get-artist-info", async (_event, name: string) => {
    const safeName = crypto.createHash("md5").update(name).digest("hex");
    const filePath = path.join(ARTISTS_DIR, `${safeName}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(data);
      } catch (err) {
        console.error("Failed to read artist info:", err);
      }
    }
    return { name };
  });

  ipcMain.handle("update-artist-info", async (_event, name: string, data: Partial<ArtistInfo>) => {
    const safeName = crypto.createHash("md5").update(name).digest("hex");
    const filePath = path.join(ARTISTS_DIR, `${safeName}.json`);

    let currentInfo: ArtistInfo = { name };
    if (fs.existsSync(filePath)) {
      try {
        currentInfo = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (err) {}
    }

    const updatedInfo = { ...currentInfo, ...data, name }; // Ensure name isn't overwritten
    fs.writeFileSync(filePath, JSON.stringify(updatedInfo, null, 2));
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
