import React from "react";
import { useAudioTime } from "../../hooks/useAudioTime";
import { FileItem } from "../types";
import { colors } from "../theme/colors";
import {
  IoPlay,
  IoPause,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoShuffle,
  IoRepeat,
  IoList,
  IoDocumentTextOutline,
  IoMusicalNote,
  IoVolumeHigh,
  IoVolumeMedium,
  IoVolumeLow,
  IoVolumeMute,
} from "react-icons/io5";

interface PlaybackBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTrack?: FileItem;
  /** The player's <audio> element; the bar reads the playback position from it. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  duration: number;
  onSeek: (time: number) => void;
  onShowDetails: () => void;
  onShowLyrics: () => void;
  onNext: () => void;
  onPrevious: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: "none" | "one" | "all";
  onToggleRepeat: () => void;
  onShowQueue: () => void;
  volume: number;
  /** Live, while the slider moves. */
  onVolumeChange: (volume: number) => void;
  /** When the user lets go of the slider: saves the volume. */
  onVolumeCommit: (volume: number) => void;
  themeColor: string;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
}

export const PlaybackBar: React.FC<PlaybackBarProps> = ({
  isPlaying,
  onTogglePlay,
  currentTrack,
  audioRef,
  duration,
  onSeek,
  onShowDetails,
  onShowLyrics,
  onNext,
  onPrevious,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  onShowQueue,
  volume,
  onVolumeChange,
  onVolumeCommit,
  themeColor,
  onContextMenu,
}) => {
  const currentTime = useAudioTime(audioRef);
  const [localTime, setLocalTime] = React.useState(currentTime);
  const isDragging = React.useRef(false);

  // Sync localTime with currentTime from audio only when not dragging
  React.useEffect(() => {
    if (!isDragging.current) {
      setLocalTime(currentTime);
    }
  }, [currentTime]);

  // The slider moves (and the volume changes) live while dragging; the saved value follows.
  const [localVolume, setLocalVolume] = React.useState(volume);
  React.useEffect(() => setLocalVolume(volume), [volume]);

  const formatTime = (seconds: number) => {
    if (typeof seconds !== "number" || isNaN(seconds) || seconds === Infinity || seconds < 0)
      return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const buttonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: colors.textPrimary,
    fontSize: "18px",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s",
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (currentTrack && onContextMenu) {
      onContextMenu(e, currentTrack);
    }
  };

  const getDisplayText = () => {
    if (!currentTrack) return { title: "No track selected", artist: "" };
    const { title, artists } = currentTrack.metadata || {};
    return {
      title: title || currentTrack.name,
      artists: (Array.isArray(artists) ? artists.join(", ") : artists) || "Unknown Artist",
    };
  };

  const { title, artists } = getDisplayText();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "100px",
        backgroundColor: colors.bgInput,
        borderTop: `1px solid ${colors.borderSubtle}`,
        display: "flex",
        flexDirection: "column",
        padding: "0 20px",
        color: colors.textPrimary,
        zIndex: 1000,
      }}
    >
      {/* Progress Bar Section */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 0 5px",
        }}
      >
        <span
          style={{ fontSize: "11px", color: colors.textDim, width: "45px", textAlign: "right" }}
        >
          {formatTime(localTime)}
        </span>
        <input
          type="range"
          min={0}
          max={isFinite(duration) && duration > 0 ? duration : 100}
          step={0.1}
          value={localTime}
          onMouseDown={() => {
            isDragging.current = true;
          }}
          onMouseUp={(e) => {
            if (isDragging.current) {
              isDragging.current = false;
              const val = Number((e.target as HTMLInputElement).value);
              onSeek(val);
            }
          }}
          onTouchStart={() => {
            isDragging.current = true;
          }}
          onTouchEnd={(e) => {
            if (isDragging.current) {
              isDragging.current = false;
              const val = Number((e.target as HTMLInputElement).value);
              onSeek(val);
            }
          }}
          onInput={(e) => {
            setLocalTime(Number((e.target as HTMLInputElement).value));
          }}
          onChange={(e) => {
            // Only trigger onSeek if we weren't dragging (i.e., it's a click)
            // If dragging, onMouseUp handles it.
            if (!isDragging.current) {
              const val = Number((e.target as HTMLInputElement).value);
              setLocalTime(val);
              onSeek(val);
            }
          }}
          style={{
            flex: 1,
            cursor: "pointer",
            accentColor: themeColor,
            height: "4px",
          }}
        />
        <span style={{ fontSize: "11px", color: colors.textDim, width: "45px" }}>
          {formatTime(duration)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Track Info (Play Now) */}
        <div
          onContextMenu={handleContextMenu}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px" }}
        >
          <div
            onClick={onShowDetails}
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: colors.bgControl,
              borderRadius: "4px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            {currentTrack?.metadata?.picture ? (
              <img
                src={`media://${encodeURIComponent(currentTrack.metadata.picture)}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <IoMusicalNote style={{ fontSize: "24px", color: colors.textIcon }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            {/* <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
              Play Now
              <button
                onClick={onShowQueue}
                style={{ background: "none", border: "none", color: themeColor, fontSize: "14px", cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}
                title="Go to Queue"
              >
                <IoList />
              </button>
            </div> */}
            <div
              onClick={onShowDetails}
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {title}
            </div>
            {currentTrack && (
              <div
                onClick={onShowDetails}
                style={{
                  fontSize: "12px",
                  color: colors.textMuted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {artists}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <button
            style={{ ...buttonStyle, color: isShuffle ? themeColor : colors.textPrimary }}
            onClick={onToggleShuffle}
            title="Shuffle"
          >
            <IoShuffle />
          </button>
          <button style={buttonStyle} onClick={onPrevious} title="Previous">
            <IoPlaySkipBack />
          </button>
          <button
            style={{
              ...buttonStyle,
              fontSize: "32px",
              backgroundColor: colors.textPrimary,
              color: colors.bgBlack,
              borderRadius: "50%",
              padding: "6px",
            }}
            onClick={onTogglePlay}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <IoPause /> : <IoPlay />}
          </button>
          <button style={buttonStyle} onClick={onNext} title="Next">
            <IoPlaySkipForward />
          </button>
          <button
            style={{
              ...buttonStyle,
              color: repeatMode !== "none" ? themeColor : colors.textPrimary,
              position: "relative",
            }}
            onClick={onToggleRepeat}
            title={`Repeat: ${repeatMode}`}
          >
            <IoRepeat />
            {repeatMode === "one" && (
              <span
                style={{
                  position: "absolute",
                  fontSize: "10px",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontWeight: "bold",
                }}
              >
                1
              </span>
            )}
          </button>
        </div>

        {/* Extra Actions */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
            gap: "15px",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "150px" }}>
            <span
              style={{
                color: colors.textDim,
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {localVolume === 0 ? (
                <IoVolumeMute />
              ) : localVolume < 0.3 ? (
                <IoVolumeLow />
              ) : localVolume < 0.7 ? (
                <IoVolumeMedium />
              ) : (
                <IoVolumeHigh />
              )}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={localVolume}
              onChange={(e) => {
                const value = Number(e.target.value);
                setLocalVolume(value);
                onVolumeChange(value);
              }}
              onPointerUp={(e) => onVolumeCommit(Number(e.currentTarget.value))}
              onKeyUp={(e) => onVolumeCommit(Number(e.currentTarget.value))}
              style={{
                flex: 1,
                cursor: "pointer",
                accentColor: themeColor,
                height: "4px",
              }}
            />
          </div>
          <button style={buttonStyle} onClick={onShowQueue} title="Queue">
            <IoList />
          </button>
          <button style={buttonStyle} onClick={onShowLyrics} title="Lyrics">
            <IoDocumentTextOutline />
          </button>
        </div>
      </div>
    </div>
  );
};
