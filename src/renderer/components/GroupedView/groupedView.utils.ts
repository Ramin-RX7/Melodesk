import { FileItem, UserConfig } from "../../types";
import { GroupSortBy, GroupType } from "./types";

export function getFilteredSongs(
    allTracks: FileItem[],
    selectedGroup: string,
    type: GroupType,
    searchQuery: string,
    sortDescending: boolean
) {
    const filteredSongs = allTracks.filter(track => {
        const meta = track.metadata;
        if (!meta) return false;

        const isMatch =
            type === "artist"
                ? meta.artists
                    ? meta.artists.includes(selectedGroup)
                    : meta.artist === selectedGroup
                : type === "album"
                    ? meta.album === selectedGroup
                    : type === "genre"
                        ? meta.genre?.some(
                            g => g.toLowerCase() === selectedGroup.toLowerCase()
                        )
                        : false;

        if (!isMatch) return false;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();

            const title = (meta.title || track.name).toLowerCase();
            const artist = (meta.artist || "").toLowerCase();
            const album = (meta.album || "").toLowerCase();

            return (
                title.includes(query) ||
                artist.includes(query) ||
                album.includes(query)
            );
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
            sensitivity: "base"
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
    config: UserConfig | null
) {
    const groups: Record<string, number> = {};

    allTracks.forEach(track => {
        const meta = track.metadata;

        if (!meta) return;

        if (type === "artist") {
            const artists = meta.artists || (meta.artist ? [meta.artist] : []);

            artists.forEach(a => {
                groups[a] = (groups[a] || 0) + 1;
            });
        }

        else if (type === "album" && meta.album) {
            groups[meta.album] = (groups[meta.album] || 0) + 1;
        }

        else if (type === "genre" && meta.genre) {
            meta.genre.forEach(g => {
                const normalized = normalizeGenre(g.trim());

                groups[normalized] = (groups[normalized] || 0) + 1;
            });
        }
    });

    let entries = Object.entries(groups);

    if (type === "album" && config) {
        entries = entries.filter(
            ([_, count]) => count >= config.minSongsForAlbum
        );
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();

        entries = entries.filter(([name]) =>
            name.toLowerCase().includes(query)
        );
    }

    entries.sort((a, b) => {
        let res = 0;

        if (sortBy === "count") {
            res = a[1] - b[1];

            if (res === 0) {
                res = a[0].localeCompare(b[0], undefined, {
                    sensitivity: "base"
                });
            }
        }

        else {
            res = a[0].localeCompare(b[0], undefined, {
                sensitivity: "base"
            });
        }

        return sortDescending ? -res : res;
    });

    return entries;
}