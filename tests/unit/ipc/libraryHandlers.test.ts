import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPath } from "../../../src/main/services/hashUtil";
import { FileItem, UserConfig } from "../../../src/renderer/types";
import { FakeBrowserWindow } from "../../helpers/electron";
import { freshMain, profilePath, seedUserData, waitFor } from "../../helpers/main";
import { makeTempDir, readJsonFile } from "../../helpers/tempdir";

let electron: Awaited<ReturnType<typeof freshMain>>;
let win: FakeBrowserWindow;
let music: string;
const updateLibrary = vi.fn(async () => {});
const setupWatcher = vi.fn(async () => {});
let scanning = false;

beforeEach(async () => {
  electron = await freshMain();
  updateLibrary.mockClear();
  setupWatcher.mockClear();
  scanning = false;
  vi.doMock("../../../src/main/services/library/libraryUpdater", () => ({
    updateLibrary,
    isScanning: () => scanning,
    getScanStatus: () => ({ scanning, processed: 0, total: 0 }),
  }));
  vi.doMock("../../../src/main/services/library/libraryWatcher", () => ({ setupWatcher }));
  music = makeTempDir("melodesk-folders-");
  for (const dir of ["A", "A/inner", "A/inner2", "B", "AB"])
    fs.mkdirSync(path.join(music, dir), { recursive: true });
  win = electron.openWindow();
  const { registerLibraryHandlers } = await import("../../../src/main/ipc/libraryHandlers");
  registerLibraryHandlers();
  await electron.invoke("take-pending-notifications");
});

const m = (...parts: string[]) => path.join(music, ...parts);
const toasts = () => win.webContents.sentOn<{ level: string; message: string }>("notification");
const setFolders = (libraryPaths: string[]) => seedUserData({ "config.json": { libraryPaths } });
const add = (folders: string[]) => electron.invoke<UserConfig>("add-library-folders", folders);

/** Adds folders, answering the replace question with the given button. */
const addAnswering = async (button: number, folders: string[]) => {
  const result = add(folders);
  const request = await waitFor(() =>
    win.webContents.sentOn<{ id: number; message: string }>("confirm-request").at(-1),
  );
  electron.send("confirm-response", request.id, button);
  return { config: await result, request };
};

describe("add-library-folders", () => {
  it("adds a new folder, then watches and scans", async () => {
    const config = await add([m("A")]);
    expect(config.libraryPaths).toEqual([m("A")]);
    expect(setupWatcher).toHaveBeenCalled();
    expect(updateLibrary).toHaveBeenCalled();
  });

  it("explains instead of adding a folder that's already there", async () => {
    await setFolders([m("A")]);
    const config = await add([m("A")]);
    expect(config.libraryPaths).toEqual([m("A")]);
    expect(toasts().at(-1)).toMatchObject({ level: "info" });
    expect(updateLibrary).not.toHaveBeenCalled();
  });

  it("refuses a folder inside a library folder, saying why", async () => {
    await setFolders([m("A")]);
    const config = await add([m("A", "inner")]);
    expect(config.libraryPaths).toEqual([m("A")]);
    expect(toasts().at(-1)!.level).toBe("error");
    expect(toasts().at(-1)!.message).toContain("inside");
  });

  it("doesn't confuse similar names", async () => {
    await setFolders([m("A")]);
    expect((await add([m("AB")])).libraryPaths).toEqual([m("A"), m("AB")]);
  });

  it("asks before replacing inner folders with their parent: yes", async () => {
    await setFolders([m("A", "inner"), m("A", "inner2"), m("B")]);
    const { config, request } = await addAnswering(0, [m("A")]);
    expect(request.message).toContain("contains folders that are already in your library");
    expect(config.libraryPaths).toEqual([m("B"), m("A")]);
  });

  it("asks before replacing inner folders with their parent: cancel", async () => {
    await setFolders([m("A", "inner")]);
    const { config } = await addAnswering(1, [m("A")]);
    expect(config.libraryPaths).toEqual([m("A", "inner")]);
    expect(updateLibrary).not.toHaveBeenCalled();
  });

  it("keeps only the parent when a parent and its child are picked together", async () => {
    const config = await add([m("A", "inner"), m("A")]);
    expect(config.libraryPaths).toEqual([m("A")]);
    expect(win.webContents.sentOn("confirm-request")).toEqual([]);
  });
});

describe("select-directories", () => {
  it("opens next to the last picked folder and remembers the new pick", async () => {
    await seedUserData({ "session.json": { lastPickedFolder: m("A", "inner") } });
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [m("B")] });
    expect(await electron.invoke("select-directories")).toEqual([m("B")]);
    expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: m("A"),
        properties: ["openDirectory", "multiSelections"],
      }),
    );
    expect(
      readJsonFile<{ lastPickedFolder: string }>(await profilePath("session.json"))
        .lastPickedFolder,
    ).toBe(m("B"));
  });

  it("falls back to the parent of the newest library folder, and returns [] when cancelled", async () => {
    await setFolders([m("B"), m("A", "inner")]);
    expect(await electron.invoke("select-directories")).toEqual([]);
    expect(electron.dialog.showOpenDialog.mock.calls[0][0]).toMatchObject({ defaultPath: m("A") });
  });
});

describe("get-library-files", () => {
  const song = (p: string): FileItem => ({
    name: path.basename(p),
    path: p,
    isDirectory: false,
    isMedia: true,
    hash: hashPath(p),
  });

  it("returns only songs inside the library folders and rescans when the cache is stale", async () => {
    await setFolders([m("A")]);
    const inside = song(m("A", "a.mp3"));
    const removedFolder = song(m("B", "b.mp3"));
    await seedUserData({
      "library_cache.json": { [inside.hash!]: inside, [removedFolder.hash!]: removedFolder },
    });
    expect(await electron.invoke("get-library-files")).toEqual([inside]);
    expect(updateLibrary).toHaveBeenCalledTimes(1);
  });

  it("scans when there is no cache yet, but not while a scan is running", async () => {
    await setFolders([m("A")]);
    scanning = true;
    expect(await electron.invoke("get-library-files")).toEqual([]);
    expect(updateLibrary).not.toHaveBeenCalled();
    scanning = false;
    await electron.invoke("get-library-files");
    expect(updateLibrary).toHaveBeenCalledTimes(1);
  });
});

describe("other library channels", () => {
  it("file-exists", async () => {
    expect(await electron.invoke("file-exists", m("A"))).toBe(true);
    expect(await electron.invoke("file-exists", m("nope"))).toBe(false);
  });

  it("get-directory-tree lists library folders only", async () => {
    await setFolders([m("A")]);
    fs.writeFileSync(m("A", "song.mp3"), "x");
    fs.writeFileSync(m("B", "private.mp3"), "x");
    const tree = await electron.invoke<FileItem[]>("get-directory-tree", m("A"));
    expect(tree.map((i) => i.name)).toEqual(["inner", "inner2", "song.mp3"]);
    expect(await electron.invoke("get-directory-tree", m("B"))).toEqual([]);
    expect(await electron.invoke("get-directory-tree", m("A", "..", "B"))).toEqual([]);
  });

  it("get-library-scan-status and refresh-library", async () => {
    expect(await electron.invoke("get-library-scan-status")).toMatchObject({ scanning: false });
    await electron.invoke("refresh-library");
    expect(updateLibrary).toHaveBeenCalledTimes(1);
  });
});
