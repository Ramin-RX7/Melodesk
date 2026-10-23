import React from "react";

import { useVirtualGrid } from "../../hooks/useVirtualGrid";

type Props<T> = {
  items: T[];
  /** Minimum card width (the grid fits as many columns as it can); omit for a one-column list. */
  minItemWidth?: number;
  gap: number;
  estimateRowHeight: number | ((columnWidth: number) => number);
  getKey: (item: T, index: number) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
};

// A card grid or list that only renders the rows on (or near) the screen. It scrolls with the
// page's scroll area; see useVirtualGrid.
export function VirtualGrid<T>({
  items,
  minItemWidth,
  gap,
  estimateRowHeight,
  getKey,
  renderItem,
}: Props<T>) {
  const grid = useVirtualGrid(items, { minItemWidth, gap, estimateRowHeight });

  return (
    <div ref={grid.containerRef} style={{ position: "relative", height: grid.totalHeight }}>
      {grid.rows.map((row) => (
        <div
          key={row.key}
          ref={grid.measureRow}
          data-index={row.index}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${row.start}px)`,
            display: "grid",
            gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
            gap,
            paddingBottom: gap,
          }}
        >
          {row.items.map((item, i) => (
            <React.Fragment key={getKey(item, row.firstIndex + i)}>
              {renderItem(item, row.firstIndex + i)}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
