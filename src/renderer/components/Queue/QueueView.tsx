import { useMemo, useRef } from "react";

import { QueueHeader } from "./QueueHeader";
import { QueueItem } from "./QueueItem";
import { FileItem } from "../../types";
import { colors } from "../../theme/colors";
import { useVirtualGrid } from "../../../hooks/useVirtualGrid";

type QueueViewProps = {
  queue: FileItem[];
  currentIndex: number;
  themeColor: string;
  /** Plays the row at `index` (the queue may contain the same song more than once). */
  onPlayTrack: (track: FileItem, index: number) => void;
  onClearQueue: () => void;
  onRemoveFromQueue: (index: number) => void;
  /** Moves the row at `from` to `to` (drag and drop). */
  onMoveInQueue: (from: number, to: number) => void;
  /** The user changed the order by hand (shown in the header). */
  isCustomOrder: boolean;
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
  onMoveInQueue,
  isCustomOrder,
  activeItemRemovable,
  onContextMenu,
}: QueueViewProps) {
  const totalDuration = useMemo(() => {
    return queue.reduce((acc, track) => acc + (track.metadata?.duration || 0), 0);
  }, [queue]);
  // Only the rows on screen are rendered, so long queues open instantly.
  const list = useVirtualGrid(queue, { gap: 0, estimateRowHeight: 60 });
  const scrollToCurrent = () => {
    if (currentIndex >= 0) list.scrollToItem(currentIndex, "center");
  };

  // Drag and drop to reorder, as in playlists.
  const dragFrom = useRef<number | null>(null);
  const dragTo = useRef<number | null>(null);
  const finishDrag = () => {
    const from = dragFrom.current;
    const to = dragTo.current;
    dragFrom.current = null;
    dragTo.current = null;
    if (from !== null && to !== null && from !== to) onMoveInQueue(from, to);
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
        isCustomOrder={isCustomOrder}
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
              color: colors.textFaint,
            }}
          >
            Queue is empty
          </div>
        ) : (
          <div ref={list.containerRef} style={{ position: "relative", height: list.totalHeight }}>
            {list.rows.map((row) => {
              const index = row.firstIndex;
              const track = row.items[0];
              return (
                <div
                  key={row.key}
                  ref={list.measureRow}
                  data-index={row.index}
                  draggable
                  onDragStart={() => (dragFrom.current = index)}
                  onDragEnter={() => (dragTo.current = index)}
                  onDragEnd={finishDrag}
                  // A row dragged far enough is unmounted and may never get dragend; the drop
                  // target finishes the move instead (finishDrag only acts once).
                  onDrop={finishDrag}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <QueueItem
                    track={track}
                    index={index}
                    isActive={index === currentIndex}
                    themeColor={themeColor}
                    onClick={() => onPlayTrack(track, index)}
                    onRemove={() => onRemoveFromQueue(index)}
                    isRemovable={index !== currentIndex || activeItemRemovable}
                    onContextMenu={onContextMenu}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
