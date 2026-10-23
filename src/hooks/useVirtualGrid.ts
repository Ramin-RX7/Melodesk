import { useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

type Options = {
  /** Minimum card width for a responsive grid (like `repeat(auto-fill, minmax(w, 1fr))`); omit for a one-column list. */
  minItemWidth?: number;
  /** Space between cards and between rows, in px. */
  gap: number;
  /**
   * Row height (without the gap) assumed until a row is measured, or a function of the column
   * width for cards whose height follows their width. Keeping it accurate keeps the scroll
   * position steady, so Back returns to exactly the same place.
   */
  estimateRowHeight: number | ((columnWidth: number) => number);
};

// Nearest ancestor that scrolls vertically: the page's own scroll area.
const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
};

/**
 * Renders only the rows of a long list or card grid that are on (or near) the screen, inside the
 * page's existing scroll area, so long lists open instantly and Back still restores the scroll
 * position. Put `containerRef` (a callback ref, so the list may appear later) on a wrapper with
 * `position: relative; height: totalHeight`, and render each of `rows` absolutely at
 * `translateY(row.start)`, with `ref={measureRow}` and `data-index={row.index}` so its real
 * height is measured.
 */
export function useVirtualGrid<T>(items: T[], { minItemWidth, gap, estimateRowHeight }: Options) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  // Distance from the top of the scroll area's content to the list (headers above it).
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!container) return;
    scrollRef.current = findScrollParent(container);
    setWidth(container.clientWidth);
    const observer = new ResizeObserver(() => setWidth(container.clientWidth));
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  // Content above the list can change height (e.g. an artist bio loads), so this is re-measured
  // after every render; it only updates state when it changed.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!container || !scroller) return;
    const margin = Math.round(
      container.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop,
    );
    if (margin !== scrollMargin) setScrollMargin(margin);
  });

  const columns =
    minItemWidth === undefined ? 1 : Math.max(1, Math.floor((width + gap) / (minItemWidth + gap)));
  const rowCount = Math.ceil(items.length / columns);
  const rowHeight =
    typeof estimateRowHeight === "number"
      ? estimateRowHeight
      : estimateRowHeight((width - gap * (columns - 1)) / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight + gap,
    overscan: 4,
    scrollMargin,
  });

  // Rows not measured yet keep the old estimate otherwise (e.g. after the window was resized).
  useLayoutEffect(() => virtualizer.measure(), [virtualizer, rowHeight, columns]);

  const rows = virtualizer.getVirtualItems().map((row) => ({
    key: row.key,
    index: row.index,
    start: row.start - scrollMargin,
    firstIndex: row.index * columns,
    items: items.slice(row.index * columns, (row.index + 1) * columns),
  }));

  return {
    containerRef: setContainer,
    columns,
    rows,
    totalHeight: virtualizer.getTotalSize(),
    measureRow: virtualizer.measureElement,
    /** Scrolls so that item `index` is visible. */
    scrollToItem: (index: number, align: "start" | "center" | "end" | "auto" = "auto") =>
      virtualizer.scrollToIndex(Math.floor(index / columns), { align }),
  };
}
