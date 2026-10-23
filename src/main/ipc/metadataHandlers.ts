import { ipcMain } from "electron";
import path from "path";

import { TagEdits } from "../../renderer/types";

import { isMediaFile } from "../services/library/mediaUtils";
import { importEsm } from "../services/esmImport";
import { readSongMetadata } from "../services/metadataService";
import { getCache } from "../services/cacheService";
import { hashPath } from "../services/hashUtil";

// A library song keeps its id after being moved, so it's taken from the cache when known.
const songId = (filePath: string) => getCache()[hashPath(filePath)]?.hash ?? hashPath(filePath);

export function registerMetadataHandlers() {
  ipcMain.handle("get-metadata", async (_event, filePath: string) => {
    const isMedia = isMediaFile(filePath);
    if (!isMedia) return null;

    try {
      const metadata = await readSongMetadata(filePath);

      return {
        name: path.basename(filePath),
        path: filePath,
        isDirectory: false,
        isMedia: true,
        hash: songId(filePath),
        metadata,
      };
    } catch (err) {
      console.error(`Failed to parse metadata for ${filePath}:`, err);
      return {
        name: path.basename(filePath),
        path: filePath,
        isDirectory: false,
        isMedia: true,
        hash: songId(filePath),
      };
    }
  });

  // node-id3 is ESM-only (importEsm); this is the part used here.
  let nodeId3Module: {
    default: { update: (tags: TagEdits, file: string) => true | Error };
  } | null = null;

  // Tags are only written to MP3 files of the library (node-id3 only handles ID3 tags).
  ipcMain.handle("write-metadata", async (_event, filePath: string, tags: TagEdits) => {
    if (
      typeof filePath !== "string" ||
      path.extname(filePath).toLowerCase() !== ".mp3" ||
      !getCache()[hashPath(filePath)]
    ) {
      console.error(
        `Refused to write tags to a file that isn't an MP3 in the library: ${filePath}`,
      );
      return false;
    }
    try {
      nodeId3Module ??= await importEsm("node-id3");
      const success = nodeId3Module!.default.update(tags, filePath);
      return success === true;
    } catch (error) {
      console.error("Failed to write metadata (node-id3 might not be installed):", error);
      return false;
    }
  });
}
