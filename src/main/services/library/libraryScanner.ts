import fs from "fs";
import path from "path";

import { FileItem } from "../../../renderer/types";
import { extractMetadata, saveArt } from "../metadataService";
import { isMediaFile } from "./mediaUtils";

let musicMetadataModule: any = null;

export const getDirectoryTree = async (dirPath: string): Promise<FileItem[]> => {
  try {
    if (!musicMetadataModule) {
      // Use eval to prevent tsc from transpiling import() to require()
      musicMetadataModule = await eval('import("music-metadata")');
    }

    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    const items: FileItem[] = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dirPath, file.name);
        const isDirectory = file.isDirectory();
        const isMedia = !isDirectory && isMediaFile(file.name);

        const item: FileItem = {
          name: file.name,
          path: fullPath,
          isDirectory,
          isMedia,
        };

        if (isDirectory) {
          item.children = await getDirectoryTree(fullPath);
        } else if (isMedia) {
          try {
            const metadata = await musicMetadataModule.parseFile(fullPath);
            let artPath = undefined;
            if (metadata.common.picture && metadata.common.picture.length > 0) {
              const pic = metadata.common.picture[0];
              artPath = saveArt(Buffer.from(pic.data), pic.format, fullPath);
            }

            item.metadata = extractMetadata(metadata, fullPath, artPath);
          } catch (err) {
            console.error(`Failed to parse metadata for ${fullPath}:`, err);
          }
        }

        return item;
      }),
    );

    // Sort: Directories first, then files alphabetically
    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
};

export const getAllMediaFiles = async (dirPath: string): Promise<FileItem[]> => {
  let results: FileItem[] = [];
  try {
    if (!musicMetadataModule) {
      musicMetadataModule = await eval('import("music-metadata")');
    }

    if (!fs.existsSync(dirPath)) return [];
    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        const subFiles = await getAllMediaFiles(fullPath);
        results = results.concat(subFiles);
      } else if (isMediaFile(file.name)) {
        try {
          const metadata = await musicMetadataModule.parseFile(fullPath);
          let artPath = undefined;
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            artPath = saveArt(Buffer.from(pic.data), pic.format, fullPath);
          }

          results.push({
            name: file.name,
            path: fullPath,
            isDirectory: false,
            isMedia: true,
            metadata: extractMetadata(metadata, fullPath, artPath),
          });
        } catch (err) {
          console.error(`Failed to parse metadata for ${fullPath}:`, err);
          results.push({
            name: file.name,
            path: fullPath,
            isDirectory: false,
            isMedia: true,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error crawling directory ${dirPath}:`, error);
  }
  return results;
};
