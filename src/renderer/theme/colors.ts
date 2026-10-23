// Single source of truth for every static color used across the renderer.
//
// At runtime, colors are driven by CSS custom properties on :root (e.g.
// `--bgBase`). Both styling channels resolve against those variables:
//   - Inline `style={{}}` objects import `colors` and use e.g. `colors.bgBase`,
//     which is the string "var(--bgBase)" — so they react to live theme changes.
//   - CSS Modules use the matching `var(--bgBase)` directly.
//
// The actual values live in DEFAULT_PALETTE (the built-in "Dark" theme) and in
// the other themes (theme/themes.ts). The selected theme + the user's per-role
// overrides are applied to :root at runtime (theme/applyTheme.ts), so changing a
// value updates the whole app without touching any component.
//
// Naming is flat + semantic (by role). A few roles share the same default value
// (e.g. `bgControl`/`borderFaint`); they are kept as separate keys on purpose so
// they can be themed/customized independently.

export const DEFAULT_PALETTE = {
  // Backgrounds
  bgBase: "#121212", // app / body / main container
  bgSurface: "#181818", // headers, sections, panels
  bgElevated: "#1e1e1e", // cards, dropdowns, modals
  bgPanel: "#1a1a1a", // search results panel
  bgHover: "#282828", // card hover
  bgHover2: "#242424", // search result hover
  bgHover3: "#2a2a2a", // dropdown hover
  bgControl: "#222", // buttons, chips, control surfaces
  bgInput: "#111", // text inputs
  bgBlack: "#000", // navbar

  // Text (light -> dark hierarchy)
  textPrimary: "#fff",
  textBright: "#e0e0e0",
  textSecondary: "#ddd",
  textTertiary: "#ccc",
  textMutedHi: "#bbb",
  textMuted: "#aaa",
  textDim: "#888",
  textFaint: "#666",
  textIcon: "#555", // muted icon glyphs (music note, etc.)

  // Borders / dividers
  borderStrong: "#555",
  border: "#444",
  borderSubtle: "#333",
  borderFaint: "#222",

  // Overlays (modal scrims, shadows) — rgba, not pickable with <input type=color>
  overlay30: "rgba(0, 0, 0, 0.3)",
  overlay50: "rgba(0, 0, 0, 0.5)",
  overlay60: "rgba(0, 0, 0, 0.6)",
  overlay70: "rgba(0, 0, 0, 0.7)",
  overlay80: "rgba(0, 0, 0, 0.8)",

  // Status
  danger: "#ff4444", // destructive action (delete)
  dangerHover: "#e55", // destructive action hover
} as const;

export type ColorKey = keyof typeof DEFAULT_PALETTE;

export const COLOR_KEYS = Object.keys(DEFAULT_PALETTE) as ColorKey[];

// What components import. Each value is a CSS variable reference, so inline
// styles, template literals (`1px solid ${colors.borderSubtle}`) and dynamic
// `el.style.background = colors.bgHover` all resolve against the live :root vars.
export const colors = Object.fromEntries(COLOR_KEYS.map((key) => [key, `var(--${key})`])) as Record<
  ColorKey,
  string
>;

// Default accent + the accent presets offered in Settings. The live accent is
// the per-user `themeColor` (UserConfig), threaded through the app as a real hex
// string (it is also used in alpha math like `${themeColor}22`).
export const DEFAULT_THEME_COLOR = "#1db954";
export const PRESET_THEME_COLORS = [
  "#1db954",
  "#e91e63",
  "#2196f3",
  "#ff9800",
  "#9c27b0",
  "#f44336",
  "#00bcd4",
];

// ---- Settings UI metadata -------------------------------------------------

export interface ColorRoleMeta {
  key: ColorKey;
  label: string;
  rgba?: boolean; // overlay roles: edit via text input, not <input type=color>
}

export interface ColorGroup {
  title: string;
  roles: ColorRoleMeta[];
}

// The handful of high-impact roles shown before the "Advanced" expander.
export const CORE_KEYS: ColorKey[] = [
  "bgBase",
  "bgSurface",
  "bgElevated",
  "textPrimary",
  "textMuted",
  "border",
  "danger",
];

export const colorGroups: ColorGroup[] = [
  {
    title: "Backgrounds",
    roles: [
      { key: "bgBase", label: "App background" },
      { key: "bgSurface", label: "Surface (headers, sections)" },
      { key: "bgElevated", label: "Elevated (cards, modals)" },
      { key: "bgPanel", label: "Panel (search results)" },
      { key: "bgHover", label: "Hover" },
      { key: "bgHover2", label: "Hover (alt)" },
      { key: "bgHover3", label: "Hover (dropdown)" },
      { key: "bgControl", label: "Controls (buttons, chips)" },
      { key: "bgInput", label: "Inputs" },
      { key: "bgBlack", label: "Navbar" },
    ],
  },
  {
    title: "Text",
    roles: [
      { key: "textPrimary", label: "Primary" },
      { key: "textBright", label: "Bright" },
      { key: "textSecondary", label: "Secondary" },
      { key: "textTertiary", label: "Tertiary" },
      { key: "textMutedHi", label: "Muted (high)" },
      { key: "textMuted", label: "Muted" },
      { key: "textDim", label: "Dim" },
      { key: "textFaint", label: "Faint" },
      { key: "textIcon", label: "Muted icons" },
    ],
  },
  {
    title: "Borders",
    roles: [
      { key: "borderStrong", label: "Strong" },
      { key: "border", label: "Default" },
      { key: "borderSubtle", label: "Subtle" },
      { key: "borderFaint", label: "Faint / dividers" },
    ],
  },
  {
    title: "Overlays & shadows",
    roles: [
      { key: "overlay30", label: "Overlay 30%", rgba: true },
      { key: "overlay50", label: "Overlay 50%", rgba: true },
      { key: "overlay60", label: "Overlay 60%", rgba: true },
      { key: "overlay70", label: "Overlay 70%", rgba: true },
      { key: "overlay80", label: "Overlay 80%", rgba: true },
    ],
  },
  {
    title: "Status",
    roles: [
      { key: "danger", label: "Danger" },
      { key: "dangerHover", label: "Danger (hover)" },
    ],
  },
];

// ---- Runtime helpers ------------------------------------------------------

// Builds the `:root` custom-property declarations for a palette + accent.
// Used for the static default injection in App.tsx and reused by applyPalette.
export function buildRootCss(
  palette: Partial<Record<ColorKey, string>>,
  themeColor: string,
): string {
  return (
    COLOR_KEYS.map((key) => `--${key}: ${palette[key] ?? DEFAULT_PALETTE[key]};`).join("\n  ") +
    `\n  --theme-color: ${themeColor};`
  );
}
