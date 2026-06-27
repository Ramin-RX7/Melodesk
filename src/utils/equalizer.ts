// Shared equalizer constants and presets used by both the Web Audio graph
// (useEqualizer) and the settings UI (SettingsView).

/** ISO-standard centre frequencies (Hz) for a 10-band graphic equalizer. */
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_BAND_COUNT = EQ_FREQUENCIES.length;

/** Per-band gain limits, in decibels. */
export const EQ_MIN_GAIN = -12;
export const EQ_MAX_GAIN = 12;

/** All-zero gains: a transparent (no-op) equalizer curve. */
export const FLAT: number[] = EQ_FREQUENCIES.map(() => 0);

export type EqPreset = {
  id: string;
  label: string;
  gains: number[];
};

// Gains are in dB, one per frequency in EQ_FREQUENCIES (32Hz .. 16kHz).
export const EQ_PRESETS: EqPreset[] = [
  { id: "flat", label: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "bassBoost", label: "Bass Boost", gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { id: "trebleBoost", label: "Treble Boost", gains: [0, 0, 0, 0, 0, 2, 3, 4, 5, 6] },
  { id: "vocal", label: "Vocal", gains: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
  { id: "rock", label: "Rock", gains: [4, 3, 1, -1, -1, 0, 2, 3, 4, 4] },
  { id: "pop", label: "Pop", gains: [-1, 0, 1, 2, 3, 3, 1, 0, -1, -1] },
  { id: "jazz", label: "Jazz", gains: [3, 2, 1, 2, 0, 0, 1, 2, 3, 3] },
  { id: "classical", label: "Classical", gains: [4, 3, 2, 0, 0, 0, 0, 2, 3, 4] },
  { id: "electronic", label: "Electronic", gains: [5, 4, 1, 0, -1, 1, 0, 2, 4, 5] },
  { id: "loudness", label: "Loudness", gains: [6, 4, 0, 0, -1, 0, 1, 3, 5, 6] },
];

/** The special preset id used when the user has hand-tuned the bands. */
export const CUSTOM_PRESET_ID = "custom";

/** Short axis label for a frequency (e.g. 16000 -> "16k"). */
export function formatFrequency(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
}

/**
 * Coerce an arbitrary stored value into a valid bands array: exactly
 * EQ_BAND_COUNT entries, each a finite number clamped to the gain range.
 * Guards against older/corrupt configs.
 */
export function normalizeBands(bands: unknown): number[] {
  const arr = Array.isArray(bands) ? bands : [];
  return EQ_FREQUENCIES.map((_, i) => {
    const v = typeof arr[i] === "number" && isFinite(arr[i] as number) ? (arr[i] as number) : 0;
    return Math.max(EQ_MIN_GAIN, Math.min(EQ_MAX_GAIN, v));
  });
}
