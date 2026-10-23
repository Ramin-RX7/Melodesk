import { FileItem } from "../../types";
import { artistsOf, UNKNOWN_ARTIST } from "../../../utils/metadata";
import { GroupSortBy, GroupType } from "./types";

export function getFilteredSongs(
  allTracks: FileItem[],
  selectedGroup: string,
  type: GroupType,
  searchQuery: string,
  sortDescending: boolean,
) {
  const filteredSongs = allTracks.filter((track) => {
    const meta = track.metadata;
    // Songs without tags still belong to the "Unknown Artist" group.
    if (!meta && type !== "artist") return false;

    const isMatch =
      type === "artist"
        ? artistsOf(track).includes(selectedGroup)
        : type === "album"
          ? meta!.album === selectedGroup
          : type === "genre"
            ? meta!.genre?.some((g) => g.toLowerCase() === selectedGroup.toLowerCase())
            : false;

    if (!isMatch) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      const title = (meta?.title || track.name).toLowerCase();
      const artist = (meta?.artists?.join(", ") || "").toLowerCase();
      const album = (meta?.album || "").toLowerCase();

      return title.includes(query) || artist.includes(query) || album.includes(query);
    }

    return true;
  });

  filteredSongs.sort((a, b) => {
    if (type === "album") {
      const trackA = a.metadata?.trackNumber ?? Number.MAX_SAFE_INTEGER;
      const trackB = b.metadata?.trackNumber ?? Number.MAX_SAFE_INTEGER;

      const res = trackA - trackB;

      return sortDescending ? -res : res;
    }

    const titleA = a.metadata?.title || a.name;
    const titleB = b.metadata?.title || b.name;

    const res = titleA.localeCompare(titleB, undefined, {
      sensitivity: "base",
    });

    return sortDescending ? -res : res;
  });

  return filteredSongs;
}

export function getGroupEntries(
  allTracks: FileItem[],
  type: GroupType,
  searchQuery: string,
  sortBy: GroupSortBy,
  sortDescending: boolean,
  normalizeGenre: (genre: string) => string,
  /** Albums with fewer songs are left out (config.minSongsForAlbum). */
  minSongsForAlbum?: number,
) {
  const groups: Record<string, number> = {};

  allTracks.forEach((track) => {
    const meta = track.metadata;

    if (type === "artist") {
      artistsOf(track).forEach((artist) => {
        groups[artist] = (groups[artist] || 0) + 1;
      });
      return;
    }

    if (!meta) return;

    if (type === "album" && meta.album) {
      groups[meta.album] = (groups[meta.album] || 0) + 1;
    } else if (type === "genre" && meta.genre) {
      meta.genre.forEach((g) => {
        const normalized = normalizeGenre(g.trim());

        groups[normalized] = (groups[normalized] || 0) + 1;
      });
    }
  });

  let entries = Object.entries(groups);

  if (type === "album" && minSongsForAlbum !== undefined) {
    entries = entries.filter(([, count]) => count >= minSongsForAlbum);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();

    entries = entries.filter(([name]) => name.toLowerCase().includes(query));
  }

  entries.sort((a, b) => {
    const byName = () => a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
    const res = sortBy === "count" ? a[1] - b[1] || byName() : byName();

    return sortDescending ? -res : res;
  });

  // "Unknown Artist" isn't a real artist: always list it last.
  if (type === "artist") {
    const unknown = entries.findIndex(([name]) => name === UNKNOWN_ARTIST);
    if (unknown >= 0) entries.push(...entries.splice(unknown, 1));
  }

  return entries;
}
