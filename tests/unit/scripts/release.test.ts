// scripts/release.mjs, run in throwaway repos (never the project itself).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { git, makeReleaseRepo, runScript } from "../../helpers/gitRepo";

const read = (work: string, file: string) => fs.readFileSync(path.join(work, file), "utf8");
const version = (work: string) => JSON.parse(read(work, "package.json")).version;
const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Each test starts many git processes; on a busy Windows machine one can fail to start, so a
// failed test is tried once more.
describe.concurrent("release.mjs", { timeout: 60_000, retry: 1 }, () => {
  it("cuts a release: version bump, dated CHANGELOG section, commit and tag (no push)", async () => {
    const { work, origin } = await makeReleaseRepo();
    const result = await runScript(work, "release.mjs", "minor");
    expect(result.code, result.out).toBe(0);

    expect(version(work)).toBe("1.3.0");
    expect(JSON.parse(read(work, "package-lock.json")).version).toBe("1.3.0");
    const changelog = read(work, "CHANGELOG.md");
    expect(changelog).toContain(`## [1.3.0] - ${today()}\n\n### Fixed\n\n- A fix.`);
    expect(changelog).toMatch(/## \[Unreleased\]\n\n## \[1\.3\.0\]/);
    expect(changelog).toContain("[1.3.0]: https://github.com/test/app/compare/v1.2.3...v1.3.0");

    expect(await git(work, "log", "-1", "--format=%s")).toBe("[release] v1.3.0");
    expect(await git(work, "cat-file", "-t", "v1.3.0")).toBe("tag"); // annotated
    expect(await git(work, "status", "--porcelain")).toBe("");
    expect(await git(origin, "tag", "--list")).toBe(""); // nothing pushed
  });

  it.each([
    ["patch", "1.2.4"],
    ["major", "2.0.0"],
    ["1.5.0", "1.5.0"],
  ])("bumps %s to %s", async (bump, expected) => {
    const { work } = await makeReleaseRepo();
    expect((await runScript(work, "release.mjs", bump)).code).toBe(0);
    expect(version(work)).toBe(expected);
  });

  it("refuses bad arguments", async () => {
    const { work } = await makeReleaseRepo();
    expect((await runScript(work, "release.mjs")).out).toContain("Usage");
    expect((await runScript(work, "release.mjs", "banana")).out).toContain(
      'Unknown version "banana"',
    );
    const lower = await runScript(work, "release.mjs", "1.0.0");
    expect(lower.code).toBe(1);
    expect(lower.out).toContain("lower than the current version");
  });

  it("refuses when Unreleased is empty", async () => {
    const { work } = await makeReleaseRepo("\n");
    const result = await runScript(work, "release.mjs", "patch");
    expect(result.code).toBe(1);
    expect(result.out).toContain("no entries under ## [Unreleased]");
  });

  it("refuses on another branch, with uncommitted changes, or when the tag exists", async () => {
    const { work } = await makeReleaseRepo();
    await git(work, "checkout", "-q", "-b", "feature");
    expect((await runScript(work, "release.mjs", "patch")).out).toContain(
      "Releases are cut from master",
    );

    await git(work, "checkout", "-q", "master");
    fs.writeFileSync(path.join(work, "dirty.txt"), "x");
    expect((await runScript(work, "release.mjs", "patch")).out).toContain("uncommitted changes");
    fs.rmSync(path.join(work, "dirty.txt"));

    await git(work, "tag", "v1.2.4");
    expect((await runScript(work, "release.mjs", "patch")).out).toContain(
      "Tag v1.2.4 already exists",
    );
    expect(await git(work, "log", "-1", "--format=%s")).toBe("[chore] start"); // nothing committed
  });

  it("refuses when master is behind origin", async () => {
    const { base, origin, work } = await makeReleaseRepo();
    const other = path.join(base, "other");
    await git(base, "clone", "-q", origin, other);
    fs.writeFileSync(path.join(other, "new.txt"), "x");
    await git(other, "add", ".");
    await git(other, "commit", "-q", "-m", "[chore] elsewhere");
    await git(other, "push", "-q");

    const result = await runScript(work, "release.mjs", "patch");
    expect(result.code).toBe(1);
    expect(result.out).toContain("behind origin");
  });

  it("--dry-run shows the result and the problems, and changes nothing", async () => {
    const { work } = await makeReleaseRepo();
    fs.writeFileSync(path.join(work, "dirty.txt"), "x");
    const before = read(work, "CHANGELOG.md");
    const result = await runScript(work, "release.mjs", "minor", "--dry-run");
    expect(result.code).toBe(0);
    expect(result.out).toContain("Dry run: 1.2.3 → 1.3.0 (tag v1.3.0)");
    expect(result.out).toContain("would stop: The working tree has uncommitted changes.");
    expect(result.out).toContain("## [1.3.0]");
    expect(read(work, "CHANGELOG.md")).toBe(before);
    expect(version(work)).toBe("1.2.3");
    expect(await git(work, "tag", "--list")).toBe("");
  });
});
