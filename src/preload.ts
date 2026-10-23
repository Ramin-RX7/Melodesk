import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from "electron";

// Typed as the renderer's contract (types.d.ts → Window.api), so every method here is checked
// against what the UI expects.
type Api = Window["api"];

// Main → renderer events: subscribe and return the unsubscribe function.
const subscribe =
  <T>(channel: string) =>
  (callback: (value: T) => void) => {
    const listener = (_event: IpcRendererEvent, value: T) => callback(value);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };

const api: Api = {
  selectDirectories: () => ipcRenderer.invoke("select-directories"),
  addLibraryFolders: (folders) => ipcRenderer.invoke("add-library-folders", folders),
  getDirectoryTree: (dirPath) => ipcRenderer.invoke("get-directory-tree", dirPath),
  showSongContextMenu: (song) => ipcRenderer.invoke("show-song-context-menu", song),
  showGroupContextMenu: (groupName) => ipcRenderer.invoke("show-group-context-menu", groupName),
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config) => ipcRenderer.invoke("update-config", config),
  getLibraryFiles: () => ipcRenderer.invoke("get-library-files"),
  onLibraryUpdated: subscribe("library-updated"),
  refreshLibrary: () => ipcRenderer.invoke("refresh-library"),
  fileExists: (filePath) => ipcRenderer.invoke("file-exists", filePath),
  takePendingNotifications: () => ipcRenderer.invoke("take-pending-notifications"),
  onNotification: subscribe("notification"),
  onConfirmRequest: subscribe("confirm-request"),
  respondToConfirm: (id, response) => ipcRenderer.send("confirm-response", id, response),
  getLibraryScanStatus: () => ipcRenderer.invoke("get-library-scan-status"),
  onLibraryScanStatus: subscribe("library-scan-status"),
  getMetadata: (filePath) => ipcRenderer.invoke("get-metadata", filePath),
  // Path of a file dropped onto the window (File.path no longer exists since Electron 32). Also
  // lets media:// serve it: outside the library, only files the user dropped can be played.
  getPathForFile: (file) => {
    const filePath = webUtils.getPathForFile(file);
    if (filePath) ipcRenderer.send("allow-dropped-file", filePath);
    return filePath;
  },
  getPlaylists: () => ipcRenderer.invoke("get-playlists"),
  getPlaylist: (id) => ipcRenderer.invoke("get-playlist", id),
  createPlaylist: (name) => ipcRenderer.invoke("create-playlist", name),
  updatePlaylist: (id, data) => ipcRenderer.invoke("update-playlist", id, data),
  deletePlaylist: (id) => ipcRenderer.invoke("delete-playlist", id),
  addSongsToPlaylist: (id, paths) => ipcRenderer.invoke("add-songs-to-playlist", id, paths),
  removePlaylistDuplicates: (id) => ipcRenderer.invoke("remove-playlist-duplicates", id),
  onPlaylistsChanged: (callback) => subscribe<void>("playlists-changed")(() => callback()),
  writeMetadata: (filePath, tags) => ipcRenderer.invoke("write-metadata", filePath, tags),
  getArtistInfo: (name) => ipcRenderer.invoke("get-artist-info", name),
  getArtistPictures: () => ipcRenderer.invoke("get-artist-pictures"),
  updateArtistInfo: (name, data) => ipcRenderer.invoke("update-artist-info", name, data),
  selectArtistImage: () => ipcRenderer.invoke("select-artist-image"),
  showFileInFolder: (filePath) => ipcRenderer.invoke("show-file-in-folder", filePath),
  openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),
  getSession: () => ipcRenderer.invoke("get-session"),
  saveSession: (data) => ipcRenderer.invoke("save-session", data),
  clearSession: () => ipcRenderer.invoke("clear-session"),
  savePlaybackPosition: (position) => ipcRenderer.send("save-playback-position", position),
  recordPlay: (hash, timestamp) => ipcRenderer.invoke("record-play", hash, timestamp),
  getPlayCounts: () => ipcRenderer.invoke("get-play-counts"),
  getRecentPlays: (limit) => ipcRenderer.invoke("get-recent-plays", limit),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window-maximize-toggle"),
  closeWindow: () => ipcRenderer.invoke("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  onMaximizedChanged: subscribe("window-maximized-changed"),
  enterMiniMode: () => ipcRenderer.invoke("enter-mini-mode"),
  exitMiniMode: () => ipcRenderer.invoke("exit-mini-mode"),
  getWindowBounds: () => ipcRenderer.invoke("get-window-bounds"),
  setWindowPosition: (x, y, width, height) =>
    ipcRenderer.send("set-window-position", x, y, width, height),
};

contextBridge.exposeInMainWorld("api", api);
