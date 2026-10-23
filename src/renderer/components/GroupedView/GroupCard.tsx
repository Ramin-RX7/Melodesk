import { IoDisc, IoMusicalNotes, IoPerson } from "react-icons/io5";
import React from "react";

import { colors } from "../../theme/colors";
import styles from "./GroupedView.module.css";
import { GroupType } from "./types";

type Props = {
  type: GroupType;
  name: string;
  count: number;
  picture?: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
};

// `picture` is resolved by the parent: an artist's custom picture (useArtistPictures) or the
// cover art of one of the group's songs.
export function GroupCard({ type, name, count, picture, onClick, onContextMenu }: Props) {
  const displayPicture = picture;

  return (
    <div className={styles.groupCard} onClick={onClick} onContextMenu={onContextMenu}>
      <div
        className={styles.groupImage}
        style={{
          borderRadius: type === "artist" ? "50%" : "8px",
        }}
      >
        {displayPicture ? (
          <img
            src={`media://${encodeURIComponent(displayPicture.replace(/\\/g, "/"))}`}
            className={styles.coverImage}
          />
        ) : (
          <>
            {type === "artist" && <IoPerson style={{ color: colors.textIcon }} />}

            {type === "album" && <IoDisc style={{ color: colors.textIcon }} />}

            {type === "genre" && <IoMusicalNotes style={{ color: colors.textIcon }} />}
          </>
        )}
      </div>

      <div className={styles.groupName}>
        <div className={name.length > 20 ? styles.groupNameTrack : ""}>{name}</div>
      </div>

      <div className={styles.groupCount}>
        {count} {count === 1 ? "song" : "songs"}
      </div>
    </div>
  );
}
