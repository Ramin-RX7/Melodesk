// Config, session, tracker, notifications and the removed-songs store: the small services that
// keep user data in the profile folder.
import fs from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_KEYBINDINGS } from "../../../src/utils/keybindings";
import { freshMain, profilePath, seedUserData } from "../../helpers/main";
import { TEST_DEFAULT_CONFIG } from "../../helpers/songs";
import { readJsonFile } from "../../helpers/tempdir";

let electron: Awaited<ReturnType<typeof freshMain>>;
beforeEach(async () => {
  electron = await freshMain();
});

describe("configService", () => {
  it("returns the defaults when there is no settings file", async () => {
    const { getConfig } = await import("../../../src/main/services/configService");
    const config = getConfig();
    expect(config.libraryPaths).toEqual([]);
    expect(config.doubleClickToPlay).toBe(true);
    expect(config.keybindings).toEqual(DEFAULT_KEYBINDINGS);
  });

  it("has the defaults the renderer tests use (tests/helpers/songs.ts)", async () => {
    const { getConfig } = await import("../../../src/main/services/configService");
    expect(getConfig()).toEqual(TEST_DEFAULT_CONFIG);
  });

  it("merges a saved file over the defaults, deep-merging appearance and keybindings", async () => {
    await seedUserData({
      "config.json": {
        volume: 0.2,
        appearance: { themeId: "nord" },
        keybindings: { togglePlay: [{ code: "KeyP" }] },
      },
    });
    const { getConfig } = await import("../../../src/main/services/configService");
    const config = getConfig();
    expect(config.volume).toBe(0.2);
    expect(config.minSongsForAlbum).toBe(3); // default kept
    expect(config.appearance).toEqual({ themeId: "nord", colors: {} });
    expect(config.keybindings.togglePlay).toEqual([{ code: "KeyP" }]);
    // An action added after the file was saved still gets its default binding.
    expect(config.keybindings.focusSearch).toEqual(DEFAULT_KEYBINDINGS.focusSearch);
  });

  it("saves and reads back", async () => {
    const { getConfig, saveConfig } = await import("../../../src/main/services/configService");
    saveConfig({ ...getConfig(), libraryPaths: ["/m"], volume: 0.9 });
    expect(getConfig()).toMatchObject({ libraryPaths: ["/m"], volume: 0.9 });
  });
});

describe("sessionService", () => {
  const playback = {
    currentTrackPath: "/m/a.mp3",
    queue: ["/m/a.mp3", "/m/b.mp3"],
    shuffledQueue: ["/m/b.mp3", "/m/a.mp3"],
    currentIndex: 0,
    isShuffle: false,
    repeatMode: "none" as const,
    position: 42,
  };

  it("merges saves, so playback state and window bounds don't overwrite each other", async () => {
    const svc = await import("../../../src/main/services/sessionService");
    svc.saveSession(playback);
    svc.saveWindowBounds({ x: 1, y: 2, width: 800, height: 600 });
    svc.saveMiniWindowBounds({ x: 5, y: 6, width: 260, height: 260 });
    expect(svc.getSession()).toMatchObject({ ...playback, windowBounds: { width: 800 } });
    expect(svc.getWindowBounds()).toEqual({ x: 1, y: 2, width: 800, height: 600 });
    expect(svc.getMiniWindowBounds()).toEqual({ x: 5, y: 6, width: 260, height: 260 });
  });

  it("clearSession drops playback state but keeps window bounds and picker folders", async () => {
    const svc = await import("../../../src/main/services/sessionService");
    svc.saveSession({ ...playback, lastPickedFolder: "/music/x", lastPickedImage: "/p/a.png" });
    svc.saveWindowBounds({ x: 1, y: 2, width: 800, height: 600 });
    svc.clearSession();
    expect(svc.getSession()).toEqual({
      windowBounds: { x: 1, y: 2, width: 800, height: 600 },
      lastPickedFolder: "/music/x",
      lastPickedImage: "/p/a.png",
    });
  });

  it("clearSession deletes the file when there is nothing to keep", async () => {
    const svc = await import("../../../src/main/services/sessionService");
    svc.saveSession(playback);
    svc.clearSession();
    expect(fs.existsSync(await profilePath("session.json"))).toBe(false);
    expect(svc.getSession()).toBeNull();
  });

  it("replaceSessionPaths points the saved queue at moved songs and keeps the position", async () => {
    const svc = await import("../../../src/main/services/sessionService");
    svc.saveSession(playback);
    svc.replaceSessionPaths((p) => (p === "/m/a.mp3" ? "/m/moved/a.mp3" : p));
    expect(svc.getSession()).toMatchObject({
      currentTrackPath: "/m/moved/a.mp3",
      queue: ["/m/moved/a.mp3", "/m/b.mp3"],
      shuffledQueue: ["/m/b.mp3", "/m/moved/a.mp3"],
      position: 42,
    });
  });
});

describe("trackerService", () => {
  const jan = new Date(2026, 0, 15).getTime();
  const feb = new Date(2026, 1, 3).getTime();

  it("counts plays and writes each play to its month's history file", async () => {
    const t = await import("../../../src/main/services/trackerService");
    t.recordPlay("h1", jan);
    t.recordPlay("h1", feb);
    t.recordPlay("h2", feb + 1000);
    expect(t.getPlayCounts()).toEqual({ h1: 2, h2: 1 });
    expect(t.getPlayCount("h1")).toBe(2);
    expect(t.getPlayCount("unknown")).toBe(0);
    expect(readJsonFile(await profilePath("tracker", "play_history", "2026-01.json"))).toEqual([
      { hash: "h1", timestamp: jan },
    ]);
    expect(t.getHistory("2026-02")).toHaveLength(2);
  });

  it("lists recent plays newest first across months, up to the limit", async () => {
    const t = await import("../../../src/main/services/trackerService");
    t.recordPlay("old", jan);
    t.recordPlay("new", feb);
    t.recordPlay("newest", feb + 5000);
    expect(t.getRecentPlays().map((r) => r.hash)).toEqual(["newest", "new", "old"]);
    expect(t.getRecentPlays(2).map((r) => r.hash)).toEqual(["newest", "new"]);
  });

  it("ignores a play without a song id", async () => {
    const t = await import("../../../src/main/services/trackerService");
    t.recordPlay("");
    expect(t.getPlayCounts()).toEqual({});
  });
});

describe("notifyService", () => {
  it("queues notifications until the page asks for them, then sends them to every window", async () => {
    const { notify } = await import("../../../src/main/services/notifyService");
    const win1 = electron.openWindow();
    const win2 = electron.openWindow();
    notify("error", "early");
    expect(win1.webContents.sentOn("notification")).toEqual([]);

    expect(await electron.invoke("take-pending-notifications")).toEqual([
      { level: "error", message: "early" },
    ]);
    expect(await electron.invoke("take-pending-notifications")).toEqual([]); // handed over once

    notify("info", "later");
    expect(win1.webContents.sentOn("notification")).toEqual([{ level: "info", message: "later" }]);
    expect(win2.webContents.sentOn("notification")).toEqual([{ level: "info", message: "later" }]);
  });
});

describe("removedSongsService", () => {
  const song = (id: string, fileSize?: number) => ({
    name: `${id}.mp3`,
    path: `/m/${id}.mp3`,
    isDirectory: false,
    isMedia: true,
    hash: id,
    metadata: fileSize === undefined ? undefined : { fileSize, duration: 3, title: id },
  });

  it("remembers removed songs (only those it can recognise later) and forgets returned ones", async () => {
    const svc = await import("../../../src/main/services/removedSongsService");
    svc.updateRemovedSongs([song("a", 100), song("untagged")], []);
    expect(Object.keys(svc.getRemovedSongs())).toEqual(["a"]);
    expect(svc.getRemovedSongs().a).toMatchObject({ path: "/m/a.mp3", size: 100, title: "a" });

    svc.updateRemovedSongs([], ["a"]);
    expect(svc.getRemovedSongs()).toEqual({});
  });

  it("is kept on disk across restarts", async () => {
    const svc = await import("../../../src/main/services/removedSongsService");
    svc.updateRemovedSongs([song("a", 100)], []);
    const file = await profilePath("removed_songs.json");
    expect(readJsonFile<Record<string, unknown>>(file)).toHaveProperty("a");
  });
});
