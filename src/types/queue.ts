export const REPEAT_MODES = ["none", "all", "one"] as const;

export type RepeatMode = (typeof REPEAT_MODES)[number];
