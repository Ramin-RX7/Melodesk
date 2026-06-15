import { useEffect } from "react";

import { FileItem } from "../renderer/types";
import { shuffleArray } from "../utils/array";
import { useAudioPlayer } from "./useAudioPlayer";
import { useQueue } from "./useQueue";


type Props = {
    queueState: ReturnType<typeof useQueue>;
    audioState: ReturnType<typeof useAudioPlayer>;

    currentTrack: FileItem | null;
    setCurrentTrack: (
        track: FileItem | null
    ) => void;
};

export function usePlaybackController({
    queueState,
    audioState,
    currentTrack,
    setCurrentTrack,
}: Props) {
    const {
        queue,
        setQueue,
        currentIndex,
        setCurrentIndex,
        isShuffle,
        shuffledQueue,
        setShuffledQueue,
        activeQueue,
        setIsShuffle,
        repeatMode,
    } = queueState;
    const {
        audioRef,
        setDuration,
        setIsPlaying,
        currentTime,
    } = audioState;

    const playTrack = (track: FileItem, newQueue?: FileItem[]) => {
        setCurrentTrack(track);

        if (newQueue) {
            setQueue(newQueue);
            if (isShuffle) {
                const newShuffled = shuffleArray(newQueue);
                setShuffledQueue(newShuffled);
                setCurrentIndex(newShuffled.findIndex(t => t.path === track.path));
            } else {
                setCurrentIndex(newQueue.findIndex(t => t.path === track.path));
            }
        } else {
            // Just update index in current active queue
            setCurrentIndex(activeQueue.findIndex(t => t.path === track.path));
        }

        if (track.metadata?.duration) {
            setDuration(track.metadata.duration);
        } else {
            setDuration(0);
        }

        if (audioRef.current) {
            const normalizedPath = track.path.replace(/\\/g, "/");
            audioRef.current.src = `media://${encodeURIComponent(normalizedPath)}`;
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleShufflePlay = (songs: FileItem[]) => {
        if (songs.length === 0) return;
        const shuffled = shuffleArray([...songs]);
        const firstSong = shuffled[0];

        setQueue(songs); // Original queue
        setShuffledQueue(shuffled);
        setCurrentIndex(0);
        setIsShuffle(true);

        setCurrentTrack(firstSong);
        if (firstSong.metadata?.duration) setDuration(firstSong.metadata.duration);
        else setDuration(0);

        if (audioRef.current) {
            const normalizedPath = firstSong.path.replace(/\\/g, "/");
            audioRef.current.src = `media://${encodeURIComponent(normalizedPath)}`;
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleNext = () => {
        if (activeQueue.length === 0) return;

        let nextIdx = currentIndex + 1;
        if (nextIdx >= activeQueue.length) {
            if (repeatMode === 'all') {
                nextIdx = 0;
            } else {
                return; // End of queue
            }
        }
        playTrack(activeQueue[nextIdx]);
    };

    const handlePrevious = () => {
        if (activeQueue.length === 0) return;

        // If more than 3 seconds in, restart track
        if (currentTime > 3) {
            if (audioRef.current) audioRef.current.currentTime = 0;
            return;
        }

        let prevIdx = currentIndex - 1;
        if (prevIdx < 0) {
            if (repeatMode === 'all') {
                prevIdx = activeQueue.length - 1;
            } else {
                return; // Start of queue
            }
        }
        playTrack(activeQueue[prevIdx]);
    };


    const handleEnded = () => {
        if (repeatMode === 'one') {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
            }
        } else {
            handleNext();
        }
    };


    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const item = await window.api.getMetadata(file.path);
            if (item && item.isMedia) {
                playTrack(item, [item]);
            }
        }
    };

    useEffect(() => {
        if (!("mediaSession" in navigator)) return;

        navigator.mediaSession.setActionHandler("play", () => {
            audioRef.current?.play();
        });

        navigator.mediaSession.setActionHandler("pause", () => {
            audioRef.current?.pause();
        });

        navigator.mediaSession.setActionHandler("nexttrack", () => {
            handleNext(); // you must provide this
        });

        navigator.mediaSession.setActionHandler("previoustrack", () => {
            handlePrevious(); // you must provide this
        });


        let track = currentTrack;
        if (!track?.metadata?.picture) return;
        const convert = () => {
            const normalized = track.metadata?.picture?.replace(/\\/g, "/");

            fetch(`file://${normalized}`)
                .then((res) => res.blob())
                .then((blob) => {
                    const reader = new FileReader();

                    reader.onloadend = () => {
                        const base64 = reader.result as string;

                        navigator.mediaSession.metadata = new MediaMetadata({
                            title: track.metadata?.title || track.name,
                            artist: track.metadata?.artist || "Unknown",
                            album: track.metadata?.album || "",
                            artwork: [
                                {
                                    src: base64,
                                    sizes: "512x512",
                                    type: "image/png",
                                },
                            ],
                        });
                    };
                    reader.readAsDataURL(blob);
                });
        };
        convert();

    }, [handleNext, handlePrevious]);
    const playNext = (track: FileItem) => {
        if (activeQueue.length === 0) {
            playTrack(track);
            return;
        }
        
        const newQueue = [...queue];
        if (isShuffle) {
            const newShuffled = [...shuffledQueue];
            newShuffled.splice(currentIndex + 1, 0, track);
            setShuffledQueue(newShuffled);
            // Add to end of regular queue so it's kept
            newQueue.push(track);
        } else {
            newQueue.splice(currentIndex + 1, 0, track);
        }
        setQueue(newQueue);
    };

    return {
        playTrack,
        handleShufflePlay,
        handleNext,
        handlePrevious,
        handleEnded,
        handleDrop,
        playNext,
    }
}