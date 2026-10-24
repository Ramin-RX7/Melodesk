// A complete fake `window.api` for renderer tests. Every method is a vi.fn with a safe default
// (empty library, default config, no session…); override any of them per test. Subscriptions
// (`on…`) are recorded, and `api.emit.…` sends an event to every subscriber, as the main
// process would.
import { Mock, vi } from "vitest";

import {
  AppNotification,
  ConfirmRequest,
  FileItem,
  LibraryScanStatus,
  Playlist,
  UserConfig,
} from "../../src/renderer/types";
import { makeConfig } from "./songs";

type Api = Window["api"];
export type FakeApi = { [K in keyof Api]: Mock<Api[K]> } & { emit: Emitters };

type Listeners = {
  libraryUpdated: Set<(files: FileItem[]) => void>;
  notification: Set<(n: AppNotification) => void>;
  confirmRequest: Set<(q: ConfirmRequest) => void>;
  libraryScanStatus: Set<(s: LibraryScanStatus) => void>;
  playlistsChanged: Set<() => void>;
  maximizedChanged: Set<(isMaximized: boolean) => void>;
};

type Emitters = { [K in keyof Listeners]: (...args: Parameters<SetItem<Listeners[K]>>) => void } & {
  /** How many subscribers an event currently has (checks that components unsubscribe). */
  count: (event: keyof Listeners) => number;
};
type SetItem<S> = S extends Set<infer T> ? T : never;

const subscribe =
  <T>(set: Set<T>) =>
  (callback: T) => {
    set.add(callback);
    return () => {
      set.delete(callback);
    };
  };

export const createApi = (overrides: Partial<Api> = {}): FakeApi => {
  const listeners: Listeners = {
    libraryUpdated: new Set(),
    notification: new Set(),
    confirmRequest: new Set(),
    libraryScanStatus: new Set(),
    playlistsChanged: new Set(),
    maximizedChanged: new Set(),
  };
  let config: UserConfig = makeConfig();
  // The playlists last handed out, so updates return the whole updated playlist.
  let playlists: Playlist[] = [];
  const savePlaylist = (updated: Playlist) => {
    playlists = playlists.map((p) => (p.id === updated.id ? updated : p));
    return updated;
  };
  const findPlaylist = (id: string): Playlist =>
    playlists.find((p) => p.id === id) ?? {
      id,
      name: id,
      songs: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

  const defaults: Api = {
    selectDirectories: async () => [],
    addLibraryFolders: async (folders) => {
      config = { ...config, libraryPaths: [...config.libraryPaths, ...folders] };
      return config;
    },
    getDirectoryTree: async () => [],
    showSongContextMenu: async () => null,
    showGroupContextMenu: async () => null,
    getConfig: async () => config,
    updateConfig: async (partial) => {
      config = { ...config, ...partial };
      return config;
    },
    getLibraryFiles: async () => [],
    onLibraryUpdated: subscribe(listeners.libraryUpdated),
    refreshLibrary: async () => {},
    fileExists: async () => true,
    takePendingNotifications: async () => [],
    onNotification: subscribe(listeners.notification),
    onConfirmRequest: subscribe(listeners.confirmRequest),
    respondToConfirm: () => {},
    getLibraryScanStatus: async () => ({ scanning: false, processed: 0, total: 0 }),
    onLibraryScanStatus: subscribe(listeners.libraryScanStatus),
    getMetadata: async (filePath) => ({
      name: filePath.split(/[\\/]/).pop()!,
      path: filePath,
      isDirectory: false,
      isMedia: true,
      hash: `hash:${filePath}`,
      metadata: {},
    }),
    getPathForFile: (file) => `C:\\Dropped\\${file.name}`,
    getPlaylists: async () => playlists,
    getPlaylist: async (id) => playlists.find((p) => p.id === id) ?? null,
    createPlaylist: async (name) => {
      const created = { ...findPlaylist(`id-${name}`), name };
      playlists = [created, ...playlists];
      return created;
    },
    updatePlaylist: async (id, data) =>
      savePlaylist({ ...findPlaylist(id), ...data, updatedAt: "2026-01-02T00:00:00.000Z" }),
    deletePlaylist: async (id) => {
      playlists = playlists.filter((p) => p.id !== id);
    },
    addSongsToPlaylist: async () => null,
    removePlaylistDuplicates: async () => null,
    onPlaylistsChanged: subscribe(listeners.playlistsChanged),
    writeMetadata: async () => true,
    getArtistInfo: async () => null,
    getArtistPictures: async () => ({}),
    updateArtistInfo: async (name, data) => ({ name, ...data }),
    selectArtistImage: async () => null,
    showFileInFolder: async () => {},
    openExternalUrl: async () => {},
    getSession: async () => null,
    saveSession: async () => {},
    clearSession: async () => {},
    savePlaybackPosition: () => {},
    recordPlay: async () => {},
    getPlayCounts: async () => ({}),
    getRecentPlays: async () => [],
    minimizeWindow: async () => {},
    maximizeWindow: async () => {},
    closeWindow: async () => {},
    isMaximized: async () => false,
    onMaximizedChanged: subscribe(listeners.maximizedChanged),
    enterMiniMode: async () => {},
    exitMiniMode: async () => {},
    getWindowBounds: async () => ({ x: 100, y: 100, width: 320, height: 120 }),
    setWindowPosition: () => {},
  };

  // Whatever a test's getPlaylists returns becomes what the other playlist calls work on.
  const getPlaylists = overrides.getPlaylists ?? defaults.getPlaylists;
  const all: Api = {
    ...defaults,
    ...overrides,
    getPlaylists: async () => (playlists = await getPlaylists()),
  };
  const api = Object.fromEntries(
    Object.entries(all).map(([name, fn]) => [name, vi.fn(fn)]),
  ) as unknown as FakeApi;

  const emit = (event: keyof Listeners) => (arg?: unknown) => {
    for (const callback of [...listeners[event]]) (callback as (a: unknown) => void)(arg);
  };
  api.emit = {
    libraryUpdated: emit("libraryUpdated"),
    notification: emit("notification"),
    confirmRequest: emit("confirmRequest"),
    libraryScanStatus: emit("libraryScanStatus"),
    playlistsChanged: emit("playlistsChanged"),
    maximizedChanged: emit("maximizedChanged"),
    count: (event) => listeners[event].size,
  };
  return api;
};

/** Installs a new fake `window.api` (also done before every renderer test) and returns it. */
export const installApi = (overrides: Partial<Api> = {}): FakeApi => {
  const api = createApi(overrides);
  window.api = api;
  return api;
};

/** The fake installed for the current test. */
export const fakeApi = () => window.api as unknown as FakeApi;
