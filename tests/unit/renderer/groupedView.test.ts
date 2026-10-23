import { describe, expect, it } from "vitest";

import {
  getFilteredSongs,
  getGroupEntries,
} from "../../../src/renderer/components/GroupedView/groupedView.utils";
import { FileItem } from "../../../src/renderer/types";
import { normalizeGenre, UNKNOWN_ARTIST } from "../../../src/utils/metadata";

let n = 0;
const song = (metadata: FileItem["metadata"], name = `song${++n}.mp3`): FileItem => ({
  name,
  path: `/m/${name}`,
  isDirectory: false,
  isMedia: true,
  metadata,
});

const library: FileItem[] = [
  song({ title: "b-side", artists: ["Alpha"], album: "One", genre: ["rock"], trackNumber: 2 }),
  song({
    title: "A-side",
    artists: ["Alpha", "Beta"],
    album: "One",
    genre: ["Rock"],
    trackNumber: 1,
  }),
  song({ title: "Solo", artists: ["Beta"], album: "Two", genre: ["Pop"] }),
  song({ title: "Untitled" }),
  song(undefined, "no tags.mp3"),
];

describe("getGroupEntries", () => {
  it("counts songs per artist (each of several artists), Unknown Artist last", () => {
    const entries = getGroupEntries(library, "artist", "", "alphabet", false, normalizeGenre);
    expect(entries).toEqual([
      ["Alpha", 2],
      ["Beta", 2],
      [UNKNOWN_ARTIST, 2],
    ]);
  });

  it("keeps Unknown Artist last even when sorting by count or descending", () => {
    const byCount = getGroupEntries(library, "artist", "", "count", true, normalizeGenre);
    expect(byCount.at(-1)?.[0]).toBe(UNKNOWN_ARTIST);
    const desc = getGroupEntries(library, "artist", "", "alphabet", true, normalizeGenre);
    expect(desc.map(([name]) => name)).toEqual(["Beta", "Alpha", UNKNOWN_ARTIST]);
  });

  it("groups albums and leaves out songs without one", () => {
    expect(getGroupEntries(library, "album", "", "alphabet", false, normalizeGenre)).toEqual([
      ["One", 2],
      ["Two", 1],
    ]);
  });

  it("hides albums with fewer songs than the minimum", () => {
    expect(getGroupEntries(library, "album", "", "alphabet", false, normalizeGenre, 2)).toEqual([
      ["One", 2],
    ]);
  });

  it("merges genres that differ only in case", () => {
    expect(getGroupEntries(library, "genre", "", "alphabet", false, normalizeGenre)).toEqual([
      ["Pop", 1],
      ["Rock", 2],
    ]);
  });

  it("filters by name, ignoring case", () => {
    expect(getGroupEntries(library, "artist", "ALP", "alphabet", false, normalizeGenre)).toEqual([
      ["Alpha", 2],
    ]);
  });

  it("sorts by count with name as the tie-breaker", () => {
    const tracks = [
      song({ artists: ["Zed"] }),
      song({ artists: ["Zed"] }),
      song({ artists: ["Bee"] }),
      song({ artists: ["Ann"] }),
    ];
    expect(getGroupEntries(tracks, "artist", "", "count", false, normalizeGenre)).toEqual([
      ["Ann", 1],
      ["Bee", 1],
      ["Zed", 2],
    ]);
  });
});

describe("getFilteredSongs", () => {
  const titles = (songs: FileItem[]) => songs.map((s) => s.metadata?.title ?? s.name);

  it("orders an album by track number (songs without one last)", () => {
    expect(titles(getFilteredSongs(library, "One", "album", "", false))).toEqual([
      "A-side",
      "b-side",
    ]);
    expect(titles(getFilteredSongs(library, "One", "album", "", true))).toEqual([
      "b-side",
      "A-side",
    ]);
  });

  it("orders an artist's songs by title, ignoring case", () => {
    expect(titles(getFilteredSongs(library, "Alpha", "artist", "", false))).toEqual([
      "A-side",
      "b-side",
    ]);
  });

  it("includes untagged songs on the Unknown Artist page", () => {
    expect(titles(getFilteredSongs(library, UNKNOWN_ARTIST, "artist", "", false))).toEqual([
      "no tags.mp3",
      "Untitled",
    ]);
  });

  it("matches genres ignoring case", () => {
    expect(getFilteredSongs(library, "rock", "genre", "", false)).toHaveLength(2);
  });

  it("searches title, artists and album", () => {
    expect(titles(getFilteredSongs(library, "Beta", "artist", "solo", false))).toEqual(["Solo"]);
    expect(titles(getFilteredSongs(library, "Beta", "artist", "two", false))).toEqual(["Solo"]);
    expect(titles(getFilteredSongs(library, "Beta", "artist", "alpha", false))).toEqual(["A-side"]);
  });
});
