// Setup for the "main" Vitest project: every test file gets the fake electron module (with its
// own temporary profile folder, see electron.ts), deleted when the file's tests are done.
import fs from "node:fs";
import { afterAll, vi } from "vitest";

vi.mock("electron", () => import("./electron"));

afterAll(async () => {
  const { userDataDir } = await import("./electron");
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
