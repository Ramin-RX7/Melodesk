import { app } from "electron";
import path from "path";
import { FileItem } from "../../renderer/types";
import { hashPath } from "./hashUtil";
import { readJson, writeJson } from "./jsonStore";

const CACHE_PATH = path.join(app.getPath("userData"), "library_cache.json");

// On disk the cache is an object keyed by each song's hash, the value being the
// song's FileItem (which also carries its own `hash`). This lets other features
// (e.g. the play tracker) reference songs by a stable key.
export type CacheMap = Record<string, FileItem>;

export const getCache = (): CacheMap => {
  // The cache is rebuilt by the next scan, so a damaged one is replaced without bothering the user.
  const parsed = readJson<CacheMap | FileItem[] | null>(CACHE_PATH, null, {
    label: "library cache",
    notifyUser: false,
  });
  if (!parsed) {
    console.log("No cache found or failed to read.");
    return {};
  }

  // Legacy format migration: older caches were stored as a flat array.
  if (Array.isArray(parsed)) {
    const map: CacheMap = {};
    for (const item of parsed) {
      const hash = item.hash ?? hashPath(item.path);
      map[hash] = { ...item, hash };
    }
    console.log(`Migrated ${parsed.length} legacy cache items to hashed map.`);
    return map;
  }

  console.log(`Loaded ${Object.keys(parsed).length} items from cache.`);
  return parsed;
};

// Flat list view of the cache, with each item guaranteed to carry its hash.
export const getCacheList = (): FileItem[] => {
  return Object.values(getCache());
};

// Accepts the freshly scanned list, assigns each item its hash (mutating in
// place so callers can broadcast the hashed items), and writes the hash->item map.
export const saveCache = (items: FileItem[]) => {
  const map: CacheMap = {};
  for (const item of items) {
    const hash = hashPath(item.path);
    item.hash = hash;
    map[hash] = item;
  }
  // Unformatted to keep it small; no .bak because a lost cache is simply rebuilt by a scan.
  if (writeJson(CACHE_PATH, map, { backup: false })) {
    console.log(`Saved ${items.length} items to cache.`);
  }
};
