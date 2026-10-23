// The whole library update on real files: scan, move detection, cache, art, messages.
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { FileItem, LibraryScanStatus } from "../../../src/renderer/types";
import { freshMain, profilePath, TestLibrary, useLibrary } from "../../helpers/main";
import { FakeBrowserWindow } from "../../helpers/electron";

let electron: Awaited<ReturnType<typeof freshMain>>;
let win: FakeBrowserWindow;
let lib: TestLibrary;
let updater: typeof import("../../../src/main/services/library/libraryUpdater");

beforeEach(async () => {
  electron = await freshMain();
  lib = await useLibrary();
  fs.mkdirSync(await profilePath("art_cache"), { recursive: true });
  win = electron.openWindow();
  updater = await import("../../../src/main/services/library/libraryUpdater");
  await electron.invoke("take-pending-notifications"); // the page is listening from now on
});

const toasts = () =>
  win.webContents.sentOn<{ level: string; message: string }>("notification").map((n) => n.message);
const lastLibrary = () => win.webContents.sentOn<FileItem[]>("library-updated").at(-1)!;
const byName = (name: string) => lastLibrary().find((f) => f.name === name)!;

/** Runs an update and returns the toasts it produced. */
const update = async () => {
  const before = toasts().length;
  await updater.updateLibrary();
  return toasts().slice(before);
};

describe("updateLibrary", () => {
  it("scans the library, saves the cache and tells the page", async () => {
    const messages = await update();
    expect(lastLibrary()).toHaveLength(10);
    expect(messages).toEqual(["Library updated: 10 new songs."]);
    expect(fs.existsSync(await profilePath("library_cache.json"))).toBe(true);

    const statuses = win.webContents.sentOn<LibraryScanStatus>("library-scan-status");
    expect(statuses[0]).toMatchObject({ scanning: true, phase: "discovering" });
    expect(statuses.at(-1)).toEqual({ scanning: false, processed: 0, total: 0 });
    expect(updater.isScanning()).toBe(false);
  });

  it("says nothing when nothing changed", async () => {
    await update();
    expect(await update()).toEqual([]);
  });

  it("a new update cancels the one running; only the last one saves and reports", async () => {
    const first = updater.updateLibrary();
    const second = updater.updateLibrary();
    await Promise.all([first, second]);
    expect(win.webContents.sentOn("library-updated")).toHaveLength(1);
    expect(toasts()).toEqual(["Library updated: 10 new songs."]);
  });

  it("keeps a song's id when its file is renamed, with one accurate message", async () => {
    await update();
    const id = byName("01 First Light.mp3").hash;
    fs.renameSync(
      lib.file("Library A/Album One/01 First Light.mp3"),
      lib.file("Library A/Album One/First Light (renamed).mp3"),
    );
    expect(await update()).toEqual([
      "Library updated: 1 song moved or renamed (play counts and playlists kept).",
    ]);
    expect(byName("First Light (renamed).mp3").hash).toBe(id);
  });

  it("follows a song moved to the other library folder", async () => {
    await update();
    const id = byName("Lone Single.mp3").hash;
    fs.renameSync(
      lib.file("Library A/Singles/Lone Single.mp3"),
      path.join(lib.b, "Lone Single.mp3"),
    );
    await update();
    expect(byName("Lone Single.mp3").path).toBe(path.join(lib.b, "Lone Single.mp3"));
    expect(byName("Lone Single.mp3").hash).toBe(id);
  });

  it("gives a song its id back when the file returns after being removed", async () => {
    await update();
    const file = lib.file("Library B/Night Drive.mp3");
    const id = byName("Night Drive.mp3").hash;
    const outside = path.join(lib.root, "..", "Night Drive.mp3");
    fs.renameSync(file, outside);
    expect(await update()).toEqual(["Library updated: 1 song removed."]);
    fs.renameSync(outside, path.join(lib.a, "Night Drive.mp3"));
    await update();
    expect(byName("Night Drive.mp3").hash).toBe(id);
  });

  it("treats a copy as a new song", async () => {
    await update();
    fs.copyFileSync(lib.file("Library A/Singles/Lone Single.mp3"), path.join(lib.b, "copy.mp3"));
    expect(await update()).toEqual(["Library updated: 1 new song."]);
    expect(byName("copy.mp3").hash).not.toBe(byName("Lone Single.mp3").hash);
  });

  it("reports a changed file as updated", async () => {
    await update();
    fs.appendFileSync(lib.file("Library B/Night Drive.mp3"), Buffer.alloc(10));
    expect(await update()).toEqual(["Library updated: 1 song updated."]);
  });

  it("tells the user once when a library folder is missing, and when it's back", async () => {
    await update();
    const offline = `${lib.b}-offline`;
    fs.renameSync(lib.b, offline);
    const missing = await update();
    expect(missing).toHaveLength(1); // its songs aren't also listed as removed
    expect(missing[0]).toContain(`"${lib.b}" can't be found`);
    expect(await update()).toEqual([]); // not repeated
    expect(lastLibrary()).toHaveLength(8);

    fs.renameSync(offline, lib.b);
    expect(await update()).toEqual([`The library folder "${lib.b}" is back.`]);
    expect(lastLibrary()).toHaveLength(10);
  });
});

describe("describeChanges", () => {
  const changes = (counts: {
    added?: number;
    moves?: number;
    updated?: number;
    removed?: number;
  }) => ({
    added: Array.from({ length: counts.added ?? 0 }, () => ({}) as FileItem),
    moves: Array.from({ length: counts.moves ?? 0 }, () => ({ id: "", from: "", to: "" })),
    removed: Array.from(
      { length: counts.removed ?? 0 },
      (_, i) => ({ path: `/m/${i}.mp3` }) as FileItem,
    ),
    returned: 0,
    updated: counts.updated ?? 0,
  });

  it("lists what changed, with plurals", () => {
    expect(updater.describeChanges(changes({ added: 1 }), [])).toBe("Library updated: 1 new song.");
    expect(
      updater.describeChanges(changes({ added: 2, moves: 1, updated: 3, removed: 1200 }), []),
    ).toBe(
      "Library updated: 2 new songs, 1 song moved or renamed (play counts and playlists kept), 3 songs updated, 1,200 songs removed.",
    );
  });

  it("says nothing when nothing changed, and leaves out songs of missing folders", () => {
    expect(updater.describeChanges(changes({}), [])).toBeNull();
    expect(updater.describeChanges(changes({ removed: 2 }), ["/m"])).toBeNull();
  });
});
