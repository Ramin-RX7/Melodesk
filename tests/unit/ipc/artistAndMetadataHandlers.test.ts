import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPath } from "../../../src/main/services/hashUtil";
import { ArtistInfo, FileItem } from "../../../src/renderer/types";
import { solidPng } from "../../fixtures/generate.mjs";
import { freshMain, profilePath, seedUserData, TestLibrary, useLibrary } from "../../helpers/main";
import { makeTempDir, readJsonFile } from "../../helpers/tempdir";

let electron: Awaited<ReturnType<typeof freshMain>>;

beforeEach(async () => {
  electron = await freshMain();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("artist handlers", () => {
  let pictures: string;

  beforeEach(async () => {
    const { setupArtistHandlers } = await import("../../../src/main/ipc/artistHandlers");
    setupArtistHandlers();
    pictures = makeTempDir("melodesk-pictures-");
  });

  const pick = (file: string | null) =>
    electron.dialog.showOpenDialog.mockResolvedValueOnce(
      file ? { canceled: false, filePaths: [file] } : { canceled: true, filePaths: [] },
    );

  it("stores an artist's bio and picture under its name", async () => {
    expect(await electron.invoke("get-artist-info", "Zeta")).toEqual({ name: "Zeta" });
    const saved = await electron.invoke<ArtistInfo>("update-artist-info", "Zeta", {
      bio: "Hi",
      name: "Other",
    });
    expect(saved).toEqual({ name: "Zeta", bio: "Hi" }); // the name can't be changed
    expect(await electron.invoke("get-artist-info", "Zeta")).toEqual({ name: "Zeta", bio: "Hi" });
  });

  it("returns every artist's picture in one call", async () => {
    await electron.invoke("update-artist-info", "A", { picture: "/art/a.png" });
    await electron.invoke("update-artist-info", "B", { bio: "no picture" });
    await electron.invoke("update-artist-info", "C", { picture: "/art/c.png" });
    expect(await electron.invoke("get-artist-pictures")).toEqual({
      A: "/art/a.png",
      C: "/art/c.png",
    });
  });

  it("copies a picked image into the art cache under a content name, opening where the last one was", async () => {
    const red = path.join(pictures, "Red.PNG");
    fs.writeFileSync(red, solidPng([255, 0, 0]));
    pick(red);
    const first = await electron.invoke<string>("select-artist-image");
    expect(path.dirname(first)).toBe(await profilePath("art_cache"));
    expect(path.basename(first)).toMatch(/^artist_[0-9a-f]{40}\.png$/);
    expect(fs.readFileSync(first)).toEqual(fs.readFileSync(red));

    const copy = path.join(pictures, "same picture.png");
    fs.copyFileSync(red, copy);
    pick(copy);
    expect(await electron.invoke("select-artist-image")).toBe(first); // same image, same file
    expect(electron.dialog.showOpenDialog.mock.calls[1][0]).toMatchObject({
      defaultPath: pictures,
    });

    pick(null);
    expect(await electron.invoke("select-artist-image")).toBeNull();
  });

  it("deletes a replaced picture unless another artist still uses it", async () => {
    const files = ["one.png", "two.png", "shared.png"].map((name, i) => {
      const file = path.join(pictures, name);
      fs.writeFileSync(file, solidPng([i * 50, 0, 0]));
      return file;
    });
    const picked: string[] = [];
    for (const file of files) {
      pick(file);
      picked.push(await electron.invoke<string>("select-artist-image"));
    }
    const [one, two, shared] = picked;
    await electron.invoke("update-artist-info", "A", { picture: one });
    await electron.invoke("update-artist-info", "B", { picture: shared });
    await electron.invoke("update-artist-info", "C", { picture: shared });

    await electron.invoke("update-artist-info", "A", { picture: two });
    await electron.invoke("update-artist-info", "B", { picture: two });
    await vi.waitFor(() => expect(fs.existsSync(one)).toBe(false));
    expect(fs.existsSync(shared)).toBe(true); // C still uses it
  });
});

describe("metadata handlers", () => {
  let lib: TestLibrary;
  const mp3 = () => lib.file("Library A/Singles/Lone Single.mp3");

  beforeEach(async () => {
    lib = await useLibrary();
    fs.mkdirSync(await profilePath("art_cache"), { recursive: true });
    const { registerMetadataHandlers } = await import("../../../src/main/ipc/metadataHandlers");
    registerMetadataHandlers();
  });

  const cacheSong = async (file: string, id: string) =>
    seedUserData({
      "library_cache.json": {
        [hashPath(file)]: {
          name: path.basename(file),
          path: file,
          isDirectory: false,
          isMedia: true,
          hash: id,
        },
      },
    });

  it("reads a song's details, keeping the id of a song the library already knows", async () => {
    await cacheSong(mp3(), "kept-id");
    const item = await electron.invoke<FileItem>("get-metadata", mp3());
    expect(item).toMatchObject({
      hash: "kept-id",
      metadata: { title: "Lone Single", artists: ["Epsilon"] },
    });

    const other = lib.file("Library B/Night Drive.mp3");
    expect((await electron.invoke<FileItem>("get-metadata", other)).hash).toBe(hashPath(other));
  });

  it("returns null for files that aren't audio", async () => {
    expect(
      await electron.invoke("get-metadata", lib.file("Library A/Singles/notes.txt")),
    ).toBeNull();
  });

  it("writes tags to an MP3 in the library", async () => {
    await cacheSong(mp3(), "id");
    const ok = await electron.invoke("write-metadata", mp3(), {
      title: "New Title",
      artist: "New Artist",
      year: "1999",
    });
    expect(ok).toBe(true);
    const { readSongMetadata } = await import("../../../src/main/services/metadataService");
    expect(await readSongMetadata(mp3())).toMatchObject({
      title: "New Title",
      artists: ["New Artist"],
      year: 1999,
    });
  });

  it("refuses to write anywhere else", async () => {
    const wav = lib.file("Library A/Singles/field recording.wav");
    await cacheSong(wav, "wav");
    const outside = path.join(makeTempDir(), "outside.mp3");
    fs.copyFileSync(mp3(), outside);
    const before = fs.readFileSync(outside);

    for (const target of [wav, outside, mp3() /* not in the cache */, 42, null]) {
      expect(await electron.invoke("write-metadata", target, { title: "x" })).toBe(false);
    }
    expect(fs.readFileSync(outside)).toEqual(before);
  });
});

describe("shell handlers", () => {
  beforeEach(async () => {
    const { registerShellHandlers } = await import("../../../src/main/ipc/shellHandlers");
    registerShellHandlers();
  });

  it("opens web links", async () => {
    await electron.invoke("open-external-url", "https://www.google.com/search?q=a%20b");
    await electron.invoke("open-external-url", "http://example.com/");
    expect(electron.shell.openExternal.mock.calls.map(([url]) => url)).toEqual([
      "https://www.google.com/search?q=a%20b",
      "http://example.com/",
    ]);
  });

  it.each([
    "file:///C:/Windows/System32/calc.exe",
    "ms-settings:",
    "javascript:alert(1)",
    "smb://server/share",
    "https://user:pass@example.com/",
    "not a url",
    "",
  ])("refuses %s", async (url) => {
    await electron.invoke("open-external-url", url);
    expect(electron.shell.openExternal).not.toHaveBeenCalled();
  });

  it("shows a file in its folder", async () => {
    await electron.invoke("show-file-in-folder", "/m/a.mp3");
    expect(electron.shell.showItemInFolder).toHaveBeenCalledWith("/m/a.mp3");
  });
});

describe("config, session and tracker handlers", () => {
  const updateLibrary = vi.fn(async () => {});
  const setupWatcher = vi.fn(async () => {});

  beforeEach(async () => {
    updateLibrary.mockClear();
    setupWatcher.mockClear();
    vi.doMock("../../../src/main/services/library/libraryUpdater", () => ({ updateLibrary }));
    vi.doMock("../../../src/main/services/library/libraryWatcher", () => ({ setupWatcher }));
    (await import("../../../src/main/ipc/configHandlers")).registerConfigHandlers();
    (await import("../../../src/main/ipc/sessionHandlers")).setupSessionHandlers();
    (await import("../../../src/main/ipc/trackerHandlers")).registerTrackerHandlers();
  });

  it("update-config merges and saves; new library folders are watched and scanned", async () => {
    const config = await electron.invoke<{ volume: number }>("update-config", { volume: 0.3 });
    expect(config.volume).toBe(0.3);
    expect(readJsonFile<{ volume: number }>(await profilePath("config.json")).volume).toBe(0.3);
    expect(updateLibrary).not.toHaveBeenCalled();

    await electron.invoke("update-config", { libraryPaths: ["/m"] });
    expect(setupWatcher).toHaveBeenCalledTimes(1);
    expect(updateLibrary).toHaveBeenCalledTimes(1);
    expect((await electron.invoke<{ volume: number }>("get-config")).volume).toBe(0.3);
  });

  it("saves, reads and clears the session; the position only with a song loaded", async () => {
    electron.send("save-playback-position", 12);
    expect(await electron.invoke("get-session")).toBeNull();

    await electron.invoke("save-session", { currentTrackPath: "/m/a.mp3", queue: ["/m/a.mp3"] });
    electron.send("save-playback-position", 12);
    electron.send("save-playback-position", NaN);
    expect(await electron.invoke("get-session")).toMatchObject({
      currentTrackPath: "/m/a.mp3",
      position: 12,
    });

    await electron.invoke("clear-session");
    expect(await electron.invoke("get-session")).toBeNull();
  });

  it("records plays and lists counts and recent plays", async () => {
    await electron.invoke("record-play", "h1", 1000);
    await electron.invoke("record-play", "h1", 2000);
    expect(await electron.invoke("get-play-counts")).toEqual({ h1: 2 });
    expect(await electron.invoke("get-recent-plays", 1)).toEqual([{ hash: "h1", timestamp: 2000 }]);
  });
});

describe("context menus", () => {
  type Item = {
    label?: string;
    type?: string;
    enabled?: boolean;
    click?: () => void;
    submenu?: Item[];
  };

  beforeEach(async () => {
    await seedUserData({
      "playlists/p1.json": { id: "p1", name: "Faves", songs: [], createdAt: "a", updatedAt: "a" },
    });
    electron.openWindow();
    (await import("../../../src/main/ipc/menuHandlers")).registerMenuHandlers();
  });

  /** Opens a menu, then clicks the item at `labels` (submenus by label) or dismisses it. */
  const openMenu = async (channel: string, arg: unknown, labels: string[] | null) => {
    const result = electron.invoke(channel, arg);
    await vi.waitFor(() => expect(electron.Menu.buildFromTemplate).toHaveBeenCalled());
    const { template, popup } = electron.Menu.buildFromTemplate.mock.results.at(-1)!.value as {
      template: Item[];
      popup: ReturnType<typeof vi.fn>;
    };
    if (labels) {
      let items = template;
      let item: Item | undefined;
      for (const label of labels) {
        item = items.find((i) => i.label === label);
        items = item?.submenu ?? [];
      }
      item!.click!();
    }
    popup.mock.calls[0][0].callback();
    return { action: await result, template };
  };

  const song = (metadata: FileItem["metadata"]): FileItem => ({
    name: "a.mp3",
    path: "/m/a.mp3",
    isDirectory: false,
    isMedia: true,
    metadata,
  });

  it("song menu: actions resolve, dismissing resolves null", async () => {
    const s = song({ album: "Al", artists: ["A", "B"] });
    expect((await openMenu("show-song-context-menu", s, ["Play Next"])).action).toEqual({
      type: "play-next",
    });
    expect((await openMenu("show-song-context-menu", s, ["Go to Artist", "B"])).action).toEqual({
      type: "go-to-artist",
      artist: "B",
    });
    expect(
      (await openMenu("show-song-context-menu", s, ["Add to Playlist", "Faves"])).action,
    ).toEqual({ type: "add-to-playlist", playlistId: "p1" });
    expect((await openMenu("show-song-context-menu", s, null)).action).toBeNull();
  });

  it("song menu: no album → Go to Album disabled; no artist → Unknown Artist", async () => {
    const { template, action } = await openMenu("show-song-context-menu", song({}), [
      "Go to Artist",
    ]);
    expect(template.find((i) => i.label === "Go to Album")!.enabled).toBe(false);
    expect(action).toEqual({ type: "go-to-artist", artist: "Unknown Artist" });
  });

  it("group menu: play, play next and add to playlist", async () => {
    expect((await openMenu("show-group-context-menu", "Alpha", ["Play"])).action).toEqual({
      type: "group-play",
    });
    expect(
      (await openMenu("show-group-context-menu", "Alpha", ["Add to Playlist", "Faves"])).action,
    ).toEqual({
      type: "group-add-to-playlist",
      playlistId: "p1",
    });
  });
});
