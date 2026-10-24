import { useEffect, useRef } from "react";

import { AppNotification, FileItem, UserConfig } from "../renderer/types";
import { shuffleArray } from "../utils/array";
import { useAudioPlayer } from "./useAudioPlayer";
import { useQueue } from "./useQueue";

type Props = {
  config: UserConfig | null;
  queueState: ReturnType<typeof useQueue>;
  audioState: ReturnType<typeof useAudioPlayer>;

  currentTrack: FileItem | null;
  setCurrentTrack: (track: FileItem | null) => void;
  notify: (notification: AppNotification) => void;
};

export function usePlaybackController({
  config,
  queueState,
  audioState,
  currentTrack,
  setCurrentTrack,
  notify,
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
    removeFromQueue,
    repeatMode,
  } = queueState;
  const { audioRef, isPlaying, setDuration, setIsPlaying, startPlayback } = audioState;

  const playTrack = (track: FileItem, newQueue?: FileItem[], explicitIndex?: number) => {
    setCurrentTrack(track);

    if (newQueue) {
      // The list becomes the queue. With shuffle on, the chosen song plays first and the rest
      // of the list (songs before and after it) follows in random order.
      setQueue(newQueue);
      const index = explicitIndex ?? newQueue.findIndex((t) => t.path === track.path);
      if (isShuffle) {
        const rest = newQueue.filter((_, i) => i !== index);
        setShuffledQueue([track, ...shuffleArray(rest)]);
        setCurrentIndex(0);
      } else {
        setCurrentIndex(index);
      }
    } else if (explicitIndex !== undefined) {
      setCurrentIndex(explicitIndex);
    } else {
      // Just update index in current active queue
      setCurrentIndex(activeQueue.findIndex((t) => t.path === track.path));
    }

    if (track.metadata?.duration) {
      setDuration(track.metadata.duration);
    } else {
      setDuration(0);
    }

    if (audioRef.current) {
      const normalizedPath = track.path.replace(/\\/g, "/");
      audioRef.current.src = `media://${encodeURIComponent(normalizedPath)}`;
      startPlayback();
    }
  };

  // The loaded song's file was moved or renamed: load it from its new path and carry on from the
  // same position. The play tracker keeps counting it as the same listen (data-relocating).
  const relocateCurrent = (fromPath: string, toPath: string) => {
    const audio = audioRef.current;
    if (!audio || loadedFilePath() !== fromPath.replace(/\\/g, "/")) return;
    const position = audio.currentTime;
    const wasPlaying = !audio.paused;
    audio.dataset.relocating = "true";
    audio.src = `media://${encodeURIComponent(toPath.replace(/\\/g, "/"))}`;
    audio.addEventListener(
      "loadedmetadata",
      () => {
        audio.currentTime = position;
        if (wasPlaying) startPlayback();
      },
      { once: true },
    );
  };

  // Path of the file the <audio> element is loading, or null when no song is loaded.
  const loadedFilePath = (): string | null => {
    const src = audioRef.current?.getAttribute("src");
    return src?.startsWith("media://") ? decodeURIComponent(src.slice("media://".length)) : null;
  };

  const displayName = (filePath: string) =>
    currentTrack?.path.replace(/\\/g, "/") === filePath
      ? currentTrack.metadata?.title || currentTrack.name
      : filePath.split("/").pop();

  // Songs skipped in a row because they couldn't be played; reset once a song really plays.
  // Stops the skipping when every song in the queue fails (e.g. with repeat-all on).
  const skippedInARowRef = useRef(0);

  // A song that can't be played (moved/deleted, or damaged/unsupported) stays in the queue but
  // is skipped, with a toast saying why. A missing file also triggers a library rescan. If
  // nothing was meant to be playing (e.g. a restored session's song is gone), only tell the user.
  const handleUnplayable = (filePath: string, missing: boolean, wasPlaying: boolean) => {
    const name = displayName(filePath);
    const reason = missing
      ? "the file wasn't found (moved or deleted?)"
      : "the file couldn't be played (damaged or unsupported format)";
    if (missing) window.api.refreshLibrary();

    const { handleNext, queueLength } = mediaActionsRef.current;
    if (!wasPlaying) {
      notify({ level: "error", message: `Can't play "${name}": ${reason}.` });
      return;
    }
    skippedInARowRef.current++;
    if (skippedInARowRef.current >= queueLength) {
      skippedInARowRef.current = 0;
      notify({
        level: "error",
        message: `Stopped: none of the songs in the queue could be played. Last one: "${name}" — ${reason}.`,
      });
      return;
    }
    notify({ level: "error", message: `Skipped "${name}": ${reason}.` });
    handleNext();
  };

  // The <audio> element failed to load its source.
  const handleAudioError = async () => {
    const filePath = loadedFilePath();
    if (!filePath) return; // src was cleared on purpose
    const wasPlaying = mediaActionsRef.current.isPlaying;
    setIsPlaying(false);
    const missing = !(await window.api.fileExists(filePath));
    handleUnplayable(filePath, missing, wasPlaying);
  };

  // Every play attempt (button, keys, media keys, next/previous, repeat) fires the element's
  // "play" event. If the file vanished after it was loaded, Chromium keeps retrying the request
  // without ever firing "error", so check here and stop the element ourselves.
  const handleAudioPlay = async () => {
    setIsPlaying(true);
    const filePath = loadedFilePath();
    if (!filePath || (await window.api.fileExists(filePath))) return;

    const audio = audioRef.current;
    if (!audio || loadedFilePath() !== filePath) return; // another song started meanwhile
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setIsPlaying(false);
    handleUnplayable(filePath, true, true);
  };

  // Playback actually started (data is flowing), so the skip streak is over.
  const handleAudioPlaying = () => {
    skippedInARowRef.current = 0;
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
      startPlayback();
    }
  };

  const handleNext = () => {
    if (activeQueue.length === 0) return;

    let nextIdx = currentIndex + 1;
    if (nextIdx >= activeQueue.length) {
      if (repeatMode === "all") {
        nextIdx = 0;
      } else {
        return; // End of queue
      }
    }
    playTrack(activeQueue[nextIdx], undefined, nextIdx);
  };

  const handlePrevious = () => {
    if (activeQueue.length === 0) return;

    // If more than 3 seconds in, restart track
    if ((audioRef.current?.currentTime ?? 0) > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }

    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      if (repeatMode === "all") {
        prevIdx = activeQueue.length - 1;
      } else {
        return; // Start of queue
      }
    }
    playTrack(activeQueue[prevIdx], undefined, prevIdx);
  };

  const handleEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        startPlayback();
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
      const item = await window.api.getMetadata(window.api.getPathForFile(file));
      if (item && item.isMedia) {
        playTrack(item, [item]);
      }
    }
  };

  // OS media controls (Windows media overlay, media keys, lock screen). Registered once; the ref
  // makes them call the latest handlers.
  // Latest handlers/state for callbacks that run later (OS media keys, async error handling).
  const latestActions = () => ({
    startPlayback,
    handleNext,
    handlePrevious,
    isPlaying,
    queueLength: activeQueue.length,
  });
  const mediaActionsRef = useRef(latestActions());
  mediaActionsRef.current = latestActions();

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.setActionHandler("play", () => mediaActionsRef.current.startPlayback());
    session.setActionHandler("pause", () => audioRef.current?.pause());
    session.setActionHandler("nexttrack", () => mediaActionsRef.current.handleNext());
    session.setActionHandler("previoustrack", () => mediaActionsRef.current.handlePrevious());
  }, [audioRef]);

  // Song info shown by the OS: set as soon as the song changes (so it's never stale, even for
  // songs without cover art); the cover is added once it has been read.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const meta = currentTrack.metadata;
    const info = {
      title: meta?.title || currentTrack.name,
      artist: meta?.artists?.join(", ") || meta?.artist || "Unknown artist",
      album: meta?.album || "",
    };
    navigator.mediaSession.metadata = new MediaMetadata(info);
    if (!meta?.picture) return;

    let active = true;
    fetch(`media://${encodeURIComponent(meta.picture.replace(/\\/g, "/"))}`)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }),
      )
      .then((dataUrl) => {
        if (active) {
          navigator.mediaSession.metadata = new MediaMetadata({
            ...info,
            artwork: [{ src: dataUrl, sizes: "512x512" }],
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentTrack]);
  const playNext = (track: FileItem) => {
    if (activeQueue.length === 0) {
      playTrack(track, [track]);
      return;
    }

    const newQueue = [...queue];
    if (isShuffle) {
      const newShuffled = [...shuffledQueue];
      newShuffled.splice(currentIndex + 1, 0, track);
      setShuffledQueue(newShuffled);
      newQueue.push(track);
    } else {
      newQueue.splice(currentIndex + 1, 0, track);
    }
    setQueue(newQueue);
  };

  // Insert a track right after the current one and immediately play it. Used
  // by the global search where clicking a result should jump to it without
  // discarding the existing queue.
  const playNextAndPlay = (track: FileItem) => {
    if (activeQueue.length === 0) {
      playTrack(track, [track]);
      return;
    }

    const insertAt = currentIndex + 1;
    if (isShuffle) {
      const newShuffled = [...shuffledQueue];
      newShuffled.splice(insertAt, 0, track);
      setShuffledQueue(newShuffled);
      setQueue([...queue, track]);
    } else {
      const newQueue = [...queue];
      newQueue.splice(insertAt, 0, track);
      setQueue(newQueue);
    }
    playTrack(track, undefined, insertAt);
  };

  const playNextMultiple = (tracks: FileItem[]) => {
    if (tracks.length === 0) return;
    if (activeQueue.length === 0) {
      playTrack(tracks[0], tracks);
      return;
    }

    const newQueue = [...queue];
    if (isShuffle) {
      const newShuffled = [...shuffledQueue];
      newShuffled.splice(currentIndex + 1, 0, ...tracks);
      setShuffledQueue(newShuffled);
      newQueue.push(...tracks);
    } else {
      newQueue.splice(currentIndex + 1, 0, ...tracks);
    }
    setQueue(newQueue);
  };

  const handleRemoveFromQueue = (index: number) => {
    if (index !== currentIndex) {
      removeFromQueue(index);
      return;
    }

    const behavior = config?.removeCurrentSongBehavior ?? "prevent";
    if (behavior === "prevent") return;

    // "play-next": remove current song and play what comes next
    const newActiveQueue = activeQueue.filter((_, i) => i !== index);
    const nextIndex = Math.min(index, newActiveQueue.length - 1);
    const nextTrack = nextIndex >= 0 ? newActiveQueue[nextIndex] : null;

    removeFromQueue(index);

    if (nextTrack) {
      playTrack(nextTrack, undefined, nextIndex);
    } else {
      setCurrentTrack(null);
      setCurrentIndex(-1);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setIsPlaying(false);
    }
  };

  return {
    playTrack,
    handleShufflePlay,
    handleNext,
    handlePrevious,
    handleEnded,
    handleDrop,
    playNext,
    playNextAndPlay,
    playNextMultiple,
    handleRemoveFromQueue,
    handleAudioError,
    handleAudioPlay,
    handleAudioPlaying,
    relocateCurrent,
  };
}
