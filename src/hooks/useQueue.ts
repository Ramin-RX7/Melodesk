import { useState } from "react";

import { FileItem } from "../renderer/types";
import { shuffleArray } from "../utils/array";
import { RepeatMode, REPEAT_MODES } from "../types/queue";


export function useQueue(currentTrack: FileItem | null) {
    const [queue, setQueue] = useState<FileItem[]>([]);

    const [currentIndex, setCurrentIndex] =
        useState(-1);

    const [repeatMode, setRepeatMode] =
        useState<RepeatMode>("none");

    const [isShuffle, setIsShuffle] =
        useState(false);

    const [shuffledQueue, setShuffledQueue] =
        useState<FileItem[]>([]);

    const activeQueue = isShuffle
        ? shuffledQueue
        : queue;


    const handleShuffleToggle = () => {
        if (!currentTrack) {
        setIsShuffle((prev) => !prev);
        return
        };
        if (!isShuffle) {
        // Remove current track from queue before shuffling, Shuffle remaining tracks, Put current track first
        const remainingTracks = queue.filter(
            (t) => t.path !== currentTrack.path
        );
        const shuffledRemaining = shuffleArray(remainingTracks);
        const newShuffled = [currentTrack, ...shuffledRemaining];
        setShuffledQueue(newShuffled);
        setCurrentIndex(0);
        } else {
        // Restore original queue position
        const originalIdx = queue.findIndex(
            (t) => t.path === currentTrack.path
        );
        setCurrentIndex(originalIdx);
        }
        setIsShuffle((prev) => !prev);
    };


    const handleRepeatToggle = () => {
        const currentIndex =
        REPEAT_MODES.indexOf(repeatMode);
        const nextMode =
        REPEAT_MODES[
            (currentIndex + 1) %
            REPEAT_MODES.length
        ];
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

        handleShuffleToggle,
        handleRepeatToggle,
    };
}