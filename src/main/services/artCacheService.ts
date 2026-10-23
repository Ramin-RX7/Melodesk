import { app } from "electron";
import crypto from "crypto";
import fs from "fs";
import path from "path";

import { FileItem } from "../../renderer/types";

// Cover art and artist pictures live in art_cache/, named after a hash of the image itself: a
// changed cover gets a new file, and the songs of an album share one. Files nothing refers to
// any more are deleted after each library scan.
export const ART_CACHE_DIR = path.join(app.getPath("userData"), "art_cache");

// Newer files are kept even when unused: the art of a song played from outside the library, or
// an artist picture that was picked but not saved yet.
const MIN_UNUSED_AGE_MS = 24 * 60 * 60 * 1000;

// Older versions named covers after the song's path; this marker says they were converted.
const VERSION_FILE = path.join(ART_CACHE_DIR, ".version");
const VERSION = "2";

export const contentHash = (data: Buffer): string =>
  crypto.createHash("sha1").update(data).digest("hex");

const fileKey = (filePath: string) => path.basename(filePath).toLowerCase();

const isInArtCache = (filePath: string) =>
  path.resolve(path.dirname(filePath)).toLowerCase() === path.resolve(ART_CACHE_DIR).toLowerCase();

// Old-format covers converted by prepareArtCache, deleted by cleanArtCache once the cache that
// points at their replacements is saved.
let converted: Set<string> | null = null;

const isConverted = () => {
  try {
    return fs.readFileSync(VERSION_FILE, "utf-8").trim() === VERSION;
  } catch {
    return false;
  }
};

// Copies the covers of older versions to their content names and points the songs at them
// (duplicates of one image collapse into one file). Asynchronous: it reads every cover once.
const convertOldCovers = async (songs: FileItem[]) => {
  const renamed = new Map<string, string>();
  for (const song of songs) {
    const picture = song.metadata?.picture;
    if (!picture || !isInArtCache(picture)) continue;
    let target = renamed.get(picture);
    if (!target) {
      try {
        const named = path.join(
          ART_CACHE_DIR,
          `${contentHash(await fs.promises.readFile(picture))}${path.extname(picture)}`,
        );
        if (named !== picture && !fs.existsSync(named)) await fs.promises.copyFile(picture, named);
        target = named;
      } catch {
        continue; // Missing or unreadable: left for the next scan to replace.
      }
      renamed.set(picture, target);
    }
    song.metadata!.picture = target;
  }
  converted = new Set([...renamed].filter(([old, to]) => old !== to).map(([old]) => fileKey(old)));
  console.log(`Converted ${converted.size} cover files to content names.`);
};

// Files nothing uses are deleted once they are a day old; converted old-format covers at once.
const deleteUnused = (inUse: Set<string>) => {
  const now = Date.now();
  let removed = 0;
  for (const name of fs.readdirSync(ART_CACHE_DIR)) {
    const key = name.toLowerCase();
    if (name.startsWith(".") || inUse.has(key)) continue;
    const filePath = path.join(ART_CACHE_DIR, name);
    try {
      if (!converted?.has(key) && now - fs.statSync(filePath).mtimeMs < MIN_UNUSED_AGE_MS) continue;
      fs.unlinkSync(filePath);
      removed++;
    } catch (error) {
      console.error(`Failed to remove unused art ${filePath}:`, error);
    }
  }
  if (removed) console.log(`Removed ${removed} unused files from the art cache.`);
};

// After a successful scan, before the cache is saved: may point song covers at new files.
export const prepareArtCache = async (songs: FileItem[]) => {
  try {
    if (fs.existsSync(ART_CACHE_DIR) && !isConverted()) await convertOldCovers(songs);
  } catch (error) {
    console.error("Failed to convert the art cache:", error);
  }
};

// After the cache is saved: deletes art that no song or artist uses any more.
export const cleanArtCache = (songs: FileItem[], artistPictures: string[]) => {
  try {
    if (!fs.existsSync(ART_CACHE_DIR)) return;
    const inUse = new Set<string>();
    for (const song of songs) if (song.metadata?.picture) inUse.add(fileKey(song.metadata.picture));
    for (const picture of artistPictures) inUse.add(fileKey(picture));
    deleteUnused(inUse);
    if (converted) {
      fs.writeFileSync(VERSION_FILE, VERSION);
      converted = null;
    }
  } catch (error) {
    console.error("Failed to clean the art cache:", error);
  }
};

// Deletes an artist picture that was replaced, unless another artist still uses it.
export const removeArtistPicture = (picture: string, stillUsed: string[]) => {
  if (!isInArtCache(picture) || stillUsed.some((p) => fileKey(p) === fileKey(picture))) return;
  fs.rm(picture, { force: true }, (error) => {
    if (error) console.error(`Failed to remove old artist picture ${picture}:`, error);
  });
};
