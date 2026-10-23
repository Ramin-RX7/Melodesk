export const normalizeGenre = (genre: string): string => {
  return genre
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Songs without an artist tag are grouped under this name (a special page on the Artists tab).
export const UNKNOWN_ARTIST = "Unknown Artist";

// A song's artists for grouping and navigation: its tagged artists, or [UNKNOWN_ARTIST].
export function artistsOf(track: { metadata?: { artists?: string[]; artist?: string } }): string[] {
  const meta = track.metadata;
  if (meta?.artists && meta.artists.length > 0) return meta.artists;
  if (meta?.artist) return [meta.artist];
  return [UNKNOWN_ARTIST];
}

export function formatArtists(artists?: string[]): { display: string; full: string } {
  if (!artists || artists.length === 0) return { display: UNKNOWN_ARTIST, full: UNKNOWN_ARTIST };
  const full = artists.join(", ");
  let display = full;
  if (artists.length > 3) {
    display = artists.slice(0, 3).join(", ") + ", ...";
  }
  return { display, full };
}
