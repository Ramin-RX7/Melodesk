export type GroupType = "artist" | "album" | "genre";

export type GroupSortBy = "alphabet" | "count";

export interface SelectedGroup {
    type: GroupType;
    name: string;
}