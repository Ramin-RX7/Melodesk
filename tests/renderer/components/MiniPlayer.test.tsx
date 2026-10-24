import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MiniPlayer } from "../../../src/renderer/components/MiniPlayer/MiniPlayer";
import { fakeApi, installApi } from "../../helpers/api";
import { song } from "../../helpers/songs";

const renderMini = () => {
  const view = render(
    <MiniPlayer
      currentTrack={song()}
      isPlaying={false}
      themeColor="#000"
      onTogglePlay={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      onExitMini={vi.fn()}
    />,
  );
  // The widget's outermost element receives the drag.
  return view.container.firstElementChild as HTMLElement;
};

const LEFT = 1;
const moves = () => fakeApi().setWindowPosition.mock.calls;

describe("MiniPlayer dragging", () => {
  it("moves the window, always with the size it had when the drag started", async () => {
    const widget = renderMini();
    await act(async () => fireEvent.mouseDown(widget, { button: 0, screenX: 500, screenY: 300 }));
    fireEvent.mouseMove(window, { buttons: LEFT, screenX: 510, screenY: 280 });
    fireEvent.mouseMove(window, { buttons: LEFT, screenX: 600, screenY: 400 });
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { buttons: 0, screenX: 700, screenY: 500 });
    // Fake window: x 100, y 100, 320 × 120.
    expect(moves()).toEqual([
      [110, 80, 320, 120],
      [200, 200, 320, 120],
    ]);
  });

  it("a quick click released before the window position arrives doesn't start a drag", async () => {
    let answer!: (b: { x: number; y: number; width: number; height: number }) => void;
    installApi({ getWindowBounds: () => new Promise((resolve) => (answer = resolve)) });
    const widget = renderMini();
    fireEvent.mouseDown(widget, { button: 0, screenX: 500, screenY: 300 });
    fireEvent.mouseUp(window);
    await act(async () => answer({ x: 0, y: 0, width: 320, height: 120 }));
    fireEvent.mouseMove(window, { buttons: LEFT, screenX: 600, screenY: 400 });
    expect(moves()).toEqual([]);
  });

  it("stops following the mouse when the button was released outside the window", async () => {
    const widget = renderMini();
    await act(async () => fireEvent.mouseDown(widget, { button: 0, screenX: 0, screenY: 0 }));
    fireEvent.mouseMove(window, { buttons: 0, screenX: 50, screenY: 50 });
    fireEvent.mouseMove(window, { buttons: LEFT, screenX: 60, screenY: 60 });
    expect(moves()).toEqual([]);
  });

  it("pressing a button or using another mouse button doesn't drag", async () => {
    const widget = renderMini();
    await act(async () => fireEvent.mouseDown(screen.getByTitle("Next"), { button: 0 }));
    await act(async () => fireEvent.mouseDown(widget, { button: 2 }));
    expect(fakeApi().getWindowBounds).not.toHaveBeenCalled();
  });
});
