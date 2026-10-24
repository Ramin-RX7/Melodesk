import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsView } from "../../../src/renderer/components/SettingsView";
import { getTheme } from "../../../src/renderer/theme/themes";
import { ConfirmOptions, UserConfig } from "../../../src/renderer/types";
import { EQ_PRESETS } from "../../../src/utils/equalizer";
import { fakeApi, installApi } from "../../helpers/api";
import { makeConfig } from "../../helpers/songs";

const renderSettings = (config: Partial<UserConfig> = {}, answer = 0) => {
  const initial = makeConfig(config);
  installApi({ updateConfig: async (partial) => ({ ...initial, ...partial }) });
  const confirm = vi.fn<(o: ConfirmOptions) => Promise<number>>(async () => answer);
  const setConfig = vi.fn();
  render(
    <SettingsView
      config={initial}
      setConfig={setConfig}
      themeColor={initial.themeColor}
      confirm={confirm}
    />,
  );
  return { user: userEvent.setup(), confirm, setConfig };
};

const saved = () => fakeApi().updateConfig.mock.calls.map(([partial]) => partial);

describe("SettingsView", () => {
  describe("themes", () => {
    it("asks before applying a theme; Apply saves its colors and accent", async () => {
      const { user, confirm } = renderSettings();
      await user.click(screen.getByTitle("Light"));
      expect(confirm).toHaveBeenCalled();
      const light = getTheme("light")!;
      expect(saved()).toEqual([
        { themeColor: light.accent, appearance: { themeId: "light", colors: {} } },
      ]);
    });

    it("Cancel keeps the current theme", async () => {
      const { user } = renderSettings({}, 1);
      await user.click(screen.getByTitle("Light"));
      expect(saved()).toEqual([]);
    });

    it("asks only when applying would change something", async () => {
      const accent = getTheme("dark")!.accent;
      const { user, confirm } = renderSettings({ themeColor: accent });
      await user.click(screen.getByTitle("Dark"));
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  describe("saving options", () => {
    it("a switch saves its option and passes the saved settings on", async () => {
      const { user, setConfig } = renderSettings({ doubleClickToPlay: true });
      await user.click(screen.getByRole("switch", { name: "Double-click to play" }));
      expect(saved()).toEqual([{ doubleClickToPlay: false }]);
      expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ doubleClickToPlay: false }));
    });

    it("a number is saved when leaving the field or pressing Enter", async () => {
      const { user } = renderSettings({ playCountThresholdPercent: 50 });
      const field = screen.getByRole("spinbutton", { name: "Count as played after" });
      await user.clear(field);
      await user.type(field, "30{Enter}");
      expect(saved()).toEqual([{ playCountThresholdPercent: 30 }]);
    });

    it("an out-of-range, empty or unchanged number isn't saved", async () => {
      const { user } = renderSettings({ playCountThresholdPercent: 50 });
      const field = screen.getByRole("spinbutton", { name: "Count as played after" });
      await user.clear(field);
      await user.type(field, "150{Enter}");
      expect(field).toHaveValue(50);
      await user.clear(field);
      await user.tab();
      expect(field).toHaveValue(50);
      await user.click(field);
      await user.tab();
      expect(saved()).toEqual([]);
    });

    it("removes a library folder", async () => {
      const { user } = renderSettings({ libraryPaths: ["D:\\Music", "E:\\Other"] });
      await user.click(screen.getAllByTitle("Remove folder")[0]);
      expect(saved()).toEqual([{ libraryPaths: ["E:\\Other"] }]);
    });
  });

  describe("equalizer", () => {
    it("a preset sets all bands", async () => {
      const { user } = renderSettings({ equalizerEnabled: true });
      const preset = EQ_PRESETS.find((p) => p.id !== "flat")!;
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Equalizer preset" }),
        preset.id,
      );
      expect(saved()).toEqual([{ equalizerPreset: preset.id, equalizerBands: preset.gains }]);
    });

    it("moving a band switches to the custom preset; Reset to flat clears them", async () => {
      const { user } = renderSettings({ equalizerEnabled: true });
      fireEvent.change(screen.getByRole("slider", { name: "1k band" }), { target: { value: "4" } });
      expect(saved()[0]).toEqual({
        equalizerBands: [0, 0, 0, 0, 0, 4, 0, 0, 0, 0],
        equalizerPreset: "custom",
      });
      await user.click(screen.getByRole("button", { name: "Reset to flat" }));
      expect(saved()[1]).toEqual({ equalizerPreset: "flat", equalizerBands: Array(10).fill(0) });
    });
  });

  describe("keyboard shortcuts", () => {
    it("records a new shortcut, ignoring modifier keys pressed alone", async () => {
      const { user } = renderSettings();
      await user.click(screen.getByRole("button", { name: "Space" }));
      fireEvent.keyDown(window, { code: "ShiftLeft", shiftKey: true });
      expect(saved()).toEqual([]);
      fireEvent.keyDown(window, { code: "KeyK", shiftKey: true });
      expect(saved()).toEqual([
        { keybindings: expect.objectContaining({ togglePlay: [{ code: "KeyK", shift: true }] }) },
      ]);
    });

    it("Cmd counts as Ctrl; Escape cancels recording", async () => {
      const { user } = renderSettings();
      await user.click(screen.getByRole("button", { name: "Page Down" }));
      fireEvent.keyDown(window, { code: "Escape" });
      expect(saved()).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Page Down" }));
      fireEvent.keyDown(window, { code: "KeyJ", metaKey: true });
      expect(saved()).toEqual([
        { keybindings: expect.objectContaining({ nextTrack: [{ code: "KeyJ", ctrl: true }] }) },
      ]);
    });

    it("Reset restores a changed shortcut", async () => {
      const { user } = renderSettings({
        keybindings: { ...makeConfig().keybindings, togglePlay: [{ code: "KeyP" }] },
      });
      const enabled = screen
        .getAllByTitle("Reset to default")
        .filter((b) => !(b as HTMLButtonElement).disabled);
      expect(enabled).toHaveLength(1);
      await user.click(enabled[0]);
      expect(saved()).toEqual([
        { keybindings: expect.objectContaining({ togglePlay: [{ code: "Space" }] }) },
      ]);
    });
  });
});
