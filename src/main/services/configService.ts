import { app } from "electron";
import fs from "fs";
import path from "path";

import { UserConfig } from "../../renderer/types";
import { DEFAULT_KEYBINDINGS } from "../../utils/keybindings";


const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

const DEFAULT_CONFIG: UserConfig = {
  doubleClickToPlay: true,
  libraryPaths: [],
  minSongsForAlbum: 3,
  themeColor: "#1db954",
  volume: 0.5,
  removeCurrentSongBehavior: "play-next",
  restoreSession: true,
  searchResultsPerCategory: 4,
  navigationHistorySize: 20,
  playCountThresholdPercent: 50,
  homeItemLimit: 10,
  appearance: { themeId: "dark", colors: {} },
  keybindings: DEFAULT_KEYBINDINGS,
};

export const getConfig = (): UserConfig => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(data);
      // Deep-merge `appearance` so a saved config that predates it (or lacks a
      // sub-field) still fills in from defaults.
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        appearance: { ...DEFAULT_CONFIG.appearance, ...(parsed.appearance ?? {}) },
        // Per-action merge so a config predating an action (or the field
        // entirely) still picks up the new default binding.
        keybindings: { ...DEFAULT_CONFIG.keybindings, ...(parsed.keybindings ?? {}) },
      };
    }
  } catch (error) {
    console.error("Failed to read config:", error);
  }
  return DEFAULT_CONFIG;
};

export const saveConfig = (config: UserConfig) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Failed to save config:", error);
  }
};
