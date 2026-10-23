import React, { useState, useEffect, useRef, useMemo } from "react";
import { IoSearch, IoClose, IoMusicalNote } from "react-icons/io5";

import { FileItem, Playlist, UserConfig } from "../../types";
import { getGroupEntries, getFilteredSongs } from "../GroupedView/groupedView.utils";
import { formatDuration } from "../../../utils/time";
import styles from "./GlobalSearch.module.css";

export type GlobalSearchNavTarget = {
  tab: "albums" | "artists" | "playlists";
  query?: string;
  groupName?: string;
  playlistId?: string;
};

type Props = {
  allTracks: FileItem[];
  config: UserConfig | null;
  themeColor: string;
  onPlaySong: (song: FileItem, queue: FileItem[]) => void;
  onSongContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
  onGroupContextMenu?: (e: React.MouseEvent, name: string, songs: FileItem[]) => void;
  onNavigate: (target: GlobalSearchNavTarget) => void;
  /** Optional external ref so a keyboard shortcut can focus the input. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function GlobalSearch({
  allTracks,
  config,
  themeColor,
  onPlaySong,
  onSongContextMenu,
  onGroupContextMenu,
  onNavigate,
  inputRef: externalInputRef,
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  const limit = config?.searchResultsPerCategory ?? 4;
  const doubleClickToPlay = config?.doubleClickToPlay ?? true;
  // Spaces around the text are ignored everywhere (songs, albums, artists, playlists and the
  // "show all" links), so typing "alan " on the way to "alan walker" doesn't hide results.
  const trimmedQuery = query.trim();
  const q = trimmedQuery.toLowerCase();

  useEffect(() => {
    if (isOpen && q) {
      window.api.getPlaylists().then(setPlaylists).catch(console.error);
    }
  }, [isOpen, q]);

  useEffect(() => {
    setShowAllSongs(false);
  }, [q]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (isOpen || query)) {
        e.stopPropagation();
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, query]);

  const results = useMemo(() => {
    if (!q) return null;

    const songs = allTracks.filter((t) => {
      const meta = t.metadata;
      if (!meta) return false;
      const title = (meta.title || t.name).toLowerCase();
      const artist = (meta.artists?.join(" ") || "").toLowerCase();
      const album = (meta.album || "").toLowerCase();
      return title.includes(q) || artist.includes(q) || album.includes(q);
    });

    // normalizeGenre is only called for 'genre' type — pass identity fn for album/artist
    const albums = getGroupEntries(
      allTracks,
      "album",
      trimmedQuery,
      "alphabet",
      false,
      (s) => s,
      config,
    );
    const artists = getGroupEntries(
      allTracks,
      "artist",
      trimmedQuery,
      "alphabet",
      false,
      (s) => s,
      config,
    );
    const matchedPlaylists = playlists.filter((p) => p.name.toLowerCase().includes(q));

    return { songs, albums, artists, playlists: matchedPlaylists };
  }, [q, allTracks, playlists, config]);

  const navigate = (target: GlobalSearchNavTarget) => {
    onNavigate(target);
    setIsOpen(false);
    setQuery("");
  };

  const playResult = (song: FileItem) => {
    onPlaySong(song, results!.songs);
    setIsOpen(false);
    setQuery("");
  };

  const hasAnyResult =
    results &&
    (results.songs.length > 0 ||
      results.albums.length > 0 ||
      results.artists.length > 0 ||
      results.playlists.length > 0);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div className={`${styles.searchBar} ${isOpen ? styles.searchBarActive : ""}`}>
        <IoSearch className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search library..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className={styles.input}
        />
        {query && (
          <button
            className={styles.clearBtn}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <IoClose />
          </button>
        )}
      </div>

      {isOpen && q && (
        <div className={styles.dropdown}>
          {!hasAnyResult ? (
            <div className={styles.noResults}>No results for "{query}"</div>
          ) : (
            <>
              {results!.songs.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>Songs</span>
                    {results!.songs.length > limit && !showAllSongs && (
                      <button className={styles.showMoreBtn} onClick={() => setShowAllSongs(true)}>
                        Show all {results!.songs.length}
                      </button>
                    )}
                    {showAllSongs && results!.songs.length > limit && (
                      <button className={styles.showMoreBtn} onClick={() => setShowAllSongs(false)}>
                        Show less
                      </button>
                    )}
                  </div>
                  {(showAllSongs ? results!.songs : results!.songs.slice(0, limit)).map((song) => (
                    <div
                      key={song.path}
                      className={styles.resultItem}
                      onClick={() => !doubleClickToPlay && playResult(song)}
                      onDoubleClick={() => doubleClickToPlay && playResult(song)}
                      onContextMenu={
                        onSongContextMenu ? (e) => onSongContextMenu(e, song) : undefined
                      }
                    >
                      <div className={styles.songThumb}>
                        {song.metadata?.picture ? (
                          <img
                            src={`media://${encodeURIComponent(song.metadata.picture)}`}
                            className={styles.thumbImg}
                          />
                        ) : (
                          <IoMusicalNote className={styles.thumbIcon} />
                        )}
                      </div>
                      <div className={styles.resultText}>
                        <div className={styles.resultPrimary}>
                          {song.metadata?.title || song.name}
                        </div>
                        <div className={styles.resultSecondary}>
                          {song.metadata?.artists?.join(", ") || "Unknown Artist"}
                        </div>
                      </div>
                      {song.metadata?.duration != null && (
                        <div className={styles.resultMeta}>
                          {formatDuration(song.metadata.duration)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {results!.albums.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>Albums</span>
                    {results!.albums.length > limit && (
                      <button
                        className={styles.showMoreBtn}
                        style={{ color: themeColor }}
                        onClick={() => navigate({ tab: "albums", query: trimmedQuery })}
                      >
                        Show more
                      </button>
                    )}
                  </div>
                  {results!.albums.slice(0, limit).map(([name, count]) => (
                    <div
                      key={name}
                      className={styles.resultItem}
                      onClick={() => navigate({ tab: "albums", groupName: name })}
                      onContextMenu={
                        onGroupContextMenu
                          ? (e) =>
                              onGroupContextMenu(
                                e,
                                name,
                                getFilteredSongs(allTracks, name, "album", "", false),
                              )
                          : undefined
                      }
                    >
                      <div className={styles.resultText}>
                        <div className={styles.resultPrimary}>{name}</div>
                        <div className={styles.resultSecondary}>{count} songs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results!.artists.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>Artists</span>
                    {results!.artists.length > limit && (
                      <button
                        className={styles.showMoreBtn}
                        style={{ color: themeColor }}
                        onClick={() => navigate({ tab: "artists", query: trimmedQuery })}
                      >
                        Show more
                      </button>
                    )}
                  </div>
                  {results!.artists.slice(0, limit).map(([name, count]) => (
                    <div
                      key={name}
                      className={styles.resultItem}
                      onClick={() => navigate({ tab: "artists", groupName: name })}
                      onContextMenu={
                        onGroupContextMenu
                          ? (e) =>
                              onGroupContextMenu(
                                e,
                                name,
                                getFilteredSongs(allTracks, name, "artist", "", false),
                              )
                          : undefined
                      }
                    >
                      <div className={styles.resultText}>
                        <div className={styles.resultPrimary}>{name}</div>
                        <div className={styles.resultSecondary}>{count} songs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results!.playlists.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>Playlists</span>
                    {results!.playlists.length > limit && (
                      <button
                        className={styles.showMoreBtn}
                        style={{ color: themeColor }}
                        onClick={() => navigate({ tab: "playlists", query: trimmedQuery })}
                      >
                        Show more
                      </button>
                    )}
                  </div>
                  {results!.playlists.slice(0, limit).map((pl) => (
                    <div
                      key={pl.id}
                      className={styles.resultItem}
                      onClick={() => navigate({ tab: "playlists", playlistId: pl.id })}
                    >
                      <div className={styles.resultText}>
                        <div className={styles.resultPrimary}>{pl.name}</div>
                        <div className={styles.resultSecondary}>{pl.songs.length} songs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
