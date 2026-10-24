import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QueueView } from "../../../src/renderer/components/Queue/QueueView";
import { FileItem } from "../../../src/renderer/types";
import { song, songs } from "../../helpers/songs";

const a = song({ title: "Alpha" });
const b = song({ title: "Beta" });

const renderQueue = (
  queue: FileItem[],
  props: Partial<React.ComponentProps<typeof QueueView>> = {},
) => {
  const handlers = {
    onPlayTrack: vi.fn(),
    onClearQueue: vi.fn(),
    onRemoveFromQueue: vi.fn(),
    onMoveInQueue: vi.fn(),
  };
  render(
    <QueueView
      queue={queue}
      currentIndex={0}
      themeColor="#000"
      activeItemRemovable={false}
      isCustomOrder={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

const rowOf = (el: HTMLElement) => el.closest("[data-active]") as HTMLElement;
const rows = () => [...document.querySelectorAll<HTMLElement>("[data-active]")];
const removeIn = (row: HTMLElement) => within(row).queryByTitle("Remove from queue");

describe("QueueView", () => {
  it("a click plays that row, also for a song queued twice", async () => {
    const { onPlayTrack } = renderQueue([a, b, a]);
    await userEvent.click(screen.getAllByText("Alpha")[1]);
    expect(onPlayTrack).toHaveBeenCalledExactlyOnceWith(a, 2);
  });

  it("remove removes that row without playing it", async () => {
    const { onPlayTrack, onRemoveFromQueue } = renderQueue([a, b, a]);
    await userEvent.click(removeIn(rowOf(screen.getAllByText("Alpha")[1]))!);
    expect(onRemoveFromQueue).toHaveBeenCalledWith(2);
    expect(onPlayTrack).not.toHaveBeenCalled();
  });

  it("the playing song can be removed only when the setting allows it", () => {
    renderQueue([a, b]);
    expect(removeIn(rows()[0])).toBeNull();
    expect(removeIn(rows()[1])).not.toBeNull();
  });

  it("dragging a row onto another moves it there, once", () => {
    const { onMoveInQueue, onPlayTrack } = renderQueue([a, b, a]);
    const row = (i: number) => rows()[i].parentElement!;
    fireEvent.dragStart(row(2));
    fireEvent.dragEnter(row(0));
    fireEvent.drop(row(0));
    fireEvent.dragEnd(row(2));
    expect(onMoveInQueue).toHaveBeenCalledExactlyOnceWith(2, 0);
    expect(onPlayTrack).not.toHaveBeenCalled();

    fireEvent.dragStart(row(1));
    fireEvent.dragEnter(row(1));
    fireEvent.dragEnd(row(1));
    expect(onMoveInQueue).toHaveBeenCalledTimes(1);
  });

  it("renders only the visible rows of a long queue", () => {
    renderQueue(songs(2000));
    expect(rows().length).toBeGreaterThan(5);
    expect(rows().length).toBeLessThan(30);
  });

  it("'Go to current' scrolls to the playing song", async () => {
    const queue = songs(2000);
    renderQueue(queue, { currentIndex: 1500 });
    const title = queue[1500].metadata!.title!;
    expect(screen.queryByText(title)).toBeNull();
    await act(async () => screen.getByRole("button", { name: "Go to current" }).click());
    expect(rowOf(await screen.findByText(title)).dataset.active).toBe("true");
  });
});
