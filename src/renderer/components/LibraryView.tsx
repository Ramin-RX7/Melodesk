import { LibraryFoldersView } from "./LibraryFoldersView";
import { LibraryFolderView } from "./LibraryFolderView";

type Props = {
  selectedLibraryPath: string | null;
  tree: any;
  config: any;
  themeColor: string;

  setSelectedLibraryPath: (v: string | null) => void;
  handleFileSelect: (file: any) => void;
  handleAddFolder: () => void;
  handleRefreshLibrary: () => void;
  handleRemoveFolder: (e: any, path: string) => void;
};

export function LibraryView(props: Props) {
  const { selectedLibraryPath } = props;

  if (selectedLibraryPath) {
    return <LibraryFolderView {...props} />;
  }

  return <LibraryFoldersView {...props} />;
}