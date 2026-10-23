import { ipcMain } from "electron";
import path from "path";

import { isMediaFile } from "../services/library/mediaUtils";
import { extractMetadata, saveArt } from "../services/metadataService";
import { getCache } from "../services/cacheService";
import { hashPath } from "../services/hashUtil";

// A library song keeps its id after being moved, so it's taken from the cache when known.
const songId = (filePath: string) => getCache()[hashPath(filePath)]?.hash ?? hashPath(filePath);

export function registerMetadataHandlers() {
  let musicMetadataModule: any = null;

  ipcMain.handle("get-metadata", async (_event, filePath: string) => {
    if (!musicMetadataModule) {
      musicMetadataModule = await eval('import("music-metadata")');
    }

    const isMedia = isMediaFile(filePath);
    if (!isMedia) return null;

    try {
      const metadata = await musicMetadataModule.parseFile(filePath);
      let artPath = undefined;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        artPath = saveArt(Buffer.from(pic.data), pic.format);
      }

      return {
        name: path.basename(filePath),
        path: filePath,
        isDirectory: false,
        isMedia: true,
        hash: songId(filePath),
        metadata: extractMetadata(metadata, filePath, artPath),
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

  let nodeId3Module: any = null;

  ipcMain.handle("write-metadata", async (_event, filePath: string, tags: any) => {
    try {
      if (!nodeId3Module) {
        nodeId3Module = await eval('import("node-id3")');
      }
      const success = nodeId3Module.default.update(tags, filePath);
      return success === true;
    } catch (error) {
      console.error("Failed to write metadata (node-id3 might not be installed):", error);
      return false;
    }
  });
}
