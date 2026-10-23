import { ipcMain } from "electron";

import { getPlayCounts, getRecentPlays, recordPlay } from "../services/trackerService";

export function registerTrackerHandlers() {
  ipcMain.handle("record-play", (_event, hash: string, timestamp?: number) => {
    recordPlay(hash, timestamp);
  });

  ipcMain.handle("get-play-counts", () => {
    return getPlayCounts();
  });

  ipcMain.handle("get-recent-plays", (_event, limit?: number) => {
    return getRecentPlays(limit);
  });
}
