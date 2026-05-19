import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  getDirectoryTree: (dirPath: string) => ipcRenderer.invoke("get-directory-tree", dirPath),
  showContextMenu: () => ipcRenderer.invoke("show-context-menu"),
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config: any) => ipcRenderer.invoke("update-config", config),
  getLibraryFiles: () => ipcRenderer.invoke("get-library-files"),
  onLibraryUpdated: (callback: (files: any[]) => void) => {
    const listener = (_event: any, files: any[]) => callback(files);
    ipcRenderer.on("library-updated", listener);
    return () => ipcRenderer.removeListener("library-updated", listener);
  },
});
