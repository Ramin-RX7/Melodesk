import { useState } from "react";
import { IoMusicalNote, IoTrash } from "react-icons/io5";
import { formatArtists } from "../../../utils/metadata";

import { FileItem } from "../../types";
import { colors } from "../../theme/colors";

type QueueItemProps = {
  track: FileItem;
  index: number;
  isActive: boolean;
  themeColor: string;
  onClick: () => void;
  onRemove?: () => void;
  isRemovable?: boolean;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
};

export function QueueItem({
  track,
  index,
  isActive,
  themeColor,
  onClick,
  onRemove,
  isRemovable = true,
  onContextMenu,
}: QueueItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      data-active={isActive}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu?.(e, track)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "15px",
        padding: "10px 30px",
        cursor: "pointer",
        backgroundColor: isActive ? `${themeColor}22` : "transparent",
        borderLeft: isActive ? `4px solid ${themeColor}` : "4px solid transparent",
        transition: "background-color 0.2s",
      }}
    >
      <div
        style={{
          width: "30px",
          textAlign: "center",
          color: isActive ? themeColor : colors.textFaint,
          fontSize: "14px",
        }}
      >
        {index + 1}
      </div>

      <div
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: colors.borderSubtle,
          borderRadius: "4px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {track.metadata?.picture ? (
          <img
            src={`media://${encodeURIComponent(track.metadata.picture)}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <IoMusicalNote style={{ color: colors.textIcon }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: "bold",
            color: isActive ? themeColor : colors.textPrimary,
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
            fontSize: "12px",
            color: colors.textDim,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {formatArtists(track.metadata?.artists).display}
        </div>
      </div>

      <div style={{ color: colors.textFaint, fontSize: "13px" }}>
        {track.metadata?.duration
          ? `${Math.floor(track.metadata.duration / 60)}:${Math.floor(track.metadata.duration % 60)
              .toString()
              .padStart(2, "0")}`
          : "-:--"}
      </div>

      {isRemovable && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "4px",
            cursor: "pointer",
            color: colors.textDim,
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.15s, color 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = colors.dangerHover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = colors.textDim;
          }}
          title="Remove from queue"
        >
          <IoTrash size={16} />
        </div>
      )}
    </div>
  );
}
