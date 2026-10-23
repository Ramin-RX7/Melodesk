import { describe, expect, it } from "vitest";

import {
  buildRootCss,
  COLOR_KEYS,
  colorGroups,
  colors,
  CORE_KEYS,
  DEFAULT_PALETTE,
  PRESET_THEME_COLORS,
} from "../../../src/renderer/theme/colors";
import { DEFAULT_THEME_ID, getTheme, THEMES } from "../../../src/renderer/theme/themes";

const isColor = (value: string) =>
  /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ||
  /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/.test(value);

describe("themes", () => {
  it("every theme defines every color role with a valid color", () => {
    for (const theme of THEMES) {
      expect(Object.keys(theme.palette).sort(), theme.id).toEqual([...COLOR_KEYS].sort());
      for (const [role, value] of Object.entries(theme.palette)) {
        expect(isColor(value), `${theme.id}.${role} = ${value}`).toBe(true);
      }
      expect(isColor(theme.accent), `${theme.id} accent`).toBe(true);
    }
  });

  it("has unique ids and names, and the default theme exists", () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(new Set(THEMES.map((t) => t.name)).size).toBe(THEMES.length);
    expect(getTheme(DEFAULT_THEME_ID)).toBeDefined();
    expect(getTheme("no-such-theme")).toBeUndefined();
  });

  it("the default palette and accent presets are valid colors", () => {
    for (const value of Object.values(DEFAULT_PALETTE)) expect(isColor(value)).toBe(true);
    for (const value of PRESET_THEME_COLORS) expect(isColor(value)).toBe(true);
  });
});

describe("color roles", () => {
  it("components reference roles as CSS variables", () => {
    for (const key of COLOR_KEYS) expect(colors[key]).toBe(`var(--${key})`);
  });

  it("the settings groups list every role exactly once, and core roles exist", () => {
    const listed = colorGroups.flatMap((g) => g.roles.map((r) => r.key));
    expect([...listed].sort()).toEqual([...COLOR_KEYS].sort());
    for (const key of CORE_KEYS) expect(COLOR_KEYS).toContain(key);
  });

  it("buildRootCss declares every role (falling back to defaults) plus the accent", () => {
    const css = buildRootCss({ bgBase: "#010203" }, "#abcdef");
    expect(css).toContain("--bgBase: #010203;");
    expect(css).toContain(`--textPrimary: ${DEFAULT_PALETTE.textPrimary};`);
    expect(css).toContain("--theme-color: #abcdef;");
    expect(css.match(/--[a-zA-Z0-9-]+:/g)).toHaveLength(COLOR_KEYS.length + 1);
  });
});
