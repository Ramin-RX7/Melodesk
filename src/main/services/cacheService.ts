import { app } from "electron";
import fs from "fs";
import path from "path";
import { FileItem } from "../../renderer/types";
import { hashPath } from "./hashUtil";


const CACHE_PATH = path.join(app.getPath("userData"), "library_cache.json");

// On disk the cache is an object keyed by each song's hash, the value being the
// song's FileItem (which also carries its own `hash`). This lets other features
// (e.g. the play tracker) reference songs by a stable key.
export type CacheMap = Record<string, FileItem>;

export const getCache = (): CacheMap => {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const data = fs.readFileSync(CACHE_PATH, "utf-8");
      const parsed = JSON.parse(data);

      // Legacy format migration: older caches were stored as a flat array.
      if (Array.isArray(parsed)) {
        const map: CacheMap = {};
        for (const item of parsed as FileItem[]) {
          const hash = item.hash ?? hashPath(item.path);
          map[hash] = { ...item, hash };
        }
        console.log(`Migrated ${parsed.length} legacy cache items to hashed map.`);
        return map;
      }

      const map = parsed as CacheMap;
      console.log(`Loaded ${Object.keys(map).length} items from cache.`);
      return map;
    }
  } catch (error) {
    console.error("Failed to read cache:", error);
  }
  console.log("No cache found or failed to read.");
  return {};
};

// Flat list view of the cache, with each item guaranteed to carry its hash.
export const getCacheList = (): FileItem[] => {
  return Object.values(getCache());
};

// Accepts the freshly scanned list, assigns each item its hash (mutating in
// place so callers can broadcast the hashed items), and writes the hash->item map.
export const saveCache = (items: FileItem[]) => {
  try {
    const map: CacheMap = {};
    for (const item of items) {
      const hash = hashPath(item.path);
      item.hash = hash;
      map[hash] = item;
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(map)); // No formatting to keep it smaller
    console.log(`Saved ${items.length} items to cache.`);
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
};
