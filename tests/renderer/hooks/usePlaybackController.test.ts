import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAudioPlayer } from "../../../src/hooks/useAudioPlayer";
import { usePlaybackController } from "../../../src/hooks/usePlaybackController";
import { useQueue } from "../../../src/hooks/useQueue";
import { AppNotification, FileItem, UserConfig } from "../../../src/renderer/types";
import { fakeApi } from "../../helpers/api";
import { fire, setMedia, stubMediaSession } from "../../helpers/audio";
import { makeConfig, mediaUrl, song } from "../../helpers/songs";

// The controller with the real queue and audio hooks, as App.tsx wires them.
function usePlayer(config: UserConfig, notify: (n: AppNotification) => void) {
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const audioState = useAudioPlayer(config, () => {});
  const queueState = useQueue(currentTrack);
  const controller = usePlaybackController({
    config,
    queueState,
    audioState,
    currentTrack,
    setCurrentTrack,
    notify,
  });
  return { currentTrack, queueState, audioState, ...controller };
}

const setup = (config: Partial<UserConfig> = {}) => {
  const notify = vi.fn<(n: AppNotification) => void>();
  const audio = document.createElement("audio");
  const hook = renderHook(() => usePlayer(makeConfig(config), notify));
  hook.result.current.audioState.audioRef.current = audio;
  const player = () => hook.result.current;
  const run = (fn: (p: ReturnType<typeof player>) => unknown) => act(() => void fn(player()));
  const playing = () => player().currentTrack;
  return { audio, notify, player, run, playing, ...hook };
};

const [a, b, c, d] = [song(), song(), song(), song()];

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

describe("playTrack", () => {
  it("loads the song through media:// with forward slashes and starts playing", async () => {
    const { audio, run, player } = setup();
    const track = song({ path: "C:\\Music\\Rock & Roll\\a #1.mp3", duration: 200 });
    run((p) => p.playTrack(track, [track]));

    expect(audio.getAttribute("src")).toBe(mediaUrl(track.path));
    expect(audio.getAttribute("src")).toContain("C%3A%2FMusic%2FRock%20%26%20Roll%2Fa%20%231.mp3");
    expect(audio.play).toHaveBeenCalled();
    expect(player().audioState.isPlaying).toBe(true);
    expect(player().audioState.duration).toBe(200);
  });

  it("makes the list the queue and plays the song at its place", () => {
    const { run, player, playing } = setup();
    run((p) => p.playTrack(c, [a, b, c, d]));
    expect(player().queueState.queue).toEqual([a, b, c, d]);
    expect(player().queueState.currentIndex).toBe(2);
    expect(playing()).toBe(c);
  });

  it("plays the chosen copy of a repeated song", () => {
    const { run, player } = setup();
    run((p) => p.playTrack(a, [a, b, a], 2));
    expect(player().queueState.currentIndex).toBe(2);
  });

  it("with shuffle on, plays the chosen song first and the rest of the list after it", () => {
    const { run, player, playing } = setup();
    run((p) => p.queueState.setIsShuffle(true));
    run((p) => p.playTrack(c, [a, b, c, d]));

    const { shuffledQueue, currentIndex, queue } = player().queueState;
    expect(playing()).toBe(c);
    expect(currentIndex).toBe(0);
    expect(shuffledQueue[0]).toBe(c);
    expect([...shuffledQueue].sort((x, y) => x.path.localeCompare(y.path))).toEqual(
      [a, b, c, d].sort((x, y) => x.path.localeCompare(y.path)),
    );
    expect(queue).toEqual([a, b, c, d]);
  });

  it("without a list, plays the song inside the current queue", () => {
    const { run, player } = setup();
    run((p) => p.playTrack(a, [a, b, c]));
    run((p) => p.playTrack(c));
    expect(player().queueState.currentIndex).toBe(2);
    expect(player().queueState.queue).toEqual([a, b, c]);
  });

  it("uses duration 0 for a song without a known length", () => {
    const { run, player } = setup();
    const untagged = song({ duration: undefined });
    run((p) => p.playTrack(untagged, [untagged]));
    expect(player().audioState.duration).toBe(0);
  });
});

describe("next, previous and the end of a song", () => {
  it("next stops at the end of the queue unless repeat is 'all'", () => {
    const { run, player, playing } = setup();
    run((p) => p.playTrack(b, [a, b]));
    run((p) => p.handleNext());
    expect(playing()).toBe(b);

    run((p) => p.queueState.setRepeatMode("all"));
    run((p) => p.handleNext());
    expect(playing()).toBe(a);
    expect(player().queueState.currentIndex).toBe(0);
  });

  it("next goes through a queue with a repeated song in order", () => {
    const { run, player } = setup();
    run((p) => p.playTrack(a, [a, b, a, c], 0));
    const order = [player().queueState.currentIndex];
    for (let i = 0; i < 3; i++) {
      run((p) => p.handleNext());
      order.push(player().queueState.currentIndex);
    }
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it("previous goes back through a queue with a repeated song in order", () => {
    const { run, player } = setup();
    run((p) => p.playTrack(c, [a, b, a, c], 3));
    const order = [player().queueState.currentIndex];
    for (let i = 0; i < 3; i++) {
      run((p) => p.handlePrevious());
      order.push(player().queueState.currentIndex);
    }
    expect(order).toEqual([3, 2, 1, 0]);
  });

  it("previous restarts the song when more than 3 seconds in", () => {
    const { run, audio, playing } = setup();
    run((p) => p.playTrack(b, [a, b]));
    setMedia(audio, { duration: 100, currentTime: 10 });
    run((p) => p.handlePrevious());
    expect(playing()).toBe(b);
    expect(audio.currentTime).toBe(0);
  });

  it("previous stops at the start unless repeat is 'all'", () => {
    const { run, playing } = setup();
    run((p) => p.playTrack(a, [a, b, c]));
    run((p) => p.handlePrevious());
    expect(playing()).toBe(a);

    run((p) => p.queueState.setRepeatMode("all"));
    run((p) => p.handlePrevious());
    expect(playing()).toBe(c);
  });

  it("next and previous do nothing with an empty queue", () => {
    const { run, playing } = setup();
    run((p) => p.handleNext());
    run((p) => p.handlePrevious());
    expect(playing()).toBeNull();
  });

  it("at the end of a song: repeat 'one' plays it again, otherwise the next song plays", () => {
    const { run, audio, playing } = setup();
    run((p) => p.playTrack(a, [a, b]));
    run((p) => p.queueState.setRepeatMode("one"));
    setMedia(audio, { duration: 100, currentTime: 100 });
    vi.mocked(audio.play).mockClear();
    run((p) => p.handleEnded());
    expect(playing()).toBe(a);
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(1);

    run((p) => p.queueState.setRepeatMode("none"));
    run((p) => p.handleEnded());
    expect(playing()).toBe(b);
  });
});

describe("changing the queue", () => {
  it("playing a new list drops the custom order and goes back to the earlier mode", () => {
    const { run, player } = setup();
    run((p) => p.playTrack(a, [a, b, c]));
    run((p) => p.queueState.moveInQueue(2, 0));
    run((p) => p.playTrack(b, [a, b]));
    expect(player().queueState.isCustomOrder).toBe(false);
    expect(player().queueState.isShuffle).toBe(false);
    expect(player().queueState.activeQueue).toEqual([a, b]);
    expect(player().queueState.currentIndex).toBe(1);

    // From a shuffled queue, the new list is shuffled again.
    run((p) => p.queueState.handleShuffleToggle());
    run((p) => p.queueState.moveInQueue(1, 0));
    run((p) => p.playTrack(c, [a, b, c]));
    expect(player().queueState.isCustomOrder).toBe(false);
    expect(player().queueState.isShuffle).toBe(true);
    expect(player().queueState.activeQueue[0]).toBe(c);
  });

  it("shuffle play drops the custom order", () => {
    const { run, player } = setup();
    run((p) => p.playTrack(a, [a, b, c]));
    run((p) => p.queueState.moveInQueue(2, 0));
    run((p) => p.handleShufflePlay([a, b, c]));
    expect(player().queueState.isCustomOrder).toBe(false);
    expect(player().queueState.isShuffle).toBe(true);
  });

  it("next follows the custom order", () => {
    const { run, playing } = setup();
    run((p) => p.playTrack(a, [a, b, c]));
    run((p) => p.queueState.moveInQueue(2, 1));
    run((p) => p.handleNext());
    expect(playing()).toBe(c);
    run((p) => p.handleNext());
    expect(playing()).toBe(b);
  });

  it("play next inserts the song after the current one", () => {
    const { run, player, playing } = setup();
    run((p) => p.playTrack(a, [a, b]));
    run((p) => p.playNext(c));
    expect(player().queueState.queue).toEqual([a, c, b]);
    expect(playing()).toBe(a);
  });

  it("play next with shuffle on inserts into the shuffled order and adds to the original", () => {
    const { run, player } = setup();
    run((p) => p.queueState.setIsShuffle(true));
    run((p) => p.playTrack(a, [a, b]));
    run((p) => p.playNext(c));
    expect(player().queueState.shuffledQueue[1]).toBe(c);
    expect(player().queueState.queue).toEqual([a, b, c]);
  });

  it("play next on an empty queue plays the song and queues it", () => {
    const { run, player, playing } = setup();
    run((p) => p.playNext(c));
    expect(playing()).toBe(c);
    expect(player().queueState.queue).toEqual([c]);
    expect(player().queueState.currentIndex).toBe(0);
  });

  it("play next for several songs keeps their order", () => {
    const { run, player } = setup();
    run((p) => p.playTrack(a, [a, b]));
    run((p) => p.playNextMultiple([c, d]));
    expect(player().queueState.queue).toEqual([a, c, d, b]);
  });

  it("play next for several songs on an empty queue plays them", () => {
    const { run, player, playing } = setup();
    run((p) => p.playNextMultiple([]));
    expect(playing()).toBeNull();
    run((p) => p.playNextMultiple([c, d]));
    expect(playing()).toBe(c);
    expect(player().queueState.queue).toEqual([c, d]);
  });

  it("play next and play inserts the song after the current one and plays it", () => {
    const { run, player, playing } = setup();
    run((p) => p.playTrack(a, [a, b]));
    run((p) => p.playNextAndPlay(a));
    expect(player().queueState.queue).toEqual([a, a, b]);
    expect(player().queueState.currentIndex).toBe(1);
    expect(playing()).toBe(a);
  });

  it("shuffle play plays a shuffled list and turns shuffle on", () => {
    const { run, player, playing } = setup();
    run((p) => p.handleShufflePlay([]));
    expect(playing()).toBeNull();

    run((p) => p.handleShufflePlay([a, b, c]));
    const { isShuffle, shuffledQueue, queue, currentIndex } = player().queueState;
    expect(isShuffle).toBe(true);
    expect(queue).toEqual([a, b, c]);
    expect(currentIndex).toBe(0);
    expect(playing()).toBe(shuffledQueue[0]);
  });

  it("removing another song just removes it", () => {
    const { run, player, playing } = setup();
    run((p) => p.playTrack(a, [a, b, c]));
    run((p) => p.handleRemoveFromQueue(2));
    expect(player().queueState.queue).toEqual([a, b]);
    expect(playing()).toBe(a);
  });

  it("the playing song can't be removed when the setting says so", () => {
    const { run, player, playing } = setup({ removeCurrentSongBehavior: "prevent" });
    run((p) => p.playTrack(b, [a, b, c]));
    run((p) => p.handleRemoveFromQueue(1));
    expect(player().queueState.queue).toEqual([a, b, c]);
    expect(playing()).toBe(b);
  });

  it("removing the playing song plays the next one", () => {
    const { run, player, playing } = setup({ removeCurrentSongBehavior: "play-next" });
    run((p) => p.playTrack(b, [a, b, c]));
    run((p) => p.handleRemoveFromQueue(1));
    expect(player().queueState.queue).toEqual([a, c]);
    expect(playing()).toBe(c);
    expect(player().queueState.currentIndex).toBe(1);
  });

  it("removing the last song stops playback and clears the player", () => {
    const { run, player, playing, audio } = setup({ removeCurrentSongBehavior: "play-next" });
    run((p) => p.playTrack(a, [a]));
    run((p) => p.handleRemoveFromQueue(0));
    expect(player().queueState.queue).toEqual([]);
    expect(playing()).toBeNull();
    expect(player().queueState.currentIndex).toBe(-1);
    expect(player().audioState.isPlaying).toBe(false);
    expect(audio.pause).toHaveBeenCalled();
  });
});

describe("songs that can't be played", () => {
  it("skips a damaged song with a message, and keeps it in the queue", async () => {
    const { run, player, playing, notify } = setup();
    run((p) => p.playTrack(a, [a, b]));
    await act(() => player().handleAudioError());

    expect(notify).toHaveBeenCalledWith({
      level: "error",
      message: expect.stringMatching(/^Skipped "Song \d+": the file couldn't be played/),
    });
    expect(playing()).toBe(b);
    expect(player().queueState.queue).toEqual([a, b]);
    expect(fakeApi().refreshLibrary).not.toHaveBeenCalled();
  });

  it("a missing file also rescans the library", async () => {
    const { run, player, notify } = setup();
    fakeApi().fileExists.mockResolvedValue(false);
    run((p) => p.playTrack(a, [a, b]));
    await act(() => player().handleAudioError());
    expect(fakeApi().refreshLibrary).toHaveBeenCalled();
    expect(notify.mock.calls[0][0].message).toMatch(/wasn't found \(moved or deleted\?\)/);
  });

  it("when nothing was playing, only tells the user", async () => {
    const { run, player, playing, notify } = setup();
    run((p) => p.playTrack(a, [a, b]));
    run((p) => p.audioState.setIsPlaying(false));
    await act(() => player().handleAudioError());
    expect(notify.mock.calls[0][0].message).toMatch(/^Can't play/);
    expect(playing()).toBe(a);
  });

  it("does nothing when no song is loaded", async () => {
    const { player, notify } = setup();
    await act(() => player().handleAudioError());
    expect(notify).not.toHaveBeenCalled();
  });

  it("stops with a message once every song in the queue failed in a row", async () => {
    const { run, player, notify } = setup();
    run((p) => p.queueState.setRepeatMode("all"));
    run((p) => p.playTrack(a, [a, b, c]));
    for (let i = 0; i < 3; i++) await act(() => player().handleAudioError());

    const messages = notify.mock.calls.map(([n]) => n.message);
    expect(messages.filter((m) => m.startsWith("Skipped"))).toHaveLength(2);
    expect(messages[2]).toMatch(/^Stopped: none of the songs in the queue could be played/);
  });

  it("a song that really plays resets the count", async () => {
    const { run, player, notify } = setup();
    run((p) => p.queueState.setRepeatMode("all"));
    run((p) => p.playTrack(a, [a, b]));
    await act(() => player().handleAudioError());
    run((p) => p.handleAudioPlaying());
    await act(() => player().handleAudioError());
    expect(notify.mock.calls.every(([n]) => n.message.startsWith("Skipped"))).toBe(true);
  });

  it("a file that vanished after loading is stopped and skipped when played", async () => {
    const { run, player, playing, audio, notify } = setup();
    run((p) => p.playTrack(a, [a, b]));
    fakeApi().fileExists.mockResolvedValue(false);
    await act(() => player().handleAudioPlay());

    expect(audio.pause).toHaveBeenCalled();
    expect(notify.mock.calls[0][0].message).toMatch(/^Skipped/);
    expect(playing()).toBe(b);
  });

  it("ignores a vanished file when another song started meanwhile", async () => {
    const { run, player, playing, notify } = setup();
    run((p) => p.playTrack(a, [a, b, c]));
    let answer!: (exists: boolean) => void;
    fakeApi().fileExists.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    let check!: Promise<void>;
    act(() => void (check = player().handleAudioPlay()));
    run((p) => p.playTrack(c));
    await act(async () => {
      answer(false);
      await check;
    });
    expect(notify).not.toHaveBeenCalled();
    expect(playing()).toBe(c);
  });

  it("a file that still exists plays normally", async () => {
    const { run, player, notify } = setup();
    run((p) => p.playTrack(a, [a]));
    await act(() => player().handleAudioPlay());
    expect(notify).not.toHaveBeenCalled();
    expect(player().audioState.isPlaying).toBe(true);
  });
});

describe("moved files, dropped files and the OS media controls", () => {
  it("reloads a moved song from its new path at the same position", async () => {
    const { run, audio } = setup();
    const moved = song({ path: "C:\\Music\\new place.mp3" });
    run((p) => p.playTrack(a, [a]));
    setMedia(audio, { duration: 200, currentTime: 42 });
    vi.mocked(audio.play).mockClear();

    run((p) => p.relocateCurrent(a.path, moved.path));
    expect(audio.getAttribute("src")).toBe(mediaUrl(moved.path));
    expect(audio.dataset.relocating).toBe("true");

    fire(audio, "loadedmetadata");
    expect(audio.currentTime).toBe(42);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("a paused moved song stays paused", () => {
    const { run, audio } = setup();
    run((p) => p.playTrack(a, [a]));
    setMedia(audio, { paused: true, currentTime: 5 });
    vi.mocked(audio.play).mockClear();
    run((p) => p.relocateCurrent(a.path, "C:\\Music\\x.mp3"));
    fire(audio, "loadedmetadata");
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("ignores a move of a song that isn't loaded", () => {
    const { run, audio } = setup();
    run((p) => p.playTrack(a, [a]));
    run((p) => p.relocateCurrent(b.path, "C:\\Music\\x.mp3"));
    expect(audio.getAttribute("src")).toBe(mediaUrl(a.path));
    expect(audio.dataset.relocating).toBeUndefined();
  });

  it("plays a file dropped onto the window", async () => {
    const { player, playing } = setup();
    const file = new File(["x"], "dropped.mp3");
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] },
    } as unknown as React.DragEvent;
    await act(() => player().handleDrop(event));

    expect(fakeApi().getMetadata).toHaveBeenCalledWith("C:\\Dropped\\dropped.mp3");
    expect(playing()?.path).toBe("C:\\Dropped\\dropped.mp3");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("shows every artist of the song to the OS, and never a stale title", async () => {
    const session = stubMediaSession();
    const { run } = setup();
    const duet = song({ title: "Duet", artists: ["A", "B"], album: "Album" });
    run((p) => p.playTrack(duet, [duet, b]));
    expect(session.metadata).toMatchObject({ title: "Duet", artist: "A, B", album: "Album" });

    const untitled = song({ title: undefined, artists: undefined, path: "C:\\Music\\raw.mp3" });
    run((p) => p.playTrack(untitled, [untitled]));
    expect(session.metadata).toMatchObject({ title: "raw.mp3", artist: "Unknown artist" });
  });

  it("media keys call the latest handlers", async () => {
    const session = stubMediaSession();
    const { run, playing, audio } = setup();
    run((p) => p.playTrack(a, [a, b]));
    act(() => session.handlers.nexttrack());
    expect(playing()).toBe(b);
    act(() => session.handlers.previoustrack());
    expect(playing()).toBe(a);
    act(() => session.handlers.pause());
    expect(audio.pause).toHaveBeenCalled();
    await waitFor(() => expect(session.handlers.play).toBeDefined());
  });
});
