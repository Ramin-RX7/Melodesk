export interface UserConfig {
  doubleClickToPlay: boolean;
  libraryPaths: string[];
  minSongsForAlbum: number;
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
    album?: string;
    genre?: string[];
    duration?: number;
    picture?: string;
  };
}

declare global {
  interface Window {
    api: {
      selectDirectory: () => Promise<string | null>;
      getDirectoryTree: (dirPath: string) => Promise<FileItem[]>;
      showContextMenu: () => Promise<void>;
      getConfig: () => Promise<UserConfig>;
      updateConfig: (config: Partial<UserConfig>) => Promise<UserConfig>;
      getLibraryFiles: () => Promise<FileItem[]>;
      onLibraryUpdated: (callback: (files: FileItem[]) => void) => () => void;
    };
  }
}
