// Shared keyboard-shortcut definitions used by both the main process (config
// defaults) and the renderer (the global key handler + the settings UI).

/** A single shortcut: a physical key (`KeyboardEvent.code`) plus modifiers. */
export interface Keybinding {
  /** Physical key, e.g. "Space", "KeyF", "ArrowRight". */
  code: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** Every action the user can rebind. */
export type KeyboardActionId =
  | "togglePlay"
  | "nextTrack"
  | "previousTrack"
  | "seekForward"
  | "seekBackward"
  | "goBack"
  | "focusSearch";

/** All bindings for every action. Each action may have multiple bindings. */
export type Keybindings = Record<KeyboardActionId, Keybinding[]>;

export const DEFAULT_KEYBINDINGS: Keybindings = {
  togglePlay: [{ code: "Space" }],
  nextTrack: [{ code: "PageDown" }],
  previousTrack: [{ code: "PageUp" }],
  seekForward: [{ code: "ArrowRight" }],
  seekBackward: [{ code: "ArrowLeft" }],
  goBack: [{ code: "Escape" }],
  focusSearch: [{ code: "KeyF", ctrl: true }],
};

/**
 * Bindings that are always active in addition to the user's configured ones
 * (the dedicated media keys), so rebinding the primary key never disables them.
 */
export const BUILTIN_KEYBINDINGS: Partial<Record<KeyboardActionId, Keybinding[]>> = {
  nextTrack: [{ code: "MediaTrackNext" }],
  previousTrack: [{ code: "MediaTrackPrevious" }],
};

/** Display metadata, also defines the order shown in settings. */
export const KEYBOARD_ACTIONS: {
  id: KeyboardActionId;
  label: string;
  description: string;
}[] = [
  { id: "togglePlay", label: "Play / Pause", description: "Toggle playback" },
  { id: "nextTrack", label: "Next track", description: "Skip to the next song" },
  { id: "previousTrack", label: "Previous track", description: "Go to the previous song" },
  { id: "seekForward", label: "Seek forward", description: "Jump forward in the current song" },
  { id: "seekBackward", label: "Seek backward", description: "Jump backward in the current song" },
  { id: "goBack", label: "Go back", description: "Return to the previous view" },
  { id: "focusSearch", label: "Focus search", description: "Focus the library search box" },
];

/** True if pressing this key requires Ctrl/Alt (so it's safe to fire while typing). */
export function hasModifier(b: Keybinding): boolean {
  return !!b.ctrl || !!b.alt;
}

/** Does a keyboard event match this binding? Treats Cmd (meta) as Ctrl. */
export function matchesKeybinding(event: KeyboardEvent, b: Keybinding): boolean {
  return (
    event.code === b.code &&
    !!b.ctrl === (event.ctrlKey || event.metaKey) &&
    !!b.shift === event.shiftKey &&
    !!b.alt === event.altKey
  );
}

const KEY_CODE_LABELS: Record<string, string> = {
  Space: "Space",
  ArrowRight: "→",
  ArrowLeft: "←",
  ArrowUp: "↑",
  ArrowDown: "↓",
  PageUp: "Page Up",
  PageDown: "Page Down",
  Escape: "Esc",
  Enter: "Enter",
  Backspace: "Backspace",
  Tab: "Tab",
  MediaTrackNext: "Media Next",
  MediaTrackPrevious: "Media Prev",
};

function formatKeyCode(code: string): string {
  if (KEY_CODE_LABELS[code]) return KEY_CODE_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3); // KeyF -> F
  if (code.startsWith("Digit")) return code.slice(5); // Digit1 -> 1
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}

/** Human-readable label for a binding, e.g. "Ctrl + F" or "Page Down". */
export function formatKeybinding(b: Keybinding): string {
  const parts: string[] = [];
  if (b.ctrl) parts.push("Ctrl");
  if (b.alt) parts.push("Alt");
  if (b.shift) parts.push("Shift");
  parts.push(formatKeyCode(b.code));
  return parts.join(" + ");
}

/** Lone modifier keys — not valid shortcuts on their own. */
export const MODIFIER_CODES = [
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
];
