import { ipcMain, dialog, WebContents } from "electron";
import fs from "fs";
import path from "path";

import { getCacheList } from "../services/cacheService";
import { getConfig, saveConfig } from "../services/configService";
import { getSession, saveSession } from "../services/sessionService";
import { askUser } from "../services/confirmService";
import { notify } from "../services/notifyService";
import { isSameOrInside, isSamePath } from "../services/library/libraryPaths";
import { getDirectoryTree } from "../services/library/libraryScanner";
import { getScanStatus, isScanning, updateLibrary } from "../services/library/libraryUpdater";
import { setupWatcher } from "../services/library/libraryWatcher";

// Adds folders to the library. Library folders never overlap:
// - a folder that is (inside) a library folder is refused, with an explanation;
// - a folder that contains library folders replaces them if the user agrees (their songs stay
//   in the library through the new folder), otherwise it isn't added.
const addLibraryFolders = async (sender: WebContents, selected: string[]) => {
  let paths = [...getConfig().libraryPaths];
  let changed = false;

  // Parents first, so a parent and its child picked together resolve to the parent.
  for (const folder of [...selected].sort((a, b) => a.length - b.length)) {
    const owner = paths.find((p) => isSameOrInside(folder, p));
    if (owner) {
      if (isSamePath(folder, owner)) {
        notify("info", `"${folder}" is already in your library.`);
      } else {
        notify(
          "error",
          `"${folder}" wasn't added: it's inside "${owner}", which is already in your library, so its songs are already included.`,
        );
      }
      continue;
    }

    const inner = paths.filter((p) => isSameOrInside(p, folder));
    if (inner.length > 0) {
      const { response } = await askUser(sender, {
        buttons: ["Add and remove inner folders", "Cancel"],
        defaultId: 0,
        cancelId: 1,
        title: "Add library folder",
        message: `"${folder}" contains ${inner.length === 1 ? "a folder that is" : "folders that are"} already in your library:`,
        detail: `${inner.join("\n")}\n\nAdd "${folder}" and remove ${inner.length === 1 ? "that folder" : "those folders"} from the library list? Their songs stay in your library, since they're inside the new folder.`,
      });
      if (response !== 0) continue;
      paths = paths.filter((p) => !inner.includes(p));
    }

    paths.push(folder);
    changed = true;
  }

  if (!changed) return getConfig();
  const config = { ...getConfig(), libraryPaths: paths };
  saveConfig(config);
  await setupWatcher();
  updateLibrary();
  return config;
};

export function registerLibraryHandlers() {
  ipcMain.handle("get-library-files", async () => {
    const cachedFiles = getCacheList();

    // Always check if cache is consistent with library paths on startup/request
    const config = getConfig();
    const allExisting = cachedFiles.filter((f) => {
      return config.libraryPaths.some((lp) => isSameOrInside(f.path, lp));
    });

    // A running update (e.g. the one started at launch) already brings the cache up to date.
    if (!isScanning()) {
      if (allExisting.length !== cachedFiles.length) {
        console.log("Cache contains stale paths, updating...");
        updateLibrary();
      } else if (cachedFiles.length === 0 && config.libraryPaths.length > 0) {
        updateLibrary();
      }
    }

    return allExisting;
  });

  ipcMain.handle("file-exists", (_event, filePath: string) => {
    return fs.existsSync(filePath);
  });

  ipcMain.handle("get-library-scan-status", () => {
    return getScanStatus();
  });

  ipcMain.handle("get-directory-tree", async (_event, dirPath: string) => {
    return getDirectoryTree(dirPath);
  });

  // Opens in the parent of the folder picked last time (or of the newest library folder), so
  // sibling folders are one click away.
  ipcMain.handle("select-directories", async () => {
    const last = getSession()?.lastPickedFolder ?? getConfig().libraryPaths.slice(-1)[0];
    const parent = last && path.dirname(last);
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "multiSelections"],
      defaultPath: parent && fs.existsSync(parent) ? parent : undefined,
    });

    if (result.canceled) return [];
    if (result.filePaths.length > 0) saveSession({ lastPickedFolder: result.filePaths[0] });
    return result.filePaths;
  });

  ipcMain.handle("add-library-folders", async (event, folders: string[]) => {
    return addLibraryFolders(event.sender, folders);
  });

  ipcMain.handle("refresh-library", async () => {
    await updateLibrary();
  });
}
