import { LibraryFoldersView } from "./LibraryFoldersView";
import { LibraryFolderView } from "./LibraryFolderView";

type Props = {
  selectedLibraryPath: string | null;
  tree: any;
  config: any;
  themeColor: string;

  setSelectedLibraryPath: (v: string | null) => void;
  setConfig: (config: any) => void;

  handleFileSelect: (file: any) => void;
  onContextMenu?: (e: React.MouseEvent, song: any) => void;
};

export function LibraryView(props: Props) {
  const { selectedLibraryPath, config, setConfig, setSelectedLibraryPath, handleFileSelect } =
    props;

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
        libraryPaths: config.libraryPaths.filter((p: string) => p !== path),
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
    return (
      <LibraryFolderView
        {...props}
        handleRefreshLibrary={handleRefreshLibrary}
        handleRemoveFolder={handleRemoveFolder}
        handleAddFolder={handleAddFolder}
      />
    );
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
