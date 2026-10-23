import React, { useState } from "react";
import { IoFolder, IoClose } from "react-icons/io5";

import { UserConfig } from "../types";
import {
  colors,
  PRESET_THEME_COLORS,
  DEFAULT_PALETTE,
  CORE_KEYS,
  colorGroups,
  ColorKey,
} from "../theme/colors";
import { THEMES, getTheme, DEFAULT_THEME_ID, Theme } from "../theme/themes";
import {
  DEFAULT_KEYBINDINGS,
  KEYBOARD_ACTIONS,
  Keybinding,
  KeyboardActionId,
  MODIFIER_CODES,
  formatKeybinding,
} from "../../utils/keybindings";
import {
  EQ_FREQUENCIES,
  EQ_PRESETS,
  EQ_MIN_GAIN,
  EQ_MAX_GAIN,
  FLAT,
  CUSTOM_PRESET_ID,
  formatFrequency,
  normalizeBands,
} from "../../utils/equalizer";

const roleMeta = Object.fromEntries(
  colorGroups.flatMap((g) => g.roles.map((r) => [r.key, r])),
) as Record<ColorKey, { key: ColorKey; label: string; rgba?: boolean }>;

type Props = {
  config: UserConfig | null;
  setConfig: (config: UserConfig) => void;
  themeColor: string;
};

export function SettingsView({ config, setConfig, themeColor }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  if (!config) return null;

  const save = async (partial: Partial<UserConfig>) => {
    const newConfig = await window.api.updateConfig(partial);
    setConfig(newConfig);
  };

  // Resolved palette = the selected theme's base, overlaid with the user's
  // per-role deviations. Used to seed the color pickers with their live hex.
  const appearance = config.appearance ?? { themeId: DEFAULT_THEME_ID, colors: {} };
  const overrides = appearance.colors ?? {};
  const base = getTheme(appearance.themeId)?.palette ?? DEFAULT_PALETTE;
  const resolved = { ...base, ...overrides } as Record<ColorKey, string>;

  const applyThemePreset = (t: Theme) => {
    const willChange =
      appearance.themeId !== t.id ||
      config.themeColor !== t.accent ||
      Object.keys(overrides).length > 0;
    if (
      willChange &&
      !window.confirm(`Apply the ${t.name} theme? This overwrites your current colors.`)
    ) {
      return;
    }
    save({ themeColor: t.accent, appearance: { themeId: t.id, colors: {} } });
  };

  const setColor = (key: ColorKey, value: string) =>
    save({ appearance: { themeId: appearance.themeId, colors: { ...overrides, [key]: value } } });

  const resetColor = (key: ColorKey) => {
    const next = { ...overrides };
    delete next[key];
    save({ appearance: { themeId: appearance.themeId, colors: next } });
  };

  const resetAllColors = () => save({ appearance: { themeId: appearance.themeId, colors: {} } });

  const keybindings = config.keybindings ?? DEFAULT_KEYBINDINGS;

  const setBinding = (action: KeyboardActionId, binding: Keybinding) =>
    save({ keybindings: { ...keybindings, [action]: [binding] } });

  const resetBinding = (action: KeyboardActionId) =>
    save({ keybindings: { ...keybindings, [action]: DEFAULT_KEYBINDINGS[action] } });

  const handleAddFolder = async () => {
    const paths = await window.api.selectDirectories();
    const added = paths.filter((p) => !config.libraryPaths.includes(p));
    if (added.length > 0) {
      await save({ libraryPaths: [...config.libraryPaths, ...added] });
    }
  };

  const handleRemoveFolder = async (path: string) => {
    await save({ libraryPaths: config.libraryPaths.filter((p) => p !== path) });
  };

  return (
    <div style={{ padding: "30px", overflowY: "auto", height: "100%", paddingBottom: "120px" }}>
      <h2 style={{ margin: "0 0 30px 0" }}>Settings</h2>

      <Section title="Appearance">
        <div style={{ marginBottom: "8px", color: colors.textMuted, fontSize: "13px" }}>Theme</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "4px" }}>
          {THEMES.map((t) => {
            const active = appearance.themeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => applyThemePreset(t)}
                title={t.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  backgroundColor: colors.bgElevated,
                  minWidth: "116px",
                  border: active ? `2px solid ${themeColor}` : `2px solid ${colors.borderSubtle}`,
                }}
              >
                <div style={{ display: "flex", gap: "4px" }}>
                  {[t.palette.bgBase, t.palette.bgSurface, t.palette.textPrimary, t.accent].map(
                    (c, i) => (
                      <span
                        key={i}
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "4px",
                          backgroundColor: c,
                          border: `1px solid ${colors.borderFaint}`,
                        }}
                      />
                    ),
                  )}
                </div>
                <span
                  style={{
                    color: colors.textSecondary,
                    fontSize: "13px",
                    fontWeight: 500,
                    textAlign: "left",
                  }}
                >
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>

        <Row label="Accent color" description="Highlight color used across the app">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {PRESET_THEME_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => save({ themeColor: c })}
                title={c}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: c,
                  cursor: "pointer",
                  border:
                    config.themeColor === c
                      ? `2px solid ${colors.textPrimary}`
                      : "2px solid transparent",
                  outline: config.themeColor === c ? `2px solid ${c}` : "none",
                }}
              />
            ))}
            <input
              type="color"
              value={config.themeColor}
              onChange={(e) => save({ themeColor: e.target.value })}
              style={{
                width: "32px",
                height: "32px",
                padding: 0,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: "6px",
                background: "none",
                cursor: "pointer",
              }}
            />
          </div>
        </Row>

        {CORE_KEYS.map((key) => (
          <ColorPickerRow
            key={key}
            label={roleMeta[key]?.label ?? key}
            value={resolved[key]}
            isOverridden={key in overrides}
            rgba={roleMeta[key]?.rgba}
            onChange={(v) => setColor(key, v)}
            onReset={() => resetColor(key)}
          />
        ))}

        <Row label="More colors" description="Fine-tune every part of the interface">
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            style={{
              backgroundColor: colors.bgControl,
              color: colors.textTertiary,
              border: `1px solid ${colors.border}`,
              padding: "8px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </button>
        </Row>

        {showAdvanced && (
          <>
            {colorGroups.map((group) => (
              <div key={group.title} style={{ marginTop: "8px" }}>
                <div
                  style={{
                    color: colors.textMuted,
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    margin: "10px 2px 6px",
                  }}
                >
                  {group.title}
                </div>
                {group.roles.map((r) => (
                  <ColorPickerRow
                    key={r.key}
                    label={r.label}
                    value={resolved[r.key]}
                    isOverridden={r.key in overrides}
                    rgba={r.rgba}
                    onChange={(v) => setColor(r.key, v)}
                    onReset={() => resetColor(r.key)}
                  />
                ))}
              </div>
            ))}
            <button
              onClick={resetAllColors}
              disabled={Object.keys(overrides).length === 0}
              style={{
                marginTop: "12px",
                backgroundColor: "transparent",
                color: Object.keys(overrides).length === 0 ? colors.textIcon : colors.textTertiary,
                border: `1px solid ${colors.border}`,
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: Object.keys(overrides).length === 0 ? "default" : "pointer",
                fontSize: "13px",
              }}
            >
              Reset all colors to {getTheme(appearance.themeId)?.name ?? "theme"}
            </button>
          </>
        )}
      </Section>

      <Section title="Playback">
        <ToggleRow
          label="Double-click to play"
          description="Require a double-click to start a song instead of a single click"
          value={config.doubleClickToPlay}
          themeColor={themeColor}
          onChange={(v) => save({ doubleClickToPlay: v })}
        />
        <SliderRow
          label="Volume"
          description="Default playback volume"
          value={config.volume}
          themeColor={themeColor}
          onChange={(v) => save({ volume: v })}
        />
        <Row
          label="Removing the current song"
          description="What happens when you remove the currently playing song from the queue"
        >
          <Segmented
            options={[
              { value: "play-next", label: "Play next" },
              { value: "prevent", label: "Prevent" },
            ]}
            value={config.removeCurrentSongBehavior}
            themeColor={themeColor}
            onChange={(v) =>
              save({ removeCurrentSongBehavior: v as UserConfig["removeCurrentSongBehavior"] })
            }
          />
        </Row>
        <NumberRow
          label="Count as played after"
          description="Percent of a song you must listen to before it counts as a play"
          value={config.playCountThresholdPercent}
          min={1}
          max={100}
          themeColor={themeColor}
          onCommit={(v) => save({ playCountThresholdPercent: v })}
        />
      </Section>

      <Section title="Equalizer">
        <ToggleRow
          label="Enable equalizer"
          description="Apply a 10-band equalizer to everything you play"
          value={config.equalizerEnabled}
          themeColor={themeColor}
          onChange={(v) => save({ equalizerEnabled: v })}
        />
        <Row label="Preset" description="Pick a genre preset, or fine-tune the bands below">
          <select
            value={config.equalizerPreset}
            disabled={!config.equalizerEnabled}
            onChange={(e) => {
              const id = e.target.value;
              const preset = EQ_PRESETS.find((p) => p.id === id);
              if (preset) save({ equalizerPreset: id, equalizerBands: [...preset.gains] });
              else save({ equalizerPreset: id });
            }}
            style={{
              backgroundColor: colors.bgInput,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              padding: "8px 10px",
              fontSize: "13px",
              cursor: config.equalizerEnabled ? "pointer" : "default",
              minWidth: "150px",
            }}
          >
            {EQ_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value={CUSTOM_PRESET_ID}>Custom</option>
          </select>
        </Row>
        <EqualizerBands
          bands={normalizeBands(config.equalizerBands)}
          enabled={config.equalizerEnabled}
          themeColor={themeColor}
          onChange={(i, v) => {
            const next = normalizeBands(config.equalizerBands);
            next[i] = v;
            save({ equalizerBands: next, equalizerPreset: CUSTOM_PRESET_ID });
          }}
          onReset={() => save({ equalizerPreset: "flat", equalizerBands: [...FLAT] })}
        />
      </Section>

      <Section title="Startup">
        <ToggleRow
          label="Restore session on startup"
          description="Resume the last playing track and queue when the app starts"
          value={config.restoreSession}
          themeColor={themeColor}
          onChange={(v) => save({ restoreSession: v })}
        />
      </Section>

      <Section title="Home">
        <NumberRow
          label="Items per row"
          description="How many items each Home section shows before the 'Show all' button"
          value={config.homeItemLimit}
          min={1}
          max={50}
          themeColor={themeColor}
          onCommit={(v) => save({ homeItemLimit: v })}
        />
      </Section>

      <Section title="Library &amp; Browsing">
        <NumberRow
          label="Minimum songs for an album"
          description="Albums with fewer songs than this are not shown as a group"
          value={config.minSongsForAlbum}
          min={1}
          themeColor={themeColor}
          onCommit={(v) => save({ minSongsForAlbum: v })}
        />
        <NumberRow
          label="Search results per category"
          description="How many results to show per category in global search"
          value={config.searchResultsPerCategory}
          min={1}
          themeColor={themeColor}
          onCommit={(v) => save({ searchResultsPerCategory: v })}
        />
        <NumberRow
          label="Navigation history size"
          description="How many navigation steps the back button can remember"
          value={config.navigationHistorySize}
          min={1}
          themeColor={themeColor}
          onCommit={(v) => save({ navigationHistorySize: v })}
        />
      </Section>

      <Section title="Keyboard Shortcuts">
        {KEYBOARD_ACTIONS.map((action) => (
          <KeybindingRow
            key={action.id}
            label={action.label}
            description={action.description}
            bindings={keybindings[action.id] ?? []}
            isDefault={
              JSON.stringify(keybindings[action.id] ?? []) ===
              JSON.stringify(DEFAULT_KEYBINDINGS[action.id])
            }
            themeColor={themeColor}
            onRecord={(b) => setBinding(action.id, b)}
            onReset={() => resetBinding(action.id)}
          />
        ))}
      </Section>

      <Section title="Library Folders">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {config.libraryPaths.map((path) => (
            <div
              key={path}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.bgElevated,
                padding: "12px 16px",
                borderRadius: "10px",
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <span style={{ color: themeColor, fontSize: "20px", flexShrink: 0 }}>
                  <IoFolder />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {path.split(/[\\/]/).pop()}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: colors.textFaint,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {path}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFolder(path)}
                title="Remove folder"
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textFaint,
                  cursor: "pointer",
                  fontSize: "18px",
                  flexShrink: 0,
                  marginLeft: "12px",
                }}
              >
                <IoClose />
              </button>
            </div>
          ))}

          {config.libraryPaths.length === 0 && (
            <div style={{ color: colors.textFaint, fontSize: "13px" }}>
              No folders added to library yet.
            </div>
          )}

          <button
            onClick={handleAddFolder}
            style={{
              alignSelf: "flex-start",
              backgroundColor: themeColor,
              color: colors.textPrimary,
              border: "none",
              padding: "10px 20px",
              borderRadius: "20px",
              fontWeight: "bold",
              cursor: "pointer",
              marginTop: "4px",
            }}
          >
            Add Folder
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "36px", maxWidth: "640px" }}>
      <h3
        style={{
          margin: "0 0 16px 0",
          color: colors.textMuted,
          fontSize: "13px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{children}</div>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.bgElevated,
        padding: "14px 18px",
        borderRadius: "10px",
        border: `1px solid ${colors.borderSubtle}`,
        gap: "16px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, marginBottom: description ? "3px" : 0 }}>{label}</div>
        {description && (
          <div style={{ fontSize: "12px", color: colors.textFaint }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  themeColor,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  themeColor: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} description={description}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: "38px",
          height: "22px",
          borderRadius: "11px",
          backgroundColor: value ? themeColor : colors.border,
          position: "relative",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "3px",
            left: value ? "19px" : "3px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: colors.textPrimary,
            transition: "left 0.2s",
          }}
        />
      </div>
    </Row>
  );
}

function SliderRow({
  label,
  description,
  value,
  themeColor,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  themeColor: string;
  onChange: (v: number) => void;
}) {
  return (
    <Row label={label} description={description}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ width: "140px", accentColor: themeColor, cursor: "pointer" }}
        />
        <span
          style={{ width: "36px", textAlign: "right", color: colors.textMuted, fontSize: "13px" }}
        >
          {Math.round(value * 100)}%
        </span>
      </div>
    </Row>
  );
}

function EqualizerBands({
  bands,
  enabled,
  themeColor,
  onChange,
  onReset,
}: {
  bands: number[];
  enabled: boolean;
  themeColor: string;
  onChange: (index: number, value: number) => void;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: colors.bgElevated,
        padding: "18px",
        borderRadius: "10px",
        border: `1px solid ${colors.borderSubtle}`,
        opacity: enabled ? 1 : 0.45,
        pointerEvents: enabled ? "auto" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "8px",
        }}
      >
        {bands.map((gain, i) => (
          <div
            key={EQ_FREQUENCIES[i]}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              flex: 1,
            }}
          >
            <span style={{ fontSize: "11px", color: colors.textMuted, minHeight: "14px" }}>
              {gain > 0 ? `+${gain}` : gain}
            </span>
            <input
              type="range"
              min={EQ_MIN_GAIN}
              max={EQ_MAX_GAIN}
              step={1}
              value={gain}
              onChange={(e) => onChange(i, parseInt(e.target.value, 10))}
              style={
                {
                  // Vertical range slider (Chromium / Electron).
                  WebkitAppearance: "slider-vertical",
                  appearance: "slider-vertical",
                  writingMode: "vertical-lr",
                  width: "8px",
                  height: "110px",
                  accentColor: themeColor,
                  cursor: "pointer",
                } as unknown as React.CSSProperties
              }
            />
            <span style={{ fontSize: "10px", color: colors.textFaint }}>
              {formatFrequency(EQ_FREQUENCIES[i])}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "14px",
        }}
      >
        <span style={{ fontSize: "11px", color: colors.textFaint }}>
          Gain (dB) per frequency band
        </span>
        <button
          onClick={onReset}
          style={{
            backgroundColor: "transparent",
            color: colors.textMuted,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Reset to flat
        </button>
      </div>
    </div>
  );
}

function NumberRow({
  label,
  description,
  value,
  min,
  max,
  themeColor,
  onCommit,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max?: number;
  themeColor: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (isNaN(parsed) || parsed < min || (max !== undefined && parsed > max)) {
      setDraft(String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <Row label={label} description={description}>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        style={{
          width: "72px",
          backgroundColor: colors.bgBase,
          color: colors.textPrimary,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: "8px",
          padding: "8px 10px",
          fontSize: "14px",
          outline: "none",
          accentColor: themeColor,
        }}
      />
    </Row>
  );
}

function Segmented({
  options,
  value,
  themeColor,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  themeColor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        backgroundColor: colors.bgBase,
        borderRadius: "8px",
        padding: "3px",
        border: `1px solid ${colors.borderSubtle}`,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              backgroundColor: active ? themeColor : "transparent",
              color: active ? colors.textPrimary : colors.textDim,
              border: "none",
              padding: "6px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: active ? "bold" : "normal",
              transition: "background-color 0.15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function KeybindingRow({
  label,
  description,
  bindings,
  isDefault,
  themeColor,
  onRecord,
  onReset,
}: {
  label: string;
  description?: string;
  bindings: Keybinding[];
  isDefault: boolean;
  themeColor: string;
  onRecord: (b: Keybinding) => void;
  onReset: () => void;
}) {
  const [recording, setRecording] = useState(false);

  React.useEffect(() => {
    if (!recording) return;

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel on Escape, ignore lone modifier presses (wait for a real key).
      if (e.code === "Escape") {
        setRecording(false);
        return;
      }
      if (MODIFIER_CODES.includes(e.code)) return;

      const binding: Keybinding = { code: e.code };
      if (e.ctrlKey || e.metaKey) binding.ctrl = true;
      if (e.shiftKey) binding.shift = true;
      if (e.altKey) binding.alt = true;

      onRecord(binding);
      setRecording(false);
    };

    // Capture phase so we intercept the key before the global handler acts on it.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onRecord]);

  return (
    <Row label={label} description={description}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => setRecording((r) => !r)}
          style={{
            minWidth: "120px",
            backgroundColor: recording ? "transparent" : colors.bgControl,
            color: recording ? themeColor : colors.textPrimary,
            border: `1px solid ${recording ? themeColor : colors.border}`,
            borderRadius: "8px",
            padding: "8px 14px",
            cursor: "pointer",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          {recording
            ? "Press a key…"
            : bindings.length > 0
              ? bindings.map(formatKeybinding).join(" / ")
              : "Unbound"}
        </button>
        <button
          onClick={onReset}
          disabled={isDefault}
          title="Reset to default"
          style={{
            background: "none",
            border: "none",
            color: isDefault ? colors.borderSubtle : colors.textDim,
            cursor: isDefault ? "default" : "pointer",
            fontSize: "12px",
            padding: "4px 6px",
          }}
        >
          Reset
        </button>
      </div>
    </Row>
  );
}

function ColorPickerRow({
  label,
  value,
  isOverridden,
  rgba,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  isOverridden: boolean;
  rgba?: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <Row label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {rgba ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            style={{
              width: "150px",
              backgroundColor: colors.bgInput,
              color: colors.textPrimary,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: "8px",
              padding: "6px 8px",
              fontSize: "12px",
              fontFamily: "monospace",
              outline: "none",
            }}
          />
        ) : (
          <>
            <input
              type="color"
              value={toColorInputValue(value)}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: "32px",
                height: "32px",
                padding: 0,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: "6px",
                background: "none",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                color: colors.textMuted,
                fontSize: "12px",
                fontFamily: "monospace",
                minWidth: "62px",
              }}
            >
              {value}
            </span>
          </>
        )}
        <button
          onClick={onReset}
          disabled={!isOverridden}
          title="Reset to theme"
          style={{
            background: "none",
            border: "none",
            color: isOverridden ? colors.textDim : colors.borderSubtle,
            cursor: isOverridden ? "pointer" : "default",
            fontSize: "12px",
            padding: "4px 6px",
          }}
        >
          Reset
        </button>
      </div>
    </Row>
  );
}

// <input type="color"> needs a 6-digit hex; expand 3-digit shorthand and fall
// back to black for anything non-hex (e.g. rgba, which uses the text input).
function toColorInputValue(v: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return (
      "#" +
      v
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return "#000000";
}
