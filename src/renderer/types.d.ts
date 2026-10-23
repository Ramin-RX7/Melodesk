import { Keybindings } from "../utils/keybindings";

export interface Appearance {
  /** Id of the selected built-in theme (the base palette). */
  themeId: string;
  /** Per-role color deviations, merged over the selected theme's palette. */
  colors: Record<string, string>;
}

export interface UserConfig {
  doubleClickToPlay: boolean;
  libraryPaths: string[];
  minSongsForAlbum: number;
  themeColor: string;
  volume: number;
  removeCurrentSongBehavior: "prevent" | "play-next";
  restoreSession: boolean;
  searchResultsPerCategory: number;
  navigationHistorySize: number;
  playCountThresholdPercent: number;
  homeItemLimit: number;
  appearance: Appearance;
  keybindings: Keybindings;
  equalizerEnabled: boolean;
  equalizerPreset: string;
  equalizerBands: number[];
}

export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

export interface SessionData {
  currentTrackPath: string | null;
  queue: string[];
  shuffledQueue: string[];
  currentIndex: number;
  isShuffle: boolean;
  repeatMode: "none" | "one" | "all";
  /** Playback position (seconds) in the current track; restored on launch. */
  position?: number;
  windowBounds?: WindowBounds;
  miniWindowBounds?: WindowBounds;
}
export interface ArtistInfo {
  name: string;
  bio?: string;
  picture?: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isMedia: boolean;
  hash?: string;
  /** File modification time (ms) when it was last scanned; unchanged files skip re-parsing. */
  mtime?: number;
  children?: FileItem[];
  metadata?: {
    title?: string;
    artist?: string;
    artists?: string[];
    album?: string;
    genre?: string[];
    duration?: number;
    picture?: string;
    year?: number;
    trackNumber?: number;
    fileSize?: number;
    format?: string;
    bitrate?: number;
    bpm?: number;
    lyrics?: string;
  };
}

export interface LibraryScanStatus {
  scanning: boolean;
  /** "discovering": listing folders (total = files found so far); "reading": reading tags. */
  phase?: "discovering" | "reading";
  processed: number;
  total: number;
  currentPath?: string;
}

/** A short message shown to the user as a toast; sent by the main process or raised in the UI. */
export interface AppNotification {
  level: "info" | "success" | "error";
  message: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  songs: string[];
  sortBy?: "custom" | "title" | "artist" | "duration";
  sortDescending?: boolean;
  createdAt: string;
  updatedAt: string;
  isFixed?: boolean;
}

export interface PlayRecord {
  hash: string;
  timestamp: number;
}

export type ContextMenuAction =
  | { type: "play-next" }
  | { type: "go-to-album" }
  | { type: "go-to-artist"; artist: string }
  | { type: "open-details" }
  | { type: "add-to-playlist"; playlistId: string };

export type GroupContextMenuAction =
  | { type: "group-play" }
  | { type: "group-play-next" }
  | { type: "group-add-to-playlist"; playlistId: string };

declare global {
  interface Window {
    api: {
      /** Folder picker with multi-select; resolves to [] when cancelled. */
      selectDirectories: () => Promise<string[]>;
      /**
       * Adds folders to the library, enforcing that library folders never overlap (may ask the
       * user to confirm replacing inner folders). Resolves to the resulting config.
       */
      addLibraryFolders: (folders: string[]) => Promise<UserConfig>;
      getDirectoryTree: (dirPath: string) => Promise<FileItem[]>;
      showSongContextMenu: (song: FileItem) => Promise<ContextMenuAction | null>;
      showGroupContextMenu: (groupName: string) => Promise<GroupContextMenuAction | null>;
      getConfig: () => Promise<UserConfig>;
      updateConfig: (config: Partial<UserConfig>) => Promise<UserConfig>;
      getLibraryFiles: () => Promise<FileItem[]>;
      onLibraryUpdated: (callback: (files: FileItem[]) => void) => () => void;
      refreshLibrary: () => Promise<void>;
      fileExists: (filePath: string) => Promise<boolean>;
      /** Notifications raised before the UI was listening (e.g. during startup). */
      takePendingNotifications: () => Promise<AppNotification[]>;
      onNotification: (callback: (notification: AppNotification) => void) => () => void;
      getLibraryScanStatus: () => Promise<LibraryScanStatus>;
      onLibraryScanStatus: (callback: (status: LibraryScanStatus) => void) => () => void;
      getMetadata: (filePath: string) => Promise<FileItem>;
      getPathForFile: (file: File) => string;
      getPlaylists: () => Promise<Playlist[]>;
      getPlaylist: (id: string) => Promise<Playlist | null>;
      createPlaylist: (name: string) => Promise<Playlist>;
      updatePlaylist: (
        id: string,
        data: Partial<
          Pick<Playlist, "name" | "songs" | "description" | "sortBy" | "sortDescending">
        >,
      ) => Promise<Playlist>;
      deletePlaylist: (id: string) => Promise<void>;
      /** Asks the user about duplicates; resolves to the updated playlist, or null if cancelled. */
      addSongsToPlaylist: (id: string, paths: string[]) => Promise<Playlist | null>;
      /** Asks for confirmation; resolves to the (possibly unchanged) playlist. */
      removePlaylistDuplicates: (id: string) => Promise<Playlist | null>;
      onPlaylistsChanged: (callback: () => void) => () => void;
      writeMetadata: (filePath: string, tags: any) => Promise<boolean>;
      getArtistInfo: (name: string) => Promise<ArtistInfo | null>;
      /** Custom pictures of all artists that have one, by artist name. */
      getArtistPictures: () => Promise<Record<string, string>>;
      updateArtistInfo: (name: string, data: Partial<ArtistInfo>) => Promise<ArtistInfo>;
      selectArtistImage: () => Promise<string | null>;
      showFileInFolder: (filePath: string) => Promise<void>;
      openExternalUrl: (url: string) => Promise<void>;
      getSession: () => Promise<SessionData | null>;
      saveSession: (data: SessionData) => Promise<void>;
      clearSession: () => Promise<void>;
      savePlaybackPosition: (position: number) => void;
      recordPlay: (hash: string, timestamp?: number) => Promise<void>;
      getPlayCounts: () => Promise<Record<string, number>>;
      getRecentPlays: (limit?: number) => Promise<PlayRecord[]>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;
      enterMiniMode: () => Promise<void>;
      exitMiniMode: () => Promise<void>;
      getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
      setWindowPosition: (x: number, y: number, width: number, height: number) => void;
    };
  }
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}
