import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { CacheMap } from "../../../src/main/services/cacheService";
import { hashPath } from "../../../src/main/services/hashUtil";
import { ScanProgress } from "../../../src/main/services/library/libraryScanner";
import { freshMain, profilePath, seedUserData, TestLibrary, useLibrary } from "../../helpers/main";

let lib: TestLibrary;
let scanner: typeof import("../../../src/main/services/library/libraryScanner");

beforeEach(async () => {
  await freshMain();
  lib = await useLibrary();
  fs.mkdirSync(await profilePath("art_cache"), { recursive: true });
  scanner = await import("../../../src/main/services/library/libraryScanner");
});

const scan = (previous: CacheMap = {}, onProgress: (p: ScanProgress) => void = () => {}) =>
  scanner.scanLibrary([lib.a, lib.b], {
    signal: new AbortController().signal,
    previous,
    onProgress,
  });

describe("scanLibrary", () => {
  it("finds every audio file and nothing else", async () => {
    const files = await scan();
    expect(files.map((f) => f.name).sort()).toEqual(
      [
        "01 Duet.mp3",
        "01 First Light.mp3",
        "02 Guest Spot.mp3",
        "02 Second Wind.mp3",
        "03 Third Rail.mp3",
        "Lone Single.mp3",
        "Night Drive.mp3",
        "Same Title.mp3",
        "field recording.wav",
        "untagged track.mp3",
      ].sort(),
    );
    for (const f of files) {
      expect(f.isMedia).toBe(true);
      expect(f.mtime).toBeGreaterThan(0);
    }
    const first = files.find((f) => f.name === "01 First Light.mp3")!;
    expect(first.metadata).toMatchObject({ title: "First Light", album: "Album One" });
  });

  it("reuses unchanged files and re-reads changed ones", async () => {
    const previous: CacheMap = {};
    const firstRun = await scan(previous);
    expect(Object.keys(previous)).toHaveLength(firstRun.length); // parsed files are remembered

    const changed = lib.file("Library B/Night Drive.mp3");
    fs.appendFileSync(changed, Buffer.alloc(417)); // size and mtime change
    const secondRun = await scan(previous);

    for (const item of secondRun) {
      const before = firstRun.find((f) => f.path === item.path)!;
      if (item.path === changed) expect(item).not.toBe(before);
      else expect(item).toBe(before); // the very same object: not parsed again
    }
  });

  it("reports progress: discovering, then reading every file", async () => {
    const events: ScanProgress[] = [];
    const files = await scan({}, (p) => events.push(p));
    expect(events[0].phase).toBe("discovering");
    const last = events.at(-1)!;
    expect(last).toMatchObject({ phase: "reading", processed: files.length, total: files.length });
  });

  it("stops with an AbortError when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      scanner.scanLibrary([lib.a], {
        signal: controller.signal,
        previous: {},
        onProgress: () => {},
      }),
    ).rejects.toThrow(/abort/i);
  });

  it("skips folders it can't read", async () => {
    const files = await scanner.scanLibrary([lib.a, path.join(lib.root, "missing")], {
      signal: new AbortController().signal,
      previous: {},
      onProgress: () => {},
    });
    expect(files.length).toBe(8);
  });
});

describe("getDirectoryTree", () => {
  it("lists folders first, then files by name, with song details from the cache", async () => {
    const single = lib.file("Library A/Singles/Lone Single.mp3");
    await seedUserData({
      "library_cache.json": {
        [hashPath(single)]: {
          name: "Lone Single.mp3",
          path: single,
          isDirectory: false,
          isMedia: true,
          hash: "id-1",
          metadata: { title: "From the cache" },
        },
      },
    });
    const tree = await scanner.getDirectoryTree(lib.a);
    expect(tree.map((i) => i.name)).toEqual(["Album One", "Album Two", "Singles"]);
    expect(tree.every((i) => i.isDirectory)).toBe(true);

    const singles = tree.find((i) => i.name === "Singles")!.children!;
    expect(singles.map((i) => i.name)).toEqual([
      "field recording.wav",
      "Lone Single.mp3",
      "notes.txt",
      "untagged track.mp3",
    ]);
    expect(singles.find((i) => i.name === "Lone Single.mp3")).toMatchObject({
      hash: "id-1",
      metadata: { title: "From the cache" },
    });
    // Not in the cache yet: shown by file name, with its location-based id.
    const untagged = singles.find((i) => i.name === "untagged track.mp3")!;
    expect(untagged.metadata).toBeUndefined();
    expect(untagged.hash).toBe(hashPath(untagged.path));
    expect(singles.find((i) => i.name === "notes.txt")!.isMedia).toBe(false);
  });

  it("returns an empty list for a folder that doesn't exist", async () => {
    expect(await scanner.getDirectoryTree(path.join(lib.root, "nope"))).toEqual([]);
  });
});
