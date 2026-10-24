// Layout for renderer tests. jsdom doesn't lay anything out: every size is 0, scrollTop doesn't
// stick and there's no ResizeObserver, so virtual lists (useVirtualGrid) would show no rows.
// installLayout() (run before every renderer test) gives elements fake sizes:
// - an element sized with setSize() reports that size (client, offset, scroll and bounding box);
// - an element without a width is as wide as its nearest sized ancestor (block layout), or as
//   the window (1000 px);
// - an element's height is, in this order: its setSize() height, `rowHeight` for a virtual list
//   row (an element with data-index; 60 px by default), a pixel `style.height`, 800 px for a
//   scroll area (overflow-y auto or scroll, like a page's), or else its content's height (the
//   children's heights added up, as in block layout);
// - scrollHeight is the content's height, so a scroll area can scroll as far as its content;
// - the bounding box moves up when an ancestor is scrolled.
// scrollTop/scrollTo work, and fire "scroll". renderInScroller() wraps a component in a sized
// scroll area, which virtual lists need to render rows.
import { render, RenderOptions } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

type Size = { width?: number; height?: number; top?: number; scrollHeight?: number };
const sizes = new WeakMap<Element, Size>();
const scrollTops = new WeakMap<Element, number>();
let rowHeight = 60;

export const setSize = (el: Element, size: Size) => sizes.set(el, { ...sizes.get(el), ...size });

/** Height reported by virtual list rows (elements with data-index). */
export const setRowHeight = (height: number) => (rowHeight = height);

const inheritedWidth = (el: Element): number => {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const size = sizes.get(node);
    if (size?.width) return size.width;
  }
  return WINDOW_WIDTH;
};

const WINDOW_WIDTH = 1000;
const SCROLL_AREA_HEIGHT = 800;

const isScrollArea = (el: Element) => {
  const { overflowY } = getComputedStyle(el);
  return overflowY === "auto" || overflowY === "scroll";
};

const contentHeight = (el: Element): number =>
  [...el.children].reduce((total, child) => total + heightOf(child), 0);

const heightOf = (el: Element): number => {
  const height = sizes.get(el)?.height;
  if (height !== undefined) return height;
  if (el.hasAttribute("data-index")) return rowHeight;
  const styled = (el as HTMLElement).style?.height;
  if (styled?.endsWith("px")) return parseFloat(styled);
  return isScrollArea(el) ? SCROLL_AREA_HEIGHT : contentHeight(el);
};

const sizeOf = (el: Element) => {
  const size = sizes.get(el);
  const height = heightOf(el);
  return {
    top: size?.top ?? 0,
    width: size?.width || inheritedWidth(el),
    height,
    scrollHeight: size?.scrollHeight ?? Math.max(height, contentHeight(el)),
  };
};

// Distance the ancestors are scrolled by: content moves up on screen when its area scrolls.
const scrolledBy = (el: Element) => {
  let total = 0;
  for (let node = el.parentElement; node; node = node.parentElement) {
    total += scrollTops.get(node) ?? 0;
  }
  return total;
};

const getter = (name: string, read: (el: Element) => number) =>
  Object.defineProperty(HTMLElement.prototype, name, {
    configurable: true,
    get(this: HTMLElement) {
      return read(this);
    },
  });

export class FakeResizeObserver {
  static instances = new Set<FakeResizeObserver>();
  targets = new Set<Element>();
  constructor(private callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.add(this);
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
    FakeResizeObserver.instances.delete(this);
  }
  /** Calls the callback as if the observed elements had changed size. */
  trigger() {
    const entries = [...this.targets].map((target) => ({ target }) as ResizeObserverEntry);
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

/** Tells every ResizeObserver that its elements changed size (after a setSize). */
export const resizeAll = () => {
  for (const observer of [...FakeResizeObserver.instances]) observer.trigger();
};

export const installLayout = () => {
  rowHeight = 60;
  FakeResizeObserver.instances.clear();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);

  getter("clientWidth", (el) => sizeOf(el).width);
  getter("clientHeight", (el) => sizeOf(el).height);
  getter("offsetWidth", (el) => sizeOf(el).width);
  getter("offsetHeight", (el) => sizeOf(el).height);
  getter("scrollHeight", (el) => sizeOf(el).scrollHeight);
  Object.defineProperty(Element.prototype, "scrollTop", {
    configurable: true,
    get(this: Element) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      scrollTops.set(this, Math.max(0, value));
    },
  });
  Element.prototype.scrollTo = function (this: Element, ...args: unknown[]) {
    const top =
      typeof args[0] === "object" ? (args[0] as ScrollToOptions).top : (args[1] as number);
    if (top === undefined) return;
    this.scrollTop = top;
    this.dispatchEvent(new Event("scroll"));
  } as Element["scrollTo"];
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const size = sizeOf(this);
    const top = size.top - scrolledBy(this);
    return {
      x: 0,
      y: top,
      left: 0,
      top,
      width: size.width,
      height: size.height,
      right: size.width,
      bottom: top + size.height,
      toJSON: () => ({}),
    } as DOMRect;
  };
};

/** Scrolls an element and fires "scroll", as a user would. */
export const scrollElement = (el: Element, top: number) => el.scrollTo({ top });

/**
 * Renders `ui` inside a scroll area of the given size (default 1000 × 800), so virtual lists in
 * it render the rows that fit. Returns the render result plus the scroll area.
 */
export const renderInScroller = (
  ui: React.ReactElement,
  { width = 1000, height = 800 } = {},
  options?: RenderOptions,
) => {
  const scroller = document.createElement("div");
  scroller.style.overflowY = "auto";
  setSize(scroller, { width, height });
  document.body.appendChild(scroller);
  const result = render(ui, { container: scroller, ...options });
  return { ...result, scroller };
};
