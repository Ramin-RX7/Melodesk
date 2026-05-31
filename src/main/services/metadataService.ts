import { app } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";



const ART_CACHE_DIR = path.join(app.getPath("userData"), "art_cache");

export const saveArt = (buffer: Buffer, format: string, filePath: string): string | undefined => {
    try {
        const hash = crypto.createHash("md5").update(filePath).digest("hex");
        const ext = format.split("/")[1] || "jpg";
        const artPath = path.join(ART_CACHE_DIR, `${hash}.${ext}`);

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

export const getArtists = (metadata: any): string[] => {
    const artistSet = new Set<string>();

    // Main artists
    if (Array.isArray(metadata.common.artists)) {
        metadata.common.artists.forEach((a: string) => {
            splitArtists(a).forEach((x) => artistSet.add(x));
        });
    }

    // Single artist string fallback
    if (metadata.common.artist) {
        splitArtists(metadata.common.artist).forEach((x) =>
            artistSet.add(x)
        );
    }

    // Album artists
    if (Array.isArray(metadata.common.albumartists)) {
        metadata.common.albumartists.forEach((a: string) => {
            splitArtists(a).forEach((x) => artistSet.add(x));
        });
    }

    // Single album artist fallback
    if (metadata.common.albumartist) {
        splitArtists(metadata.common.albumartist).forEach((x) =>
            artistSet.add(x)
        );
    }

    return Array.from(artistSet);
};

export const extractMetadata = (metadata: any, fullPath: string, artPath?: string) => {
    const stats = fs.statSync(fullPath);
    return {
        title: metadata.common.title,
        artist: metadata.common.artist,
        artists: getArtists(metadata),
        album: metadata.common.album,
        genre: metadata.common.genre,
        duration: metadata.format.duration,
        picture: artPath,
        year: metadata.common.year || (metadata.common.date ? parseInt(metadata.common.date.substring(0, 4)) : undefined),
        trackNumber: metadata.common.track?.no,
        fileSize: stats.size,
        format: metadata.format.codec || metadata.format.container,
        bitrate: metadata.format.bitrate,
        bpm: metadata.common.bpm,
        lyrics: metadata.common.lyrics ? (typeof metadata.common.lyrics === "string" ? metadata.common.lyrics : metadata.common.lyrics[0]?.text) : undefined,
    };
};
