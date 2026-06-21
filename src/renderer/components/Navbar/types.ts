export type Page =
  | "home"
  | "library"
  | "artists"
  | "albums"
  | "genres"
  | "playlists"
  | "queue"
  | "details"
  | "settings";

export type NavTab = Exclude<Page, "queue" | "details" | "settings">;