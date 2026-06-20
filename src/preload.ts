import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  getDirectoryTree: (dirPath: string) => ipcRenderer.invoke("get-directory-tree", dirPath),
  showSongContextMenu: (song: any) => ipcRenderer.invoke("show-song-context-menu", song),
  showGroupContextMenu: (groupName: string) => ipcRenderer.invoke("show-group-context-menu", groupName),
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config: any) => ipcRenderer.invoke("update-config", config),
  getLibraryFiles: () => ipcRenderer.invoke("get-library-files"),
  onLibraryUpdated: (callback: (files: any[]) => void) => {
    const listener = (_event: any, files: any[]) => callback(files);
    ipcRenderer.on("library-updated", listener);
    return () => ipcRenderer.removeListener("library-updated", listener);
  },
  refreshLibrary: () => ipcRenderer.invoke("refresh-library"),
  getMetadata: (filePath: string) => ipcRenderer.invoke("get-metadata", filePath),
  getPlaylists: () => ipcRenderer.invoke("get-playlists"),
  getPlaylist: (id: string) => ipcRenderer.invoke("get-playlist", id),
  createPlaylist: (name: string) => ipcRenderer.invoke("create-playlist", name),
  updatePlaylist: (id: string, data: any) => ipcRenderer.invoke("update-playlist", id, data),
  deletePlaylist: (id: string) => ipcRenderer.invoke("delete-playlist", id),
  writeMetadata: (filePath: string, tags: any) => ipcRenderer.invoke("write-metadata", filePath, tags),
  getArtistInfo: (name: string) => ipcRenderer.invoke("get-artist-info", name),
  updateArtistInfo: (name: string, data: any) => ipcRenderer.invoke("update-artist-info", name, data),
  selectArtistImage: () => ipcRenderer.invoke("select-artist-image"),
  showFileInFolder: (filePath: string) => ipcRenderer.invoke("show-file-in-folder", filePath),
  openExternalUrl: (url: string) => ipcRenderer.invoke("open-external-url", url),
  getSession: () => ipcRenderer.invoke("get-session"),
  saveSession: (data: any) => ipcRenderer.invoke("save-session", data),
  clearSession: () => ipcRenderer.invoke("clear-session"),
  recordPlay: (hash: string, timestamp?: number) => ipcRenderer.invoke("record-play", hash, timestamp),
  getPlayCounts: () => ipcRenderer.invoke("get-play-counts"),
  getRecentPlays: (limit?: number) => ipcRenderer.invoke("get-recent-plays", limit),
});
