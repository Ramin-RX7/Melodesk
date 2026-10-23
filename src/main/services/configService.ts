import { app } from "electron";
import path from "path";

import { UserConfig } from "../../renderer/types";
import { DEFAULT_KEYBINDINGS } from "../../utils/keybindings";
import { readJson, writeJson } from "./jsonStore";

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
  equalizerEnabled: false,
  equalizerPreset: "flat",
  equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export const getConfig = (): UserConfig => {
  const parsed = readJson<Partial<UserConfig> | null>(CONFIG_PATH, null, { label: "settings" });
  if (!parsed) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    // Deep-merge `appearance` so a saved config that predates it (or lacks a
    // sub-field) still fills in from defaults.
    appearance: { ...DEFAULT_CONFIG.appearance, ...(parsed.appearance ?? {}) },
    // Per-action merge so a config predating an action (or the field
    // entirely) still picks up the new default binding.
    keybindings: { ...DEFAULT_CONFIG.keybindings, ...(parsed.keybindings ?? {}) },
  };
};

export const saveConfig = (config: UserConfig) => {
  writeJson(CONFIG_PATH, config, { pretty: true });
};
