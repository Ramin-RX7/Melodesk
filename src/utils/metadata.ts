export const normalizeGenre = (genre: string): string => {
    return genre
        .toLowerCase()
        .split(' ')
        .map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(' ');
}

export function formatArtists(artists?: string[]): { display: string, full: string } {
    if (!artists || artists.length === 0) return { display: "Unknown Artist", full: "Unknown Artist" };
    const full = artists.join(", ");
    let display = full;
    if (artists.length > 3) {
        display = artists.slice(0, 3).join(", ") + ", ...";
    }
    return { display, full };
};