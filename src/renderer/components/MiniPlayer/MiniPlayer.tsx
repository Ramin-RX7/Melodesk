import React from "react";
import {
  IoPlay,
  IoPause,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoMusicalNote,
  IoExpand,
} from "react-icons/io5";
import { FileItem } from "../../types";
import { colors } from "../../theme/colors";

interface MiniPlayerProps {
  currentTrack?: FileItem;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onExitMini: () => void;
  themeColor: string;
}

// Small always-on-top floating widget. The window is frameless and sized by the
// main process; this component fills it with the cover art + transport controls.
//
// Dragging is implemented in JS (not -webkit-app-region) because a drag region
// would suppress the mouse events we need to reveal the controls on hover.
export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious,
  onExitMini,
  themeColor,
}) => {
  const [hovered, setHovered] = React.useState(false);
  // ww/wh = the window size captured when the drag started. We pass it on every
  // move so the window is repositioned with a constant size; otherwise the
  // size drifts (grows) on high-DPI displays due to setBounds DIP rounding.
  const dragRef = React.useRef<{ mx: number; my: number; wx: number; wy: number; ww: number; wh: number } | null>(null);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      window.api.setWindowPosition(d.wx + (e.screenX - d.mx), d.wy + (e.screenY - d.my), d.ww, d.wh);
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Clicking a control should not start a window drag.
    if ((e.target as HTMLElement).closest("button")) return;
    const b = await window.api.getWindowBounds();
    dragRef.current = { mx: e.screenX, my: e.screenY, wx: b.x, wy: b.y, ww: b.width, wh: b.height };
  };

  const picture = currentTrack?.metadata?.picture;
  const title = currentTrack?.metadata?.title || currentTrack?.name || "No track selected";
  const artists = currentTrack ? currentTrack.metadata?.artists || "Unknown Artist" : "";
  const artistsText = Array.isArray(artists) ? artists.join(", ") : artists;

  const ctrlBtn: React.CSSProperties = {
    pointerEvents: "auto",
    background: "rgba(0,0,0,0.45)",
    border: "none",
    color: colors.textPrimary,
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.12s, background-color 0.15s",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: colors.bgBase,
        userSelect: "none",
        cursor: "default",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
    >
      {/* Cover art (fills the window) */}
      {picture ? (
        <img
          src={`media://${encodeURIComponent(picture)}`}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.bgControl,
          }}
        >
          <IoMusicalNote style={{ fontSize: "64px", color: colors.textIcon }} />
        </div>
      )}

      {/* Restore button (top-right corner) */}
      <button
        style={{
          ...ctrlBtn,
          position: "absolute",
          top: "8px",
          right: "8px",
          width: "30px",
          height: "30px",
          fontSize: "15px",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.15s, background-color 0.15s",
        }}
        title="Back to full window"
        onClick={onExitMini}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = themeColor)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.45)")}
      >
        <IoExpand />
      </button>

      {/* Hover overlay: title + artists + transport controls.
          The container is click-transparent so it never blocks the cover (drag)
          or the restore button beneath it; only its buttons capture clicks. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "12px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 100%)",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.18s",
          pointerEvents: "none",
        }}
      >
        <div style={{ marginBottom: "10px", minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
          {artistsText && (
            <div
              style={{
                fontSize: "11px",
                color: colors.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {artistsText}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <button
            style={{ ...ctrlBtn, width: "34px", height: "34px", fontSize: "16px" }}
            title="Previous"
            onClick={onPrevious}
          >
            <IoPlaySkipBack />
          </button>
          <button
            style={{
              ...ctrlBtn,
              width: "48px",
              height: "48px",
              fontSize: "24px",
              backgroundColor: colors.textPrimary,
              color: colors.bgBlack,
            }}
            title={isPlaying ? "Pause" : "Play"}
            onClick={onTogglePlay}
          >
            {isPlaying ? <IoPause /> : <IoPlay />}
          </button>
          <button
            style={{ ...ctrlBtn, width: "34px", height: "34px", fontSize: "16px" }}
            title="Next"
            onClick={onNext}
          >
            <IoPlaySkipForward />
          </button>
        </div>
      </div>
    </div>
  );
};
