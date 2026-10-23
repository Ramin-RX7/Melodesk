// Cuts a release: bumps the version, moves the CHANGELOG "Unreleased" entries into a new
// version section, commits "[release] vX.Y.Z" and creates an annotated vX.Y.Z tag.
// It never pushes; pushing the tag is what triggers the GitHub release workflow.
//
//   npm run release -- <patch | minor | major | X.Y.Z> [--dry-run]

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  compareVersions,
  findSection,
  hasEntries,
  parse,
  readChangelog,
  release,
  serialize,
  validate,
  writeChangelog,
} from "./changelog.mjs";

const RELEASE_BRANCH = "master";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bump = args.find((a) => !a.startsWith("--"));

function sh(command, options = {}) {
  return execSync(command, { cwd: ROOT, encoding: "utf8", ...options })?.trim();
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function nextVersion(current, bump) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  fail(`Unknown version "${bump}". Use patch, minor, major or an explicit X.Y.Z.`);
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

if (!bump) fail("Usage: npm run release -- <patch | minor | major | X.Y.Z> [--dry-run]");

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const current = pkg.version;
const version = nextVersion(current, bump);
const tag = `v${version}`;

if (compareVersions(version, current) < 0) {
  fail(`${version} is lower than the current version ${current}.`);
}

const changelog = parse(readChangelog());
const problems = [...validate(changelog)];
const unreleased = findSection(changelog, "Unreleased");
if (!hasEntries(unreleased?.body)) {
  problems.push("CHANGELOG.md has no entries under ## [Unreleased]; there is nothing to release.");
}

const branch = sh("git rev-parse --abbrev-ref HEAD");
if (branch !== RELEASE_BRANCH)
  problems.push(`Releases are cut from ${RELEASE_BRANCH}, not ${branch}.`);
if (sh("git status --porcelain")) problems.push("The working tree has uncommitted changes.");
if (sh(`git tag -l ${tag}`)) problems.push(`Tag ${tag} already exists.`);

sh(`git fetch --quiet origin ${RELEASE_BRANCH}`);
const behind = Number(sh(`git rev-list --count HEAD..origin/${RELEASE_BRANCH}`));
if (behind > 0)
  problems.push(`Local ${RELEASE_BRANCH} is ${behind} commit(s) behind origin; pull first.`);

const updated = serialize(release(changelog, version, today()));

if (dryRun) {
  console.log(`Dry run: ${current} → ${version} (tag ${tag})\n`);
  for (const p of problems) console.log(`⚠ would stop: ${p}`);
  console.log(`\n--- CHANGELOG.md after release ---\n${updated}`);
  process.exit(0);
}

if (problems.length) fail(problems.join("\n✖ "));

console.log("Running checks…");
sh("npm run check", { stdio: "inherit" });

if (version !== current) {
  sh(`npm version ${version} --no-git-tag-version`, { stdio: "inherit" });
}
writeChangelog(updated);

sh("git add CHANGELOG.md package.json package-lock.json");
sh(`git commit -m "[release] ${tag}"`, { stdio: "inherit" });
sh(`git tag -a ${tag} -m "MeloDesk ${tag}"`);

console.log(`
✔ Created commit "[release] ${tag}" and tag ${tag}.

Push to publish the GitHub release (CI builds the installers):
  git push origin ${RELEASE_BRANCH} --follow-tags

To undo before pushing:
  git tag -d ${tag} && git reset --hard HEAD~1`);
