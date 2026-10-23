import { describe, expect, it } from "vitest";

import { shuffleArray } from "../../../src/utils/array";
import {
  EQ_BAND_COUNT,
  EQ_FREQUENCIES,
  EQ_MAX_GAIN,
  EQ_MIN_GAIN,
  EQ_PRESETS,
  FLAT,
  formatFrequency,
  normalizeBands,
} from "../../../src/utils/equalizer";
import {
  artistsOf,
  formatArtists,
  normalizeGenre,
  UNKNOWN_ARTIST,
} from "../../../src/utils/metadata";
import { formatDuration } from "../../../src/utils/time";

describe("shuffleArray", () => {
  it("keeps every element exactly once and leaves the input untouched", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const copy = [...input];
    const shuffled = shuffleArray(input);
    expect(input).toEqual(copy);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
  });

  it("changes the order (practically always for 50 items)", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    expect(shuffleArray(input)).not.toEqual(input);
  });

  it("handles empty and single-item lists", () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray(["a"])).toEqual(["a"]);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [65, "1:05"],
    [599.9, "9:59"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
  ])("%s seconds → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("normalizeGenre", () => {
  it("title-cases each word", () => {
    expect(normalizeGenre("hip hop")).toBe("Hip Hop");
    expect(normalizeGenre("ELECTRONIC")).toBe("Electronic");
    expect(normalizeGenre("pop")).toBe(normalizeGenre("Pop"));
  });
});

describe("artistsOf", () => {
  it("uses the artists list, then the single artist, then Unknown Artist", () => {
    expect(artistsOf({ metadata: { artists: ["A", "B"], artist: "A & B" } })).toEqual(["A", "B"]);
    expect(artistsOf({ metadata: { artists: [], artist: "Solo" } })).toEqual(["Solo"]);
    expect(artistsOf({ metadata: {} })).toEqual([UNKNOWN_ARTIST]);
    expect(artistsOf({})).toEqual([UNKNOWN_ARTIST]);
  });
});

describe("formatArtists", () => {
  it("shows Unknown Artist when there are none", () => {
    expect(formatArtists()).toEqual({ display: UNKNOWN_ARTIST, full: UNKNOWN_ARTIST });
    expect(formatArtists([])).toEqual({ display: UNKNOWN_ARTIST, full: UNKNOWN_ARTIST });
  });

  it("lists up to three artists and shortens longer lists", () => {
    expect(formatArtists(["A", "B", "C"])).toEqual({ display: "A, B, C", full: "A, B, C" });
    expect(formatArtists(["A", "B", "C", "D"])).toEqual({
      display: "A, B, C, ...",
      full: "A, B, C, D",
    });
  });
});

describe("equalizer", () => {
  it("has one gain per band in every preset, within the limits", () => {
    expect(FLAT).toHaveLength(EQ_BAND_COUNT);
    const ids = new Set<string>();
    for (const preset of EQ_PRESETS) {
      expect(preset.gains).toHaveLength(EQ_FREQUENCIES.length);
      for (const gain of preset.gains) {
        expect(gain).toBeGreaterThanOrEqual(EQ_MIN_GAIN);
        expect(gain).toBeLessThanOrEqual(EQ_MAX_GAIN);
      }
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
    }
  });

  it("normalizeBands fills, clamps and cleans stored values", () => {
    expect(normalizeBands(undefined)).toEqual(FLAT);
    expect(normalizeBands("nonsense")).toEqual(FLAT);
    expect(normalizeBands([3, 99, -99, NaN, "5", null])).toEqual([
      3,
      EQ_MAX_GAIN,
      EQ_MIN_GAIN,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    expect(normalizeBands(new Array(20).fill(1))).toHaveLength(EQ_BAND_COUNT);
  });

  it("formats frequencies for the axis", () => {
    expect(formatFrequency(32)).toBe("32");
    expect(formatFrequency(1000)).toBe("1k");
    expect(formatFrequency(16000)).toBe("16k");
  });
});
