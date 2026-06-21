import React, { useState } from "react";
import { IoFolder, IoClose } from "react-icons/io5";

import { UserConfig } from "../types";

type Props = {
  config: UserConfig | null;
  setConfig: (config: UserConfig) => void;
  themeColor: string;
};

const PRESET_COLORS = ["#1db954", "#e91e63", "#2196f3", "#ff9800", "#9c27b0", "#f44336", "#00bcd4"];

export function SettingsView({ config, setConfig, themeColor }: Props) {
  if (!config) return null;

  const save = async (partial: Partial<UserConfig>) => {
    const newConfig = await window.api.updateConfig(partial);
    setConfig(newConfig);
  };

  const handleAddFolder = async () => {
    const path = await window.api.selectDirectory();
    if (path && !config.libraryPaths.includes(path)) {
      await save({ libraryPaths: [...config.libraryPaths, path] });
    }
  };

  const handleRemoveFolder = async (path: string) => {
    await save({ libraryPaths: config.libraryPaths.filter((p) => p !== path) });
  };

  return (
    <div style={{ padding: "30px", overflowY: "auto", height: "100%", paddingBottom: "120px" }}>
      <h2 style={{ margin: "0 0 30px 0" }}>Settings</h2>

      <Section title="Appearance">
        <Row label="Theme color" description="Accent color used across the app">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {PRESET_COLORS.map((c) => (
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
                  border: config.themeColor === c ? "2px solid #fff" : "2px solid transparent",
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
                border: "1px solid #333",
                borderRadius: "6px",
                background: "none",
                cursor: "pointer",
              }}
            />
          </div>
        </Row>
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
            onChange={(v) => save({ removeCurrentSongBehavior: v as UserConfig["removeCurrentSongBehavior"] })}
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

      <Section title="Library Folders">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {config.libraryPaths.map((path) => (
            <div
              key={path}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#1e1e1e",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px solid #333",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <span style={{ color: themeColor, fontSize: "20px", flexShrink: 0 }}>
                  <IoFolder />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {path.split(/[\\/]/).pop()}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {path}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFolder(path)}
                title="Remove folder"
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "18px", flexShrink: 0, marginLeft: "12px" }}
              >
                <IoClose />
              </button>
            </div>
          ))}

          {config.libraryPaths.length === 0 && (
            <div style={{ color: "#666", fontSize: "13px" }}>No folders added to library yet.</div>
          )}

          <button
            onClick={handleAddFolder}
            style={{
              alignSelf: "flex-start",
              backgroundColor: themeColor,
              color: "#fff",
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
      <h3 style={{ margin: "0 0 16px 0", color: "#aaa", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{children}</div>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#1e1e1e",
        padding: "14px 18px",
        borderRadius: "10px",
        border: "1px solid #333",
        gap: "16px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, marginBottom: description ? "3px" : 0 }}>{label}</div>
        {description && <div style={{ fontSize: "12px", color: "#666" }}>{description}</div>}
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
          backgroundColor: value ? themeColor : "#444",
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
            backgroundColor: "#fff",
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
        <span style={{ width: "36px", textAlign: "right", color: "#aaa", fontSize: "13px" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
    </Row>
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
          backgroundColor: "#121212",
          color: "#fff",
          border: "1px solid #333",
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
    <div style={{ display: "flex", backgroundColor: "#121212", borderRadius: "8px", padding: "3px", border: "1px solid #333" }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              backgroundColor: active ? themeColor : "transparent",
              color: active ? "#fff" : "#888",
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
