import { app } from "electron";
import fs from "fs";
import path from "path";

import { PlayRecord } from "../../renderer/types";
import { readJson, writeJson } from "./jsonStore";

// Play tracking lives outside the library cache so counts/history survive cache
// rebuilds and can be read/written directly.
//
//   play_counts.json        -> { [songHash]: number }   total plays per song
//   play_history/<YYYY-MM>  -> PlayRecord[]              one entry per play, rotated monthly
//
const TRACKER_DIR = path.join(app.getPath("userData"), "tracker");
const COUNTS_PATH = path.join(TRACKER_DIR, "play_counts.json");
const HISTORY_DIR = path.join(TRACKER_DIR, "play_history");

type PlayCounts = Record<string, number>;

const ensureDirs = () => {
  if (!fs.existsSync(TRACKER_DIR)) fs.mkdirSync(TRACKER_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
};

// "YYYY-MM" key for a timestamp; determines which monthly history file is used.
const monthKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
};

const historyPathFor = (month: string): string => path.join(HISTORY_DIR, `${month}.json`);

/* ---------------- COUNTS ---------------- */

export const getPlayCounts = (): PlayCounts => {
  return readJson<PlayCounts>(COUNTS_PATH, {}, { label: "play counts" });
};

export const getPlayCount = (hash: string): number => {
  return getPlayCounts()[hash] ?? 0;
};

/* ---------------- HISTORY ---------------- */

// Sorted newest-first list of available "YYYY-MM" month keys.
const listMonths = (): string[] => {
  try {
    return fs
      .readdirSync(HISTORY_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
};

export const getHistory = (month?: string): PlayRecord[] => {
  const key = month ?? monthKey(Date.now());
  return readJson<PlayRecord[]>(historyPathFor(key), [], { label: `play history (${key})` });
};

// Most recent plays across all months, newest first.
export const getRecentPlays = (limit = 200): PlayRecord[] => {
  const records: PlayRecord[] = [];
  for (const month of listMonths()) {
    records.push(...getHistory(month));
    if (records.length >= limit * 4) break; // read enough months to satisfy the limit
  }
  records.sort((a, b) => b.timestamp - a.timestamp);
  return records.slice(0, limit);
};

/* ---------------- RECORDING ---------------- */

// Records a single play: bumps the song's total count and appends a timestamped
// entry to the current month's history file (created on demand → monthly rotation).
export const recordPlay = (hash: string, timestamp: number = Date.now()): void => {
  if (!hash) return;
  ensureDirs();

  const counts = getPlayCounts();
  counts[hash] = (counts[hash] ?? 0) + 1;
  writeJson(COUNTS_PATH, counts);

  const key = monthKey(timestamp);
  const history = getHistory(key);
  history.push({ hash, timestamp });
  writeJson(historyPathFor(key), history);
};
