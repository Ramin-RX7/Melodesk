// Builds the test music library: small, silent but valid audio files with known tags and covers,
// so tests can scan, play and edit real files. Output goes to tests/fixtures/generated/ (ignored
// by git) and is reused while this file is unchanged. Tests copy it before changing anything.
//
//   node tests/fixtures/generate.mjs        (re)builds it; tests call ensureLibrary() themselves

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import NodeID3 from "node-id3";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const GENERATED_DIR = path.join(HERE, "generated");
export const LIBRARY_DIR = path.join(GENERATED_DIR, "library");
const STAMP = path.join(GENERATED_DIR, "stamp.txt");

/* ---------------- audio ---------------- */

// MPEG-1 Layer III, 128 kbps, 44.1 kHz, mono: 417-byte frames of 1152 samples each. An all-zero
// frame body is valid and decodes to silence.
const FRAME_HEADER = Buffer.from([0xff, 0xfb, 0x90, 0xc0]);
const FRAME_SIZE = 417;
const FRAME_SECONDS = 1152 / 44100;

export const silentMp3 = (seconds) => {
  const frame = Buffer.alloc(FRAME_SIZE);
  FRAME_HEADER.copy(frame);
  const count = Math.round(seconds / FRAME_SECONDS);
  return Buffer.concat(Array.from({ length: count }, () => frame));
};

// 8 kHz, 16-bit mono PCM silence.
export const silentWav = (seconds) => {
  const rate = 8000;
  const data = Buffer.alloc(Math.round(rate * seconds) * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

/* ---------------- images ---------------- */

// A solid-color PNG (enough to tell covers apart, and to check that equal covers are shared).
export const solidPng = ([r, g, b], size = 16) => {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body) >>> 0, body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.alloc(size * 3).fill(Buffer.from([r, g, b])),
  ]);
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", pixels),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const RED = solidPng([200, 40, 40]);
const BLUE = solidPng([40, 60, 200]);
const GREEN = solidPng([40, 160, 70]);

/* ---------------- the library ---------------- */

// Every song has a different length, so no two are taken for the same file by move detection.
// `folder` is relative to the library root; "Library A" and "Library B" are two library folders.
export const SONGS = [
  {
    folder: "Library A/Album One",
    file: "01 First Light.mp3",
    seconds: 4,
    tags: {
      title: "First Light",
      artist: "Alpha Band",
      album: "Album One",
      genre: "Rock",
      trackNumber: "1",
      year: "2020",
    },
    cover: RED,
  },
  {
    folder: "Library A/Album One",
    file: "02 Second Wind.mp3",
    seconds: 5,
    tags: {
      title: "Second Wind",
      artist: "Alpha Band",
      album: "Album One",
      genre: "Rock",
      trackNumber: "2",
      year: "2020",
    },
    cover: RED,
  },
  {
    folder: "Library A/Album One",
    file: "03 Third Rail.mp3",
    seconds: 6,
    tags: {
      title: "Third Rail",
      artist: "Alpha Band",
      album: "Album One",
      genre: "Rock",
      trackNumber: "3",
      year: "2020",
    },
    cover: RED,
  },
  {
    folder: "Library A/Album Two",
    file: "01 Duet.mp3",
    seconds: 7,
    tags: {
      title: "Duet",
      artist: "Beta & Gamma",
      album: "Album Two",
      genre: "Pop",
      trackNumber: "1",
      year: "2021",
    },
    cover: BLUE,
  },
  {
    folder: "Library A/Album Two",
    file: "02 Guest Spot.mp3",
    seconds: 8,
    tags: {
      title: "Guest Spot",
      artist: "Alpha Band feat. Delta",
      album: "Album Two",
      genre: "pop",
      trackNumber: "2",
      year: "2021",
    },
    cover: BLUE,
  },
  {
    folder: "Library A/Singles",
    file: "Lone Single.mp3",
    seconds: 9,
    tags: { title: "Lone Single", artist: "Epsilon", genre: "Electronic" },
    cover: GREEN,
  },
  { folder: "Library A/Singles", file: "untagged track.mp3", seconds: 10, tags: null, cover: null },
  {
    folder: "Library A/Singles",
    file: "field recording.wav",
    seconds: 3,
    tags: null,
    cover: null,
    wav: true,
  },
  {
    folder: "Library B",
    file: "Night Drive.mp3",
    seconds: 11,
    tags: {
      title: "Night Drive",
      artist: "Zeta",
      album: "Roads",
      genre: "Electronic",
      trackNumber: "1",
    },
    cover: GREEN,
  },
  {
    folder: "Library B/Deep",
    file: "Same Title.mp3",
    seconds: 12,
    tags: { title: "Duet", artist: "Zeta", album: "Roads", genre: "Electronic", trackNumber: "2" },
    cover: null,
  },
];

// Files next to the music that the library must ignore.
const OTHER_FILES = [
  { folder: "Library A/Album One", file: "cover.png", data: RED },
  { folder: "Library A/Singles", file: "notes.txt", data: Buffer.from("not music") },
];

const writeSong = (root, song) => {
  const dir = path.join(root, song.folder);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, song.file);
  fs.writeFileSync(target, song.wav ? silentWav(song.seconds) : silentMp3(song.seconds));
  if (song.tags) {
    const tags = { ...song.tags };
    if (song.cover) {
      tags.image = {
        mime: "image/png",
        type: { id: 3, name: "front cover" },
        description: "cover",
        imageBuffer: song.cover,
      };
    }
    const ok = NodeID3.write(tags, target);
    if (ok !== true) throw new Error(`Could not tag ${target}: ${ok}`);
  }
};

// Writes the whole library into `root` (which should not exist yet).
export const writeLibrary = (root) => {
  for (const song of SONGS) writeSong(root, song);
  for (const other of OTHER_FILES) {
    fs.mkdirSync(path.join(root, other.folder), { recursive: true });
    fs.writeFileSync(path.join(root, other.folder, other.file), other.data);
  }
};

// The generator's own source decides whether the cached library is current.
const sourceStamp = () =>
  crypto
    .createHash("sha1")
    .update(fs.readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex");

export const ensureLibrary = () => {
  const stamp = sourceStamp();
  try {
    if (fs.readFileSync(STAMP, "utf8") === stamp && fs.existsSync(LIBRARY_DIR)) return LIBRARY_DIR;
  } catch {
    // Not generated yet.
  }
  fs.rmSync(GENERATED_DIR, { recursive: true, force: true });
  writeLibrary(LIBRARY_DIR);
  fs.writeFileSync(STAMP, stamp);
  return LIBRARY_DIR;
};

// Copies the library into `target` (e.g. a test's temp folder) and returns the copy's path.
export const copyLibrary = (target) => {
  fs.cpSync(ensureLibrary(), target, { recursive: true, preserveTimestamps: true });
  return target;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.rmSync(STAMP, { force: true });
  console.log(`Test library written to ${ensureLibrary()}`);
}
