import { NavTab } from "./types";

export const navItems: {
  label: string;
  tab: NavTab;
}[] = [
  { label: "Library", tab: "library" },
  { label: "Artists", tab: "artists" },
  { label: "Albums", tab: "albums" },
  { label: "Genres", tab: "genres" },
  { label: "Playlists", tab: "playlists" }
];