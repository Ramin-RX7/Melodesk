import { useState } from "react";

import { FileItem } from "../renderer/types";
import { shuffleArray } from "../utils/array";
import { RepeatMode, REPEAT_MODES } from "../types/queue";

/** A queue reordered by hand: the mode the user was in before ("normal" or "shuffle"). */
export type CustomOrder = "normal" | "shuffle" | null;

export function useQueue(currentTrack: FileItem | null) {
  const [queue, setQueue] = useState<FileItem[]>([]);

  const [currentIndex, setCurrentIndex] = useState(-1);

  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");

  const [isShuffle, setIsShuffle] = useState(false);

  const [shuffledQueue, setShuffledQueue] = useState<FileItem[]>([]);

  // The queue has three orders: normal (`queue`, never reordered by hand), shuffled and custom.
  // Shuffled and custom both live in `shuffledQueue` (`isShuffle` = that list is playing), so
  // removing and inserting songs keeps working on both lists. Reordering by hand turns the
  // shuffled list (or a copy of the normal one) into the custom order; the shuffle button then
  // goes back to the normal order.
  const [customOrder, setCustomOrder] = useState<CustomOrder>(null);

  const activeQueue = isShuffle ? shuffledQueue : queue;
  const isCustomOrder = customOrder !== null;

  // A new queue (a list played, shuffle play, queue cleared) drops the custom order and goes back
  // to the mode the user was in before. Returns whether that mode is shuffle.
  const resetCustomOrder = (): boolean => {
    if (customOrder === null) return isShuffle;
    const shuffle = customOrder === "shuffle";
    setCustomOrder(null);
    setIsShuffle(shuffle);
    return shuffle;
  };

  // Moves the row at `from` to `to` in the visible queue, which becomes the custom order. The
  // playing song stays the current one wherever it ends up.
  const moveInQueue = (from: number, to: number) => {
    const length = activeQueue.length;
    if (from === to || from < 0 || to < 0 || from >= length || to >= length) return;

    const reordered = [...activeQueue];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setShuffledQueue(reordered);
    if (!isCustomOrder) setCustomOrder(isShuffle ? "shuffle" : "normal");
    setIsShuffle(true);

    if (currentIndex === from) setCurrentIndex(to);
    else if (from < currentIndex && to >= currentIndex) setCurrentIndex(currentIndex - 1);
    else if (from > currentIndex && to <= currentIndex) setCurrentIndex(currentIndex + 1);
  };

  const handleShuffleToggle = () => {
    // From a custom order, the button goes back to the normal order.
    if (isCustomOrder) {
      setCustomOrder(null);
      setIsShuffle(false);
      if (currentTrack) setCurrentIndex(queue.findIndex((t) => t.path === currentTrack.path));
      return;
    }
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

    customOrder,
    setCustomOrder,
    isCustomOrder,
    resetCustomOrder,

    moveInQueue,
    removeFromQueue,
    handleShuffleToggle,
    handleRepeatToggle,
  };
}
