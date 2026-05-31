import { ipcMain, shell } from "electron";


export function registerShellHandlers() {
    ipcMain.handle("show-file-in-folder", async (_event, filePath: string) => {
        shell.showItemInFolder(filePath);
    });

    ipcMain.handle("open-external-url", async (_event, url: string) => {
        await shell.openExternal(url);
    });
}