import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  compareVersions,
  findSection,
  hasEntries,
  parse,
  release,
  serialize,
  validate,
} from "../../../scripts/changelog.mjs";
import { makeReleaseRepo, runScript } from "../../helpers/gitRepo";

const SAMPLE = `# Changelog

Intro text.

## [Unreleased]

### Added

- New thing.

## [1.1.0] - 2026-02-01

### Fixed

- A bug.

## [1.0.0] - 2026-01-01

### Added

- Everything.

[Unreleased]: https://example.com/compare/v1.1.0...HEAD
[1.1.0]: https://example.com/compare/v1.0.0...v1.1.0
[1.0.0]: https://example.com/releases/tag/v1.0.0
`;

describe("parse", () => {
  it("splits the header and the sections, dropping link definitions", () => {
    const log = parse(SAMPLE);
    expect(log.header).toBe("# Changelog\n\nIntro text.");
    expect(log.sections.map((s) => [s.name, s.date])).toEqual([
      ["Unreleased", null],
      ["1.1.0", "2026-02-01"],
      ["1.0.0", "2026-01-01"],
    ]);
    expect(findSection(log, "1.1.0")!.body).toBe("### Fixed\n\n- A bug.");
    expect(log.sections.some((s) => s.body.includes("https://example.com"))).toBe(false);
  });
});

describe("serialize", () => {
  it("round-trips and regenerates the links from package.json's repository", () => {
    const text = serialize(parse(SAMPLE));
    expect(parse(text)).toEqual(parse(SAMPLE));
    const repo = "https://github.com/Ramin-RX7/Melodesk";
    expect(text).toContain(`[Unreleased]: ${repo}/compare/v1.1.0...HEAD`);
    expect(text).toContain(`[1.1.0]: ${repo}/compare/v1.0.0...v1.1.0`);
    expect(text).toContain(`[1.0.0]: ${repo}/releases/tag/v1.0.0`);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("links Unreleased to all commits before the first release", () => {
    const text = serialize({
      header: "# C",
      sections: [{ name: "Unreleased", date: null, body: "" }],
    });
    expect(text).toContain("[Unreleased]: https://github.com/Ramin-RX7/Melodesk/commits/HEAD");
  });
});

describe("release", () => {
  it("moves the Unreleased entries into a dated version and empties Unreleased", () => {
    const released = release(parse(SAMPLE), "1.2.0", "2026-03-01");
    expect(released.sections.map((s) => s.name)).toEqual(["Unreleased", "1.2.0", "1.1.0", "1.0.0"]);
    expect(released.sections[0].body).toBe("");
    expect(released.sections[1]).toEqual({
      name: "1.2.0",
      date: "2026-03-01",
      body: "### Added\n\n- New thing.",
    });
    expect(validate(released)).toEqual([]);
  });
});

describe("validate", () => {
  it("accepts the project's own CHANGELOG", () => {
    const own = fs.readFileSync(path.resolve("CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n");
    expect(validate(parse(own))).toEqual([]);
  });

  it("reports structural problems", () => {
    const problems = (text: string) => validate(parse(text));
    expect(problems("# C\n\n## [1.0.0] - 2026-01-01\n\n- x\n")).toContain(
      'The first section must be "## [Unreleased]".',
    );
    expect(problems("## [Unreleased]\n\n## [1.0] - 2026-01-01\n\n- x\n")[0]).toContain(
      "is not a MAJOR.MINOR.PATCH version",
    );
    expect(problems("## [Unreleased]\n\n## [1.0.0]\n\n- x\n")[0]).toContain("needs a release date");
    expect(problems("## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\nnothing\n")).toContain(
      "Version 1.0.0 has no entries.",
    );
    expect(
      problems(
        "## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n- a\n\n## [1.1.0] - 2026-02-01\n\n- b\n",
      ).join(),
    ).toContain("newest first");
    expect(
      problems(
        "## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n- a\n\n## [1.0.0] - 2026-01-01\n\n- b\n",
      ).join(),
    ).toContain("appears more than once");
  });
});

describe("helpers", () => {
  it("compareVersions compares numerically", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBeLessThan(0);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("hasEntries needs at least one bullet", () => {
    expect(hasEntries("### Added\n\n- x")).toBe(true);
    expect(hasEntries("### Added\n")).toBe(false);
    expect(hasEntries(undefined)).toBe(false);
  });
});

describe.concurrent("CLI", { timeout: 60_000 }, () => {
  it("notes prints a version's section (with or without the v)", async () => {
    const { work } = await makeReleaseRepo();
    const result = await runScript(work, "changelog.mjs", "notes", "v1.2.3");
    expect(result.code).toBe(0);
    expect(result.out.trim()).toBe("### Added\n\n- The first feature.");
    expect((await runScript(work, "changelog.mjs", "notes", "9.9.9")).code).toBe(1);
  });

  it("verify fails on a broken CHANGELOG", async () => {
    const { work } = await makeReleaseRepo();
    fs.writeFileSync(
      path.join(work, "CHANGELOG.md"),
      "# Changelog\n\n## [1.0] - 2026-01-01\n\n- x\n",
    );
    const result = await runScript(work, "changelog.mjs", "verify");
    expect(result.code).toBe(1);
    expect(result.out).toContain("Unreleased");
  });
});
