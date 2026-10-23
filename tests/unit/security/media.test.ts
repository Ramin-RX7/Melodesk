// What media:// may serve (mediaAccess) and how it serves it (mediaProtocol).
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshMain, profilePath, seedUserData, TestLibrary, useLibrary } from "../../helpers/main";
import { makeTempDir } from "../../helpers/tempdir";

let electron: Awaited<ReturnType<typeof freshMain>>;
let lib: TestLibrary;
let outside: string;

beforeEach(async () => {
  electron = await freshMain();
  lib = await useLibrary();
  outside = makeTempDir("melodesk-outside-");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("canServe", () => {
  it("allows library files and the art cache", async () => {
    const { canServe } = await import("../../../src/main/services/mediaAccess");
    expect(canServe(lib.file("Library A/Album One/01 First Light.mp3"))).toBe(true);
    expect(canServe(path.join(lib.b, "Deep", "Same Title.mp3"))).toBe(true);
    expect(canServe(await profilePath("art_cache", "abc.png"))).toBe(true);
  });

  it.runIf(process.platform === "win32")("ignores letter case on Windows", async () => {
    const { canServe } = await import("../../../src/main/services/mediaAccess");
    expect(canServe(lib.file("Library A/Singles/Lone Single.mp3").toUpperCase())).toBe(true);
  });

  it("refuses everything else, including .. tricks", async () => {
    const { canServe } = await import("../../../src/main/services/mediaAccess");
    expect(canServe(path.join(outside, "song.mp3"))).toBe(false);
    expect(canServe(path.join(lib.a, "..", "..", "secret.txt"))).toBe(false);
    expect(canServe(await profilePath("config.json"))).toBe(false);
    expect(canServe(`${lib.a}-evil${path.sep}x.mp3`)).toBe(false);
  });

  it("allows an audio file the user dropped onto the window, and nothing else", async () => {
    const { canServe } = await import("../../../src/main/services/mediaAccess");
    const dropped = path.join(outside, "dropped.mp3");
    const notAudio = path.join(outside, "dropped.txt");
    fs.writeFileSync(dropped, "x");
    fs.writeFileSync(notAudio, "x");

    electron.send("allow-dropped-file", dropped);
    electron.send("allow-dropped-file", notAudio);
    electron.send("allow-dropped-file", path.join(outside, "missing.mp3"));
    electron.send("allow-dropped-file", 42);

    expect(canServe(dropped)).toBe(true);
    expect(canServe(notAudio)).toBe(false);
    expect(canServe(path.join(outside, "missing.mp3"))).toBe(false);
  });

  it("allows audio files from the restored queue", async () => {
    const queued = path.join(outside, "queued.mp3");
    await seedUserData({
      "session.json": { queue: [queued, path.join(outside, "notes.txt")], shuffledQueue: [] },
    });
    const { allowSessionFiles, canServe } = await import("../../../src/main/services/mediaAccess");
    expect(canServe(queued)).toBe(false);
    allowSessionFiles();
    expect(canServe(queued)).toBe(true);
    expect(canServe(path.join(outside, "notes.txt"))).toBe(false);
  });
});

describe("media protocol", () => {
  const url = (file: string) => `media://${encodeURIComponent(file.replace(/\\/g, "/"))}`;
  const fetchMedia = async (file: string, headers: Record<string, string> = {}) => {
    const { registerMediaProtocol } = await import("../../../src/main/protocols/mediaProtocol");
    registerMediaProtocol();
    const handler = electron.protocolHandlers.get("media")!;
    return handler(new Request(url(file), { headers }));
  };

  it("parses Range headers", async () => {
    const { parseRange } = await import("../../../src/main/protocols/mediaProtocol");
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=5-2", 1000)).toBeNull();
    expect(parseRange("bytes=0-1,5-9", 1000)).toBeNull();
    expect(parseRange("items=0-1", 1000)).toBeNull();
    expect(parseRange("bytes=-", 1000)).toBeNull();
  });

  it("knows the content types", async () => {
    const { getMimeType } = await import("../../../src/main/protocols/mediaProtocol");
    expect(getMimeType("a.MP3")).toBe("audio/mpeg");
    expect(getMimeType("a.flac")).toBe("audio/flac");
    expect(getMimeType("a.m4a")).toBe("audio/mp4");
    expect(getMimeType("a.ogg")).toBe("audio/ogg");
    expect(getMimeType("a.wav")).toBe("audio/wav");
    expect(getMimeType("a.jpeg")).toBe("image/jpeg");
    expect(getMimeType("a.png")).toBe("image/png");
    expect(getMimeType("a.bin")).toBe("application/octet-stream");
  });

  it("serves a whole library file with the CORS header the equalizer needs", async () => {
    const file = lib.file("Library A/Album One/01 First Light.mp3");
    const response = await fetchMedia(file);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(fs.readFileSync(file))).toBe(true);
  });

  it("serves byte ranges (206) and refuses impossible ones (416)", async () => {
    const file = lib.file("Library A/Album One/01 First Light.mp3");
    const size = fs.statSync(file).size;
    const partial = await fetchMedia(file, { Range: "bytes=10-19" });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("Content-Range")).toBe(`bytes 10-19/${size}`);
    expect(Buffer.from(await partial.arrayBuffer())).toEqual(
      fs.readFileSync(file).subarray(10, 20),
    );

    const impossible = await fetchMedia(file, { Range: `bytes=${size}-` });
    expect(impossible.status).toBe(416);
    expect(impossible.headers.get("Content-Range")).toBe(`bytes */${size}`);
  });

  it("refuses files outside the library (403) and reports missing ones (404)", async () => {
    const secret = path.join(outside, "secret.mp3");
    fs.writeFileSync(secret, "x");
    expect((await fetchMedia(secret)).status).toBe(403);
    expect((await fetchMedia(path.join(lib.a, "gone.mp3"))).status).toBe(404);
  });

  it("answers a malformed URL with 400", async () => {
    const { registerMediaProtocol } = await import("../../../src/main/protocols/mediaProtocol");
    registerMediaProtocol();
    const response = await electron.protocolHandlers.get("media")!(new Request("media://%E0%A4%A"));
    expect(response.status).toBe(400);
  });
});
