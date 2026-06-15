import { IoMusicalNote } from "react-icons/io5";
import { formatArtists } from "../../../utils/metadata";

import { FileItem, UserConfig } from "../../types";


type QueueItemProps = {
    track: FileItem;
    index: number;
    isActive: boolean;
    themeColor: string;
    onClick: () => void;
    onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
};

export function QueueItem({
    track,
    index,
    isActive,
    themeColor,
    onClick,
    onContextMenu,
}: QueueItemProps) {
    return (
        <div
            data-active={isActive}
            onClick={onClick}
            onContextMenu={(e) => onContextMenu?.(e, track)}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
                padding: "10px 30px",
                cursor: "pointer",
                backgroundColor: isActive ? `${themeColor}22` : "transparent",
                borderLeft: isActive
                    ? `4px solid ${themeColor}`
                    : "4px solid transparent",
                transition: "background-color 0.2s",
            }}
        >
            <div
                style={{
                    width: "30px",
                    textAlign: "center",
                    color: isActive ? themeColor : "#666",
                    fontSize: "14px",
                }}
            >
                {index + 1}
            </div>

            <div
                style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor: "#333",
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
                    <IoMusicalNote style={{ color: "#555" }} />
                )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontWeight: "bold",
                        color: isActive ? themeColor : "#fff",
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
                        color: "#888",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {formatArtists(track.metadata?.artists).display}
                </div>
            </div>

            <div style={{ color: "#666", fontSize: "13px" }}>
                {track.metadata?.duration
                    ? `${Math.floor(track.metadata.duration / 60)}:${Math.floor(
                        track.metadata.duration % 60
                    )
                        .toString()
                        .padStart(2, "0")}`
                    : "-:--"}
            </div>
        </div>
    );
}