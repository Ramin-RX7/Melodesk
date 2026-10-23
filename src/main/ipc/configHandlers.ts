import { ipcMain } from "electron";

import { getConfig, saveConfig } from "../services/configService";
import { updateLibrary } from "../services/library/libraryUpdater";
import { setupWatcher } from "../services/library/libraryWatcher";
import { UserConfig } from "../../renderer/types";

export function registerConfigHandlers() {
  ipcMain.handle("get-config", () => {
    return getConfig();
  });

  ipcMain.handle("update-config", async (_event, partialConfig: Partial<UserConfig>) => {
    const currentConfig = getConfig();
    const newConfig = { ...currentConfig, ...partialConfig };
    saveConfig(newConfig);

    // Library paths changed: watch the new set and rescan (the watcher ignores files that
    // already exist, so added folders would otherwise not be scanned until a refresh).
    if (partialConfig.libraryPaths) {
      await setupWatcher();
      updateLibrary();
    }

    return newConfig;
  });
}
