import { useEffect } from "react";

import { FileItem } from "../renderer/types";

export function useLibrary(
  setAllTracks: (tracks: FileItem[]) => void,
  setTree: (tree: FileItem[]) => void,
  selectedLibraryPath: string | null,
) {
  useEffect(() => {
    const unsubscribe = window.api.onLibraryUpdated((updatedFiles) => {
      setAllTracks(updatedFiles);
    });

    return () => unsubscribe();
  }, [setAllTracks]);

  useEffect(() => {
    if (!selectedLibraryPath) return;
    window.api
      .getDirectoryTree(selectedLibraryPath)
      .then(setTree)
      .catch((error) => console.error("Failed to load directory tree:", error));
  }, [selectedLibraryPath, setTree]);
}
