import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

const created: string[] = [];

afterAll(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/** A new empty folder, deleted after the test file. */
export const makeTempDir = (prefix = "melodesk-test-") => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
};

/** Writes a file (creating folders) and returns its path. */
export const writeFile = (file: string, content: string | Buffer) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
};

export const writeJsonFile = (file: string, data: unknown) =>
  writeFile(file, JSON.stringify(data, null, 2));

export const readJsonFile = <T = unknown>(file: string): T =>
  JSON.parse(fs.readFileSync(file, "utf8")) as T;
