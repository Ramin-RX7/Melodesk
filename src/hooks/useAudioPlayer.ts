import { useRef, useState, useEffect } from "react";

const SEEK_AMOUNT = 5;

export function useAudioPlayer(config: any, setConfig: (config: any) => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);

  const [duration, setDuration] = useState(0);

  const [isShuffle, setIsShuffle] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }

    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = time;

    setCurrentTime(time);
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

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;

    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;

    const audioDuration = audioRef.current.duration;

    if (isFinite(audioDuration) && audioDuration > 0) {
      setDuration(audioDuration);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (config) {
      const newConfig = await window.api.updateConfig({ volume: newVolume });
      setConfig(newConfig);
    }
  };

  useEffect(() => {
    if (config && audioRef.current) {
      audioRef.current.volume = config.volume;
    }
  }, [config]);

  return {
    audioRef,

    isPlaying,
    currentTime,
    duration,

    setDuration,
    setIsPlaying,

    togglePlay,

    handleSeek,
    seekForward,
    seekBackward,

    handleTimeUpdate,
    handleLoadedMetadata,
    handleVolumeChange,
  };
}
