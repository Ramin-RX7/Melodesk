import { beforeEach, describe, expect, it } from "vitest";

import { CacheMap } from "../../../src/main/services/cacheService";
import { hashPath } from "../../../src/main/services/hashUtil";
import { FileItem } from "../../../src/renderer/types";
import { freshMain, seedUserData } from "../../helpers/main";

type Moves = typeof import("../../../src/main/services/library/songMoves");
let moves: Moves;
let removed: typeof import("../../../src/main/services/removedSongsService");

beforeEach(async () => {
  await freshMain();
  moves = await import("../../../src/main/services/library/songMoves");
  removed = await import("../../../src/main/services/removedSongsService");
});

// A song as the scanner produces it; `id` is set for songs already in the library.
const song = (
  path: string,
  {
    size = 1000,
    duration = 100,
    title = "T",
    id,
  }: { size?: number; duration?: number; title?: string; id?: string } = {},
): FileItem => ({
  name: path.split("/").pop()!,
  path,
  isDirectory: false,
  isMedia: true,
  hash: id,
  metadata: { fileSize: size, duration, title, artists: ["A"], album: "Al" },
});

const cacheOf = (...songs: FileItem[]): CacheMap =>
  Object.fromEntries(
    songs.map((s) => [hashPath(s.path), { ...s, hash: s.hash ?? hashPath(s.path) }]),
  );

describe("detectMoves", () => {
  it("gives a renamed or moved file its old id", () => {
    const before = cacheOf(song("/m/a.mp3", { id: "id-a" }));
    const moved = song("/m/sub/renamed.mp3");
    const changes = moves.detectMoves(before, [moved]);
    expect(moved.hash).toBe("id-a");
    expect(changes.moves).toEqual([{ id: "id-a", from: "/m/a.mp3", to: "/m/sub/renamed.mp3" }]);
    expect(changes.added).toEqual([]);
    expect(changes.removed).toEqual([]);
  });

  it("needs size, length and tags to match", () => {
    const before = cacheOf(song("/m/a.mp3", { id: "id-a" }));
    for (const other of [
      song("/m/b.mp3", { size: 1001 }),
      song("/m/c.mp3", { duration: 120 }),
      song("/m/d.mp3", { title: "Other" }),
    ]) {
      const changes = moves.detectMoves(before, [other]);
      expect(other.hash).toBeUndefined();
      expect(changes.added).toEqual([other]);
    }
  });

  it("uses the file name to tell apart two identical vanished songs", () => {
    const before = cacheOf(
      song("/m/x/one.mp3", { id: "id-1" }),
      song("/m/x/two.mp3", { id: "id-2" }),
    );
    const moved = song("/m/y/two.mp3");
    moves.detectMoves(before, [moved]);
    expect(moved.hash).toBe("id-2");
  });

  it("gives up (new id) when it still can't tell which song it was", () => {
    const before = cacheOf(
      song("/m/x/one.mp3", { id: "id-1" }),
      song("/m/x/two.mp3", { id: "id-2" }),
    );
    const moved = song("/m/y/three.mp3");
    const changes = moves.detectMoves(before, [moved]);
    expect(moved.hash).toBeUndefined();
    expect(changes.moves).toEqual([]);
    expect(changes.removed.map((s) => s.hash).sort()).toEqual(["id-1", "id-2"]);
  });

  it("treats a copy as a new song (the original didn't vanish)", () => {
    const original = song("/m/a.mp3", { id: "id-a" });
    const copy = song("/m/copy of a.mp3");
    const changes = moves.detectMoves(cacheOf(original), [original, copy]);
    expect(copy.hash).toBeUndefined();
    expect(changes.added).toEqual([copy]);
  });

  it("never gives one id to two files", () => {
    const before = cacheOf(song("/m/a.mp3", { id: "id-a" }));
    const first = song("/m/b/a.mp3");
    const second = song("/m/c/a.mp3");
    moves.detectMoves(before, [first, second]);
    expect([first.hash, second.hash].filter(Boolean)).toEqual(["id-a"]);
  });

  it("remembers vanished songs and recognises them when they come back later", () => {
    const original = song("/m/a.mp3", { id: "id-a" });
    const gone = moves.detectMoves(cacheOf(original), []);
    expect(gone.removed.map((s) => s.hash)).toEqual(["id-a"]);
    expect(removed.getRemovedSongs()).toHaveProperty("id-a");

    const back = song("/m/elsewhere/a.mp3");
    const changes = moves.detectMoves({}, [back]);
    expect(back.hash).toBe("id-a");
    expect(changes.moves).toHaveLength(1);
    expect(removed.getRemovedSongs()).not.toHaveProperty("id-a"); // forgotten once back
  });

  it("counts a song that comes back to the same place as returned, not moved", () => {
    moves.detectMoves(cacheOf(song("/m/a.mp3", { id: "id-a" })), []);
    const back = song("/m/a.mp3");
    const changes = moves.detectMoves({}, [back]);
    expect(back.hash).toBe("id-a");
    expect(changes.returned).toBe(1);
    expect(changes.moves).toEqual([]);
  });

  it("counts re-read files as updated", () => {
    const kept = song("/m/a.mp3", { id: "id-a" });
    const before = cacheOf(kept, song("/m/b.mp3", { id: "id-b" }));
    const reused = before[hashPath("/m/a.mp3")];
    const reread = song("/m/b.mp3", { id: "id-b" });
    const changes = moves.detectMoves(before, [reused, reread]);
    expect(changes.updated).toBe(1);
  });
});

describe("applyMoves", () => {
  it("points playlists and the saved session at the new paths", async () => {
    await seedUserData({
      "playlists/p1.json": {
        id: "p1",
        name: "Mix",
        songs: ["/m/a.mp3", "/m/other.mp3"],
        createdAt: "x",
        updatedAt: "x",
      },
      "playlists/p2.json": {
        id: "p2",
        name: "Untouched",
        songs: ["/m/other.mp3"],
        createdAt: "x",
        updatedAt: "y",
      },
      "session.json": {
        currentTrackPath: "/m/a.mp3",
        queue: ["/m/a.mp3"],
        shuffledQueue: [],
        currentIndex: 0,
        isShuffle: false,
        repeatMode: "none",
      },
    });
    const { getAllPlaylists } = await import("../../../src/main/ipc/playlistHandlers");
    const { getSession } = await import("../../../src/main/services/sessionService");
    moves.applyMoves([{ id: "id-a", from: "/m/a.mp3", to: "/m/new/a.mp3" }]);

    const lists = Object.fromEntries(getAllPlaylists().map((p) => [p.id, p]));
    expect(lists.p1.songs).toEqual(["/m/new/a.mp3", "/m/other.mp3"]);
    expect(lists.p2.updatedAt).toBe("y"); // not rewritten
    expect(getSession()).toMatchObject({
      currentTrackPath: "/m/new/a.mp3",
      queue: ["/m/new/a.mp3"],
    });
  });

  it("does nothing without moves", () => {
    expect(() => moves.applyMoves([])).not.toThrow();
  });
});
