import { BrowserWindow, ipcMain, Menu } from "electron";


export function registerMenuHandlers() {
    ipcMain.handle("show-context-menu", (event) => {
        const template = [
            { label: "Option 1", click: () => console.log("Option 1 clicked") },
            { label: "Option 2", click: () => console.log("Option 2 clicked") },
            { type: "separator" as const },
            { label: "Static Action", click: () => console.log("Static Action clicked") },
        ];
        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! });
    });
}
