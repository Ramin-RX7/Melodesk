import { ipcMain, dialog } from "electron";

import { getCacheList } from "../services/cacheService";
import { getConfig } from "../services/configService";
import { getDirectoryTree } from "../services/library/libraryScanner";
import { updateLibrary } from "../services/library/libraryUpdater";

export function registerLibraryHandlers() {
  ipcMain.handle("get-library-files", async () => {
    const cachedFiles = getCacheList();

    // Always check if cache is consistent with library paths on startup/request
    const config = getConfig();
    const allExisting = cachedFiles.filter((f) => {
      return config.libraryPaths.some((lp) => f.path.startsWith(lp));
    });

    if (allExisting.length !== cachedFiles.length) {
      console.log("Cache contains stale paths, updating...");
      updateLibrary();
    } else if (cachedFiles.length === 0) {
      updateLibrary();
    }

    return allExisting;
  });

  ipcMain.handle("get-directory-tree", async (_event, dirPath: string) => {
    return getDirectoryTree(dirPath);
  });

  ipcMain.handle("select-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("refresh-library", async () => {
    await updateLibrary();
  });
}
