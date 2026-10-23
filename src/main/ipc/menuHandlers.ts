import { BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from "electron";

import { ContextMenuAction, FileItem, GroupContextMenuAction } from "../../renderer/types";
import { artistsOf } from "../../utils/metadata";
import { getAllPlaylists } from "./playlistHandlers";

export function registerMenuHandlers() {
  ipcMain.handle("show-group-context-menu", (event, _groupName: string) => {
    return new Promise((resolve) => {
      let actionSelected = false;
      const playlists = getAllPlaylists();

      const handleAction = (action: GroupContextMenuAction) => {
        actionSelected = true;
        resolve(action);
      };

      const template: MenuItemConstructorOptions[] = [
        { label: "Play", click: () => handleAction({ type: "group-play" }) },
        { label: "Play Next", click: () => handleAction({ type: "group-play-next" }) },
        { type: "separator" as const },
      ];

      if (playlists.length > 0) {
        template.push({
          label: "Add to Playlist",
          submenu: playlists.map((p) => ({
            label: p.name,
            click: () => handleAction({ type: "group-add-to-playlist", playlistId: p.id }),
          })),
        });
      } else {
        template.push({ label: "Add to Playlist", enabled: false });
      }

      const menu = Menu.buildFromTemplate(template);
      menu.popup({
        window: BrowserWindow.fromWebContents(event.sender)!,
        callback: () => {
          setTimeout(() => {
            if (!actionSelected) resolve(null);
          }, 10);
        },
      });
    });
  });

  ipcMain.handle("show-song-context-menu", (event, song: FileItem | null) => {
    return new Promise((resolve) => {
      let actionSelected = false;
      const playlists = getAllPlaylists();

      const handleAction = (action: ContextMenuAction) => {
        actionSelected = true;
        resolve(action);
      };

      const template: MenuItemConstructorOptions[] = [
        { label: "Play Next", click: () => handleAction({ type: "play-next" }) },
        { type: "separator" as const },
        {
          label: "Go to Album",
          click: () => handleAction({ type: "go-to-album" }),
          enabled: !!song?.metadata?.album,
        },
      ];

      // Songs without an artist tag lead to the "Unknown Artist" page.
      const artists = song ? artistsOf(song) : [];
      if (artists.length === 1) {
        template.push({
          label: "Go to Artist",
          click: () => handleAction({ type: "go-to-artist", artist: artists[0] }),
        });
      } else if (artists.length > 1) {
        template.push({
          label: "Go to Artist",
          submenu: artists.map((a: string) => ({
            label: a,
            click: () => handleAction({ type: "go-to-artist", artist: a }),
          })),
        });
      }

      template.push({ label: "Open Details", click: () => handleAction({ type: "open-details" }) });
      template.push({ type: "separator" as const });

      if (playlists.length > 0) {
        template.push({
          label: "Add to Playlist",
          submenu: playlists.map((p) => ({
            label: p.name,
            click: () => handleAction({ type: "add-to-playlist", playlistId: p.id }),
          })),
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
        },
      });
    });
  });
}
