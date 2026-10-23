import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freshMain } from "../../helpers/main";
import { makeTempDir } from "../../helpers/tempdir";

type Store = typeof import("../../../src/main/services/jsonStore");
let store: Store;
let invoke: Awaited<ReturnType<typeof freshMain>>["invoke"];
let dir: string;

const notifications = () =>
  invoke<{ level: string; message: string }[]>("take-pending-notifications");

beforeEach(async () => {
  ({ invoke } = await freshMain());
  store = await import("../../../src/main/services/jsonStore");
  dir = makeTempDir();
});

afterEach(() => vi.restoreAllMocks());

describe("writeJson", () => {
  it("writes compact JSON by default and pretty JSON on request, leaving no temp file", () => {
    const file = path.join(dir, "a.json");
    expect(store.writeJson(file, { x: 1 })).toBe(true);
    expect(fs.readFileSync(file, "utf8")).toBe('{"x":1}');
    store.writeJson(file, { x: 2 }, { pretty: true });
    expect(fs.readFileSync(file, "utf8")).toBe('{\n  "x": 2\n}');
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  it("keeps the previous good version as .bak", () => {
    const file = path.join(dir, "a.json");
    store.writeJson(file, { v: 1 });
    expect(fs.existsSync(`${file}.bak`)).toBe(false); // nothing to back up the first time
    store.writeJson(file, { v: 2 });
    expect(JSON.parse(fs.readFileSync(`${file}.bak`, "utf8"))).toEqual({ v: 1 });
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ v: 2 });
  });

  it("doesn't keep a backup with backup: false", () => {
    const file = path.join(dir, "cache.json");
    store.writeJson(file, { v: 1 }, { backup: false });
    store.writeJson(file, { v: 2 }, { backup: false });
    expect(fs.existsSync(`${file}.bak`)).toBe(false);
  });

  it("never replaces a good backup with a damaged current file", () => {
    const file = path.join(dir, "a.json");
    store.writeJson(file, { v: 1 });
    store.writeJson(file, { v: 2 }); // .bak = v1
    fs.writeFileSync(file, "{ broken");
    store.writeJson(file, { v: 3 });
    expect(JSON.parse(fs.readFileSync(`${file}.bak`, "utf8"))).toEqual({ v: 1 });
  });

  it("retries a rename that Windows briefly refuses (EPERM)", () => {
    const file = path.join(dir, "a.json");
    const real = fs.renameSync;
    let failures = 2;
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (failures-- > 0) throw Object.assign(new Error("busy"), { code: "EPERM" });
      return real(from, to);
    });
    expect(store.writeJson(file, { ok: true })).toBe(true);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ ok: true });
  });

  it("reports failure (and cleans up) when the file can't be written", () => {
    const missingDir = path.join(dir, "does-not-exist", "a.json");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(store.writeJson(missingDir, { v: 1 })).toBe(false);
  });
});

describe("readJson", () => {
  it("returns the fallback for a missing file, without telling the user", async () => {
    expect(store.readJson(path.join(dir, "none.json"), { d: 1 }, { label: "x" })).toEqual({
      d: 1,
    });
    expect(await notifications()).toEqual([]);
  });

  it("reads a good file", () => {
    const file = path.join(dir, "a.json");
    fs.writeFileSync(file, '{"a":[1,2]}');
    expect(store.readJson(file, null, { label: "x" })).toEqual({ a: [1, 2] });
  });

  it("restores a damaged file from its backup, keeps the damaged copy and tells the user", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const file = path.join(dir, "config.json");
    store.writeJson(file, { good: 1 });
    store.writeJson(file, { good: 2 }); // .bak = { good: 1 }
    fs.writeFileSync(file, "{ not json");

    expect(store.readJson(file, { fallback: true }, { label: "settings" })).toEqual({ good: 1 });
    expect(fs.readFileSync(`${file}.corrupt`, "utf8")).toBe("{ not json");
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ good: 1 }); // re-saved
    const [toast] = await notifications();
    expect(toast.level).toBe("error");
    expect(toast.message).toContain("settings");
    expect(toast.message).toContain("restored from its backup");
  });

  it("falls back (and says so) when there is no usable backup", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const file = path.join(dir, "counts.json");
    fs.writeFileSync(file, "garbage");
    expect(store.readJson(file, { empty: true }, { label: "play counts" })).toEqual({
      empty: true,
    });
    const [toast] = await notifications();
    expect(toast.message).toContain("play counts");
    expect(toast.message).toContain("reset");
    expect(fs.existsSync(`${file}.corrupt`)).toBe(true);
  });

  it("doesn't overwrite an earlier .corrupt copy", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const file = path.join(dir, "a.json");
    fs.writeFileSync(`${file}.corrupt`, "first");
    fs.writeFileSync(file, "second");
    store.readJson(file, null, { label: "x", notifyUser: false });
    expect(fs.readFileSync(`${file}.corrupt`, "utf8")).toBe("first");
    const kept = fs.readdirSync(dir).filter((f) => f.endsWith(".corrupt"));
    expect(kept).toHaveLength(2);
  });

  it("stays silent with notifyUser: false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const file = path.join(dir, "cache.json");
    fs.writeFileSync(file, "garbage");
    store.readJson(file, {}, { label: "library cache", notifyUser: false });
    expect(await notifications()).toEqual([]);
  });
});
