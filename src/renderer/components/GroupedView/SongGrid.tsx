import { FileItem, UserConfig } from "../../types";
import { GroupType } from "./types";
import { SongCard } from "./SongCard";
import styles from "./GroupedView.module.css";

type Props = {
    songs: FileItem[];
    selectedGroup: string;
    type: GroupType;
    currentTrack?: FileItem | null;
    config: UserConfig | null;
    themeColor: string;
    onBack: () => void;
    onSongClick: (song: FileItem) => void;
    onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
};

export function SongGrid({
    songs,
    selectedGroup,
    type,
    currentTrack,
    config,
    themeColor,
    onBack,
    onSongClick,
    onContextMenu
}: Props) {
    return (
        <div className={styles.page}>
            <div className={styles.grid}>
                {songs.map(song => (
                    <SongCard
                        key={song.path}
                        song={song}
                        currentTrack={currentTrack}
                        themeColor={themeColor}
                        onClick={() => onSongClick(song)}
                        onDoubleClick={() => {
                            if (config?.doubleClickToPlay) {
                                onSongClick(song);
                            }
                        }}
                        onContextMenu={(e) => onContextMenu?.(e, song)}
                    />
                ))}
            </div>
        </div>
    );
}