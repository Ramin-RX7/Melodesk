// Applies a resolved palette + accent to the document root by setting the CSS
// custom properties that every component (inline styles and CSS Modules) reads.
// Pure DOM — call it from an effect whenever the config's appearance changes.

import { COLOR_KEYS, ColorKey, DEFAULT_PALETTE } from "./colors";

export function applyPalette(palette: Partial<Record<ColorKey, string>>, themeColor: string): void {
  const root = document.documentElement;
  for (const key of COLOR_KEYS) {
    root.style.setProperty(`--${key}`, palette[key] ?? DEFAULT_PALETTE[key]);
  }
  root.style.setProperty("--theme-color", themeColor);
}
