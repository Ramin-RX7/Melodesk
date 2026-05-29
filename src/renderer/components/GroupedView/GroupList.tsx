import { FileItem } from "../../types";
import styles from "./GroupedView.module.css";
import { GroupCard } from "./GroupCard";
import { GroupType } from "./types";

type Props = {
    entries: [string, number][];
    type: GroupType;
    allTracks: FileItem[];
    onSelect: (name: string) => void;
};

export function GroupList({
    entries,
    type,
    allTracks,
    onSelect
}: Props) {
    return (
        <div className={styles.grid}>
            {entries.map(([name, count]) => {
                const firstTrack = allTracks.find(track => {
                    const meta = track.metadata;

                    if (!meta) return false;

                    if (type === "artist") {
                        return meta.artists?.includes(name);
                    }

                    if (type === "album") {
                        return meta.album === name;
                    }

                    if (type === "genre") {
                        return meta.genre?.includes(name);
                    }

                    return false;
                });

                return (
                    <GroupCard
                        key={name}
                        type={type}
                        name={name}
                        count={count}
                        picture={firstTrack?.metadata?.picture}
                        onClick={() => onSelect(name)}
                    />
                );
            })}
        </div>
    );
}