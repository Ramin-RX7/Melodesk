import { QueueHeader } from "./QueueHeader";
import { QueueItem } from "./QueueItem";
import { FileItem } from "../../types";
import { useMemo } from "react";

type QueueViewProps = {
    queue: FileItem[];
    currentIndex: number;
    themeColor: string;
    onPlayTrack: (track: FileItem) => void;
    onClearQueue: () => void;
};

export function QueueView({
    queue,
    currentIndex,
    themeColor,
    onPlayTrack,
    onClearQueue,
}: QueueViewProps) {
    const totalDuration = useMemo(() => {
        return queue.reduce(
            (acc, track) => acc + (track.metadata?.duration || 0),
            0
        );
    }, [queue]);

    return (
        <div
            style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <QueueHeader
                totalSongs={queue.length}
                totalDuration={totalDuration}
                onClear={onClearQueue}
            />

            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "10px 0",
                    paddingBottom: "120px",
                }}
            >
                {queue.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "50px",
                            color: "#666",
                        }}
                    >
                        Queue is empty
                    </div>
                ) : (
                    queue.map((track, index) => (
                        <QueueItem
                            key={`${track.path}-${index}`}
                            track={track}
                            index={index}
                            isActive={index === currentIndex}
                            themeColor={themeColor}
                            onClick={() => onPlayTrack(track)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}