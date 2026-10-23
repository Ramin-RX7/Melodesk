import { useState } from "react";

import { FileItem } from "../renderer/types";
import { shuffleArray } from "../utils/array";
import { RepeatMode, REPEAT_MODES } from "../types/queue";

export function useQueue(currentTrack: FileItem | null) {
  const [queue, setQueue] = useState<FileItem[]>([]);

  const [currentIndex, setCurrentIndex] = useState(-1);

  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");

  const [isShuffle, setIsShuffle] = useState(false);

  const [shuffledQueue, setShuffledQueue] = useState<FileItem[]>([]);

  const activeQueue = isShuffle ? shuffledQueue : queue;

  const handleShuffleToggle = () => {
    if (!currentTrack) {
      setIsShuffle((prev) => !prev);
      return;
    }
    if (!isShuffle) {
      // Remove current track from queue before shuffling, Shuffle remaining tracks, Put current track first
      const remainingTracks = queue.filter((t) => t.path !== currentTrack.path);
      const shuffledRemaining = shuffleArray(remainingTracks);
      const newShuffled = [currentTrack, ...shuffledRemaining];
      setShuffledQueue(newShuffled);
      setCurrentIndex(0);
    } else {
      // Restore original queue position
      const originalIdx = queue.findIndex((t) => t.path === currentTrack.path);
      setCurrentIndex(originalIdx);
    }
    setIsShuffle((prev) => !prev);
  };

  // Removes the row at `indexToRemove` from the visible (active) queue, plus the matching entry
  // of the other list. A song can be queued more than once, so "matching" means the same
  // occurrence: removing the 2nd copy here removes the 2nd copy there.
  const removeFromQueue = (indexToRemove: number) => {
    const trackToRemove = activeQueue[indexToRemove];
    if (!trackToRemove) return;

    const occurrence = activeQueue
      .slice(0, indexToRemove)
      .filter((t) => t.path === trackToRemove.path).length;
    const removeOccurrence = (list: FileItem[]) => {
      const positions = list.flatMap((t, i) => (t.path === trackToRemove.path ? [i] : []));
      const target = positions[Math.min(occurrence, positions.length - 1)];
      return target === undefined ? list : list.filter((_, i) => i !== target);
    };

    if (isShuffle) {
      setShuffledQueue(shuffledQueue.filter((_, i) => i !== indexToRemove));
      setQueue(removeOccurrence(queue));
    } else {
      setQueue(queue.filter((_, i) => i !== indexToRemove));
      setShuffledQueue(removeOccurrence(shuffledQueue));
    }

    if (indexToRemove < currentIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (indexToRemove === currentIndex && currentIndex >= activeQueue.length - 1) {
      setCurrentIndex(activeQueue.length - 2);
    }
  };

  const handleRepeatToggle = () => {
    const currentIndex = REPEAT_MODES.indexOf(repeatMode);
    const nextMode = REPEAT_MODES[(currentIndex + 1) % REPEAT_MODES.length];
    setRepeatMode(nextMode);
  };

  return {
    queue,
    setQueue,

    currentIndex,
    setCurrentIndex,

    repeatMode,
    setRepeatMode,

    isShuffle,
    setIsShuffle,

    shuffledQueue,
    setShuffledQueue,

    activeQueue,

    removeFromQueue,
    handleShuffleToggle,
    handleRepeatToggle,
  };
}
