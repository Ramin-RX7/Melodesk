// Setup for the "main" Vitest project: every test file gets the fake electron module (with its
// own temporary profile folder, see electron.ts); the profiles are deleted when the file is done.
import fs from "node:fs";
import { afterAll, vi } from "vitest";

vi.mock("electron", () => import("./electron"));
// The app loads ESM-only packages through eval("import()"), which Vitest's module runner can't
// run; a plain import() does the same here.
vi.mock("../../src/main/services/esmImport", () => ({
  importEsm: (name: string) => import(name),
}));

afterAll(() => {
  const profiles = (globalThis as { __melodeskProfiles?: string[] }).__melodeskProfiles ?? [];
  for (const dir of profiles.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
