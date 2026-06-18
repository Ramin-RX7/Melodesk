import React, { useState, useEffect, useRef, useCallback } from "react";
import { FileItem, Playlist } from "../types";
import { formatArtists } from "../../utils/metadata";
import { IoArrowBack, IoAdd, IoTrash, IoSearch, IoMusicalNote, IoSwapVertical, IoPencil, IoCheckmark, IoClose } from "react-icons/io5";

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

export function PlaylistView({ allTracks, themeColor, onPlayTrack, currentTrack, configDoubleClickToPlay, onContextMenu, selectedPlaylistId, onPlaylistSelect, onPlaylistClose, onPlaylistDeleted, onScrollRef, initialSearch }: PlaylistViewProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId) ?? null;
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState(initialSearch ?? "");
  const [isAddingSongs, setIsAddingSongs] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'custom' | 'title' | 'artist' | 'duration'>('custom');
  const [sortDescending, setSortDescending] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");

  // Drag and drop state for reordering
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const scrollAreaRef = useCallback((el: HTMLElement | null) => {
    onScrollRef?.(el);
  }, [onScrollRef]);

  useEffect(() => {
    loadPlaylists();
  }, []);

  useEffect(() => {
    if (selectedPlaylist) {
      setSortBy(selectedPlaylist.sortBy ?? 'custom');
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
        setPlaylists(playlists.filter(p => p.id !== id));
        if (selectedPlaylistId === id) {
          onPlaylistDeleted?.(id);
        }
      } catch (error) {
        console.error("Failed to delete playlist:", error);
      }
    }
  };

  const handleAddSong = async (track: FileItem) => {
    if (!selectedPlaylist) return;
    const newSongs = [...selectedPlaylist.songs, track.path];
    try {
      const updated = await window.api.updatePlaylist(selectedPlaylist.id, { songs: newSongs });
      setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
    } catch (error) {
      console.error("Failed to add song:", error);
    }
  };

  const handleRemoveSong = async (indexToRemove: number) => {
    if (!selectedPlaylist) return;
    const newSongs = selectedPlaylist.songs.filter((_, i) => i !== indexToRemove);
    try {
      const updated = await window.api.updatePlaylist(selectedPlaylist.id, { songs: newSongs });
      setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
    } catch (error) {
      console.error("Failed to remove song:", error);
    }
  };

  const handleSortEnd = async () => {
    if (!selectedPlaylist || dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
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
      setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
    } catch (error) {
      console.error("Failed to reorder songs:", error);
    }
  };

  const handleSortByChange = async (newSortBy: 'custom' | 'title' | 'artist' | 'duration') => {
    setSortBy(newSortBy);
    if (!selectedPlaylist) return;
    const updated = await window.api.updatePlaylist(selectedPlaylist.id, { sortBy: newSortBy });
    if (updated) {
      setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
    }
  };

  const handleSortDirectionToggle = async () => {
    const newDesc = !sortDescending;
    setSortDescending(newDesc);
    if (!selectedPlaylist) return;
    const updated = await window.api.updatePlaylist(selectedPlaylist.id, { sortDescending: newDesc });
    if (updated) {
      setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
    }
  };

  const handleSaveDescription = async () => {
    if (!selectedPlaylist) return;
    setIsEditingDescription(false);
    if (editDescription === (selectedPlaylist.description ?? "")) return;
    const updated = await window.api.updatePlaylist(selectedPlaylist.id, { description: editDescription });
    if (updated) {
      setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
    }
  };

  const handleCancelDescription = () => {
    setEditDescription(selectedPlaylist?.description ?? "");
    setIsEditingDescription(false);
  };

  // Helper to render 2x2 grid of covers
  const renderGridCover = (playlist: Playlist) => {
    const tracks = playlist.songs.map(path => allTracks.find(t => t.path === path)).filter(Boolean) as FileItem[];
    const covers = tracks.map(t => t.metadata?.picture).filter(Boolean) as string[];
    const uniqueCovers = Array.from(new Set(covers)).slice(0, 4);

    if (uniqueCovers.length === 0) {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#333" }}>
          <IoMusicalNote style={{ fontSize: "50px", color: "#555" }} />
        </div>
      );
    }

    if (uniqueCovers.length < 4) {
      return (
        <img src={`media://${encodeURIComponent(uniqueCovers[0])}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      );
    }

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", width: "100%", height: "100%" }}>
        {uniqueCovers.map((pic, i) => (
          <img key={i} src={`media://${encodeURIComponent(pic)}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ))}
      </div>
    );
  };

  if (selectedPlaylist) {
    const tracks = selectedPlaylist.songs.map(path => allTracks.find(t => t.path === path)).filter(Boolean) as FileItem[];
    const totalDuration = tracks.reduce((sum, t) => sum + (t.metadata?.duration || 0), 0);

    let filteredTracks = tracks.map((track, originalIndex) => ({ track, originalIndex }));
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredTracks = filteredTracks.filter(({ track }) => 
        (track.metadata?.title || track.name).toLowerCase().includes(q) ||
        (track.metadata?.artists?.join(", ") || "").toLowerCase().includes(q)
      );
    }

    if (sortBy !== 'custom') {
      filteredTracks.sort((a, b) => {
        let res = 0;
        if (sortBy === 'title') {
          res = (a.track.metadata?.title || a.track.name).localeCompare(b.track.metadata?.title || b.track.name);
        } else if (sortBy === 'artist') {
          res = (a.track.metadata?.artists?.[0] || "").localeCompare(b.track.metadata?.artists?.[0] || "");
        } else if (sortBy === 'duration') {
          res = (a.track.metadata?.duration || 0) - (b.track.metadata?.duration || 0);
        }
        return sortDescending ? -res : res;
      });
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: "100px" }}>
        <div style={{ padding: "20px 30px", display: "flex", gap: "20px", borderBottom: "1px solid #222", backgroundColor: "#181818" }}>
          <div style={{ width: "150px", height: "150px", flexShrink: 0, borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 15px rgba(0,0,0,0.5)" }}>
            {renderGridCover(selectedPlaylist)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1 }}>
            <button onClick={() => { setSearchQuery(""); onPlaylistClose(); }} style={{ alignSelf: "flex-start", background: "none", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", marginBottom: "auto" }}>
              <IoArrowBack /> Back to Playlists
            </button>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "36px" }}>{selectedPlaylist.name}</h1>

            {/* Description */}
            {isEditingDescription ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                <textarea
                  autoFocus
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveDescription(); } if (e.key === 'Escape') handleCancelDescription(); }}
                  rows={2}
                  placeholder="Add a description..."
                  style={{ flex: 1, backgroundColor: "#111", border: "1px solid #555", borderRadius: "6px", padding: "6px 10px", color: "#ccc", fontSize: "14px", resize: "none", outline: "none", fontFamily: "inherit" }}
                />
                <button onClick={handleSaveDescription} style={{ background: "none", border: "none", color: themeColor, cursor: "pointer", padding: "4px", display: "flex" }}><IoCheckmark size={18} /></button>
                <button onClick={handleCancelDescription} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: "4px", display: "flex" }}><IoClose size={18} /></button>
              </div>
            ) : (
              <div
                onClick={() => { setEditDescription(selectedPlaylist.description ?? ""); setIsEditingDescription(true); }}
                style={{ color: selectedPlaylist.description ? "#aaa" : "#555", fontSize: "14px", marginBottom: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", minHeight: "20px" }}
              >
                <span style={{ fontStyle: selectedPlaylist.description ? "normal" : "italic" }}>
                  {selectedPlaylist.description || "Add a description..."}
                </span>
                <IoPencil size={12} style={{ color: "#555", flexShrink: 0 }} />
              </div>
            )}

            <div style={{ color: "#888", fontSize: "14px" }}>
              {tracks.length} songs • {Math.floor(totalDuration / 60)} mins
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button onClick={() => onPlayTrack(tracks[0], tracks)} style={{ backgroundColor: themeColor, color: "#fff", border: "none", padding: "8px 24px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" }}>Play</button>
              <button onClick={() => setIsAddingSongs(true)} style={{ backgroundColor: "transparent", color: "#fff", border: "1px solid #fff", padding: "8px 24px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                <IoAdd /> Add Songs
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: "10px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222" }}>
          <div style={{ position: "relative", width: "250px" }}>
            <IoSearch style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888" }} />
            <input type="text" placeholder="Search in playlist..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", backgroundColor: "#222", border: "1px solid #333", borderRadius: "20px", padding: "8px 15px 8px 35px", color: "#fff", outline: "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#222", padding: "4px 12px", borderRadius: "20px", border: "1px solid #333" }}>
            <span style={{ fontSize: "12px", color: "#888" }}>Sort by:</span>
            <select value={sortBy} onChange={(e) => handleSortByChange(e.target.value as any)} style={{ backgroundColor: "transparent", color: "#fff", border: "none", fontSize: "13px", cursor: "pointer", outline: "none" }}>
              <option value="custom" style={{ backgroundColor: "#222" }}>Custom Order</option>
              <option value="title" style={{ backgroundColor: "#222" }}>Title</option>
              <option value="artist" style={{ backgroundColor: "#222" }}>Artist</option>
              <option value="duration" style={{ backgroundColor: "#222" }}>Duration</option>
            </select>
            {sortBy !== 'custom' && (
              <button onClick={handleSortDirectionToggle} style={{ background: "none", border: "none", color: sortDescending ? themeColor : "#888", display: "flex", alignItems: "center", cursor: "pointer", fontSize: "16px" }}>
                <IoSwapVertical />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }} key="detail" ref={scrollAreaRef}>
          {filteredTracks.map(({ track, originalIndex }, i) => (
            <div
              key={`${track.path}-${originalIndex}`}
              draggable={sortBy === 'custom' && !searchQuery}
              onDragStart={(e) => (dragItem.current = originalIndex)}
              onDragEnter={(e) => (dragOverItem.current = originalIndex)}
              onDragEnd={handleSortEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => onPlayTrack(track, tracks)}
              onDoubleClick={() => configDoubleClickToPlay && onPlayTrack(track, tracks)}
              onContextMenu={(e) => onContextMenu?.(e, track)}
              style={{
                display: "flex", alignItems: "center", gap: "15px", padding: "10px 30px", cursor: "pointer",
                borderBottom: "1px solid #222",
                backgroundColor: currentTrack?.path === track.path ? `${themeColor}22` : "transparent",
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = currentTrack?.path === track.path ? `${themeColor}33` : "#222"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = currentTrack?.path === track.path ? `${themeColor}22` : "transparent"}
            >
              <div style={{ width: "30px", textAlign: "center", color: "#666" }}>{i + 1}</div>
              <div style={{ width: "40px", height: "40px", backgroundColor: "#333", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                {track.metadata?.picture ? <img src={`media://${encodeURIComponent(track.metadata.picture)}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><IoMusicalNote color="#555" /></div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: currentTrack?.path === track.path ? themeColor : "#fff", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.metadata?.title || track.name}</div>
                <div title={formatArtists(track.metadata?.artists).full} style={{ flex: 1, color: "#888", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatArtists(track.metadata?.artists).display}</div>
              </div>
              <div style={{ color: "#666", fontSize: "13px", padding: "0 20px" }}>
                {track.metadata?.duration ? `${Math.floor(track.metadata.duration / 60)}:${Math.floor(track.metadata.duration % 60).toString().padStart(2, '0')}` : "-:--"}
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleRemoveSong(originalIndex); }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: "5px" }}>
                <IoTrash />
              </button>
            </div>
          ))}
        </div>

        {isAddingSongs && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ backgroundColor: "#181818", width: "600px", height: "70vh", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #333" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Add Songs</h3>
                <button onClick={() => setIsAddingSongs(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
              <div style={{ padding: "20px", borderBottom: "1px solid #333" }}>
                <input type="text" placeholder="Search library..." value={addSearchQuery} onChange={(e) => setAddSearchQuery(e.target.value)} style={{ width: "100%", backgroundColor: "#222", border: "1px solid #444", borderRadius: "8px", padding: "10px 15px", color: "#fff", outline: "none" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
                {allTracks.filter(t => (t.metadata?.title || t.name).toLowerCase().includes(addSearchQuery.toLowerCase()) || (t.metadata?.artists?.join(", ") || "").toLowerCase().includes(addSearchQuery.toLowerCase())).map(track => {
                  const isAdded = selectedPlaylist.songs.includes(track.path);
                  return (
                    <div key={track.path} style={{ display: "flex", alignItems: "center", gap: "15px", padding: "10px", borderBottom: "1px solid #222" }}>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.metadata?.title || track.name}</div>
                        <div title={formatArtists(track.metadata?.artists).full} style={{ color: "#888", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatArtists(track.metadata?.artists).display}</div>
                      </div>
                      <button disabled={isAdded} onClick={() => handleAddSong(track)} style={{ backgroundColor: isAdded ? "#333" : themeColor, color: "#fff", border: "none", padding: "6px 16px", borderRadius: "20px", cursor: isAdded ? "default" : "pointer", opacity: isAdded ? 0.5 : 1 }}>
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
    ? playlists.filter(p => p.name.toLowerCase().includes(listSearchQuery.toLowerCase()))
    : playlists;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", backgroundColor: "#181818" }}>
        <h2 style={{ margin: 0 }}>Playlists</h2>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <IoSearch style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888", fontSize: "14px" }} />
            <input
              type="text"
              placeholder="Search playlists..."
              value={listSearchQuery}
              onChange={e => setListSearchQuery(e.target.value)}
              style={{ backgroundColor: "#222", border: "1px solid #333", borderRadius: "20px", padding: "7px 14px 7px 32px", color: "#fff", outline: "none", fontSize: "13px", width: "200px" }}
            />
          </div>
          <button onClick={() => setIsCreating(true)} style={{ backgroundColor: themeColor, color: "#fff", border: "none", padding: "8px 20px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
            <IoAdd /> New Playlist
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "30px", paddingBottom: "120px" }} key="grid" ref={scrollAreaRef}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "25px" }}>
          {filteredPlaylists.map(playlist => (
            <div
              key={playlist.id}
              onClick={() => onPlaylistSelect(playlist.id)}
              style={{ backgroundColor: "#1e1e1e", padding: "20px", borderRadius: "12px", cursor: "pointer", textAlign: "center", transition: "all 0.2s", border: "1px solid #333", position: "relative" }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#282828"; e.currentTarget.style.transform = "translateY(-5px)"; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#1e1e1e"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ width: "100%", aspectRatio: "1/1", backgroundColor: "#333", borderRadius: "8px", margin: "0 auto 15px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
                {renderGridCover(playlist)}
              </div>
              <div style={{ fontWeight: "bold", marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {playlist.name}
              </div>
              <div style={{ fontSize: "12px", color: "#888" }}>
                {playlist.songs.length} songs
              </div>
              <button
                onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(0,0,0,0.5)", border: "none", color: "#ff4444", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: 0.8 }}
                onMouseOver={(e) => e.currentTarget.style.opacity = "1"}
                onMouseOut={(e) => e.currentTarget.style.opacity = "0.8"}
              >
                <IoTrash />
              </button>
            </div>
          ))}
          {filteredPlaylists.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "50px", color: "#666" }}>
              {listSearchQuery ? `No playlists matching "${listSearchQuery}"` : "No playlists found. Create one to get started!"}
            </div>
          )}
        </div>
      </div>

      {isCreating && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#222", padding: "30px", borderRadius: "12px", width: "400px", border: "1px solid #444" }}>
            <h3 style={{ margin: "0 0 20px 0" }}>Create New Playlist</h3>
            <input
              autoFocus
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
              style={{ width: "100%", backgroundColor: "#111", border: "1px solid #444", borderRadius: "8px", padding: "12px", color: "#fff", marginBottom: "20px", outline: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => { setIsCreating(false); setNewPlaylistName(""); }} style={{ background: "none", border: "1px solid #666", color: "#fff", padding: "8px 20px", borderRadius: "20px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim()} style={{ backgroundColor: themeColor, color: "#fff", border: "none", padding: "8px 20px", borderRadius: "20px", cursor: newPlaylistName.trim() ? "pointer" : "not-allowed", opacity: newPlaylistName.trim() ? 1 : 0.5 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
