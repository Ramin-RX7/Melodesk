import { RefObject, useEffect, useState } from "react";

// Current playback position of the <audio> element. Kept out of App state on purpose: it changes
// about 4 times a second, so only the component that displays it (the playback bar) re-renders.
export function useAudioTime(audioRef: RefObject<HTMLAudioElement | null>): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setTime(audio.currentTime || 0);
    const events = ["timeupdate", "seeked", "loadedmetadata", "emptied"];
    events.forEach((e) => audio.addEventListener(e, update));
    update();
    return () => events.forEach((e) => audio.removeEventListener(e, update));
  }, [audioRef]);

  return time;
}
