import { useEffect, useRef } from "react";

import {
  BUILTIN_KEYBINDINGS,
  DEFAULT_KEYBINDINGS,
  Keybindings,
  KeyboardActionId,
  hasModifier,
  matchesKeybinding,
} from "../utils/keybindings";

type Params = {
  togglePlay: () => void;
  handleNext: () => void;
  handlePrevious: () => void;
  seekForward: () => void;
  seekBackward: () => void;
  goBack?: () => void;
  focusSearch?: () => void;
  keybindings?: Keybindings;
};

export function useKeyboardControls(params: Params) {
  // Stable ref so the listeners never need to re-register when the callbacks
  // or the keybindings change.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const p = paramsRef.current;
      const kb = p.keybindings ?? DEFAULT_KEYBINDINGS;

      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      const actions: { id: KeyboardActionId; run: () => void }[] = [
        { id: "focusSearch", run: () => p.focusSearch?.() },
        { id: "togglePlay", run: () => p.togglePlay() },
        { id: "nextTrack", run: () => p.handleNext() },
        { id: "previousTrack", run: () => p.handlePrevious() },
        { id: "seekForward", run: () => p.seekForward() },
        { id: "seekBackward", run: () => p.seekBackward() },
        { id: "goBack", run: () => p.goBack?.() },
      ];

      for (const action of actions) {
        const bindings = [...(kb[action.id] ?? []), ...(BUILTIN_KEYBINDINGS[action.id] ?? [])];
        const hit = bindings.find((b) => matchesKeybinding(event, b));
        if (!hit) continue;

        // While typing, only fire shortcuts that need a modifier (e.g.
        // Ctrl+F) so plain keys don't hijack text entry.
        if (isTyping && !hasModifier(hit)) return;

        event.preventDefault();
        action.run();
        return;
      }

      // Built-in arrow-key scrolling (only when the focused element is
      // scrollable and no action is bound to the arrow key).
      if (!isTyping && (event.code === "ArrowUp" || event.code === "ArrowDown")) {
        const isScrollable = target.scrollHeight > target.clientHeight;
        if (!isScrollable) return;

        event.preventDefault();
        const scrollAmount = 40;
        target.scrollTop += event.code === "ArrowDown" ? scrollAmount : -scrollAmount;
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      // Mouse button 3 = side "back" button on most mice
      if (event.button === 3) {
        event.preventDefault();
        paramsRef.current.goBack?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);
}
