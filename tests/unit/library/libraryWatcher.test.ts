import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freshMain, useLibrary } from "../../helpers/main";

// A stand-in for chokidar: records watched paths and lets the test fire file events.
class FakeWatcher extends EventEmitter {
  closed = false;
  constructor(readonly paths: string[]) {
    super();
  }
  async close() {
    this.closed = true;
  }
}
let watchers: FakeWatcher[] = [];
const updateLibrary = vi.fn(async () => {});

beforeEach(async () => {
  await freshMain();
  watchers = [];
  updateLibrary.mockClear();
  vi.doMock("../../../src/main/services/esmImport", () => ({
    importEsm: async () => ({
      watch: (paths: string[]) => {
        const w = new FakeWatcher(paths);
        watchers.push(w);
        return w;
      },
    }),
  }));
  vi.doMock("../../../src/main/services/library/libraryUpdater", () => ({ updateLibrary }));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("../../../src/main/services/esmImport");
  vi.doUnmock("../../../src/main/services/library/libraryUpdater");
});

const setup = async () => {
  const { setupWatcher } = await import("../../../src/main/services/library/libraryWatcher");
  await setupWatcher();
  return watchers.at(-1)!;
};

describe("setupWatcher", () => {
  it("watches the existing library folders", async () => {
    const lib = await useLibrary();
    const w = await setup();
    expect(w.paths).toEqual([lib.a, lib.b]);
  });

  it("starts one update after 2 seconds without changes", async () => {
    await useLibrary();
    const w = await setup();
    w.emit("add", "/m/a.mp3");
    await vi.advanceTimersByTimeAsync(1500);
    w.emit("unlink", "/m/b.flac");
    w.emit("addDir", "/m/new folder");
    await vi.advanceTimersByTimeAsync(1999);
    expect(updateLibrary).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(updateLibrary).toHaveBeenCalledTimes(1);
  });

  it("ignores files that aren't audio", async () => {
    await useLibrary();
    const w = await setup();
    w.emit("add", "/m/cover.jpg");
    w.emit("change", "/m/notes.txt");
    await vi.advanceTimersByTimeAsync(5000);
    expect(updateLibrary).not.toHaveBeenCalled();
  });

  it("closes the previous watcher when set up again", async () => {
    await useLibrary();
    const { setupWatcher } = await import("../../../src/main/services/library/libraryWatcher");
    await setupWatcher();
    await setupWatcher();
    expect(watchers).toHaveLength(2);
    expect(watchers[0].closed).toBe(true);
  });

  it("watches nothing without library folders", async () => {
    const { setupWatcher } = await import("../../../src/main/services/library/libraryWatcher");
    await setupWatcher();
    expect(watchers).toHaveLength(0);
  });
});
