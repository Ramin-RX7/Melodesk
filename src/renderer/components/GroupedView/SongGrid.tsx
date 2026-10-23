import { FileItem, UserConfig } from "../../types";
import { VirtualGrid } from "../VirtualGrid";
import { GroupType } from "./types";
import { SONG_CARD_HEIGHT, SongCard } from "./SongCard";
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
  onContextMenu,
}: Props) {
  const doubleClickToPlay = config?.doubleClickToPlay ?? true;

  return (
    <div className={styles.page}>
      <VirtualGrid
        items={songs}
        minItemWidth={180}
        gap={25}
        estimateRowHeight={SONG_CARD_HEIGHT}
        getKey={(song) => song.path}
        renderItem={(song) => (
          <SongCard
            song={song}
            currentTrack={currentTrack}
            themeColor={themeColor}
            onClick={() => {
              if (!doubleClickToPlay) onSongClick(song);
            }}
            onDoubleClick={() => {
              if (doubleClickToPlay) onSongClick(song);
            }}
            onContextMenu={(e) => onContextMenu?.(e, song)}
          />
        )}
      />
    </div>
  );
}
