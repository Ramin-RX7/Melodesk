// Test data for renderer tests: songs (FileItem) and a full UserConfig.
import { FileItem, UserConfig } from "../../src/renderer/types";
import { DEFAULT_KEYBINDINGS } from "../../src/utils/keybindings";

// Same values as DEFAULT_CONFIG in src/main/services/configService.ts, which can't be imported
// here (it reads app.getPath when loaded). tests/unit/services/dataServices.test.ts checks that
// the two stay equal.
export const TEST_DEFAULT_CONFIG: UserConfig = {
  doubleClickToPlay: true,
  libraryPaths: [],
  minSongsForAlbum: 3,
  themeColor: "#1db954",
  volume: 0.5,
  removeCurrentSongBehavior: "play-next",
  restoreSession: true,
  searchResultsPerCategory: 4,
  navigationHistorySize: 20,
  playCountThresholdPercent: 50,
  homeItemLimit: 10,
  appearance: { themeId: "dark", colors: {} },
  keybindings: DEFAULT_KEYBINDINGS,
  equalizerEnabled: false,
  equalizerPreset: "flat",
  equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export const makeConfig = (partial: Partial<UserConfig> = {}): UserConfig => ({
  ...TEST_DEFAULT_CONFIG,
  ...partial,
});

let counter = 0;

type SongOptions = NonNullable<FileItem["metadata"]> & { path?: string; hash?: string };

/**
 * A library song. Each one gets a unique path, id, title and length unless given; a field set
 * to `undefined` is left out (e.g. `song({ artists: undefined })` has no artist).
 */
export const song = ({ path, hash, ...metadata }: SongOptions = {}): FileItem => {
  const n = ++counter;
  const filePath = path ?? `C:\\Music\\song ${n}.mp3`;
  return {
    name: filePath.split(/[\\/]/).pop()!,
    path: filePath,
    isDirectory: false,
    isMedia: true,
    hash: hash ?? `hash${n}`,
    metadata: { title: `Song ${n}`, artists: ["Artist"], duration: 100 + n, ...metadata },
  };
};

export const songs = (count: number, options: SongOptions = {}) =>
  Array.from({ length: count }, () => song(options));

/** The `media://` URL the player uses for a file. */
export const mediaUrl = (filePath: string) =>
  `media://${encodeURIComponent(filePath.replace(/\\/g, "/"))}`;
