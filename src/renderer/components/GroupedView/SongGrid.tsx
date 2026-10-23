import { FileItem, UserConfig } from "../../types";
import { VirtualGrid } from "../VirtualGrid";
import { SONG_CARD_HEIGHT, SongCard } from "./SongCard";
import styles from "./GroupedView.module.css";

type Props = {
  songs: FileItem[];
  currentTrack?: FileItem | null;
  config: UserConfig | null;
  themeColor: string;
  onSongClick: (song: FileItem) => void;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
};

export function SongGrid({
  songs,
  currentTrack,
  config,
  themeColor,
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
