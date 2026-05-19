import React from "react";
import { FileItem } from "../types";
import {
  IoPlay,
  IoPause,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoShuffle,
  IoRepeat,
  IoList,
  IoDocumentTextOutline,
  IoMusicalNote
} from "react-icons/io5";

interface PlaybackBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTrack?: FileItem;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onShowDetails: () => void;
}

export const PlaybackBar: React.FC<PlaybackBarProps> = ({
  isPlaying,
  onTogglePlay,
  currentTrack,
  currentTime,
  duration,
  onSeek,
  onShowDetails,
}) => {
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const buttonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "18px",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s",
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    window.api.showContextMenu();
  };

  const getDisplayText = () => {
    if (!currentTrack) return { title: "No track selected", artist: "" };
    const { title, artist } = currentTrack.metadata || {};
    return {
      title: title || currentTrack.name,
      artist: artist || "Unknown Artist"
    };
  };

  const { title, artist } = getDisplayText();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "100px",
        backgroundColor: "#111",
        borderTop: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        padding: "0 20px",
        color: "#fff",
        zIndex: 1000,
      }}
    >
      {/* Progress Bar Section */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 0 5px" }}>
        <span style={{ fontSize: "11px", color: "#888", width: "35px" }}>{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{
            flex: 1,
            cursor: "pointer",
            accentColor: "#1db954",
            height: "4px",
          }}
        />
        <span style={{ fontSize: "11px", color: "#888", width: "35px" }}>{formatTime(duration)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, minHeight: 0 }}>
        {/* Track Info (Play Now) */}
        <div
          onContextMenu={handleContextMenu}
          onClick={onShowDetails}
          style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}
          title="Click for details, Right click for options"
        >
          <div style={{ width: "48px", height: "48px", backgroundColor: "#222", borderRadius: "4px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {currentTrack?.metadata?.picture ? (
              <img src={currentTrack.metadata.picture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <IoMusicalNote style={{ fontSize: "24px", color: "#555" }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>Play Now</div>
            <div style={{ fontSize: "14px", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </div>
            {currentTrack && (
              <div style={{ fontSize: "12px", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {artist}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "15px", flex: 1, justifyContent: "center" }}>
          <button style={buttonStyle} title="Shuffle"><IoShuffle /></button>
          <button style={buttonStyle} title="Previous"><IoPlaySkipBack /></button>
          <button
            style={{ ...buttonStyle, fontSize: "32px", backgroundColor: "#fff", color: "#000", borderRadius: "50%", padding: "6px" }}
            onClick={onTogglePlay}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <IoPause /> : <IoPlay />}
          </button>
          <button style={buttonStyle} title="Next"><IoPlaySkipForward /></button>
          <button style={buttonStyle} title="Repeat"><IoRepeat /></button>
        </div>

        {/* Extra Actions */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button style={buttonStyle} title="Queue"><IoList /></button>
          <button style={buttonStyle} title="Lyrics"><IoDocumentTextOutline /></button>
        </div>
      </div>
    </div>
  );
};
