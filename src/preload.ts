import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectDirectories: () => ipcRenderer.invoke("select-directories"),
  addLibraryFolders: (folders: string[]) => ipcRenderer.invoke("add-library-folders", folders),
  getDirectoryTree: (dirPath: string) => ipcRenderer.invoke("get-directory-tree", dirPath),
  showSongContextMenu: (song: any) => ipcRenderer.invoke("show-song-context-menu", song),
  showGroupContextMenu: (groupName: string) =>
    ipcRenderer.invoke("show-group-context-menu", groupName),
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config: any) => ipcRenderer.invoke("update-config", config),
  getLibraryFiles: () => ipcRenderer.invoke("get-library-files"),
  onLibraryUpdated: (callback: (files: any[]) => void) => {
    const listener = (_event: any, files: any[]) => callback(files);
    ipcRenderer.on("library-updated", listener);
    return () => ipcRenderer.removeListener("library-updated", listener);
  },
  refreshLibrary: () => ipcRenderer.invoke("refresh-library"),
  fileExists: (filePath: string) => ipcRenderer.invoke("file-exists", filePath),
  takePendingNotifications: () => ipcRenderer.invoke("take-pending-notifications"),
  onNotification: (callback: (notification: any) => void) => {
    const listener = (_event: any, notification: any) => callback(notification);
    ipcRenderer.on("notification", listener);
    return () => ipcRenderer.removeListener("notification", listener);
  },
  getLibraryScanStatus: () => ipcRenderer.invoke("get-library-scan-status"),
  onLibraryScanStatus: (callback: (status: any) => void) => {
    const listener = (_event: any, status: any) => callback(status);
    ipcRenderer.on("library-scan-status", listener);
    return () => ipcRenderer.removeListener("library-scan-status", listener);
  },
  getMetadata: (filePath: string) => ipcRenderer.invoke("get-metadata", filePath),
  // Path of a file dropped onto the window (File.path no longer exists since Electron 32).
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getPlaylists: () => ipcRenderer.invoke("get-playlists"),
  getPlaylist: (id: string) => ipcRenderer.invoke("get-playlist", id),
  createPlaylist: (name: string) => ipcRenderer.invoke("create-playlist", name),
  updatePlaylist: (id: string, data: any) => ipcRenderer.invoke("update-playlist", id, data),
  deletePlaylist: (id: string) => ipcRenderer.invoke("delete-playlist", id),
  addSongsToPlaylist: (id: string, paths: string[]) =>
    ipcRenderer.invoke("add-songs-to-playlist", id, paths),
  removePlaylistDuplicates: (id: string) => ipcRenderer.invoke("remove-playlist-duplicates", id),
  onPlaylistsChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("playlists-changed", listener);
    return () => ipcRenderer.removeListener("playlists-changed", listener);
  },
  writeMetadata: (filePath: string, tags: any) =>
    ipcRenderer.invoke("write-metadata", filePath, tags),
  getArtistInfo: (name: string) => ipcRenderer.invoke("get-artist-info", name),
  getArtistPictures: () => ipcRenderer.invoke("get-artist-pictures"),
  updateArtistInfo: (name: string, data: any) =>
    ipcRenderer.invoke("update-artist-info", name, data),
  selectArtistImage: () => ipcRenderer.invoke("select-artist-image"),
  showFileInFolder: (filePath: string) => ipcRenderer.invoke("show-file-in-folder", filePath),
  openExternalUrl: (url: string) => ipcRenderer.invoke("open-external-url", url),
  getSession: () => ipcRenderer.invoke("get-session"),
  saveSession: (data: any) => ipcRenderer.invoke("save-session", data),
  clearSession: () => ipcRenderer.invoke("clear-session"),
  savePlaybackPosition: (position: number) => ipcRenderer.send("save-playback-position", position),
  recordPlay: (hash: string, timestamp?: number) =>
    ipcRenderer.invoke("record-play", hash, timestamp),
  getPlayCounts: () => ipcRenderer.invoke("get-play-counts"),
  getRecentPlays: (limit?: number) => ipcRenderer.invoke("get-recent-plays", limit),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window-maximize-toggle"),
  closeWindow: () => ipcRenderer.invoke("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: any, value: boolean) => callback(value);
    ipcRenderer.on("window-maximized-changed", listener);
    return () => ipcRenderer.removeListener("window-maximized-changed", listener);
  },
  enterMiniMode: () => ipcRenderer.invoke("enter-mini-mode"),
  exitMiniMode: () => ipcRenderer.invoke("exit-mini-mode"),
  getWindowBounds: () => ipcRenderer.invoke("get-window-bounds"),
  setWindowPosition: (x: number, y: number, width: number, height: number) =>
    ipcRenderer.send("set-window-position", x, y, width, height),
});
