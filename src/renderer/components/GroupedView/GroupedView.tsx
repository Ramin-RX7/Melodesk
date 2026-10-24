import React, { useState, useEffect, useCallback, useMemo } from "react";
import { IoSearch, IoSwapVertical, IoShuffle, IoCreate, IoSave, IoImage } from "react-icons/io5";

import { FileItem, UserConfig, ArtistInfo } from "../../types";
import { useArtistPictures } from "../../../hooks/useArtistPictures";
import { UNKNOWN_ARTIST } from "../../../utils/metadata";

import { colors } from "../../theme/colors";

import styles from "./GroupedView.module.css";

import { GroupList } from "./GroupList";
import { SongGrid } from "./SongGrid";

import { getFilteredSongs, getGroupEntries } from "./groupedView.utils";

import { GroupSortBy, GroupType, SelectedGroup } from "./types";

type Props = {
  type: GroupType;
  allTracks: FileItem[];

  selectedGroup: SelectedGroup | null;

  searchQuery: string;
  sortBy: GroupSortBy;
  sortDescending: boolean;

  currentTrack?: FileItem | null;

  config: UserConfig | null;

  themeColor: string;

  onGroupSelect: (group: SelectedGroup) => void;
  onGoBack: () => void;
  onScrollRef?: (el: HTMLDivElement | null) => void;

  setSearchQuery: (query: string) => void;

  setSortBy: (sortBy: GroupSortBy) => void;

  setSortDescending: (value: boolean) => void;

  normalizeGenre: (genre: string) => string;

  handleFileSelect: (song: FileItem, queue?: FileItem[]) => void;
  handleShufflePlay?: (songs: FileItem[]) => void;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
  onGroupContextMenu?: (e: React.MouseEvent, name: string, songs: FileItem[]) => void;
};

export function GroupedView({
  type,
  allTracks,

  selectedGroup,

  searchQuery,
  sortBy,
  sortDescending,

  currentTrack,

  config,

  themeColor,

  onGroupSelect,
  onGoBack,
  onScrollRef,
  setSearchQuery,
  setSortBy,
  setSortDescending,

  normalizeGenre,

  handleFileSelect,
  handleShufflePlay,
  onContextMenu,
  onGroupContextMenu,
}: Props) {
  const scrollAreaRef = useCallback(
    (el: HTMLDivElement | null) => {
      onScrollRef?.(el);
    },
    [onScrollRef],
  );

  const { artistPictures, setArtistPicture } = useArtistPictures();
  const [artistInfo, setArtistInfo] = useState<ArtistInfo | null>(null);
  const [isEditingArtist, setIsEditingArtist] = useState(false);
  const [editBio, setEditBio] = useState("");

  // Switching to another artist or page cancels an unsaved bio edit, so a draft can never be
  // saved onto a different artist. Responses for an artist we already left are ignored.
  useEffect(() => {
    setIsEditingArtist(false);
    setEditBio("");
    setArtistInfo(null);
    if (type !== "artist" || !selectedGroup) return;

    let active = true;
    window.api
      .getArtistInfo(selectedGroup.name)
      .then((info) => {
        if (!active) return;
        setArtistInfo(info);
        setEditBio(info?.bio || "");
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [type, selectedGroup]);

  const cancelArtistEdit = () => {
    setIsEditingArtist(false);
    setEditBio(artistInfo?.bio || "");
  };

  const handleSaveArtist = async () => {
    if (!selectedGroup) return;
    try {
      const updated = await window.api.updateArtistInfo(selectedGroup.name, { bio: editBio });
      setArtistInfo(updated);
      setIsEditingArtist(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectImage = async () => {
    if (!selectedGroup) return;
    try {
      const path = await window.api.selectArtistImage();
      if (path) {
        const updated = await window.api.updateArtistInfo(selectedGroup.name, { picture: path });
        setArtistInfo(updated);
        setArtistPicture(selectedGroup.name, path);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Both walk the whole library, so they're only recomputed when their inputs change, not on
  // every redraw (playback, toasts…).
  const minSongsForAlbum = config?.minSongsForAlbum;
  const songs = useMemo(
    () =>
      selectedGroup
        ? getFilteredSongs(allTracks, selectedGroup.name, type, searchQuery, sortDescending)
        : [],
    [allTracks, selectedGroup, type, searchQuery, sortDescending],
  );
  const entries = useMemo(
    () =>
      selectedGroup
        ? []
        : getGroupEntries(
            allTracks,
            type,
            searchQuery,
            sortBy,
            sortDescending,
            normalizeGenre,
            minSongsForAlbum,
          ),
    [
      allTracks,
      selectedGroup,
      type,
      searchQuery,
      sortBy,
      sortDescending,
      normalizeGenre,
      minSongsForAlbum,
    ],
  );

  if (selectedGroup) {
    return (
      <div className={styles.container}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.backButton} onClick={onGoBack}>
              Back to {type}s
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <h2 className={styles.title} style={{ margin: 0 }}>
                {selectedGroup.name}
              </h2>
              {handleShufflePlay && (
                <button
                  onClick={() => handleShufflePlay(songs)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    backgroundColor: themeColor,
                    color: colors.textPrimary,
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  <IoShuffle /> Shuffle Play
                </button>
              )}
              {onGroupContextMenu && (
                <button
                  onClick={(e) => onGroupContextMenu(e, selectedGroup.name, songs)}
                  style={{
                    background: "none",
                    border: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: 0,
                  }}
                  title="More options"
                >
                  ···
                </button>
              )}
            </div>
          </div>

          {/* SEARCH */}
          <div className={styles.searchContainer}>
            <IoSearch className={styles.searchIcon} />

            <input
              type="text"
              placeholder={`Search in ${selectedGroup.name}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className={styles.scrollArea} key="detail" ref={scrollAreaRef}>
          {type === "artist" && selectedGroup?.name === UNKNOWN_ARTIST && (
            <div style={{ padding: "20px 20px 0", color: colors.textDim, fontSize: "14px" }}>
              Songs without an artist tag. Add one with Edit Tags on a song&apos;s details page to
              move it to its artist.
            </div>
          )}

          {/* ARTIST PROFILE (not for "Unknown Artist", which isn't a real artist) */}
          {type === "artist" && artistInfo && selectedGroup?.name !== UNKNOWN_ARTIST && (
            <div
              style={{
                display: "flex",
                gap: "30px",
                padding: "20px",
                backgroundColor: colors.bgElevated,
                borderRadius: "12px",
                marginBottom: "20px",
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div
                style={{
                  width: "200px",
                  height: "200px",
                  borderRadius: "10px",
                  backgroundColor: colors.bgInput,
                  overflow: "hidden",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                {artistInfo.picture ? (
                  <img
                    src={`media://${encodeURIComponent(artistInfo.picture.replace(/\\/g, "/"))}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.textIcon,
                      fontSize: "60px",
                    }}
                  >
                    <IoImage />
                  </div>
                )}
                <button
                  onClick={handleSelectImage}
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "10px",
                    backgroundColor: colors.overlay70,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.borderStrong}`,
                    borderRadius: "5px",
                    padding: "5px 10px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Change Photo
                </button>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "24px" }}>About</h3>
                  {!isEditingArtist ? (
                    <button
                      onClick={() => setIsEditingArtist(true)}
                      style={{
                        background: "none",
                        border: `1px solid ${colors.borderStrong}`,
                        color: colors.textTertiary,
                        borderRadius: "15px",
                        padding: "4px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <IoCreate /> Edit Bio
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={cancelArtistEdit}
                        style={{
                          background: "none",
                          border: `1px solid ${colors.borderStrong}`,
                          color: colors.textTertiary,
                          borderRadius: "15px",
                          padding: "4px 12px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveArtist}
                        style={{
                          backgroundColor: themeColor,
                          border: "none",
                          color: colors.textPrimary,
                          borderRadius: "15px",
                          padding: "4px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <IoSave /> Save
                      </button>
                    </div>
                  )}
                </div>
                {isEditingArtist ? (
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    style={{
                      flex: 1,
                      width: "100%",
                      backgroundColor: colors.bgInput,
                      color: colors.textSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "8px",
                      padding: "10px",
                      resize: "none",
                      fontFamily: "inherit",
                    }}
                    placeholder="Write a biography for this artist..."
                  />
                ) : (
                  <div
                    style={{
                      flex: 1,
                      color: colors.textMuted,
                      lineHeight: "1.5",
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {artistInfo.bio || "No biography available. Click 'Edit Bio' to add one."}
                  </div>
                )}
              </div>
            </div>
          )}

          <SongGrid
            songs={songs}
            currentTrack={currentTrack}
            config={config}
            themeColor={themeColor}
            onSongClick={(song) => handleFileSelect(song, songs)}
            onContextMenu={onContextMenu}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <h2 className={styles.title}>{type.charAt(0).toUpperCase() + type.slice(1)}s</h2>

        <div className={styles.headerControls}>
          {/* SORT */}
          <div className={styles.sortControls}>
            <span className={styles.sortLabel}>Sort by:</span>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as GroupSortBy)}
              className={styles.sortSelect}
            >
              <option value="alphabet">Alphabet</option>

              <option value="count">Song Count</option>
            </select>

            <button
              onClick={() => setSortDescending(!sortDescending)}
              className={styles.sortButton}
              aria-label="Reverse sort order"
              aria-pressed={sortDescending}
              style={{
                color: sortDescending ? themeColor : colors.textDim,
              }}
            >
              <IoSwapVertical />
            </button>
          </div>

          {/* SEARCH */}
          <div className={styles.searchContainer}>
            <IoSearch className={styles.searchIcon} />

            <input
              type="text"
              placeholder={`Search ${type}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className={styles.scrollArea} key="list" ref={scrollAreaRef}>
        <GroupList
          entries={entries}
          type={type}
          allTracks={allTracks}
          artistPictures={artistPictures}
          onSelect={(name) => onGroupSelect({ type, name })}
          onContextMenu={
            onGroupContextMenu
              ? (e, name) => {
                  const groupSongs = getFilteredSongs(allTracks, name, type, "", false);
                  onGroupContextMenu(e, name, groupSongs);
                }
              : undefined
          }
        />

        {entries.length === 0 && (
          <div className={styles.emptyState}>
            {searchQuery ? `No results for "${searchQuery}"` : `No ${type}s found in your library.`}
          </div>
        )}
      </div>
    </div>
  );
}
