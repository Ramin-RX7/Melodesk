import { BrowserWindow } from "electron";
import fs from "fs";

import { getConfig } from "../configService";
import { FileItem } from "../../../renderer/types";
import { saveCache } from "../cacheService";
import { getAllMediaFiles } from "../library/libraryScanner";

export const updateLibrary = async () => {
  console.log("Starting library update...");
  const config = getConfig();
  let allFiles: FileItem[] = [];
  for (const dirPath of config.libraryPaths) {
    if (fs.existsSync(dirPath)) {
      const files = await getAllMediaFiles(dirPath);
      allFiles = allFiles.concat(files);
    }
  }
  saveCache(allFiles);
  console.log(`Library update complete. Found ${allFiles.length} files.`);
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("library-updated", allFiles);
  });
};
