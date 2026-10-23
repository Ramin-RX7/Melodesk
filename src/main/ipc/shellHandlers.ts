import { ipcMain, shell } from "electron";

export function registerShellHandlers() {
  ipcMain.handle("show-file-in-folder", async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // Only web pages: other schemes (file:, ms-settings:, custom app links…) can start programs.
  ipcMain.handle("open-external-url", async (_event, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      console.error(`Refused to open a non-web link: ${url}`);
      return;
    }
    if (parsed.username || parsed.password) return;
    await shell.openExternal(parsed.toString());
  });
}
