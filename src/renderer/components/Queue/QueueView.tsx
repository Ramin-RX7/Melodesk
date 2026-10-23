import { useMemo, useRef } from "react";

import { QueueHeader } from "./QueueHeader";
import { QueueItem } from "./QueueItem";
import { FileItem } from "../../types";
import { colors } from "../../theme/colors";

type QueueViewProps = {
  queue: FileItem[];
  currentIndex: number;
  themeColor: string;
  /** Plays the row at `index` (the queue may contain the same song more than once). */
  onPlayTrack: (track: FileItem, index: number) => void;
  onClearQueue: () => void;
  onRemoveFromQueue: (index: number) => void;
  activeItemRemovable: boolean;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
};

export function QueueView({
  queue,
  currentIndex,
  themeColor,
  onPlayTrack,
  onClearQueue,
  onRemoveFromQueue,
  activeItemRemovable,
  onContextMenu,
}: QueueViewProps) {
  const totalDuration = useMemo(() => {
    return queue.reduce((acc, track) => acc + (track.metadata?.duration || 0), 0);
  }, [queue]);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToCurrent = () => {
    const container = listRef.current;
    if (!container) return;

    const activeEl = container.querySelector(`[data-active="true"]`) as HTMLElement | null;

    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

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
        scrollToCurrent={scrollToCurrent}
      />

      <div
        ref={listRef}
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
              color: colors.textFaint,
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
              onClick={() => onPlayTrack(track, index)}
              onRemove={() => onRemoveFromQueue(index)}
              isRemovable={index !== currentIndex || activeItemRemovable}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>
    </div>
  );
}
