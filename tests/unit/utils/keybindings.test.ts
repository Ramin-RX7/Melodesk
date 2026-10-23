import { describe, expect, it } from "vitest";

import {
  BUILTIN_KEYBINDINGS,
  DEFAULT_KEYBINDINGS,
  formatKeybinding,
  hasModifier,
  KEYBOARD_ACTIONS,
  KeyboardActionId,
  matchesKeybinding,
} from "../../../src/utils/keybindings";

const key = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  }) as KeyboardEvent;

describe("keybindings", () => {
  it("every action has a default binding and a settings label, in both lists", () => {
    const listed = KEYBOARD_ACTIONS.map((a) => a.id).sort();
    const defaults = (Object.keys(DEFAULT_KEYBINDINGS) as KeyboardActionId[]).sort();
    expect(listed).toEqual(defaults);
    for (const action of KEYBOARD_ACTIONS) {
      expect(action.label).not.toBe("");
      expect(DEFAULT_KEYBINDINGS[action.id].length).toBeGreaterThan(0);
    }
  });

  it("no two actions share a default binding", () => {
    const seen = new Set<string>();
    for (const bindings of Object.values(DEFAULT_KEYBINDINGS)) {
      for (const b of bindings) {
        const label = formatKeybinding(b);
        expect(seen.has(label)).toBe(false);
        seen.add(label);
      }
    }
  });

  it("media keys are built in for next/previous", () => {
    expect(BUILTIN_KEYBINDINGS.nextTrack).toEqual([{ code: "MediaTrackNext" }]);
    expect(BUILTIN_KEYBINDINGS.previousTrack).toEqual([{ code: "MediaTrackPrevious" }]);
  });

  it("matches the key and exactly the required modifiers", () => {
    const space = { code: "Space" };
    expect(matchesKeybinding(key("Space"), space)).toBe(true);
    expect(matchesKeybinding(key("Space", { shiftKey: true }), space)).toBe(false);
    expect(matchesKeybinding(key("Enter"), space)).toBe(false);

    const ctrlF = { code: "KeyF", ctrl: true };
    expect(matchesKeybinding(key("KeyF", { ctrlKey: true }), ctrlF)).toBe(true);
    expect(matchesKeybinding(key("KeyF", { metaKey: true }), ctrlF)).toBe(true); // Cmd = Ctrl
    expect(matchesKeybinding(key("KeyF"), ctrlF)).toBe(false);
    expect(matchesKeybinding(key("KeyF", { ctrlKey: true, altKey: true }), ctrlF)).toBe(false);
  });

  it("formats bindings for display", () => {
    expect(formatKeybinding({ code: "KeyF", ctrl: true })).toBe("Ctrl + F");
    expect(formatKeybinding({ code: "Digit1", alt: true, shift: true })).toBe("Alt + Shift + 1");
    expect(formatKeybinding({ code: "PageDown" })).toBe("Page Down");
    expect(formatKeybinding({ code: "Numpad5" })).toBe("Num 5");
    expect(formatKeybinding({ code: "F5" })).toBe("F5");
  });

  it("hasModifier is true only for Ctrl/Alt bindings", () => {
    expect(hasModifier({ code: "KeyF", ctrl: true })).toBe(true);
    expect(hasModifier({ code: "KeyF", alt: true })).toBe(true);
    expect(hasModifier({ code: "KeyF", shift: true })).toBe(false);
    expect(hasModifier({ code: "Space" })).toBe(false);
  });
});
