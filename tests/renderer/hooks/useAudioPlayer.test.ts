import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAudioPlayer } from "../../../src/hooks/useAudioPlayer";
import { UserConfig } from "../../../src/renderer/types";
import { fakeApi } from "../../helpers/api";
import { rejectNextPlay, setMedia } from "../../helpers/audio";
import { makeConfig } from "../../helpers/songs";

const setup = (config: UserConfig | null = makeConfig()) => {
  const setConfig = vi.fn();
  const audio = document.createElement("audio");
  const hook = renderHook(({ c }) => useAudioPlayer(c, setConfig), {
    initialProps: { c: config },
  });
  act(() => void (hook.result.current.audioRef.current = audio));
  hook.rerender({ c: config });
  return { audio, setConfig, ...hook };
};

describe("useAudioPlayer", () => {
  it("startPlayback shows 'playing' and starts the element", async () => {
    const { result, audio } = setup();
    act(() => result.current.startPlayback());
    expect(result.current.isPlaying).toBe(true);
    expect(audio.play).toHaveBeenCalled();
  });

  it("keeps 'playing' when a newer song interrupted play() (AbortError)", async () => {
    const { result } = setup();
    rejectNextPlay("AbortError");
    await act(async () => result.current.startPlayback());
    expect(result.current.isPlaying).toBe(true);
  });

  it("shows 'not playing' when play() fails for another reason", async () => {
    const { result } = setup();
    rejectNextPlay("NotAllowedError");
    act(() => result.current.startPlayback());
    await waitFor(() => expect(result.current.isPlaying).toBe(false));
  });

  it("togglePlay pauses and plays", () => {
    const { result, audio } = setup();
    act(() => result.current.togglePlay());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.togglePlay());
    expect(result.current.isPlaying).toBe(false);
    expect(audio.pause).toHaveBeenCalled();
  });

  it("seeks 5 seconds, within the song", () => {
    const { result, audio } = setup();
    setMedia(audio, { duration: 12, currentTime: 3 });
    act(() => result.current.seekForward());
    expect(audio.currentTime).toBe(8);
    act(() => result.current.seekForward());
    expect(audio.currentTime).toBe(12);
    act(() => result.current.handleSeek(2));
    act(() => result.current.seekBackward());
    expect(audio.currentTime).toBe(0);
  });

  it("takes the duration from the element only when it's a real length", () => {
    const { result, audio } = setup();
    setMedia(audio, { duration: Infinity });
    act(() => result.current.handleLoadedMetadata());
    expect(result.current.duration).toBe(0);
    setMedia(audio, { duration: 187.5 });
    act(() => result.current.handleLoadedMetadata());
    expect(result.current.duration).toBe(187.5);
  });

  it("moving the volume slider changes only what you hear", () => {
    const { result, audio } = setup();
    act(() => result.current.previewVolume(0.2));
    expect(audio.volume).toBe(0.2);
    expect(fakeApi().updateConfig).not.toHaveBeenCalled();
  });

  it("releasing the slider saves the volume once, only when it changed", async () => {
    const { result, setConfig } = setup(makeConfig({ volume: 0.5 }));
    await act(() => result.current.commitVolume(0.5));
    expect(fakeApi().updateConfig).not.toHaveBeenCalled();

    await act(() => result.current.commitVolume(0.8));
    expect(fakeApi().updateConfig).toHaveBeenCalledExactlyOnceWith({ volume: 0.8 });
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ volume: 0.8 }));
  });

  it("applies the saved volume to the element once the settings load, and when it changes", () => {
    const { audio, rerender } = setup(null);
    rerender({ c: makeConfig({ volume: 0.3 }) });
    expect(audio.volume).toBe(0.3);
    rerender({ c: makeConfig({ volume: 0.7 }) });
    expect(audio.volume).toBe(0.7);
  });

  it("does nothing before the element exists", () => {
    const { result } = renderHook(() => useAudioPlayer(makeConfig(), () => {}));
    act(() => {
      result.current.startPlayback();
      result.current.togglePlay();
      result.current.seekForward();
    });
    expect(result.current.isPlaying).toBe(false);
  });
});
