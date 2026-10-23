import { useRef, useState, useEffect } from "react";

import { UserConfig } from "../renderer/types";

const SEEK_AMOUNT = 5;

export function useAudioPlayer(config: UserConfig | null, setConfig: (config: UserConfig) => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  // The playback position isn't kept here (see useAudioTime): updating it ~4 times a second
  // would re-render the whole app.

  const [duration, setDuration] = useState(0);

  // play() rejects with an AbortError when a newer src interrupts it (harmless). Any other
  // rejection means nothing is playing; load failures are reported via the element's error event.
  const startPlayback = () => {
    if (!audioRef.current) return;
    setIsPlaying(true);
    audioRef.current.play().catch((error) => {
      if (error?.name !== "AbortError") setIsPlaying(false);
    });
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      startPlayback();
    }
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = time;
  };

  const seekForward = () => {
    if (!audioRef.current) return;

    handleSeek(
      Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + SEEK_AMOUNT),
    );
  };

  const seekBackward = () => {
    if (!audioRef.current) return;

    handleSeek(Math.max(0, audioRef.current.currentTime - SEEK_AMOUNT));
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;

    const audioDuration = audioRef.current.duration;

    if (isFinite(audioDuration) && audioDuration > 0) {
      setDuration(audioDuration);
    }
  };

  // While the volume slider moves: change what you hear, without saving anything.
  const previewVolume = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // When the slider is released: save the volume (one config write per adjustment).
  const commitVolume = async (newVolume: number) => {
    previewVolume(newVolume);
    if (config && config.volume !== newVolume) {
      const newConfig = await window.api.updateConfig({ volume: newVolume });
      setConfig(newConfig);
    }
  };

  const savedVolume = config?.volume;
  useEffect(() => {
    if (savedVolume !== undefined && audioRef.current) {
      audioRef.current.volume = savedVolume;
    }
  }, [savedVolume]);

  return {
    audioRef,

    isPlaying,
    duration,

    setDuration,
    setIsPlaying,

    startPlayback,
    togglePlay,

    handleSeek,
    seekForward,
    seekBackward,

    handleLoadedMetadata,
    previewVolume,
    commitVolume,
  };
}
