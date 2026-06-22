// Single source of truth for every static color used across the renderer.
//
// Change a value here and it updates everywhere:
//   - Inline `style={{}}` objects import `colors` and use e.g. `colors.bgBase`.
//   - CSS Modules use the matching CSS custom property, e.g. `var(--bgBase)`.
//     Those variables are injected into `:root` from `colorCssVariables` (see
//     App.tsx), so there is no second list of values to keep in sync.
//
// Naming is flat + semantic (by role). A few roles share the same underlying
// value (e.g. `bgControl`/`borderFaint`); they are kept as separate keys on
// purpose so a future change to one role doesn't drag the others with it.

export const colors = {
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

  // Overlays (modal scrims, shadows)
  overlay30: "rgba(0, 0, 0, 0.3)",
  overlay50: "rgba(0, 0, 0, 0.5)",
  overlay60: "rgba(0, 0, 0, 0.6)",
  overlay70: "rgba(0, 0, 0, 0.7)",
  overlay80: "rgba(0, 0, 0, 0.8)",

  // Status
  danger: "#ff4444", // destructive action (delete)
  dangerHover: "#e55", // destructive action hover
} as const;

export type ColorKey = keyof typeof colors;

// Default accent + the presets offered in Settings. The live accent is the
// per-user `themeColor` (UserConfig) threaded through the app as a prop; this
// module owns only its default and the preset list.
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

// CSS custom properties generated from `colors` (the single source). Var names
// mirror the keys 1:1 (camelCase is valid in custom properties), so
// `colors.bgBase` <-> `var(--bgBase)`. Injected into `:root` in App.tsx.
export const colorCssVariables =
  Object.entries(colors)
    .map(([key, value]) => `--${key}: ${value};`)
    .join("\n  ") + `\n  --theme-color: ${DEFAULT_THEME_COLOR};`;
