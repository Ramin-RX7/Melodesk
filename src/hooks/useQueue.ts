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

  const removeFromQueue = (indexToRemove: number) => {
    const trackToRemove = activeQueue[indexToRemove];
    if (!trackToRemove) return;

    if (isShuffle) {
      const newShuffled = shuffledQueue.filter((_, i) => i !== indexToRemove);
      const queueIdx = queue.findIndex((t) => t.path === trackToRemove.path);
      const newQueue = queueIdx >= 0 ? queue.filter((_, i) => i !== queueIdx) : queue;
      setShuffledQueue(newShuffled);
      setQueue(newQueue);
    } else {
      const newQueue = queue.filter((_, i) => i !== indexToRemove);
      const shuffledIdx = shuffledQueue.findIndex((t) => t.path === trackToRemove.path);
      const newShuffled =
        shuffledIdx >= 0 ? shuffledQueue.filter((_, i) => i !== shuffledIdx) : shuffledQueue;
      setQueue(newQueue);
      setShuffledQueue(newShuffled);
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
