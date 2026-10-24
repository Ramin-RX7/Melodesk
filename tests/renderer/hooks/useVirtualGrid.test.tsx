import { act, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { useVirtualGrid } from "../../../src/hooks/useVirtualGrid";
import { VirtualGrid } from "../../../src/renderer/components/VirtualGrid";
import { renderInScroller, resizeAll, scrollElement, setSize } from "../../helpers/layout";

const items = (count: number) => Array.from({ length: count }, (_, i) => `item ${i}`);
const shown = () => screen.queryAllByText(/^item \d+$/).map((el) => el.textContent);

// The list inside VirtualGrid, given a width (jsdom has no layout).
function Sized({ width, children }: { width: number; children: React.ReactNode }) {
  return <div ref={(el) => void (el && setSize(el, { width }))}>{children}</div>;
}

const grid = (count: number, props: Partial<React.ComponentProps<typeof VirtualGrid<string>>>) => (
  <VirtualGrid
    items={items(count)}
    gap={10}
    estimateRowHeight={50}
    getKey={(item) => item}
    renderItem={(item) => <span>{item}</span>}
    {...props}
  />
);

describe("useVirtualGrid / VirtualGrid", () => {
  it("renders only the rows that fit in the scroll area, plus a few more", () => {
    // 800 px tall area, 60 px rows → 14 rows on screen, + 4 below.
    renderInScroller(grid(2000, {}));
    const visible = shown();
    expect(visible.length).toBeGreaterThanOrEqual(14);
    expect(visible.length).toBeLessThanOrEqual(20);
    expect(visible[0]).toBe("item 0");
  });

  it("renders later rows after scrolling", async () => {
    const { scroller } = renderInScroller(grid(2000, {}));
    await act(async () => scrollElement(scroller, 60 * 1000));
    const visible = shown();
    expect(visible).toContain("item 1000");
    expect(visible).not.toContain("item 0");
    expect(visible.length).toBeLessThanOrEqual(30);
  });

  it("fits as many columns as the width allows", () => {
    // (1000 + 10) / (190 + 10) → 5 columns
    renderInScroller(<Sized width={1000}>{grid(100, { minItemWidth: 190 })}</Sized>);
    const firstRow = screen.getByText("item 0").parentElement!;
    expect(firstRow.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))");
    expect(firstRow.textContent).toBe("item 0item 1item 2item 3item 4");
  });

  it("changes the number of columns when the list is resized", () => {
    let list!: HTMLDivElement;
    renderInScroller(
      <div ref={(el) => void (el && (list = el) && setSize(el, { width: 1000 }))}>
        {grid(100, { minItemWidth: 190 })}
      </div>,
    );
    const container = list.firstElementChild as HTMLElement;
    setSize(container, { width: 400 });
    act(() => resizeAll());
    expect(screen.getByText("item 0").parentElement!.style.gridTemplateColumns).toBe(
      "repeat(2, minmax(0, 1fr))",
    );
  });

  it("passes the column width to estimateRowHeight", () => {
    const estimate = vi.fn((width: number) => width);
    renderInScroller(
      <Sized width={1000}>{grid(10, { minItemWidth: 190, estimateRowHeight: estimate })}</Sized>,
    );
    const container = screen.getByText("item 0").parentElement!.parentElement!;
    setSize(container, { width: 1000 });
    act(() => resizeAll());
    // 5 columns, 4 gaps of 10 px: (1000 - 40) / 5
    expect(estimate).toHaveBeenLastCalledWith(192);
  });

  it("is a one-column list without minItemWidth", () => {
    renderInScroller(<Sized width={1000}>{grid(10, {})}</Sized>);
    expect(screen.getByText("item 0").parentElement!.textContent).toBe("item 0");
  });

  it("places rows relative to the list when headers sit above it", () => {
    function WithHeader() {
      return (
        <>
          <div ref={(el) => void (el && setSize(el, { height: 300 }))}>header</div>
          <div ref={(el) => void (el && setSize(el, { top: 300 }))}>{grid(10, {})}</div>
        </>
      );
    }
    renderInScroller(<WithHeader />);
    const firstRow = screen.getByText("item 0").parentElement!;
    expect(firstRow.style.transform).toBe("translateY(0px)");
  });

  it("scrollToItem scrolls the page's scroll area to the item's row", async () => {
    let scrollTo!: (index: number) => void;
    function List() {
      const g = useVirtualGrid(items(500), { gap: 0, estimateRowHeight: 60 });
      useEffect(() => void (scrollTo = (i) => g.scrollToItem(i, "start")));
      return (
        <div ref={g.containerRef} style={{ height: g.totalHeight }}>
          {g.rows.map((row) => (
            <div key={row.key} ref={g.measureRow} data-index={row.index}>
              {row.items}
            </div>
          ))}
        </div>
      );
    }
    const { scroller } = renderInScroller(<List />);
    await act(async () => scrollTo(100));
    expect(scroller.scrollTop).toBe(6000);
  });
});
