import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IoShuffle, IoArrowBack } from "react-icons/io5";

import { FileItem, PlayRecord, UserConfig } from "../../types";
import { normalizeGenre } from "../../../utils/metadata";
import { useArtistPictures } from "../../../hooks/useArtistPictures";
import { SongCard } from "../GroupedView/SongCard";
import { GroupCard } from "../GroupedView/GroupCard";
import styles from "./HomeView.module.css";

interface HomeViewProps {
  allTracks: FileItem[];
  currentTrack: FileItem | null;
  themeColor: string;
  config: UserConfig | null;
  handleFileSelect: (item: FileItem, contextQueue?: FileItem[]) => void;
  handleShufflePlay: (songs: FileItem[]) => void;
  onContextMenu: (e: React.MouseEvent, song: FileItem) => void;
  onScrollRef: (el: HTMLElement | null) => void;
  onSelectArtist: (name: string) => void;
  onNavigateTab: (tab: "library" | "artists" | "albums" | "genres") => void;
}

const DEFAULT_PREVIEW_LIMIT = 10;
const RECENT_FETCH_LIMIT = 200;
const RECENT_MAX = 100;

type DetailKey = "recent" | "most-played" | "popular-artists" | "never-played";

type ArtistEntry = { name: string; plays: number; songCount: number };

const formatListeningTime = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds < 0) return "0m";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

export function HomeView({
  allTracks,
  currentTrack,
  themeColor,
  config,
  handleFileSelect,
  handleShufflePlay,
  onContextMenu,
  onScrollRef,
  onSelectArtist,
  onNavigateTab,
}: HomeViewProps) {
  const previewLimit = Math.max(1, config?.homeItemLimit ?? DEFAULT_PREVIEW_LIMIT);
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [recentPlays, setRecentPlays] = useState<PlayRecord[]>([]);
  const [detail, setDetail] = useState<DetailKey | null>(null);
  const { artistPictures } = useArtistPictures();

  const scrollAreaRef = useCallback(
    (el: HTMLElement | null) => {
      onScrollRef?.(el);
    },
    [onScrollRef],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [counts, recent] = await Promise.all([
          window.api.getPlayCounts(),
          window.api.getRecentPlays(RECENT_FETCH_LIMIT),
        ]);
        setPlayCounts(counts);
        setRecentPlays(recent);
      } catch (error) {
        console.error("Failed to load tracker data:", error);
      }
    };
    load();
  }, []);

  const mediaTracks = useMemo(() => allTracks.filter((t) => t.isMedia), [allTracks]);

  const hashToTrack = useMemo(() => {
    const map = new Map<string, FileItem>();
    for (const t of mediaTracks) {
      if (t.hash) map.set(t.hash, t);
    }
    return map;
  }, [mediaTracks]);

  const recentlyPlayed = useMemo(() => {
    const result: FileItem[] = [];
    const seen = new Set<string>();
    for (const rec of recentPlays) {
      if (seen.has(rec.hash)) continue;
      const track = hashToTrack.get(rec.hash);
      if (!track) continue;
      seen.add(rec.hash);
      result.push(track);
      if (result.length >= RECENT_MAX) break;
    }
    return result;
  }, [recentPlays, hashToTrack]);

  const mostPlayed = useMemo(() => {
    return Object.entries(playCounts)
      .filter(([hash]) => hashToTrack.has(hash))
      .sort((a, b) => b[1] - a[1])
      .map(([hash]) => hashToTrack.get(hash)!);
  }, [playCounts, hashToTrack]);

  // Aggregate plays + song counts per artist.
  const artistStats = useMemo(() => {
    const map = new Map<string, { plays: number; songCount: number }>();
    for (const track of mediaTracks) {
      const artists = track.metadata?.artists;
      if (!artists || artists.length === 0) continue;
      const plays = track.hash ? (playCounts[track.hash] ?? 0) : 0;
      for (const artist of artists) {
        const name = artist.trim();
        if (!name) continue;
        const entry = map.get(name) ?? { plays: 0, songCount: 0 };
        entry.plays += plays;
        entry.songCount += 1;
        map.set(name, entry);
      }
    }
    return map;
  }, [mediaTracks, playCounts]);

  // Artist -> cover art of one of their songs, for artists without a custom picture.
  const artistCovers = useMemo(() => {
    const covers = new Map<string, string>();
    for (const track of mediaTracks) {
      const picture = track.metadata?.picture;
      if (!picture) continue;
      for (const artist of track.metadata?.artists ?? []) {
        const name = artist.trim();
        if (name && !covers.has(name)) covers.set(name, picture);
      }
    }
    return covers;
  }, [mediaTracks]);

  const popularArtists = useMemo<ArtistEntry[]>(() => {
    return Array.from(artistStats.entries())
      .sort((a, b) => b[1].plays - a[1].plays || b[1].songCount - a[1].songCount)
      .map(([name, stats]) => ({ name, ...stats }));
  }, [artistStats]);

  const neverPlayed = useMemo(() => {
    return mediaTracks.filter((t) => !(t.hash && playCounts[t.hash] > 0));
  }, [mediaTracks, playCounts]);

  const stats = useMemo(() => {
    const artistSet = new Set<string>();
    const albumSet = new Set<string>();
    const genreSet = new Set<string>();
    let listeningSeconds = 0;
    let totalPlays = 0;

    for (const track of mediaTracks) {
      track.metadata?.artists?.forEach((a) => {
        const n = a.trim();
        if (n) artistSet.add(n);
      });
      if (track.metadata?.album) albumSet.add(track.metadata.album.trim());
      track.metadata?.genre?.forEach((g) => {
        const n = g.trim();
        if (n) genreSet.add(normalizeGenre(n));
      });
      const plays = track.hash ? (playCounts[track.hash] ?? 0) : 0;
      totalPlays += plays;
      listeningSeconds += plays * (track.metadata?.duration ?? 0);
    }

    let topSong: FileItem | null = null;
    let topSongPlays = 0;
    for (const [hash, count] of Object.entries(playCounts)) {
      if (count > topSongPlays && hashToTrack.has(hash)) {
        topSongPlays = count;
        topSong = hashToTrack.get(hash)!;
      }
    }

    const topArtist = popularArtists.find((a) => a.plays > 0) ?? null;

    return {
      songCount: mediaTracks.length,
      artistCount: artistSet.size,
      albumCount: albumSet.size,
      genreCount: genreSet.size,
      totalPlays,
      listeningSeconds,
      topSong,
      topSongPlays,
      topArtist,
      neverPlayedCount: neverPlayed.length,
    };
  }, [mediaTracks, playCounts, hashToTrack, popularArtists, neverPlayed]);

  const doubleClickToPlay = config?.doubleClickToPlay ?? true;

  const renderSongCard = (song: FileItem, contextQueue: FileItem[]) => (
    <SongCard
      key={song.path}
      song={song}
      currentTrack={currentTrack}
      themeColor={themeColor}
      onClick={() => {
        if (!doubleClickToPlay) handleFileSelect(song, contextQueue);
      }}
      onDoubleClick={() => {
        if (doubleClickToPlay) handleFileSelect(song, contextQueue);
      }}
      onContextMenu={(e) => onContextMenu(e, song)}
    />
  );

  const renderArtistCard = (artist: ArtistEntry) => (
    <GroupCard
      key={artist.name}
      type="artist"
      name={artist.name}
      count={artist.songCount}
      picture={artistPictures[artist.name] || artistCovers.get(artist.name)}
      onClick={() => onSelectArtist(artist.name)}
    />
  );

  // ----- Full-result detail page -----
  const detailConfig: Record<DetailKey, { title: string; render: () => React.ReactNode }> = {
    recent: {
      title: "Recently Played",
      render: () => (
        <div className={styles.fullGrid}>
          {recentlyPlayed.map((s) => renderSongCard(s, recentlyPlayed))}
        </div>
      ),
    },
    "most-played": {
      title: "Most Played",
      render: () => (
        <div className={styles.fullGrid}>
          {mostPlayed.map((s) => renderSongCard(s, mostPlayed))}
        </div>
      ),
    },
    "popular-artists": {
      title: "Most Popular Artists",
      render: () => <div className={styles.fullGrid}>{popularArtists.map(renderArtistCard)}</div>,
    },
    "never-played": {
      title: "Never Played",
      render: () => (
        <div className={styles.fullGrid}>
          {neverPlayed.map((s) => renderSongCard(s, neverPlayed))}
        </div>
      ),
    },
  };

  if (detail) {
    const cfg = detailConfig[detail];
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.detailHeaderLeft}>
            <button className={styles.backButton} onClick={() => setDetail(null)}>
              <IoArrowBack /> Back
            </button>
            <h2 className={styles.title}>{cfg.title}</h2>
          </div>
        </div>
        <div className={styles.scrollArea}>{cfg.render()}</div>
      </div>
    );
  }

  // ----- Home overview -----
  const renderSongRow = (
    songs: FileItem[],
    emptyText: string,
    detailKey: DetailKey,
    title: string,
  ) => (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {songs.length > previewLimit && (
          <button className={styles.showAllButton} onClick={() => setDetail(detailKey)}>
            Show all
          </button>
        )}
      </div>
      {songs.length === 0 ? (
        <div className={styles.emptyState}>{emptyText}</div>
      ) : (
        <div className={styles.row}>
          {songs.slice(0, previewLimit).map((song) => (
            <div className={styles.cardWrap} key={song.path}>
              {renderSongCard(song, songs)}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Home</h2>
        <button
          className={styles.shuffleButton}
          style={{ backgroundColor: themeColor }}
          disabled={mediaTracks.length === 0}
          onClick={() => handleShufflePlay(mediaTracks)}
          title="Shuffle your whole library"
        >
          <IoShuffle /> Shuffle Play
        </button>
      </div>

      <div className={styles.scrollArea} ref={scrollAreaRef}>
        {renderSongRow(
          recentlyPlayed,
          "Nothing played yet. Start listening!",
          "recent",
          "Recently Played",
        )}
        {renderSongRow(mostPlayed, "No play history yet.", "most-played", "Most Played")}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Most Popular Artists</h3>
            {popularArtists.length > previewLimit && (
              <button className={styles.showAllButton} onClick={() => setDetail("popular-artists")}>
                Show all
              </button>
            )}
          </div>
          {popularArtists.length === 0 ? (
            <div className={styles.emptyState}>No artists in your library yet.</div>
          ) : (
            <div className={styles.row}>
              {popularArtists.slice(0, previewLimit).map((artist) => (
                <div className={styles.artistWrap} key={artist.name}>
                  {renderArtistCard(artist)}
                </div>
              ))}
            </div>
          )}
        </section>

        {renderSongRow(
          neverPlayed,
          "Every song has been played. Nice!",
          "never-played",
          "Never Played",
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Statistics</h3>
          </div>
          <div className={styles.statsGrid}>
            <StatCard
              label="Songs"
              value={stats.songCount.toLocaleString()}
              onClick={() => onNavigateTab("library")}
            />
            <StatCard
              label="Artists"
              value={stats.artistCount.toLocaleString()}
              onClick={() => onNavigateTab("artists")}
            />
            <StatCard
              label="Albums"
              value={stats.albumCount.toLocaleString()}
              onClick={() => onNavigateTab("albums")}
            />
            <StatCard
              label="Genres"
              value={stats.genreCount.toLocaleString()}
              onClick={() => onNavigateTab("genres")}
            />
            <StatCard label="Total Plays" value={stats.totalPlays.toLocaleString()} />
            <StatCard label="Listening Time" value={formatListeningTime(stats.listeningSeconds)} />
            <StatCard
              label="Never Played"
              value={stats.neverPlayedCount.toLocaleString()}
              onClick={stats.neverPlayedCount > 0 ? () => setDetail("never-played") : undefined}
            />
            <StatCard
              label="Top Song"
              value={stats.topSong ? stats.topSong.metadata?.title || stats.topSong.name : "—"}
              sub={stats.topSong ? `${stats.topSongPlays.toLocaleString()} plays` : undefined}
              onClick={stats.topSong ? () => setDetail("most-played") : undefined}
            />
            <StatCard
              label="Top Artist"
              value={stats.topArtist ? stats.topArtist.name : "—"}
              sub={stats.topArtist ? `${stats.topArtist.plays.toLocaleString()} plays` : undefined}
              onClick={stats.topArtist ? () => setDetail("popular-artists") : undefined}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`${styles.statCard} ${onClick ? styles.statCardClickable : ""}`}
      onClick={onClick}
    >
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} title={value}>
        {value}
      </div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}
