import fs from "fs";
import path from "path";

import { FileItem } from "../../renderer/types";
import { ART_CACHE_DIR, contentHash } from "./artCacheService";

// music-metadata is ESM-only (loaded with import() at runtime, see CLAUDE.md §11); these are the
// parts of its result that are read here.
export interface ParsedAudio {
  common: {
    title?: string;
    artist?: string;
    artists?: string[];
    albumartist?: string;
    albumartists?: string[];
    album?: string;
    genre?: string[];
    year?: number;
    date?: string;
    track?: { no: number | null };
    bpm?: number;
    lyrics?: (string | { text?: string })[] | string;
    picture?: { data: Uint8Array; format: string }[];
  };
  format: { duration?: number; codec?: string; container?: string; bitrate?: number };
}

type MusicMetadata = { parseFile: (filePath: string) => Promise<ParsedAudio> };
let musicMetadata: MusicMetadata | null = null;

// Named after the image itself (see artCacheService), so the file is only written once.
export const saveArt = (buffer: Buffer, format: string): string | undefined => {
  try {
    const ext = format.split("/")[1] || "jpg";
    const artPath = path.join(ART_CACHE_DIR, `${contentHash(buffer)}.${ext}`);

    if (!fs.existsSync(artPath)) {
      fs.writeFileSync(artPath, buffer);
    }
    return artPath;
  } catch (err) {
    console.error("Failed to save art:", err);
    return undefined;
  }
};

export const splitArtists = (value: string): string[] => {
  return value
    .split(/[,;&/]|\s+feat\.?\s+|\s+ft\.?\s+/i)
    .map((a) => a.trim())
    .filter(Boolean);
};

export const getArtists = (metadata: ParsedAudio): string[] => {
  const artistSet = new Set<string>();

  // Main artists
  if (Array.isArray(metadata.common.artists)) {
    metadata.common.artists.forEach((a: string) => {
      splitArtists(a).forEach((x) => artistSet.add(x));
    });
  }

  // Single artist string fallback
  if (metadata.common.artist) {
    splitArtists(metadata.common.artist).forEach((x) => artistSet.add(x));
  }

  // Album artists
  if (Array.isArray(metadata.common.albumartists)) {
    metadata.common.albumartists.forEach((a: string) => {
      splitArtists(a).forEach((x) => artistSet.add(x));
    });
  }

  // Single album artist fallback
  if (metadata.common.albumartist) {
    splitArtists(metadata.common.albumartist).forEach((x) => artistSet.add(x));
  }

  return Array.from(artistSet);
};

type SongMetadata = NonNullable<FileItem["metadata"]>;

const firstLyrics = (lyrics: ParsedAudio["common"]["lyrics"]): string | undefined => {
  if (!lyrics || typeof lyrics === "string") return lyrics || undefined;
  const first = lyrics[0];
  return typeof first === "string" ? first : first?.text;
};

export const extractMetadata = (
  metadata: ParsedAudio,
  fullPath: string,
  artPath?: string,
): SongMetadata => {
  const stats = fs.statSync(fullPath);
  return {
    title: metadata.common.title,
    artist: metadata.common.artist,
    artists: getArtists(metadata),
    album: metadata.common.album,
    genre: metadata.common.genre,
    duration: metadata.format.duration,
    picture: artPath,
    year:
      metadata.common.year ||
      (metadata.common.date ? parseInt(metadata.common.date.substring(0, 4)) : undefined),
    // music-metadata reports a missing track number as null.
    trackNumber: metadata.common.track?.no ?? undefined,
    fileSize: stats.size,
    format: metadata.format.codec || metadata.format.container,
    bitrate: metadata.format.bitrate,
    bpm: metadata.common.bpm,
    lyrics: firstLyrics(metadata.common.lyrics),
  };
};

// Reads a song's tags and saves its embedded cover to the art cache. Throws if the file can't be
// parsed.
export const readSongMetadata = async (filePath: string) => {
  // eval keeps tsc from turning import() into require() (CLAUDE.md §11).
  musicMetadata ??= (await eval('import("music-metadata")')) as MusicMetadata;
  const parsed = await musicMetadata.parseFile(filePath);
  const picture = parsed.common.picture?.[0];
  const artPath = picture ? saveArt(Buffer.from(picture.data), picture.format) : undefined;
  return extractMetadata(parsed, filePath, artPath);
};
