import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useQueue } from "../../../src/hooks/useQueue";
import { FileItem } from "../../../src/renderer/types";
import { song } from "../../helpers/songs";

const [a, b, c, d] = [song(), song(), song(), song()];
const paths = (list: FileItem[]) => list.map((t) => t.path);

const setup = (current: FileItem | null, queue: FileItem[], index: number) => {
  const hook = renderHook(({ track }) => useQueue(track), { initialProps: { track: current } });
  act(() => {
    hook.result.current.setQueue(queue);
    hook.result.current.setCurrentIndex(index);
  });
  return hook;
};

beforeEach(() => {
  // Math.random() = 0 makes shuffleArray rotate the list in a fixed way.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

describe("useQueue", () => {
  it("cycles repeat: none → all → one → none", () => {
    const { result } = setup(null, [], -1);
    const modes = [result.current.repeatMode];
    for (let i = 0; i < 3; i++) {
      act(() => result.current.handleRepeatToggle());
      modes.push(result.current.repeatMode);
    }
    expect(modes).toEqual(["none", "all", "one", "none"]);
  });

  it("turning shuffle on puts the current song first, followed by the rest shuffled", () => {
    const { result } = setup(c, [a, b, c, d], 2);
    act(() => result.current.handleShuffleToggle());

    expect(result.current.isShuffle).toBe(true);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.shuffledQueue[0]).toBe(c);
    expect(paths(result.current.shuffledQueue).sort()).toEqual(paths([a, b, c, d]).sort());
    expect(result.current.activeQueue).toBe(result.current.shuffledQueue);
  });

  it("turning shuffle on drops the other copies of the current song", () => {
    const { result } = setup(a, [a, b, a, c], 0);
    act(() => result.current.handleShuffleToggle());
    expect(paths(result.current.shuffledQueue).filter((p) => p === a.path)).toHaveLength(1);
    expect(result.current.shuffledQueue).toHaveLength(3);
  });

  it("without a current song, shuffle only flips the setting", () => {
    const { result } = setup(null, [a, b], -1);
    act(() => result.current.handleShuffleToggle());
    expect(result.current.isShuffle).toBe(true);
    expect(result.current.shuffledQueue).toEqual([]);
    expect(result.current.currentIndex).toBe(-1);
  });

  it("turning shuffle off returns to the current song's place in the original order", () => {
    const { result } = setup(c, [a, b, c, d], 2);
    act(() => result.current.handleShuffleToggle());
    act(() => result.current.handleShuffleToggle());
    expect(result.current.isShuffle).toBe(false);
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.activeQueue).toEqual([a, b, c, d]);
  });

  describe("removeFromQueue", () => {
    it("removes the row, and moves the current index when an earlier row goes", () => {
      const { result } = setup(c, [a, b, c, d], 2);
      act(() => result.current.removeFromQueue(0));
      expect(result.current.queue).toEqual([b, c, d]);
      expect(result.current.currentIndex).toBe(1);
    });

    it("keeps the index when a later row goes", () => {
      const { result } = setup(b, [a, b, c, d], 1);
      act(() => result.current.removeFromQueue(3));
      expect(result.current.queue).toEqual([a, b, c]);
      expect(result.current.currentIndex).toBe(1);
    });

    it("removing the current song when it's last moves to the new last song", () => {
      const { result } = setup(c, [a, b, c], 2);
      act(() => result.current.removeFromQueue(2));
      expect(result.current.queue).toEqual([a, b]);
      expect(result.current.currentIndex).toBe(1);
    });

    it("removes exactly the chosen copy of a repeated song", () => {
      const { result } = setup(d, [a, b, a, d], 3);
      act(() => result.current.removeFromQueue(2));
      expect(result.current.queue).toEqual([a, b, d]);
      expect(result.current.queue[0]).toBe(a);
    });

    it("with shuffle on, removes the same copy from the original order too", () => {
      const { result } = setup(d, [a, b, a, c, d], 4);
      act(() => {
        result.current.setShuffledQueue([d, a, c, a, b]);
        result.current.setIsShuffle(true);
        result.current.setCurrentIndex(0);
      });
      // The second copy of `a` in the shuffled list…
      act(() => result.current.removeFromQueue(3));
      expect(result.current.shuffledQueue).toEqual([d, a, c, b]);
      // …is the second copy in the original list as well.
      expect(result.current.queue).toEqual([a, b, c, d]);
    });

    it("without shuffle, removes the same copy from the shuffled list", () => {
      const { result } = setup(d, [a, b, a, d], 3);
      act(() => result.current.setShuffledQueue([a, d, a, b]));
      act(() => result.current.removeFromQueue(0));
      expect(result.current.queue).toEqual([b, a, d]);
      expect(result.current.shuffledQueue).toEqual([d, a, b]);
    });

    it("ignores an index that isn't in the queue", () => {
      const { result } = setup(a, [a, b], 0);
      act(() => result.current.removeFromQueue(5));
      expect(result.current.queue).toEqual([a, b]);
      expect(result.current.currentIndex).toBe(0);
    });
  });
});
