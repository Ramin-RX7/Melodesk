import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Playlist } from "../../../src/renderer/types";
import { FakeBrowserWindow } from "../../helpers/electron";
import { freshMain, profilePath, seedUserData, waitFor } from "../../helpers/main";

let electron: Awaited<ReturnType<typeof freshMain>>;
let win: FakeBrowserWindow;

beforeEach(async () => {
  electron = await freshMain();
  win = electron.openWindow();
  const { setupPlaylistHandlers } = await import("../../../src/main/ipc/playlistHandlers");
  setupPlaylistHandlers();
  await electron.invoke("take-pending-notifications");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const toasts = () => win.webContents.sentOn<{ level: string; message: string }>("notification");
const playlistFile = (id: string) => profilePath("playlists", `${id}.json`);

/** Invokes a handler that asks the user, answering with the given button. */
const answering = async <T>(button: number, channel: string, ...args: unknown[]) => {
  const result = electron.invoke<T>(channel, ...args);
  const request = await waitFor(() =>
    win.webContents.sentOn<{ id: number; buttons: string[] }>("confirm-request").at(-1),
  );
  electron.send("confirm-response", request.id, button);
  return { result: await result, request };
};

const create = async (name: string, songs: string[] = []) => {
  const p = await electron.invoke<Playlist>("create-playlist", name);
  return songs.length ? electron.invoke<Playlist>("update-playlist", p.id, { songs }) : p;
};

describe("playlist CRUD", () => {
  it("creates, reads, updates and deletes", async () => {
    const created = await create("Road Trip");
    expect(created).toMatchObject({ name: "Road Trip", songs: [] });
    expect(await electron.invoke<Playlist[]>("get-playlists")).toHaveLength(1);

    await new Promise((r) => setTimeout(r, 5));
    const updated = await electron.invoke<Playlist>("update-playlist", created.id, {
      name: "Road Trip 2",
      songs: ["/m/a.mp3"],
    });
    expect(updated).toMatchObject({ name: "Road Trip 2", songs: ["/m/a.mp3"], id: created.id });
    expect(updated.updatedAt > created.updatedAt).toBe(true);
    expect(await electron.invoke("get-playlist", created.id)).toEqual(updated);

    await electron.invoke("delete-playlist", created.id);
    expect(await electron.invoke("get-playlists")).toEqual([]);
    expect(fs.existsSync(`${await playlistFile(created.id)}.bak`)).toBe(false);
    expect(win.webContents.sentOn("playlists-changed").length).toBeGreaterThan(0);
  });

  it("returns null for playlists that don't exist", async () => {
    expect(await electron.invoke("get-playlist", "nope")).toBeNull();
    expect(await electron.invoke("update-playlist", "nope", { name: "x" })).toBeNull();
  });

  it("never touches files outside the playlists folder, whatever id it is given", async () => {
    await seedUserData({ "config.json": { libraryPaths: ["/m"] }, "session.json": { queue: [] } });
    for (const id of ["../config", "..\\config", "../session", "/etc/passwd", ""]) {
      await electron.invoke("delete-playlist", id);
      expect(await electron.invoke("get-playlist", id)).toBeNull();
      expect(await electron.invoke("update-playlist", id, { name: "pwned" })).toBeNull();
    }
    expect(fs.existsSync(await profilePath("config.json"))).toBe(true);
    expect(JSON.parse(fs.readFileSync(await profilePath("session.json"), "utf8"))).toEqual({
      queue: [],
    });
  });

  it("lists playlists newest first and ignores backup, damaged and temp files", async () => {
    await seedUserData({
      "playlists/old.json": {
        id: "old",
        name: "Old",
        songs: [],
        createdAt: "a",
        updatedAt: "2020-01-01",
      },
      "playlists/new.json": {
        id: "new",
        name: "New",
        songs: [],
        createdAt: "a",
        updatedAt: "2026-01-01",
      },
      "playlists/new.json.bak": "{}",
      "playlists/x.json.corrupt": "junk",
      "playlists/y.json.tmp": "junk",
    });
    const lists = await electron.invoke<Playlist[]>("get-playlists");
    expect(lists.map((p) => p.name)).toEqual(["New", "Old"]);
  });
});

describe("damaged playlist files", () => {
  it("are restored from their backup, with a message", async () => {
    const p = await create("Faves", ["/m/a.mp3"]);
    await electron.invoke("update-playlist", p.id, { songs: ["/m/a.mp3", "/m/b.mp3"] }); // .bak = 1 song
    fs.writeFileSync(await playlistFile(p.id), "{ broken");

    const [restored] = await electron.invoke<Playlist[]>("get-playlists");
    expect(restored.songs).toEqual(["/m/a.mp3"]);
    expect(fs.existsSync(`${await playlistFile(p.id)}.corrupt`)).toBe(true);
    expect(toasts().at(-1)!.message).toContain('"Faves" was damaged and has been restored');
  });

  it("are salvaged when there is no backup, keeping the other playlists", async () => {
    await seedUserData({
      "playlists/good.json": {
        id: "good",
        name: "Good",
        songs: [],
        createdAt: "a",
        updatedAt: "a",
      },
      "playlists/bad.json": '{"name": "Half", "songs": ["/m/a.mp3", "/m/b.mp3", "/m/c',
    });
    const lists = await electron.invoke<Playlist[]>("get-playlists");
    const half = lists.find((p) => p.id === "bad")!;
    expect(half).toMatchObject({ name: "Half", songs: ["/m/a.mp3", "/m/b.mp3"] });
    expect(lists.map((p) => p.id).sort()).toEqual(["bad", "good"]);
    expect(toasts().at(-1)!.message).toContain("Recovered 2 songs");
  });

  it("are set aside when nothing can be recovered", async () => {
    await seedUserData({ "playlists/junk.json": "%%%" });
    expect(await electron.invoke("get-playlists")).toEqual([]);
    expect(fs.existsSync(`${await playlistFile("junk")}.corrupt`)).toBe(true);
    expect(toasts().at(-1)!.message).toContain("nothing could be recovered");
  });
});

describe("add-songs-to-playlist", () => {
  it("adds new songs and says so", async () => {
    const p = await create("Mix");
    const updated = await electron.invoke<Playlist>("add-songs-to-playlist", p.id, [
      "/m/a.mp3",
      "/m/b.mp3",
    ]);
    expect(updated.songs).toEqual(["/m/a.mp3", "/m/b.mp3"]);
    expect(toasts().at(-1)).toEqual({ level: "success", message: 'Added 2 songs to "Mix".' });
    expect(win.webContents.sentOn("confirm-request")).toEqual([]);
  });

  it("asks about duplicates: add anyway", async () => {
    const p = await create("Mix", ["/m/a.mp3"]);
    const { result, request } = await answering<Playlist>(0, "add-songs-to-playlist", p.id, [
      "/m/a.mp3",
      "/m/b.mp3",
    ]);
    expect(request.buttons).toEqual(["Add anyway", "Skip duplicates", "Cancel"]);
    expect(result.songs).toEqual(["/m/a.mp3", "/m/a.mp3", "/m/b.mp3"]);
  });

  it("asks about duplicates: skip them", async () => {
    const p = await create("Mix", ["/m/a.mp3"]);
    const { result } = await answering<Playlist>(1, "add-songs-to-playlist", p.id, [
      "/m/a.mp3",
      "/m/b.mp3",
      "/m/b.mp3",
    ]);
    expect(result.songs).toEqual(["/m/a.mp3", "/m/b.mp3"]);
  });

  it("asks about duplicates: cancel adds nothing", async () => {
    const p = await create("Mix", ["/m/a.mp3"]);
    const { result } = await answering<Playlist | null>(2, "add-songs-to-playlist", p.id, [
      "/m/a.mp3",
    ]);
    expect(result).toBeNull();
    expect((await electron.invoke<Playlist>("get-playlist", p.id)).songs).toEqual(["/m/a.mp3"]);
  });

  it("says so when skipping leaves nothing to add", async () => {
    const p = await create("Mix", ["/m/a.mp3"]);
    await answering(1, "add-songs-to-playlist", p.id, ["/m/a.mp3"]);
    expect(toasts().at(-1)).toEqual({ level: "info", message: 'Nothing was added to "Mix".' });
  });
});

describe("remove-playlist-duplicates", () => {
  it("removes repeats after confirmation, keeping the first copy", async () => {
    const p = await create("Mix", ["/m/a.mp3", "/m/b.mp3", "/m/a.mp3"]);
    const { result } = await answering<Playlist>(0, "remove-playlist-duplicates", p.id);
    expect(result.songs).toEqual(["/m/a.mp3", "/m/b.mp3"]);
  });

  it("changes nothing when cancelled", async () => {
    const p = await create("Mix", ["/m/a.mp3", "/m/a.mp3"]);
    const { result } = await answering<Playlist>(1, "remove-playlist-duplicates", p.id);
    expect(result.songs).toEqual(["/m/a.mp3", "/m/a.mp3"]);
  });

  it("says so when there are no duplicates, without asking", async () => {
    const p = await create("Mix", ["/m/a.mp3"]);
    await electron.invoke("remove-playlist-duplicates", p.id);
    expect(win.webContents.sentOn("confirm-request")).toEqual([]);
    expect(toasts().at(-1)!.message).toBe('"Mix" has no duplicate songs.');
  });
});

describe("replaceSongPaths", () => {
  it("rewrites moved songs and saves only the playlists that changed", async () => {
    const a = await create("A", ["/m/old.mp3", "/m/x.mp3"]);
    const b = await create("B", ["/m/x.mp3"]);
    const { replaceSongPaths } = await import("../../../src/main/ipc/playlistHandlers");
    const bBefore = fs.readFileSync(await playlistFile(b.id), "utf8");
    replaceSongPaths((p) => (p === "/m/old.mp3" ? "/m/new.mp3" : p));
    expect((await electron.invoke<Playlist>("get-playlist", a.id)).songs).toEqual([
      "/m/new.mp3",
      "/m/x.mp3",
    ]);
    expect(fs.readFileSync(await playlistFile(b.id), "utf8")).toBe(bBefore);
  });
});
