import React, { useMemo } from "react";
import { FileItem } from "../../types";
import { VirtualGrid } from "../VirtualGrid";
import { normalizeGenre } from "../../../utils/metadata";
import { GROUP_CARD_HEIGHT, GroupCard } from "./GroupCard";
import { GroupType } from "./types";

type Props = {
  entries: [string, number][];
  type: GroupType;
  allTracks: FileItem[];
  /** Custom artist pictures by name (artists only); they take precedence over cover art. */
  artistPictures?: Record<string, string>;
  onSelect: (name: string) => void;
  onContextMenu?: (e: React.MouseEvent, name: string) => void;
};

// Group name -> cover art of the first song in that group that has one. Built in one pass over
// the library instead of searching it once per card.
const buildCoverMap = (tracks: FileItem[], type: GroupType): Map<string, string> => {
  const covers = new Map<string, string>();
  for (const track of tracks) {
    const meta = track.metadata;
    if (!meta?.picture) continue;
    const names =
      type === "artist"
        ? (meta.artists ?? [])
        : type === "album"
          ? meta.album
            ? [meta.album]
            : []
          : (meta.genre ?? []).map((g) => normalizeGenre(g.trim()));
    for (const name of names) {
      if (!covers.has(name)) covers.set(name, meta.picture);
    }
  }
  return covers;
};

export function GroupList({
  entries,
  type,
  allTracks,
  artistPictures,
  onSelect,
  onContextMenu,
}: Props) {
  const covers = useMemo(() => buildCoverMap(allTracks, type), [allTracks, type]);

  return (
    <VirtualGrid
      items={entries}
      minItemWidth={180}
      gap={25}
      estimateRowHeight={GROUP_CARD_HEIGHT}
      getKey={([name]) => name}
      renderItem={([name, count]) => (
        <GroupCard
          type={type}
          name={name}
          count={count}
          picture={(type === "artist" && artistPictures?.[name]) || covers.get(name)}
          onClick={() => onSelect(name)}
          onContextMenu={onContextMenu ? (e) => onContextMenu(e, name) : undefined}
        />
      )}
    />
  );
}
