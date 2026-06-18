import { app } from "electron";
import fs from "fs";
import path from "path";

import { UserConfig } from "../../renderer/types";


const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

const DEFAULT_CONFIG: UserConfig = {
  doubleClickToPlay: true,
  libraryPaths: [],
  minSongsForAlbum: 3,
  themeColor: "#1db954",
  volume: 0.5,
  removeCurrentSongBehavior: "play-next",
  restoreSession: true,
};

export const getConfig = (): UserConfig => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
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
