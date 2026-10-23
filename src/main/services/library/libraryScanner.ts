import fs from "fs";
import path from "path";

import { FileItem, LibraryScanStatus } from "../../../renderer/types";
import { CacheMap, getCache } from "../cacheService";
import { hashPath } from "../hashUtil";
import { readSongMetadata } from "../metadataService";
import { isMediaFile } from "./mediaUtils";

const PROGRESS_INTERVAL_MS = 150;

export type ScanProgress = Omit<LibraryScanStatus, "scanning">;

type ScanOptions = {
  signal: AbortSignal;
  /**
   * Known files; entries whose mtime and size are unchanged are reused without re-parsing.
   * Newly parsed files are added to it, so a cancelled scan's work is reused by the next one.
   */
  previous: CacheMap;
  onProgress: (progress: ScanProgress) => void;
};

const throttle = (fn: (progress: ScanProgress) => void) => {
  let last = 0;
  return (progress: ScanProgress, force = false) => {
    const now = Date.now();
    if (force || now - last >= PROGRESS_INTERVAL_MS) {
      last = now;
      fn(progress);
    }
  };
};

const sortTree = (items: FileItem[]) =>
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

// Lists a folder for the Library tab's tree view. Song details come from the library cache
// instead of re-reading tags, so even large folders open instantly; files the cache doesn't
// know yet (e.g. a scan is still running) are shown by file name only.
export const getDirectoryTree = async (dirPath: string): Promise<FileItem[]> => {
  return buildTree(dirPath, getCache());
};

const buildTree = async (dirPath: string, cache: CacheMap): Promise<FileItem[]> => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const items: FileItem[] = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const isDirectory = entry.isDirectory();
        const isMedia = !isDirectory && isMediaFile(entry.name);
        const item: FileItem = { name: entry.name, path: fullPath, isDirectory, isMedia };

        if (isDirectory) {
          item.children = await buildTree(fullPath, cache);
        } else if (isMedia) {
          const hash = hashPath(fullPath);
          return cache[hash] ? { ...cache[hash], name: entry.name } : { ...item, hash };
        }
        return item;
      }),
    );
    return sortTree(items);
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
};

const discoverMediaFiles = async (
  dirs: string[],
  signal: AbortSignal,
  onFound: (count: number, dir: string) => void,
): Promise<string[]> => {
  const found: string[] = [];

  const walk = async (dir: string) => {
    signal.throwIfAborted();
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (error) {
      console.error(`Error crawling directory ${dir}:`, error);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (isMediaFile(entry.name)) found.push(fullPath);
    }
    onFound(found.length, dir);
  };

  for (const dir of dirs) await walk(dir);
  return found;
};

const readMediaFile = async (fullPath: string, stats: fs.Stats): Promise<FileItem> => {
  const item: FileItem = {
    name: path.basename(fullPath),
    path: fullPath,
    isDirectory: false,
    isMedia: true,
    mtime: stats.mtimeMs,
  };
  try {
    item.metadata = await readSongMetadata(fullPath);
  } catch (err) {
    console.error(`Failed to parse metadata for ${fullPath}:`, err);
  }
  return item;
};

const isUnchanged = (cached: FileItem | undefined, stats: fs.Stats): cached is FileItem =>
  !!cached &&
  cached.mtime === stats.mtimeMs &&
  (cached.metadata?.fileSize ?? stats.size) === stats.size;

// Scans the given library folders in two phases: list every media file (fast), then read the
// tags of new or changed files. Throws an AbortError as soon as `signal` is aborted.
export const scanLibrary = async (
  dirs: string[],
  { signal, previous, onProgress }: ScanOptions,
): Promise<FileItem[]> => {
  const report = throttle(onProgress);

  const files = await discoverMediaFiles(dirs, signal, (count, dir) =>
    report({ phase: "discovering", processed: 0, total: count, currentPath: dir }),
  );

  const results: FileItem[] = [];
  let reused = 0;
  for (let i = 0; i < files.length; i++) {
    signal.throwIfAborted();
    const fullPath = files[i];
    report({ phase: "reading", processed: i, total: files.length, currentPath: fullPath });

    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(fullPath);
    } catch (error) {
      console.error(`Failed to read ${fullPath}:`, error);
      continue;
    }

    const hash = hashPath(fullPath);
    const cached = previous[hash];
    if (isUnchanged(cached, stats)) {
      results.push(cached);
      reused++;
    } else {
      const item = await readMediaFile(fullPath, stats);
      previous[hash] = item;
      results.push(item);
    }
  }

  report({ phase: "reading", processed: files.length, total: files.length }, true);
  console.log(`Scanned ${files.length} files (${reused} unchanged, reused from cache).`);
  return results;
};
