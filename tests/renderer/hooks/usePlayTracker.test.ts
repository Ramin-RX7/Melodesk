import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlayTracker } from "../../../src/hooks/usePlayTracker";
import { FileItem } from "../../../src/renderer/types";
import { fakeApi } from "../../helpers/api";
import { fire, playTo, setMedia } from "../../helpers/audio";
import { song } from "../../helpers/songs";

const setup = (track: FileItem | null, threshold = 50) => {
  const audio = document.createElement("audio");
  const ref = { current: audio };
  const hook = renderHook(({ t, p }) => usePlayTracker(ref, t, p), {
    initialProps: { t: track, p: threshold },
  });
  return { audio, ...hook };
};

/** Plays from `from` to `to` in small steps, like real playback. */
const listen = (audio: HTMLAudioElement, from: number, to: number, step = 0.25) => {
  for (let t = from + step; t <= to + 1e-9; t += step) playTo(audio, Math.round(t * 100) / 100);
};

const recorded = () => fakeApi().recordPlay.mock.calls.map(([hash]) => hash);

describe("usePlayTracker", () => {
  it("records a play once the threshold share was listened to", () => {
    const track = song({ duration: 20 });
    const { audio } = setup(track, 50);
    listen(audio, 0, 9.5);
    expect(recorded()).toEqual([]);
    listen(audio, 9.5, 10.5);
    expect(recorded()).toEqual([track.hash]);
  });

  it("records it only once per listen", () => {
    const track = song({ duration: 10 });
    const { audio } = setup(track, 50);
    listen(audio, 0, 10);
    expect(recorded()).toHaveLength(1);
  });

  it("doesn't count jumps forward (seeks)", () => {
    const track = song({ duration: 20 });
    const { audio } = setup(track, 50);
    listen(audio, 0, 2);
    playTo(audio, 18, "seeked");
    listen(audio, 18, 20);
    // Big jumps reported as timeupdate don't count either.
    playTo(audio, 5);
    playTo(audio, 15);
    expect(recorded()).toEqual([]);
  });

  it("doesn't count moving backwards", () => {
    const track = song({ duration: 20 });
    const { audio } = setup(track, 50);
    listen(audio, 5, 9);
    playTo(audio, 6, "seeked");
    listen(audio, 6, 9);
    expect(recorded()).toEqual([]);
    // 3.75 s + 3 s so far; listening on to 13 s passes the 10 s needed.
    listen(audio, 9, 13);
    expect(recorded()).toEqual([track.hash]);
  });

  it("uses the element's duration when the song has no length in its tags", () => {
    const track = song({ duration: undefined });
    const { audio } = setup(track, 50);
    listen(audio, 0, 3);
    expect(recorded()).toEqual([]);
    setMedia(audio, { duration: 8 });
    listen(audio, 3, 4.5);
    expect(recorded()).toEqual([track.hash]);
  });

  it("never records a song without an id", () => {
    const track = { ...song({ duration: 4 }), hash: undefined };
    const { audio } = setup(track, 50);
    listen(audio, 0, 4);
    expect(recorded()).toEqual([]);
  });

  it("seeking back to the start counts the song again", () => {
    const track = song({ duration: 4 });
    const { audio } = setup(track, 50);
    listen(audio, 0, 3);
    playTo(audio, 0.5, "seeked");
    listen(audio, 0.5, 3);
    expect(recorded()).toEqual([track.hash, track.hash]);
  });

  it("the same song loaded again counts again", () => {
    const track = song({ duration: 4 });
    const { audio } = setup(track, 50);
    listen(audio, 0, 3);
    fire(audio, "loadstart");
    audio.currentTime = 0;
    listen(audio, 0, 3);
    expect(recorded()).toHaveLength(2);
  });

  it("a moved song reloading from its new path continues the same listen", () => {
    const track = song({ duration: 10 });
    const { audio } = setup(track, 50);
    listen(audio, 0, 3);
    audio.dataset.relocating = "true";
    fire(audio, "loadstart");
    expect(audio.dataset.relocating).toBeUndefined();
    listen(audio, 3, 5.25);
    expect(recorded()).toEqual([track.hash]);
  });

  it("a refreshed song object with the same id keeps the listen", () => {
    const track = song({ duration: 10 });
    const { audio, rerender } = setup(track, 50);
    listen(audio, 0, 3);
    rerender({ t: { ...track, metadata: { ...track.metadata, title: "Renamed" } }, p: 50 });
    listen(audio, 3, 5.25);
    expect(recorded()).toEqual([track.hash]);
  });

  it("a different song starts a new listen", () => {
    const first = song({ duration: 10 });
    const second = song({ duration: 10 });
    const { audio, rerender } = setup(first, 50);
    listen(audio, 0, 3);
    audio.currentTime = 0;
    rerender({ t: second, p: 50 });
    listen(audio, 0, 3);
    expect(recorded()).toEqual([]);
  });

  it("follows the threshold setting", () => {
    const track = song({ duration: 100 });
    const { audio } = setup(track, 10);
    listen(audio, 0, 10.25);
    expect(recorded()).toEqual([track.hash]);
  });
});
