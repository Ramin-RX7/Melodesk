import { BrowserWindow, ipcMain, Menu } from "electron";

import { getAllPlaylists } from "./playlistHandlers";

export function registerMenuHandlers() {
    ipcMain.handle("show-song-context-menu", (event, song) => {
        return new Promise((resolve) => {
            let actionSelected = false;
            const playlists = getAllPlaylists();
            
            const handleAction = (action: any) => {
                actionSelected = true;
                resolve(action);
            };

            const template: any[] = [
                { label: "Play Next", click: () => handleAction({ type: "play-next" }) },
                { type: "separator" as const },
                { label: "Go to Album", click: () => handleAction({ type: "go-to-album" }), enabled: !!song?.metadata?.album },
            ];

            const artists = song?.metadata?.artists || (song?.metadata?.artist ? [song.metadata.artist] : []);
            if (artists.length === 1) {
                template.push({
                    label: "Go to Artist",
                    click: () => handleAction({ type: "go-to-artist", artist: artists[0] })
                });
            } else if (artists.length > 1) {
                template.push({
                    label: "Go to Artist",
                    submenu: artists.map((a: string) => ({
                        label: a,
                        click: () => handleAction({ type: "go-to-artist", artist: a })
                    }))
                });
            } else {
                template.push({ label: "Go to Artist", enabled: false });
            }

            template.push({ label: "Open Details", click: () => handleAction({ type: "open-details" }) });
            template.push({ type: "separator" as const });
            
            if (playlists.length > 0) {
                template.push({
                    label: "Add to Playlist",
                    submenu: playlists.map((p: any) => ({
                        label: p.name,
                        click: () => handleAction({ type: "add-to-playlist", playlistId: p.id })
                    }))
                });
            } else {
                template.push({ label: "Add to Playlist", enabled: false });
            }

            const menu = Menu.buildFromTemplate(template);
            menu.popup({ 
                window: BrowserWindow.fromWebContents(event.sender)!,
                callback: () => {
                    // Slight delay to ensure click handler fires first if clicked
                    setTimeout(() => {
                        if (!actionSelected) resolve(null);
                    }, 10);
                }
            });
        });
    });
}
