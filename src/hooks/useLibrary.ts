import { useEffect } from "react";

export function useLibrary(
  setAllTracks: (t: any[]) => void,
  setTree: (t: any) => void,
  selectedLibraryPath: string | null,
) {
  useEffect(() => {
    const unsubscribe = window.api.onLibraryUpdated((updatedFiles) => {
      setAllTracks(updatedFiles);
    });

    return () => unsubscribe();
  }, [setAllTracks]);

  const loadTree = async (selectedLibraryPath: string, setTree: any) => {
    try {
      const data = await window.api.getDirectoryTree(selectedLibraryPath);
      setTree(data);
    } catch (error) {
      console.error("Failed to load directory tree:", error);
    }
  };

  useEffect(() => {
    if (!selectedLibraryPath) return;

    loadTree(selectedLibraryPath, setTree);
  }, [selectedLibraryPath]);
}
