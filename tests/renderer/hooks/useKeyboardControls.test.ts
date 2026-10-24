import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKeyboardControls } from "../../../src/hooks/useKeyboardControls";
import { DEFAULT_KEYBINDINGS, Keybindings } from "../../../src/utils/keybindings";
import { setSize } from "../../helpers/layout";

const handlers = () => ({
  togglePlay: vi.fn(),
  handleNext: vi.fn(),
  handlePrevious: vi.fn(),
  seekForward: vi.fn(),
  seekBackward: vi.fn(),
  goBack: vi.fn(),
  focusSearch: vi.fn(),
});
let h: ReturnType<typeof handlers>;

const setup = (keybindings?: Keybindings) =>
  renderHook((p) => useKeyboardControls(p), { initialProps: { ...h, keybindings } });

const press = (code: string, init: KeyboardEventInit = {}, target: Element = document.body) => {
  const event = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

const input = (type = "text") => {
  const el = document.createElement("input");
  el.type = type;
  document.body.appendChild(el);
  return el;
};

beforeEach(() => {
  h = handlers();
});

describe("useKeyboardControls", () => {
  it.each([
    ["Space", "togglePlay"],
    ["PageDown", "handleNext"],
    ["PageUp", "handlePrevious"],
    ["ArrowRight", "seekForward"],
    ["ArrowLeft", "seekBackward"],
    ["Escape", "goBack"],
    ["MediaTrackNext", "handleNext"],
    ["MediaTrackPrevious", "handlePrevious"],
  ] as const)("%s → %s", (code, handler) => {
    setup();
    const event = press(code);
    expect(h[handler]).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Ctrl+F and Cmd+F focus the search; F alone doesn't", () => {
    setup();
    press("KeyF");
    expect(h.focusSearch).not.toHaveBeenCalled();
    press("KeyF", { ctrlKey: true });
    press("KeyF", { metaKey: true });
    expect(h.focusSearch).toHaveBeenCalledTimes(2);
  });

  it("Shift and Alt must match exactly", () => {
    setup();
    press("Space", { shiftKey: true });
    press("Space", { altKey: true });
    press("KeyF", { ctrlKey: true, shiftKey: true });
    expect(h.togglePlay).not.toHaveBeenCalled();
    expect(h.focusSearch).not.toHaveBeenCalled();
  });

  it("uses the user's bindings, and media keys stay active", () => {
    setup({ ...DEFAULT_KEYBINDINGS, nextTrack: [{ code: "KeyN", shift: true }] });
    press("PageDown");
    expect(h.handleNext).not.toHaveBeenCalled();
    press("KeyN", { shiftKey: true });
    press("MediaTrackNext");
    expect(h.handleNext).toHaveBeenCalledTimes(2);
  });

  it("while typing, plain keys type and shortcuts with Ctrl still work", () => {
    setup();
    const box = input();
    const space = press("Space", {}, box);
    press("ArrowLeft", {}, box);
    expect(h.togglePlay).not.toHaveBeenCalled();
    expect(h.seekBackward).not.toHaveBeenCalled();
    expect(space.defaultPrevented).toBe(false);

    press("KeyF", { ctrlKey: true }, box);
    expect(h.focusSearch).toHaveBeenCalled();
  });

  it("typing in a text area counts as typing too", () => {
    setup();
    const area = document.createElement("textarea");
    document.body.appendChild(area);
    press("Space", {}, area);
    expect(h.togglePlay).not.toHaveBeenCalled();
  });

  it("Space on a slider (volume, seek bar) plays/pauses; its arrows stay with the slider", () => {
    setup();
    const slider = input("range");
    press("Space", {}, slider);
    expect(h.togglePlay).toHaveBeenCalledTimes(1);
    press("ArrowRight", {}, slider);
    expect(h.seekForward).not.toHaveBeenCalled();
  });

  it("the mouse back button goes back", () => {
    setup();
    fireEvent.mouseUp(window, { button: 3 });
    fireEvent.mouseUp(window, { button: 0 });
    expect(h.goBack).toHaveBeenCalledTimes(1);
  });

  it("unbound up/down arrows scroll a scrollable element", () => {
    setup();
    const list = document.createElement("div");
    document.body.appendChild(list);
    setSize(list, { height: 100, scrollHeight: 500 });
    press("ArrowDown", {}, list);
    press("ArrowDown", {}, list);
    press("ArrowUp", {}, list);
    expect(list.scrollTop).toBe(40);

    const short = document.createElement("div");
    document.body.appendChild(short);
    setSize(short, { height: 100 });
    expect(press("ArrowDown", {}, short).defaultPrevented).toBe(false);
  });

  it("calls the newest handlers without registering the listener again", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = setup();
    const togglePlay = vi.fn();
    rerender({ ...h, togglePlay, keybindings: undefined });
    press("Space");
    expect(togglePlay).toHaveBeenCalled();
    expect(h.togglePlay).not.toHaveBeenCalled();
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
  });

  it("stops listening when unmounted", () => {
    const { unmount } = setup();
    unmount();
    press("Space");
    fireEvent.mouseUp(window, { button: 3 });
    expect(h.togglePlay).not.toHaveBeenCalled();
    expect(h.goBack).not.toHaveBeenCalled();
  });
});
