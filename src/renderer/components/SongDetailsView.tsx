import React, { useState, useEffect } from "react";
import { AppNotification, FileItem, Playlist } from "../types";
import {
  IoArrowBack,
  IoAdd,
  IoCreate,
  IoImage,
  IoMusicalNotes,
  IoSearch,
  IoSave,
  IoClose,
} from "react-icons/io5";
import { colors } from "../theme/colors";
import { UNKNOWN_ARTIST } from "../../utils/metadata";

interface SongDetailsViewProps {
  currentTrack: FileItem;
  themeColor: string;
  onBack: () => void;
  onNavigate: (type: "artist" | "album" | "genre", name: string) => void;
  onTrackUpdated: (track: FileItem) => void;
  openLyrics?: boolean;
  onLyricsConsumed?: () => void;
  notify: (notification: AppNotification) => void;
}

export function SongDetailsView({
  currentTrack,
  themeColor,
  onBack,
  onNavigate,
  onTrackUpdated,
  openLyrics,
  onLyricsConsumed,
  notify,
}: SongDetailsViewProps) {
  const mp3Only = () =>
    notify({ level: "info", message: "Editing tags is only supported for MP3 files for now." });
  const [isEditing, setIsEditing] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    album: "",
    genre: "",
    year: "",
  });

  const isMp3 = currentTrack.name.toLowerCase().endsWith(".mp3");

  useEffect(() => {
    if (isEditing) {
      setFormData({
        title: currentTrack.metadata?.title || "",
        artist: currentTrack.metadata?.artists?.join(", ") || currentTrack.metadata?.artist || "",
        album: currentTrack.metadata?.album || "",
        genre: currentTrack.metadata?.genre?.join(", ") || "",
        year: currentTrack.metadata?.year?.toString() || "",
      });
    }
  }, [isEditing, currentTrack]);

  useEffect(() => {
    if (openLyrics) {
      setShowLyricsModal(true);
      onLyricsConsumed?.();
    }
  }, [openLyrics, onLyricsConsumed]);

  useEffect(() => {
    if (showPlaylistModal) {
      window.api.getPlaylists().then(setPlaylists).catch(console.error);
    }
  }, [showPlaylistModal]);

  const handleSave = async () => {
    if (!isMp3) {
      mp3Only();
      return;
    }

    setIsSaving(true);
    const tagsToSave = {
      title: formData.title,
      artist: formData.artist,
      album: formData.album,
      genre: formData.genre,
      year: formData.year,
    };

    try {
      const success = await window.api.writeMetadata(currentTrack.path, tagsToSave);
      if (success) {
        // Re-read metadata
        const updatedTrack = await window.api.getMetadata(currentTrack.path);
        onTrackUpdated(updatedTrack);
        setIsEditing(false);
      } else {
        notify({
          level: "error",
          message: "The tags couldn't be saved. Check that the file isn't read-only or in use.",
        });
      }
    } catch (error) {
      console.error(error);
      notify({ level: "error", message: "Something went wrong while saving the tags." });
    } finally {
      setIsSaving(false);
    }
  };

  // The main process asks about duplicates and reports the result with a toast.
  const handleAddToPlaylist = async (playlist: Playlist) => {
    setShowPlaylistModal(false);
    try {
      await window.api.addSongsToPlaylist(playlist.id, [currentTrack.path]);
    } catch (err) {
      console.error(err);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const meta = currentTrack.metadata || {};

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.bgSurface,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <IoArrowBack /> Back
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowPlaylistModal(true)}
            style={{
              background: "none",
              border: `1px solid ${themeColor}`,
              color: themeColor,
              padding: "8px 16px",
              borderRadius: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <IoAdd /> Add to Playlist
          </button>
          {!isEditing && (
            <button
              onClick={() => (isMp3 ? setIsEditing(true) : mp3Only())}
              style={{
                background: "none",
                border: `1px solid ${colors.textFaint}`,
                color: colors.textTertiary,
                padding: "8px 16px",
                borderRadius: "20px",
                cursor: isMp3 ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                opacity: isMp3 ? 1 : 0.5,
              }}
              title={isMp3 ? "" : "Only MP3 files can be edited"}
            >
              <IoCreate /> Edit Tags
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "40px 20px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "40px",
          alignItems: "flex-start",
          paddingBottom: "120px",
        }}
      >
        {/* Cover Art */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
            height: "-webkit-fill-available",
          }}
        >
          <div
            style={{
              width: "inherit",
              aspectRatio: "1/1",
              backgroundColor: colors.borderSubtle,
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "80px",
              boxShadow: `0 10px 40px ${colors.overlay60}`,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {meta.picture ? (
              <img
                src={`media://${encodeURIComponent(meta.picture)}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <IoMusicalNotes style={{ color: colors.textIcon }} />
            )}
          </div>
        </div>

        {/* Edit Form OR Display */}
        <div style={{ flex: "1 1 400px", maxWidth: "800px" }}>
          {isEditing ? (
            <div
              style={{
                backgroundColor: colors.bgElevated,
                padding: "20px",
                borderRadius: "12px",
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <h3 style={{ margin: "0 0 20px 0" }}>Edit Metadata</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label
                    htmlFor="tag-title"
                    style={{
                      display: "block",
                      color: colors.textDim,
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    Title
                  </label>
                  <input
                    id="tag-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      color: colors.textPrimary,
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="tag-artist"
                    style={{
                      display: "block",
                      color: colors.textDim,
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    Artists (comma separated)
                  </label>
                  <input
                    id="tag-artist"
                    type="text"
                    value={formData.artist}
                    onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      color: colors.textPrimary,
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="tag-album"
                    style={{
                      display: "block",
                      color: colors.textDim,
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    Album
                  </label>
                  <input
                    id="tag-album"
                    type="text"
                    value={formData.album}
                    onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      color: colors.textPrimary,
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="tag-genre"
                    style={{
                      display: "block",
                      color: colors.textDim,
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    Genre (comma separated)
                  </label>
                  <input
                    id="tag-genre"
                    type="text"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      color: colors.textPrimary,
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="tag-year"
                    style={{
                      display: "block",
                      color: colors.textDim,
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    Year
                  </label>
                  <input
                    id="tag-year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      color: colors.textPrimary,
                      outline: "none",
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
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
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    backgroundColor: themeColor,
                    color: colors.textPrimary,
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <IoSave /> {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "clamp(40px, 4vw, 100px)",
                  margin: "0 0 10px 0",
                  lineHeight: 1.2,
                }}
              >
                {meta.title || currentTrack.name}
              </h2>
              {/* Navigable Links */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {meta.artists && meta.artists.length > 0 ? (
                    meta.artists.map((artist, idx) => (
                      <React.Fragment key={idx}>
                        <span
                          onClick={() => onNavigate("artist", artist)}
                          style={{
                            fontSize: "clamp(35px, 3vw, 90px)",
                            color: themeColor,
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                          // onMouseOver={e => e.currentTarget.style.textDecoration = "underline"}
                          // onMouseOut={e => e.currentTarget.style.textDecoration = "none"}
                        >
                          {artist}
                        </span>
                        {idx < meta.artists!.length - 1 && (
                          <span
                            style={{ fontSize: "clamp(35px, 3vw, 90px)", color: colors.textDim }}
                          >
                            ,
                          </span>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <span
                      onClick={() => onNavigate("artist", UNKNOWN_ARTIST)}
                      title="All songs without an artist"
                      style={{
                        color: colors.textDim,
                        fontSize: "clamp(35px, 3vw, 90px)",
                        cursor: "pointer",
                      }}
                    >
                      {UNKNOWN_ARTIST}
                    </span>
                  )}
                </div>

                {meta.album && (
                  <span
                    onClick={() => onNavigate("album", meta.album!)}
                    style={{
                      fontSize: "clamp(20px, 2vw, 70px)",
                      color: colors.textTertiary,
                      cursor: "pointer",
                      fontStyle: "italic",
                    }}
                    // onMouseOver={e => e.currentTarget.style.textDecoration = "underline"}
                    // onMouseOut={e => e.currentTarget.style.textDecoration = "none"}
                  >
                    {meta.album}
                  </span>
                )}

                {meta.genre && meta.genre.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      justifyContent: "center",
                      flexWrap: "wrap",
                      marginTop: "5px",
                    }}
                  >
                    {meta.genre.map((g) => (
                      <span
                        key={g}
                        onClick={() => onNavigate("genre", g)}
                        style={{
                          backgroundColor: colors.bgControl,
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          color: colors.textMuted,
                          cursor: "pointer",
                          border: `1px solid ${colors.borderSubtle}`,
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.backgroundColor = colors.borderSubtle)
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.backgroundColor = colors.bgControl)
                        }
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Extended Metadata Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "15px",
                  backgroundColor: colors.bgSurface,
                  padding: "20px",
                  borderRadius: "12px",
                  marginTop: "30px",
                  border: `1px solid ${colors.borderFaint}`,
                  textAlign: "left",
                }}
              >
                <div>
                  <div
                    style={{
                      color: colors.textFaint,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Year
                  </div>
                  <div style={{ color: colors.textSecondary }}>{meta.year || "--"}</div>
                </div>
                <div>
                  <div
                    style={{
                      color: colors.textFaint,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Track Number
                  </div>
                  <div style={{ color: colors.textSecondary }}>{meta.trackNumber || "--"}</div>
                </div>
                <div>
                  <div
                    style={{
                      color: colors.textFaint,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Format
                  </div>
                  <div style={{ color: colors.textSecondary }}>
                    {meta.format?.toUpperCase() || "--"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      color: colors.textFaint,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    Bitrate
                  </div>
                  <div style={{ color: colors.textSecondary }}>
                    {meta.bitrate ? Math.round(meta.bitrate / 1000) + " kbps" : "--"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      color: colors.textFaint,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    BPM
                  </div>
                  <div style={{ color: colors.textSecondary }}>{meta.bpm || "--"}</div>
                </div>
                <div>
                  <div
                    style={{
                      color: colors.textFaint,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    File Size
                  </div>
                  <div style={{ color: colors.textSecondary }}>{formatFileSize(meta.fileSize)}</div>
                </div>
              </div>

              {/* Action Buttons (Placeholders & Features) */}
              <div
                style={{
                  display: "flex",
                  gap: "15px",
                  justifyContent: "center",
                  marginTop: "30px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() =>
                    notify({ level: "info", message: "Fixing cover art isn't available yet." })
                  }
                  style={{
                    backgroundColor: colors.bgControl,
                    border: `1px solid ${colors.border}`,
                    color: colors.textTertiary,
                    padding: "10px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <IoImage /> Fix Cover Art
                </button>
                <button
                  onClick={() => setShowLyricsModal(true)}
                  style={{
                    backgroundColor: colors.bgControl,
                    border: `1px solid ${colors.border}`,
                    color: colors.textTertiary,
                    padding: "10px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <IoMusicalNotes /> Show Lyrics
                </button>
                {/* {!isEditing && (
                  <button 
                    onClick={() => isMp3 ? setIsEditing(true) : mp3Only()}
                    style={{ 
                      backgroundColor: "#222", 
                      border: "1px solid #444", 
                      color: "#ccc", 
                      padding: "10px 20px", 
                      borderRadius: "8px", 
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px" 
                    }}
                    title={isMp3 ? "" : "Only MP3 files can be edited"}
                  >
                    <IoCreate /> Edit Tags
                  </button>
                )}
                <button 
                  onClick={() => setShowPlaylistModal(true)}
                  style={{ 
                    backgroundColor: "#222", 
                    border: "1px solid #444", 
                    color: "#ccc", 
                    padding: "10px 20px", 
                    borderRadius: "8px", 
                    cursor: "pointer", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "8px" 
                  }}>
                  <IoAdd /> Add to Playlist
                </button> */}
              </div>

              <div>
                <div
                  style={{
                    color: colors.textFaint,
                    fontSize: "16px",
                    paddingTop: "3%",
                    cursor: "pointer",
                  }}
                  onClick={() => window.api.showFileInFolder(currentTrack.path)}
                >
                  {currentTrack.path.replace(/\\/g, "/")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Playlist Selection Modal */}
      {showPlaylistModal && (
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
              borderRadius: "12px",
              width: "400px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              border: `1px solid ${colors.border}`,
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
              <h3 style={{ margin: 0 }}>Add to Playlist</h3>
              <button
                onClick={() => setShowPlaylistModal(false)}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textDim,
                  cursor: "pointer",
                  fontSize: "20px",
                }}
              >
                <IoClose />
              </button>
            </div>
            <div style={{ padding: "10px", overflowY: "auto", flex: 1 }}>
              {playlists.length === 0 ? (
                <div style={{ textAlign: "center", color: colors.textFaint, padding: "30px 10px" }}>
                  No playlists found. Create one first!
                </div>
              ) : (
                playlists.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddToPlaylist(p)}
                    style={{
                      padding: "15px",
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = colors.borderSubtle)
                    }
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span>{p.name}</span>
                    <span style={{ fontSize: "12px", color: colors.textDim }}>
                      {p.songs.length} songs
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showLyricsModal && (
        <div
          onClick={() => setShowLyricsModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: colors.overlay70,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(700px, 90vw)",
              maxHeight: "80vh",
              overflowY: "auto",
              backgroundColor: colors.bgSurface,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: "16px",
              padding: "24px",
              color: colors.textPrimary,
              boxShadow: `0 10px 40px ${colors.overlay50}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0 }}>Lyrics</h2>

              <button
                onClick={() => {
                  const title = meta.title || currentTrack.name.replace(/\.[^.]+$/, "");
                  const artists = meta.artists?.join(" ") || meta.artist;
                  const query = [artists, title, "lyrics"].filter(Boolean).join(" ");
                  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                  window.api.openExternalUrl(url);
                }}
                style={{
                  backgroundColor: colors.bgControl,
                  border: `1px solid ${colors.border}`,
                  color: colors.textTertiary,
                  padding: "10px 20px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <IoSearch /> Find Lyrics
              </button>

              <button
                onClick={() => setShowLyricsModal(false)}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textMuted,
                  cursor: "pointer",
                  fontSize: "24px",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.8,
                color: colors.textSecondary,
                userSelect: "text",
                cursor: "text",
              }}
            >
              {meta?.lyrics || "No lyrics available for this song."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
