import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useArtistPictures } from "../../../src/hooks/useArtistPictures";
import { useAudioTime } from "../../../src/hooks/useAudioTime";
import { useLibrary } from "../../../src/hooks/useLibrary";
import { useLibraryScanStatus } from "../../../src/hooks/useLibraryScanStatus";
import { usePlaybackPositionSaver } from "../../../src/hooks/usePlaybackPosition";
import { fakeApi, installApi } from "../../helpers/api";
import { fire, playTo, setMedia } from "../../helpers/audio";
import { song } from "../../helpers/songs";

/** A promise to resolve later, for answers that arrive after unmounting. */
const later = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe("useAudioTime", () => {
  it("follows the element's position", () => {
    const audio = document.createElement("audio");
    audio.currentTime = 7;
    const { result } = renderHook(() => useAudioTime({ current: audio }));
    expect(result.current).toBe(7);

    act(() => playTo(audio, 8));
    expect(result.current).toBe(8);
    act(() => playTo(audio, 30, "seeked"));
    expect(result.current).toBe(30);
    act(() => playTo(audio, 0, "emptied"));
    expect(result.current).toBe(0);
  });
});

describe("usePlaybackPositionSaver", () => {
  const setup = (enabled = true) => {
    vi.useFakeTimers();
    const audio = document.createElement("audio");
    audio.src = "media://song.mp3";
    const hook = renderHook(({ on }) => usePlaybackPositionSaver({ current: audio }, on), {
      initialProps: { on: enabled },
    });
    return { audio, saved: () => fakeApi().savePlaybackPosition.mock.calls.flat(), ...hook };
  };

  it("saves the position every 10 seconds while playing, not while paused", () => {
    const { audio, saved } = setup();
    setMedia(audio, { paused: false, currentTime: 12 });
    vi.advanceTimersByTime(10_000);
    expect(saved()).toEqual([12]);
    setMedia(audio, { paused: true });
    vi.advanceTimersByTime(30_000);
    expect(saved()).toEqual([12]);
  });

  it("saves on pause and when the window closes", () => {
    const { audio, saved } = setup();
    audio.currentTime = 33;
    fire(audio, "pause");
    window.dispatchEvent(new Event("beforeunload"));
    expect(saved()).toEqual([33, 33]);
  });

  it("saves nothing when no song is loaded, or when restoring the session is off", () => {
    const { audio, saved, rerender } = setup();
    audio.removeAttribute("src");
    fire(audio, "pause");
    expect(saved()).toEqual([]);

    audio.src = "media://song.mp3";
    rerender({ on: false });
    fire(audio, "pause");
    window.dispatchEvent(new Event("beforeunload"));
    expect(saved()).toEqual([]);
  });

  it("stops when unmounted", () => {
    const { audio, saved, unmount } = setup();
    unmount();
    setMedia(audio, { paused: false });
    vi.advanceTimersByTime(20_000);
    fire(audio, "pause");
    expect(saved()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useLibrary", () => {
  it("replaces the library when the main process sends a new one", () => {
    const setAllTracks = vi.fn();
    const { unmount } = renderHook(() => useLibrary(setAllTracks, vi.fn(), null));
    const files = [song()];
    fakeApi().emit.libraryUpdated(files);
    expect(setAllTracks).toHaveBeenCalledWith(files);
    unmount();
    expect(fakeApi().emit.count("libraryUpdated")).toBe(0);
  });

  it("loads the folder tree only when a folder is open", async () => {
    const tree = [song()];
    installApi({ getDirectoryTree: async () => tree });
    const setTree = vi.fn();
    const { rerender } = renderHook(({ path }) => useLibrary(vi.fn(), setTree, path), {
      initialProps: { path: null as string | null },
    });
    expect(fakeApi().getDirectoryTree).not.toHaveBeenCalled();
    rerender({ path: "C:\\Music" });
    await waitFor(() => expect(setTree).toHaveBeenCalledWith(tree));
    expect(fakeApi().getDirectoryTree).toHaveBeenCalledWith("C:\\Music");
  });
});

describe("useLibraryScanStatus", () => {
  it("starts from the current status, then follows events", async () => {
    installApi({
      getLibraryScanStatus: async () => ({ scanning: true, processed: 3, total: 10 }),
    });
    const { result } = renderHook(() => useLibraryScanStatus());
    await waitFor(() => expect(result.current.processed).toBe(3));
    act(() => fakeApi().emit.libraryScanStatus({ scanning: true, processed: 9, total: 10 }));
    expect(result.current).toEqual({ scanning: true, processed: 9, total: 10 });
  });

  it("ignores a status that arrives after unmounting", async () => {
    const status = later<{ scanning: boolean; processed: number; total: number }>();
    installApi({ getLibraryScanStatus: () => status.promise });
    const error = vi.spyOn(console, "error");
    const { result, unmount } = renderHook(() => useLibraryScanStatus());
    unmount();
    await act(async () => status.resolve({ scanning: true, processed: 1, total: 2 }));
    expect(result.current.scanning).toBe(false);
    expect(fakeApi().emit.count("libraryScanStatus")).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });
});

describe("useArtistPictures", () => {
  it("loads every artist picture once and updates one locally", async () => {
    installApi({ getArtistPictures: async () => ({ Alpha: "C:\\art\\a.png" }) });
    const { result } = renderHook(() => useArtistPictures());
    await waitFor(() => expect(result.current.artistPictures).toEqual({ Alpha: "C:\\art\\a.png" }));
    act(() => result.current.setArtistPicture("Beta", "C:\\art\\b.png"));
    expect(result.current.artistPictures).toEqual({
      Alpha: "C:\\art\\a.png",
      Beta: "C:\\art\\b.png",
    });
    expect(fakeApi().getArtistPictures).toHaveBeenCalledTimes(1);
  });

  it("ignores pictures that arrive after unmounting", async () => {
    const pictures = later<Record<string, string>>();
    installApi({ getArtistPictures: () => pictures.promise });
    const { result, unmount } = renderHook(() => useArtistPictures());
    unmount();
    await act(async () => pictures.resolve({ Alpha: "x" }));
    expect(result.current.artistPictures).toEqual({});
  });
});
