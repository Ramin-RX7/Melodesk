import { RefObject, useEffect, useRef } from "react";

import { FileItem } from "../renderer/types";

// Deltas larger than this between two timeupdate events are treated as a seek
// (a jump), not real listening, and are not accumulated.
const MAX_PLAY_DELTA = 1.0;
// Seeking to at/under this position is treated as "back to the beginning" and
// resets the accumulated listening timer.
const BEGINNING_THRESHOLD = 1.0;

/**
 * Records a play once the user has actually *listened* to a configurable
 * percentage of a song.
 *
 * Listening is accumulated from forward playback progress, so skipping ahead
 * does not count and pausing does not lose progress. Seeking back to the start
 * resets the timer, allowing the same song to be counted again in one sitting.
 *
 * The decision of *when* to record lives here; the persistence is the tracker
 * service behind window.api.recordPlay.
 */
export function usePlayTracker(
  audioRef: RefObject<HTMLAudioElement | null>,
  currentTrack: FileItem | null,
  thresholdPercent: number,
) {
  const listenedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const countedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // Reset accumulation for the newly active track.
    listenedRef.current = 0;
    lastTimeRef.current = audio.currentTime || 0;
    countedRef.current = false;

    const maybeCount = () => {
      if (countedRef.current || !currentTrack.hash) return;
      const duration = currentTrack.metadata?.duration || audio.duration;
      if (!duration || !isFinite(duration)) return;
      const required = (duration * thresholdPercent) / 100;
      if (listenedRef.current >= required) {
        countedRef.current = true;
        window.api.recordPlay(currentTrack.hash);
      }
    };

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      const delta = t - lastTimeRef.current;
      lastTimeRef.current = t;
      // Only count normal forward playback; ignore seeks (large or negative jumps).
      if (delta > 0 && delta < MAX_PLAY_DELTA) {
        listenedRef.current += delta;
        maybeCount();
      }
    };

    const onSeeked = () => {
      const t = audio.currentTime;
      lastTimeRef.current = t;
      if (t <= BEGINNING_THRESHOLD) {
        // Back to the start → start a fresh listening cycle.
        listenedRef.current = 0;
        countedRef.current = false;
      }
    };

    // The same song loaded again (picked again, or repeat-all over a one-song queue) is a new
    // listen: the path doesn't change, so this effect doesn't re-run, but the element reloads.
    const onLoadStart = () => {
      listenedRef.current = 0;
      lastTimeRef.current = 0;
      countedRef.current = false;
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("loadstart", onLoadStart);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("loadstart", onLoadStart);
    };
  }, [audioRef, currentTrack?.path, currentTrack?.hash, thresholdPercent]);
}
