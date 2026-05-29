export type Page =
  | "library"
  | "artists"
  | "albums"
  | "genres"
  | "playlists"
  | "queue"
  | "details";

export type NavTab = Exclude<Page, "queue" | "details">;