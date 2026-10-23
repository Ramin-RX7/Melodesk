import { RefObject, useEffect } from "react";

const SAVE_INTERVAL_MS = 10_000;

// Saves the playback position into the session (so it can be restored on the next launch):
// every few seconds while playing, on pause, and when the window closes.
export function usePlaybackPositionSaver(
  audioRef: RefObject<HTMLAudioElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled) return;

    const save = () => {
      if (audio.getAttribute("src")) window.api.savePlaybackPosition(audio.currentTime || 0);
    };
    const interval = setInterval(() => {
      if (!audio.paused) save();
    }, SAVE_INTERVAL_MS);

    audio.addEventListener("pause", save);
    window.addEventListener("beforeunload", save);
    return () => {
      clearInterval(interval);
      audio.removeEventListener("pause", save);
      window.removeEventListener("beforeunload", save);
    };
  }, [audioRef, enabled]);
}
