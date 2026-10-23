import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FileItem, Playlist, PlayRecord } from "../types";
import { formatArtists } from "../../utils/metadata";
import {
  IoArrowBack,
  IoAdd,
  IoTrash,
  IoSearch,
  IoMusicalNote,
  IoSwapVertical,
  IoPencil,
  IoCheckmark,
  IoClose,
  IoTime,
  IoFlame,
} from "react-icons/io5";
import { colors } from "../theme/colors";

const RECENTLY_PLAYED_ID = "__recently_played__";
const MOST_PLAYED_ID = "__most_played__";
const FIXED_PLAYLIST_LIMIT = 100;

interface PlaylistViewProps {
  allTracks: FileItem[];
  themeColor: string;
  onPlayTrack: (track: FileItem, queue: FileItem[]) => void;
  currentTrack: FileItem | null;
  configDoubleClickToPlay: boolean;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
  selectedPlaylistId: string | null;
  onPlaylistSelect: (id: string) => void;
  onPlaylistClose: () => void;
  onPlaylistDeleted?: (id: string) => void;
  onScrollRef?: (el: HTMLElement | null) => void;
  initialSearch?: string;
}

export function PlaylistView({
  allTracks,
  themeColor,
  onPlayTrack,
  currentTrack,
  configDoubleClickToPlay,
  onContextMenu,
  selectedPlaylistId,
  onPlaylistSelect,
  onPlaylistClose,
  onPlaylistDeleted,
  onScrollRef,
  initialSearch,
}: PlaylistViewProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [recentPlays, setRecentPlays] = useState<PlayRecord[]>([]);

  const hashToTrack = useMemo(() => {
    const map = new Map<string, FileItem>();
    for (const t of allTracks) {
      if (t.hash) map.set(t.hash, t);
    }
    return map;
  }, [allTracks]);

  // "Recently Played" and "Most Played" are derived, read-only playlists backed
  // by the play tracker. They are shown alongside real playlists but not editable.
  const fixedPlaylists = useMemo<Playlist[]>(() => {
    const now = new Date().toISOString();

    const recentPaths: string[] = [];
    const seen = new Set<string>();
    for (const rec of recentPlays) {
      if (seen.has(rec.hash)) continue;
      const track = hashToTrack.get(rec.hash);
      if (!track) continue;
      seen.add(rec.hash);
      recentPaths.push(track.path);
      if (recentPaths.length >= FIXED_PLAYLIST_LIMIT) break;
    }

    const mostPaths = Object.entries(playCounts)
      .filter(([hash]) => hashToTrack.has(hash))
      .sort((a, b) => b[1] - a[1])
      .slice(0, FIXED_PLAYLIST_LIMIT)
      .map(([hash]) => hashToTrack.get(hash)!.path);

    return [
      {
        id: RECENTLY_PLAYED_ID,
        name: "Recently Played",
        songs: recentPaths,
        isFixed: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: MOST_PLAYED_ID,
        name: "Most Played",
        songs: mostPaths,
        isFixed: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }, [recentPlays, playCounts, hashToTrack]);

  const allPlaylists = useMemo(
    () => [...fixedPlaylists, ...playlists],
    [fixedPlaylists, playlists],
  );
  const selectedPlaylist = allPlaylists.find((p) => p.id === selectedPlaylistId) ?? null;
  const isFixed = selectedPlaylist?.isFixed ?? false;
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState(initialSearch ?? "");
  const [isAddingSongs, setIsAddingSongs] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"custom" | "title" | "artist" | "duration">("custom");
  const [sortDescending, setSortDescending] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");

  // Drag and drop state for reordering
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const scrollAreaRef = useCallback(
    (el: HTMLElement | null) => {
      onScrollRef?.(el);
    },
    [onScrollRef],
  );

  useEffect(() => {
    loadPlaylists();
    loadTrackerData();
  }, []);

  useEffect(() => {
    if (selectedPlaylist) {
      setSortBy(selectedPlaylist.sortBy ?? "custom");
      setSortDescending(selectedPlaylist.sortDescending ?? false);
      setEditDescription(selectedPlaylist.description ?? "");
      setIsEditingDescription(false);
    }
  }, [selectedPlaylist?.id]);

  useEffect(() => {
    if (initialSearch !== undefined) setListSearchQuery(initialSearch);
  }, [initialSearch]);

  const loadPlaylists = async () => {
    try {
      const data = await window.api.getPlaylists();
      setPlaylists(data);
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  };

  const loadTrackerData = async () => {
    try {
      const [counts, recent] = await Promise.all([
        window.api.getPlayCounts(),
        window.api.getRecentPlays(FIXED_PLAYLIST_LIMIT * 2),
      ]);
      setPlayCounts(counts);
      setRecentPlays(recent);
    } catch (error) {
      console.error("Failed to load tracker data:", error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const newPlaylist = await window.api.createPlaylist(newPlaylistName.trim());
      setPlaylists([newPlaylist, ...playlists]);
      setNewPlaylistName("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create playlist:", error);
    }
  };

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this playlist?")) {
      try {
        await window.api.deletePlaylist(id);
        setPlaylists(playlists.filter((p) => p.id !== id));
        if (selectedPlaylistId === id) {
          onPlaylistDeleted?.(id);
        }
      } catch (error) {
        console.error("Failed to delete playlist:", error);
      }
    }
  };

  const handleAddSong = async (track: FileItem) => {
    if (!selectedPlaylist || selectedPlaylist.isFixed) return;
    const newSongs = [...selectedPlaylist.songs, track.path];
    try {
      const updated = await window.api.updatePlaylist(selectedPlaylist.id, { songs: newSongs });
      setPlaylists(playlists.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      console.error("Failed to add song:", error);
    }
  };

  const handleRemoveSong = async (indexToRemove: number) => {
    if (!selectedPlaylist || selectedPlaylist.isFixed) return;
    const newSongs = selectedPlaylist.songs.filter((_, i) => i !== indexToRemove);
    try {
      const updated = await window.api.updatePlaylist(selectedPlaylist.id, { songs: newSongs });
      setPlaylists(playlists.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      console.error("Failed to remove song:", error);
    }
  };

  const handleSortEnd = async () => {
    if (
      !selectedPlaylist ||
      selectedPlaylist.isFixed ||
      dragItem.current === null ||
      dragOverItem.current === null ||
      dragItem.current === dragOverItem.current
    ) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const newSongs = [...selectedPlaylist.songs];
    const draggedItemContent = newSongs.splice(dragItem.current, 1)[0];
    newSongs.splice(dragOverItem.current, 0, draggedItemContent);

    dragItem.current = null;
    dragOverItem.current = null;

    try {
      const updated = await window.api.updatePlaylist(selectedPlaylist.id, { songs: newSongs });
      setPlaylists(playlists.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      console.error("Failed to reorder songs:", error);
    }
  };

  const handleSortByChange = async (newSortBy: "custom" | "title" | "artist" | "duration") => {
    setSortBy(newSortBy);
    if (!selectedPlaylist) return;
    const updated = await window.api.updatePlaylist(selectedPlaylist.id, { sortBy: newSortBy });
    if (updated) {
      setPlaylists(playlists.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  const handleSortDirectionToggle = async () => {
    const newDesc = !sortDescending;
    setSortDescending(newDesc);
    if (!selectedPlaylist) return;
    const updated = await window.api.updatePlaylist(selectedPlaylist.id, {
      sortDescending: newDesc,
    });
    if (updated) {
      setPlaylists(playlists.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  const handleSaveDescription = async () => {
    if (!selectedPlaylist) return;
    setIsEditingDescription(false);
    if (editDescription === (selectedPlaylist.description ?? "")) return;
    const updated = await window.api.updatePlaylist(selectedPlaylist.id, {
      description: editDescription,
    });
    if (updated) {
      setPlaylists(playlists.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  const handleCancelDescription = () => {
    setEditDescription(selectedPlaylist?.description ?? "");
    setIsEditingDescription(false);
  };

  const fixedIcon = (playlist: Playlist): React.ReactNode => {
    if (playlist.id === RECENTLY_PLAYED_ID)
      return <IoTime style={{ fontSize: "50px", color: themeColor }} />;
    if (playlist.id === MOST_PLAYED_ID)
      return <IoFlame style={{ fontSize: "50px", color: themeColor }} />;
    return <IoMusicalNote style={{ fontSize: "50px", color: colors.textIcon }} />;
  };

  // Helper to render 2x2 grid of covers
  const renderGridCover = (playlist: Playlist) => {
    const tracks = playlist.songs
      .map((path) => allTracks.find((t) => t.path === path))
      .filter(Boolean) as FileItem[];
    const covers = tracks.map((t) => t.metadata?.picture).filter(Boolean) as string[];
    const uniqueCovers = Array.from(new Set(covers)).slice(0, 4);

    if (uniqueCovers.length === 0) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.borderSubtle,
          }}
        >
          {fixedIcon(playlist)}
        </div>
      );
    }

    if (uniqueCovers.length < 4) {
      return (
        <img
          src={`media://${encodeURIComponent(uniqueCovers[0])}`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      );
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          width: "100%",
          height: "100%",
        }}
      >
        {uniqueCovers.map((pic, i) => (
          <img
            key={i}
            src={`media://${encodeURIComponent(pic)}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ))}
      </div>
    );
  };

  if (selectedPlaylist) {
    const tracks = selectedPlaylist.songs
      .map((path) => allTracks.find((t) => t.path === path))
      .filter(Boolean) as FileItem[];
    const totalDuration = tracks.reduce((sum, t) => sum + (t.metadata?.duration || 0), 0);

    let filteredTracks = tracks.map((track, originalIndex) => ({ track, originalIndex }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredTracks = filteredTracks.filter(
        ({ track }) =>
          (track.metadata?.title || track.name).toLowerCase().includes(q) ||
          (track.metadata?.artists?.join(", ") || "").toLowerCase().includes(q),
      );
    }

    if (sortBy !== "custom") {
      filteredTracks.sort((a, b) => {
        let res = 0;
        if (sortBy === "title") {
          res = (a.track.metadata?.title || a.track.name).localeCompare(
            b.track.metadata?.title || b.track.name,
          );
        } else if (sortBy === "artist") {
          res = (a.track.metadata?.artists?.[0] || "").localeCompare(
            b.track.metadata?.artists?.[0] || "",
          );
        } else if (sortBy === "duration") {
          res = (a.track.metadata?.duration || 0) - (b.track.metadata?.duration || 0);
        }
        return sortDescending ? -res : res;
      });
    }

    return (
      <div
        style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: "100px" }}
      >
        <div
          style={{
            padding: "20px 30px",
            display: "flex",
            gap: "20px",
            borderBottom: `1px solid ${colors.borderFaint}`,
            backgroundColor: colors.bgSurface,
          }}
        >
          <div
            style={{
              width: "150px",
              height: "150px",
              flexShrink: 0,
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: `0 4px 15px ${colors.overlay50}`,
            }}
          >
            {renderGridCover(selectedPlaylist)}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              flex: 1,
            }}
          >
            <button
              onClick={() => {
                setSearchQuery("");
                onPlaylistClose();
              }}
              style={{
                alignSelf: "flex-start",
                background: "none",
                border: `1px solid ${colors.border}`,
                color: colors.textPrimary,
                padding: "6px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "auto",
              }}
            >
              <IoArrowBack /> Back to Playlists
            </button>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "36px" }}>{selectedPlaylist.name}</h1>

            {/* Description */}
            {isFixed ? (
              <div
                style={{
                  color: colors.textDim,
                  fontSize: "14px",
                  marginBottom: "8px",
                  fontStyle: "italic",
                }}
              >
                {selectedPlaylist.id === RECENTLY_PLAYED_ID
                  ? "Your most recently played songs"
                  : "The songs you play the most"}{" "}
                • updates automatically
              </div>
            ) : isEditingDescription ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <textarea
                  autoFocus
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveDescription();
                    }
                    if (e.key === "Escape") handleCancelDescription();
                  }}
                  rows={2}
                  placeholder="Add a description..."
                  style={{
                    flex: 1,
                    backgroundColor: colors.bgInput,
                    border: `1px solid ${colors.borderStrong}`,
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: colors.textTertiary,
                    fontSize: "14px",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={handleSaveDescription}
                  style={{
                    background: "none",
                    border: "none",
                    color: themeColor,
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                  }}
                >
                  <IoCheckmark size={18} />
                </button>
                <button
                  onClick={handleCancelDescription}
                  style={{
                    background: "none",
                    border: "none",
                    color: colors.textFaint,
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                  }}
                >
                  <IoClose size={18} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setEditDescription(selectedPlaylist.description ?? "");
                  setIsEditingDescription(true);
                }}
                style={{
                  color: selectedPlaylist.description ? colors.textMuted : colors.textIcon,
                  fontSize: "14px",
                  marginBottom: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  minHeight: "20px",
                }}
              >
                <span style={{ fontStyle: selectedPlaylist.description ? "normal" : "italic" }}>
                  {selectedPlaylist.description || "Add a description..."}
                </span>
                <IoPencil size={12} style={{ color: colors.textIcon, flexShrink: 0 }} />
              </div>
            )}

            <div style={{ color: colors.textDim, fontSize: "14px" }}>
              {tracks.length} songs • {Math.floor(totalDuration / 60)} mins
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button
                disabled={tracks.length === 0}
                onClick={() => tracks.length > 0 && onPlayTrack(tracks[0], tracks)}
                style={{
                  backgroundColor: themeColor,
                  color: colors.textPrimary,
                  border: "none",
                  padding: "8px 24px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  cursor: tracks.length === 0 ? "not-allowed" : "pointer",
                  opacity: tracks.length === 0 ? 0.5 : 1,
                }}
              >
                Play
              </button>
              {!isFixed && (
                <button
                  onClick={() => setIsAddingSongs(true)}
                  style={{
                    backgroundColor: "transparent",
                    color: colors.textPrimary,
                    border: `1px solid ${colors.textPrimary}`,
                    padding: "8px 24px",
                    borderRadius: "20px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <IoAdd /> Add Songs
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "10px 30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: `1px solid ${colors.borderFaint}`,
          }}
        >
          <div style={{ position: "relative", width: "250px" }}>
            <IoSearch
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: colors.textDim,
              }}
            />
            <input
              type="text"
              placeholder="Search in playlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: colors.bgControl,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: "20px",
                padding: "8px 15px 8px 35px",
                color: colors.textPrimary,
                outline: "none",
              }}
            />
          </div>
          {!isFixed && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                backgroundColor: colors.bgControl,
                padding: "4px 12px",
                borderRadius: "20px",
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <span style={{ fontSize: "12px", color: colors.textDim }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortByChange(e.target.value as any)}
                style={{
                  backgroundColor: "transparent",
                  color: colors.textPrimary,
                  border: "none",
                  fontSize: "13px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="custom" style={{ backgroundColor: colors.bgControl }}>
                  Custom Order
                </option>
                <option value="title" style={{ backgroundColor: colors.bgControl }}>
                  Title
                </option>
                <option value="artist" style={{ backgroundColor: colors.bgControl }}>
                  Artist
                </option>
                <option value="duration" style={{ backgroundColor: colors.bgControl }}>
                  Duration
                </option>
              </select>
              {sortBy !== "custom" && (
                <button
                  onClick={handleSortDirectionToggle}
                  style={{
                    background: "none",
                    border: "none",
                    color: sortDescending ? themeColor : colors.textDim,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  <IoSwapVertical />
                </button>
              )}
            </div>
          )}
        </div>

        <div
          style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}
          key="detail"
          ref={scrollAreaRef}
        >
          {filteredTracks.map(({ track, originalIndex }, i) => (
            <div
              key={`${track.path}-${originalIndex}`}
              draggable={!isFixed && sortBy === "custom" && !searchQuery}
              onDragStart={(e) => (dragItem.current = originalIndex)}
              onDragEnter={(e) => (dragOverItem.current = originalIndex)}
              onDragEnd={handleSortEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => onPlayTrack(track, tracks)}
              onDoubleClick={() => configDoubleClickToPlay && onPlayTrack(track, tracks)}
              onContextMenu={(e) => onContextMenu?.(e, track)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
                padding: "10px 30px",
                cursor: "pointer",
                borderBottom: `1px solid ${colors.borderFaint}`,
                backgroundColor:
                  currentTrack?.path === track.path ? `${themeColor}22` : "transparent",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor =
                  currentTrack?.path === track.path ? `${themeColor}33` : colors.bgControl)
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor =
                  currentTrack?.path === track.path ? `${themeColor}22` : "transparent")
              }
            >
              <div style={{ width: "30px", textAlign: "center", color: colors.textFaint }}>
                {i + 1}
              </div>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: colors.borderSubtle,
                  borderRadius: "4px",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {track.metadata?.picture ? (
                  <img
                    src={`media://${encodeURIComponent(track.metadata.picture)}`}
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
                    }}
                  >
                    <IoMusicalNote color={colors.textIcon} />
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: currentTrack?.path === track.path ? themeColor : colors.textPrimary,
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {track.metadata?.title || track.name}
                </div>
                <div
                  title={formatArtists(track.metadata?.artists).full}
                  style={{
                    flex: 1,
                    color: colors.textDim,
                    fontSize: "14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatArtists(track.metadata?.artists).display}
                </div>
              </div>
              <div style={{ color: colors.textFaint, fontSize: "13px", padding: "0 20px" }}>
                {track.metadata?.duration
                  ? `${Math.floor(track.metadata.duration / 60)}:${Math.floor(
                      track.metadata.duration % 60,
                    )
                      .toString()
                      .padStart(2, "0")}`
                  : "-:--"}
              </div>
              {!isFixed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSong(originalIndex);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: colors.textFaint,
                    cursor: "pointer",
                    padding: "5px",
                  }}
                >
                  <IoTrash />
                </button>
              )}
            </div>
          ))}
        </div>

        {isAddingSongs && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.overlay80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: colors.bgSurface,
                width: "600px",
                height: "70vh",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div
                style={{
                  padding: "20px",
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ margin: 0 }}>Add Songs</h3>
                <button
                  onClick={() => setIsAddingSongs(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: colors.textDim,
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: "20px", borderBottom: `1px solid ${colors.borderSubtle}` }}>
                <input
                  type="text"
                  placeholder="Search library..."
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: colors.bgControl,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    padding: "10px 15px",
                    color: colors.textPrimary,
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
                {allTracks
                  .filter(
                    (t) =>
                      (t.metadata?.title || t.name)
                        .toLowerCase()
                        .includes(addSearchQuery.toLowerCase()) ||
                      (t.metadata?.artists?.join(", ") || "")
                        .toLowerCase()
                        .includes(addSearchQuery.toLowerCase()),
                  )
                  .map((track) => {
                    const isAdded = selectedPlaylist.songs.includes(track.path);
                    return (
                      <div
                        key={track.path}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "15px",
                          padding: "10px",
                          borderBottom: `1px solid ${colors.borderFaint}`,
                        }}
                      >
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {track.metadata?.title || track.name}
                          </div>
                          <div
                            title={formatArtists(track.metadata?.artists).full}
                            style={{
                              color: colors.textDim,
                              fontSize: "12px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatArtists(track.metadata?.artists).display}
                          </div>
                        </div>
                        <button
                          disabled={isAdded}
                          onClick={() => handleAddSong(track)}
                          style={{
                            backgroundColor: isAdded ? colors.borderSubtle : themeColor,
                            color: colors.textPrimary,
                            border: "none",
                            padding: "6px 16px",
                            borderRadius: "20px",
                            cursor: isAdded ? "default" : "pointer",
                            opacity: isAdded ? 0.5 : 1,
                          }}
                        >
                          {isAdded ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filteredPlaylists = listSearchQuery
    ? allPlaylists.filter((p) => p.name.toLowerCase().includes(listSearchQuery.toLowerCase()))
    : allPlaylists;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "20px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${colors.borderFaint}`,
          backgroundColor: colors.bgSurface,
        }}
      >
        <h2 style={{ margin: 0 }}>Playlists</h2>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <IoSearch
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: colors.textDim,
                fontSize: "14px",
              }}
            />
            <input
              type="text"
              placeholder="Search playlists..."
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              style={{
                backgroundColor: colors.bgControl,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: "20px",
                padding: "7px 14px 7px 32px",
                color: colors.textPrimary,
                outline: "none",
                fontSize: "13px",
                width: "200px",
              }}
            />
          </div>
          <button
            onClick={() => setIsCreating(true)}
            style={{
              backgroundColor: themeColor,
              color: colors.textPrimary,
              border: "none",
              padding: "8px 20px",
              borderRadius: "20px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <IoAdd /> New Playlist
          </button>
        </div>
      </div>

      <div
        style={{ flex: 1, overflowY: "auto", padding: "30px", paddingBottom: "120px" }}
        key="grid"
        ref={scrollAreaRef}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "25px",
          }}
        >
          {filteredPlaylists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => onPlaylistSelect(playlist.id)}
              style={{
                backgroundColor: colors.bgElevated,
                padding: "20px",
                borderRadius: "12px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
                border: `1px solid ${colors.borderSubtle}`,
                position: "relative",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = colors.bgHover;
                e.currentTarget.style.transform = "translateY(-5px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = colors.bgElevated;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1/1",
                  backgroundColor: colors.borderSubtle,
                  borderRadius: "8px",
                  margin: "0 auto 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: `0 4px 10px ${colors.overlay30}`,
                }}
              >
                {renderGridCover(playlist)}
              </div>
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "5px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {playlist.name}
              </div>
              <div style={{ fontSize: "12px", color: colors.textDim }}>
                {playlist.songs.length} songs
              </div>
              {!playlist.isFixed && (
                <button
                  onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: colors.overlay50,
                    border: "none",
                    color: colors.danger,
                    borderRadius: "50%",
                    width: "30px",
                    height: "30px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    opacity: 0.8,
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = "0.8")}
                >
                  <IoTrash />
                </button>
              )}
            </div>
          ))}
          {filteredPlaylists.length === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "50px",
                color: colors.textFaint,
              }}
            >
              {listSearchQuery
                ? `No playlists matching "${listSearchQuery}"`
                : "No playlists found. Create one to get started!"}
            </div>
          )}
        </div>
      </div>

      {isCreating && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.overlay80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: colors.bgControl,
              padding: "30px",
              borderRadius: "12px",
              width: "400px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 style={{ margin: "0 0 20px 0" }}>Create New Playlist</h3>
            <input
              autoFocus
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              style={{
                width: "100%",
                backgroundColor: colors.bgInput,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                padding: "12px",
                color: colors.textPrimary,
                marginBottom: "20px",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewPlaylistName("");
                }}
                style={{
                  background: "none",
                  border: `1px solid ${colors.textFaint}`,
                  color: colors.textPrimary,
                  padding: "8px 20px",
                  borderRadius: "20px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                style={{
                  backgroundColor: themeColor,
                  color: colors.textPrimary,
                  border: "none",
                  padding: "8px 20px",
                  borderRadius: "20px",
                  cursor: newPlaylistName.trim() ? "pointer" : "not-allowed",
                  opacity: newPlaylistName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
