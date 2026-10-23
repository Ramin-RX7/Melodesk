import path from "path";

import { FileItem } from "../../../renderer/types";
import { replaceSongPaths } from "../../ipc/playlistHandlers";
import { CacheMap } from "../cacheService";
import { hashPath } from "../hashUtil";
import { notify } from "../notifyService";
import { getRemovedSongs, updateRemovedSongs } from "../removedSongsService";
import { replaceSessionPaths } from "../sessionService";

// A song's id (FileItem.hash) is created from its path when it first enters the library and then
// kept. When a file is moved or renamed, the scan sees one song disappear and a new one appear;
// if they are the same file (same size, length and tags) the new one takes over the old id, so
// play counts and history stay, and playlists and the saved session are pointed at the new path.

export type SongMove = { id: string; from: string; to: string };

type Candidate = { id: string; path: string };

type Identity = {
  size?: number;
  duration?: number;
  title?: string;
  artists?: string[];
  album?: string;
};

// Moving a file keeps its bytes, so all of these stay the same. Files without tags can't be
// recognised (no size is known for them).
const identityKey = (s: Identity): string | null =>
  s.size === undefined
    ? null
    : [
        s.size,
        Math.round(s.duration ?? 0),
        s.title ?? "",
        (s.artists ?? []).join("\u0001"),
        s.album ?? "",
      ].join("\u0000");

const itemKey = (item: FileItem) =>
  identityKey({ ...item.metadata, size: item.metadata?.fileSize });

const sameName = (a: string, b: string) =>
  path.basename(a).toLowerCase() === path.basename(b).toLowerCase();

/**
 * Compares the last saved library (`before`) with a scan's result (`after`). New files that are
 * a vanished or previously removed song take over its id (`item.hash` is set). Vanished songs
 * that weren't found again are remembered in the removed-songs store.
 * Returns the moves whose path changed.
 */
export const detectMoves = (before: CacheMap, after: FileItem[]): SongMove[] => {
  const afterKeys = new Set(after.map((item) => hashPath(item.path)));
  const vanished = Object.entries(before)
    .filter(([key]) => !afterKeys.has(key))
    .map(([, item]) => ({ ...item, hash: item.hash ?? hashPath(item.path) }));
  const added = after.filter((item) => !before[hashPath(item.path)]);

  const candidates = new Map<string, Candidate[]>();
  const addCandidate = (key: string | null, candidate: Candidate) => {
    if (key) candidates.set(key, [...(candidates.get(key) ?? []), candidate]);
  };
  for (const item of vanished) addCandidate(itemKey(item), { id: item.hash, path: item.path });
  const removedSongs = getRemovedSongs();
  if (added.length > 0) {
    for (const song of Object.values(removedSongs)) addCandidate(identityKey(song), song);
  }

  // Ids already in use can't be given out again (e.g. two copies of one moved file).
  const used = new Set(after.filter((item) => item.hash).map((item) => item.hash!));
  const moves: SongMove[] = [];
  const returned: string[] = [];
  for (const item of added) {
    const key = itemKey(item);
    const options = (key && candidates.get(key)?.filter((c) => !used.has(c.id))) || [];
    const named = options.filter((c) => sameName(c.path, item.path));
    const match = options.length === 1 ? options[0] : named.length === 1 ? named[0] : undefined;
    if (!match) continue;

    item.hash = match.id;
    used.add(match.id);
    if (removedSongs[match.id]) returned.push(match.id);
    if (hashPath(match.path) !== hashPath(item.path)) {
      moves.push({ id: match.id, from: match.path, to: item.path });
    }
  }

  updateRemovedSongs(
    vanished.filter((item) => !used.has(item.hash)),
    returned,
  );
  return moves;
};

// Points playlists and the saved session at the songs' new paths and tells the user.
export const applyMoves = (moves: SongMove[]) => {
  if (moves.length === 0) return;
  const newPaths = new Map(moves.map((move) => [hashPath(move.from), move.to]));
  const replace = (p: string) => newPaths.get(hashPath(p)) ?? p;

  replaceSongPaths(replace);
  replaceSessionPaths(replace);
  console.log(`Detected ${moves.length} moved or renamed song(s).`);
  notify(
    "info",
    moves.length === 1
      ? `"${path.basename(moves[0].to)}" was moved or renamed; its play count and playlists were kept.`
      : `${moves.length} songs were moved or renamed; their play counts and playlists were kept.`,
  );
};
