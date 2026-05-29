import { IoMusicalNote } from "react-icons/io5";
import { FileItem } from "../../types";
import styles from "./GroupedView.module.css";

type Props = {
    song: FileItem;
    currentTrack?: FileItem | null;
    themeColor: string;
    onClick: () => void;
    onDoubleClick: () => void;
};

export function SongCard({
    song,
    currentTrack,
    themeColor,
    onClick,
    onDoubleClick
}: Props) {
    return (
        <div
            className={styles.songCard}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            style={{
                border:
                    currentTrack?.path === song.path
                        ? `1px solid ${themeColor}`
                        : "1px solid #333"
            }}
        >
            <div className={styles.songImage}>
                {song.metadata?.picture ? (
                    <img
                        src={`media://${encodeURIComponent(song.metadata.picture)}`}
                        className={styles.coverImage}
                    />
                ) : (
                    <IoMusicalNote style={{ color: "#555" }} />
                )}
            </div>

            <div
                className={styles.songTitle}
                style={{
                    color:
                        currentTrack?.path === song.path
                            ? themeColor
                            : "#fff"
                }}
            >
                {song.metadata?.title || song.name}
            </div>

            <div className={styles.songArtist}>
                {song.metadata?.artists?.join(", ") || "Unknown Artist"}
            </div>
        </div>
    );
}