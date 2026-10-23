import { FileItem, UserConfig } from "../types";
import { LibraryFoldersView } from "./LibraryFoldersView";
import { LibraryFolderView } from "./LibraryFolderView";

export type LibraryViewProps = {
  selectedLibraryPath: string | null;
  tree: FileItem[];
  config: UserConfig | null;
  themeColor: string;

  setSelectedLibraryPath: (v: string | null) => void;
  /** Opens a library folder's tree (recorded in the Back history). */
  onOpenFolder: (path: string) => void;
  /** Leaves the folder tree (same as Back). */
  onCloseFolder: () => void;
  onScrollRef?: (el: HTMLElement | null) => void;
  setConfig: (config: UserConfig) => void;

  handleFileSelect: (file: FileItem, contextQueue?: FileItem[]) => void;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
};

export function LibraryView(props: LibraryViewProps) {
  const { selectedLibraryPath, config, setConfig, setSelectedLibraryPath } = props;

  const handleAddFolder = async () => {
    const paths = await window.api.selectDirectories();
    if (paths.length > 0) {
      setConfig(await window.api.addLibraryFolders(paths));
    }
  };

  const handleRemoveFolder = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();

    if (config) {
      const newConfig = await window.api.updateConfig({
        libraryPaths: config.libraryPaths.filter((p) => p !== path),
      });

      setConfig(newConfig);

      if (selectedLibraryPath === path) {
        setSelectedLibraryPath(null);
      }
    }
  };

  const handleRefreshLibrary = async () => {
    await window.api.refreshLibrary();
  };

  if (selectedLibraryPath) {
    return <LibraryFolderView {...props} />;
  }

  return (
    <LibraryFoldersView
      {...props}
      handleAddFolder={handleAddFolder}
      handleRefreshLibrary={handleRefreshLibrary}
      handleRemoveFolder={handleRemoveFolder}
    />
  );
}
