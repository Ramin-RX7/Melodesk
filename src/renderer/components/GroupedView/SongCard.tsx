import { IoMusicalNote } from "react-icons/io5";
import { FileItem } from "../../../renderer/types";
import { formatArtists } from "../../../utils/metadata";
import { colors } from "../../theme/colors";
import styles from "./GroupedView.module.css";

type Props = {
  song: FileItem;
  currentTrack?: FileItem | null;
  themeColor: string;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
};

// Height of a card of the given width (square cover plus title and artist), for virtual grids.
export const SONG_CARD_HEIGHT = (width: number) => width + 47;

export function SongCard({
  song,
  currentTrack,
  themeColor,
  onClick,
  onDoubleClick,
  onContextMenu,
}: Props) {
  return (
    <div
      className={styles.songCard}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        border:
          currentTrack?.path === song.path
            ? `1px solid ${themeColor}`
            : `1px solid ${colors.borderSubtle}`,
      }}
    >
      <div className={styles.songImage}>
        {song.metadata?.picture ? (
          <img
            loading="lazy"
            decoding="async"
            src={`media://${encodeURIComponent(song.metadata.picture)}`}
            className={styles.coverImage}
          />
        ) : (
          <IoMusicalNote style={{ color: colors.textIcon }} />
        )}
      </div>

      <div
        className={styles.songTitle}
        style={{
          color: currentTrack?.path === song.path ? themeColor : colors.textPrimary,
        }}
      >
        {song.metadata?.title || song.name}
      </div>

      <div title={formatArtists(song.metadata?.artists).full} className={styles.songArtist}>
        {formatArtists(song.metadata?.artists).display}
      </div>
    </div>
  );
}
