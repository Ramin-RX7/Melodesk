import { useCallback, useEffect, useState } from "react";

// Custom artist pictures by artist name, loaded with a single IPC call (instead of one per card).
export function useArtistPictures() {
  const [pictures, setPictures] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    window.api
      .getArtistPictures()
      .then((loaded) => {
        if (active) setPictures(loaded);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  // Keeps the map current after the user picks a new picture for an artist.
  const setArtistPicture = useCallback((name: string, picture: string) => {
    setPictures((prev) => ({ ...prev, [name]: picture }));
  }, []);

  return { artistPictures: pictures, setArtistPicture };
}
