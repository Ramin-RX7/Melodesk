// The library cache, the art cache (content-named covers, cleanup, old-format conversion) and
// reading tags from real files.
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPath } from "../../../src/main/services/hashUtil";
import { FileItem } from "../../../src/renderer/types";
import { solidPng } from "../../fixtures/generate.mjs";
import { age, freshMain, profilePath, seedUserData, useLibrary } from "../../helpers/main";
import { readJsonFile } from "../../helpers/tempdir";

const DAY = 24 * 60 * 60 * 1000;

const song = (p: string, extra: Partial<FileItem> = {}): FileItem => ({
  name: path.basename(p),
  path: p,
  isDirectory: false,
  isMedia: true,
  ...extra,
});

beforeEach(async () => {
  await freshMain();
});

describe("cacheService", () => {
  it("is empty without a cache file", async () => {
    const { getCache, getCacheList } = await import("../../../src/main/services/cacheService");
    expect(getCache()).toEqual({});
    expect(getCacheList()).toEqual([]);
  });

  it("migrates the old array format to a map keyed by location", async () => {
    await seedUserData({
      "library_cache.json": [song("/m/a.mp3"), song("/m/b.mp3", { hash: "kept" })],
    });
    const { getCache } = await import("../../../src/main/services/cacheService");
    const cache = getCache();
    expect(cache[hashPath("/m/a.mp3")].hash).toBe(hashPath("/m/a.mp3"));
    expect(cache.kept.path).toBe("/m/b.mp3");
  });

  it("saveCache keeps existing song ids, gives new songs one, and keys by location", async () => {
    const { saveCache, getCache } = await import("../../../src/main/services/cacheService");
    const moved = song("/m/new place.mp3", { hash: "original-id" });
    const fresh = song("/m/fresh.mp3");
    saveCache([moved, fresh]);
    expect(moved.hash).toBe("original-id");
    expect(fresh.hash).toBe(hashPath("/m/fresh.mp3"));
    const onDisk = readJsonFile<Record<string, FileItem>>(await profilePath("library_cache.json"));
    expect(Object.keys(onDisk).sort()).toEqual(
      [hashPath("/m/new place.mp3"), hashPath("/m/fresh.mp3")].sort(),
    );
    expect(getCache()[hashPath("/m/new place.mp3")].hash).toBe("original-id");
    expect(fs.existsSync(`${await profilePath("library_cache.json")}.bak`)).toBe(false);
  });

  it("reads the file once and then serves the in-memory copy", async () => {
    await seedUserData({ "library_cache.json": { k: song("/m/a.mp3", { hash: "k" }) } });
    const { getCache } = await import("../../../src/main/services/cacheService");
    expect(Object.keys(getCache())).toEqual(["k"]);
    fs.writeFileSync(await profilePath("library_cache.json"), "{}");
    expect(Object.keys(getCache())).toEqual(["k"]);
  });
});

describe("artCacheService", () => {
  const RED = solidPng([200, 0, 0]);
  const BLUE = solidPng([0, 0, 200]);

  const artDir = () => profilePath("art_cache");
  const files = async () => fs.readdirSync(await artDir()).sort();

  beforeEach(async () => {
    fs.mkdirSync(await artDir(), { recursive: true });
  });

  it("names covers after their content, so equal covers share one file", async () => {
    const { saveArt } = await import("../../../src/main/services/metadataService");
    const a = saveArt(RED, "image/png");
    const b = saveArt(Buffer.from(RED), "image/png");
    const c = saveArt(BLUE, "image/jpeg");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(path.basename(a!)).toMatch(/^[0-9a-f]{40}\.png$/);
    expect(path.extname(c!)).toBe(".jpeg");
    expect(await files()).toHaveLength(2);
  });

  it("converts old path-named covers once: duplicates collapse and songs are repointed", async () => {
    const dir = await artDir();
    const old1 = path.join(dir, "md5-of-path-1.png");
    const old2 = path.join(dir, "md5-of-path-2.png");
    fs.writeFileSync(old1, RED);
    fs.writeFileSync(old2, RED); // same image, different song
    const outside = path.join(dir, "..", "elsewhere.png");
    fs.writeFileSync(outside, BLUE);
    const songs = [
      song("/m/a.mp3", { metadata: { picture: old1 } }),
      song("/m/b.mp3", { metadata: { picture: old2 } }),
      song("/m/c.mp3", { metadata: { picture: outside } }),
    ];
    const art = await import("../../../src/main/services/artCacheService");
    await art.prepareArtCache(songs);
    expect(songs[0].metadata!.picture).toBe(songs[1].metadata!.picture);
    expect(path.basename(songs[0].metadata!.picture!)).toMatch(/^[0-9a-f]{40}\.png$/);
    expect(songs[2].metadata!.picture).toBe(outside); // not ours to convert

    art.cleanArtCache(songs, []);
    expect(await files()).toEqual([".version", path.basename(songs[0].metadata!.picture!)]);

    // Second scan: already converted, nothing changes.
    const again = [song("/m/a.mp3", { metadata: { picture: old1 } })];
    await art.prepareArtCache(again);
    expect(again[0].metadata!.picture).toBe(old1);
  });

  it("deletes unused art once it is a day old, keeping files in use and recent ones", async () => {
    const dir = await artDir();
    const used = path.join(dir, "used.png");
    const artist = path.join(dir, "artist_x.png");
    const oldUnused = path.join(dir, "old.png");
    const newUnused = path.join(dir, "new.png");
    for (const f of [used, artist, oldUnused, newUnused]) fs.writeFileSync(f, RED);
    fs.writeFileSync(path.join(dir, ".version"), "2");
    for (const f of [used, artist, oldUnused]) age(f, 2 * DAY);

    const { cleanArtCache } = await import("../../../src/main/services/artCacheService");
    cleanArtCache([song("/m/a.mp3", { metadata: { picture: used } })], [artist]);
    expect(await files()).toEqual([".version", "artist_x.png", "new.png", "used.png"]);
  });

  it("removeArtistPicture keeps a picture another artist uses and ignores outside files", async () => {
    const dir = await artDir();
    const shared = path.join(dir, "artist_shared.png");
    const alone = path.join(dir, "artist_alone.png");
    const outside = path.join(dir, "..", "mine.png");
    for (const f of [shared, alone, outside]) fs.writeFileSync(f, RED);
    const { removeArtistPicture } = await import("../../../src/main/services/artCacheService");

    removeArtistPicture(shared, [shared]);
    removeArtistPicture(alone, [shared]);
    removeArtistPicture(outside, []);
    await vi.waitFor(() => expect(fs.existsSync(alone)).toBe(false));
    expect(fs.existsSync(shared)).toBe(true);
    expect(fs.existsSync(outside)).toBe(true);
  });
});

describe("metadataService", () => {
  it("splits artist credits", async () => {
    const { splitArtists } = await import("../../../src/main/services/metadataService");
    expect(splitArtists("A feat. B")).toEqual(["A", "B"]);
    expect(splitArtists("A ft B & C")).toEqual(["A", "B", "C"]);
    expect(splitArtists("A, B; C / D")).toEqual(["A", "B", "C", "D"]);
    expect(splitArtists("Featuring")).toEqual(["Featuring"]);
  });

  it("collects artists from every tag, without duplicates", async () => {
    const { getArtists } = await import("../../../src/main/services/metadataService");
    expect(
      getArtists({
        common: { artists: ["A & B"], artist: "A", albumartist: "C", albumartists: ["C"] },
        format: {},
      }),
    ).toEqual(["A", "B", "C"]);
  });

  it("reads tags, length, size and cover from real files", async () => {
    const lib = await useLibrary();
    fs.mkdirSync(await profilePath("art_cache"), { recursive: true });
    const { readSongMetadata } = await import("../../../src/main/services/metadataService");

    const tagged = await readSongMetadata(lib.file("Library A/Album Two/02 Guest Spot.mp3"));
    expect(tagged).toMatchObject({
      title: "Guest Spot",
      artists: ["Alpha Band", "Delta"],
      album: "Album Two",
      genre: ["pop"],
      trackNumber: 2,
      year: 2021,
    });
    expect(tagged.duration).toBeCloseTo(8, 0);
    expect(tagged.fileSize).toBe(
      fs.statSync(lib.file("Library A/Album Two/02 Guest Spot.mp3")).size,
    );
    expect(fs.existsSync(tagged.picture!)).toBe(true);

    const untagged = await readSongMetadata(lib.file("Library A/Singles/untagged track.mp3"));
    expect(untagged.title).toBeUndefined();
    expect(untagged.artists).toEqual([]);
    expect(untagged.trackNumber).toBeUndefined(); // not null
    expect(untagged.picture).toBeUndefined();

    const wav = await readSongMetadata(lib.file("Library A/Singles/field recording.wav"));
    expect(wav.duration).toBeCloseTo(3, 0);
  });

  it("gives a damaged file empty details (no tags, no length) instead of failing", async () => {
    const lib = await useLibrary();
    const fake = lib.file("Library A/Singles/broken.mp3");
    fs.writeFileSync(fake, "this is not audio");
    const { readSongMetadata } = await import("../../../src/main/services/metadataService");
    const details = await readSongMetadata(fake);
    expect(details).toMatchObject({ title: undefined, artists: [], duration: undefined });
    expect(details.fileSize).toBe(17);
  });
});
