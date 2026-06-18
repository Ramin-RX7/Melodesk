export interface UserConfig {
  doubleClickToPlay: boolean;
  libraryPaths: string[];
  minSongsForAlbum: number;
  themeColor: string;
  volume: number;
  removeCurrentSongBehavior: "prevent" | "play-next";
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

export interface Playlist {
  id: string;
  name: string;
  songs: string[];
  createdAt: string;
  updatedAt: string;
}

export type ContextMenuAction = 
  | { type: 'play-next' }
  | { type: 'go-to-album' }
  | { type: 'go-to-artist', artist: string }
  | { type: 'open-details' }
  | { type: 'add-to-playlist', playlistId: string };

declare global {
  interface Window {
    api: {
      selectDirectory: () => Promise<string | null>;
      getDirectoryTree: (dirPath: string) => Promise<FileItem[]>;
      showSongContextMenu: (song: FileItem) => Promise<ContextMenuAction | null>;
      getConfig: () => Promise<UserConfig>;
      updateConfig: (config: Partial<UserConfig>) => Promise<UserConfig>;
      getLibraryFiles: () => Promise<FileItem[]>;
      onLibraryUpdated: (callback: (files: FileItem[]) => void) => () => void;
      refreshLibrary: () => Promise<void>;
      getMetadata: (filePath: string) => Promise<FileItem>;
      getPlaylists: () => Promise<Playlist[]>;
      getPlaylist: (id: string) => Promise<Playlist | null>;
      createPlaylist: (name: string) => Promise<Playlist>;
      updatePlaylist: (id: string, data: Partial<Pick<Playlist, 'name' | 'songs'>>) => Promise<Playlist>;
      deletePlaylist: (id: string) => Promise<void>;
      writeMetadata: (filePath: string, tags: any) => Promise<boolean>;
      getArtistInfo: (name: string) => Promise<ArtistInfo | null>;
      updateArtistInfo: (name: string, data: Partial<ArtistInfo>) => Promise<ArtistInfo>;
      selectArtistImage: () => Promise<string | null>;
      showFileInFolder: (filePath: string) => Promise<void>;
      openExternalUrl: (url: string) => Promise<void>;
    };
  }
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}
