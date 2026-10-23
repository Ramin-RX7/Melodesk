// Throwaway git repositories for testing the release scripts. Git runs with an empty global
// config (no signing, no hooks, a test identity), so the user's own repos and settings are never
// involved. Everything is asynchronous so independent tests can run concurrently (each git call
// is a process start, which is slow on Windows).
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { makeTempDir, writeFile } from "./tempdir";

const run = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const gitEnv = (() => {
  const emptyConfig = path.join(makeTempDir("melodesk-gitconfig-"), "gitconfig");
  fs.writeFileSync(emptyConfig, "");
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_TERMINAL_PROMPT: "0",
  };
})();

export const git = async (cwd: string, ...args: string[]) =>
  (await run("git", args, { cwd, env: gitEnv, encoding: "utf8" })).stdout.trim();

export const CHANGELOG = (unreleased: string) => `# Changelog

All notable changes.

## [Unreleased]
${unreleased}
## [1.2.3] - 2026-01-01

### Added

- The first feature.

[Unreleased]: https://github.com/test/app/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/test/app/releases/tag/v1.2.3
`;

export const FIX_ENTRY = "\n### Fixed\n\n- A fix.\n";

/**
 * A repo on "master" with the project's release scripts, a package.json at 1.2.3 (whose
 * "check" script does nothing) and a CHANGELOG, pushed to a local bare "origin".
 */
export const makeReleaseRepo = async (unreleased = FIX_ENTRY) => {
  const base = makeTempDir("melodesk-repo-");
  const origin = path.join(base, "origin.git");
  const work = path.join(base, "work");
  await git(base, "init", "-q", "--bare", "-b", "master", origin);
  fs.mkdirSync(path.join(work, "scripts"), { recursive: true });
  await git(work, "init", "-q", "-b", "master");
  for (const script of ["changelog.mjs", "release.mjs"]) {
    fs.copyFileSync(path.join(REPO_ROOT, "scripts", script), path.join(work, "scripts", script));
  }
  const pkg = {
    name: "app",
    version: "1.2.3",
    repository: { type: "git", url: "https://github.com/test/app.git" },
    scripts: { check: 'node -e ""' },
  };
  writeFile(path.join(work, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  const lock = {
    name: "app",
    version: "1.2.3",
    lockfileVersion: 3,
    requires: true,
    packages: { "": { name: "app", version: "1.2.3" } },
  };
  writeFile(path.join(work, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
  writeFile(path.join(work, "CHANGELOG.md"), CHANGELOG(unreleased));
  await git(work, "add", ".");
  await git(work, "commit", "-q", "-m", "[chore] start");
  await git(work, "remote", "add", "origin", origin);
  await git(work, "push", "-q", "-u", "origin", "master");
  return { base, origin, work };
};

/** Runs one of the repo's scripts with node; resolves to its exit code and output. */
export const runScript = async (cwd: string, script: string, ...args: string[]) => {
  try {
    const { stdout, stderr } = await run(
      process.execPath,
      [path.join("scripts", script), ...args],
      { cwd, env: gitEnv, encoding: "utf8" },
    );
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof e.code === "number" ? e.code : 1,
      out: `${e.stdout ?? ""}${e.stderr ?? ""}`,
    };
  }
};
