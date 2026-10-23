import { ipcMain } from "electron";

import { getConfig, saveConfig } from "../services/configService";
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

    // Re-setup watcher if library paths changed
    if (partialConfig.libraryPaths) {
      await setupWatcher();
    }

    return newConfig;
  });
}
