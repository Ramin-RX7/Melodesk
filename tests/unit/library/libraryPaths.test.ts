import path from "node:path";
import { describe, expect, it } from "vitest";

import { hashPath } from "../../../src/main/services/hashUtil";
import {
  isSameOrInside,
  isSamePath,
  outermostFolders,
} from "../../../src/main/services/library/libraryPaths";
import { isMediaFile } from "../../../src/main/services/library/mediaUtils";

const root = path.resolve("/music");
const p = (...parts: string[]) => path.join(root, ...parts);
const isWindows = process.platform === "win32";

describe("isSamePath", () => {
  it("ignores trailing separators and relative segments", () => {
    expect(isSamePath(p("A"), p("A") + path.sep)).toBe(true);
    expect(isSamePath(p("A", "..", "A"), p("A"))).toBe(true);
    expect(isSamePath(p("A"), p("B"))).toBe(false);
  });

  it.runIf(isWindows)("is case-insensitive on Windows", () => {
    expect(isSamePath("D:\\Music\\Rock", "d:\\music\\rock")).toBe(true);
  });

  it.skipIf(isWindows)("is case-sensitive elsewhere", () => {
    expect(isSamePath("/music/Rock", "/music/rock")).toBe(false);
  });
});

describe("isSameOrInside", () => {
  it("accepts the folder itself and anything below it", () => {
    expect(isSameOrInside(p("A"), p("A"))).toBe(true);
    expect(isSameOrInside(p("A", "song.mp3"), p("A"))).toBe(true);
    expect(isSameOrInside(p("A", "x", "y", "z.mp3"), p("A"))).toBe(true);
  });

  it("compares whole folder names, not text prefixes", () => {
    expect(isSameOrInside(p("AB", "song.mp3"), p("A"))).toBe(false);
    expect(isSameOrInside(p("A"), p("A", "inner"))).toBe(false);
  });

  it("isn't fooled by .. segments", () => {
    expect(isSameOrInside(p("A", "..", "B", "song.mp3"), p("A"))).toBe(false);
  });

  it("works for a drive or filesystem root", () => {
    const fsRoot = path.parse(root).root;
    expect(isSameOrInside(p("A"), fsRoot)).toBe(true);
  });
});

describe("outermostFolders", () => {
  it("drops folders inside other folders and duplicates, keeping order", () => {
    expect(outermostFolders([p("A", "inner"), p("B"), p("A"), p("B") + path.sep])).toEqual([
      p("B"),
      p("A"),
    ]);
  });

  it("keeps folders with similar names", () => {
    expect(outermostFolders([p("A"), p("AB")])).toEqual([p("A"), p("AB")]);
  });

  it("returns an empty list unchanged", () => {
    expect(outermostFolders([])).toEqual([]);
  });
});

describe("isMediaFile", () => {
  it.each(["a.mp3", "b.WAV", "c.ogg", "d.m4a", "e.flac", "dir/f.Mp3"])("%s is audio", (name) => {
    expect(isMediaFile(name)).toBe(true);
  });

  it.each(["cover.jpg", "notes.txt", "song.mp3.part", "mp3", "playlist.m3u"])(
    "%s is not audio",
    (name) => {
      expect(isMediaFile(name)).toBe(false);
    },
  );
});

describe("hashPath", () => {
  it("is a stable sha1 that treats / and \\ the same", () => {
    expect(hashPath("C:\\Music\\a.mp3")).toBe(hashPath("C:/Music/a.mp3"));
    expect(hashPath("/m/a.mp3")).toMatch(/^[0-9a-f]{40}$/);
    expect(hashPath("/m/a.mp3")).not.toBe(hashPath("/m/b.mp3"));
  });
});
