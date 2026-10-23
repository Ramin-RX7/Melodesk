import fs from "fs";

import { getConfig } from "../configService";
import { importEsm } from "../esmImport";
import { updateLibrary } from "./libraryUpdater";
import { isMediaFile } from "./mediaUtils";

// chokidar is ESM-only (importEsm); these are the parts used here.
type Watcher = {
  on: (event: string, listener: (arg: never) => void) => Watcher;
  close: () => Promise<void>;
};
type Chokidar = { watch: (paths: string[], options: object) => Watcher };

let watcher: Watcher | null = null;
let chokidarModule: Chokidar | null = null;
let updateTimeout: NodeJS.Timeout | null = null;

export const setupWatcher = async () => {
  if (watcher) {
    console.log("Closing existing watcher...");
    await watcher.close();
    watcher = null;
  }

  const config = getConfig();
  if (config.libraryPaths.length === 0) {
    console.log("No library paths to watch.");
    return;
  }

  console.log("Setting up watcher for paths:", config.libraryPaths);
  if (!chokidarModule) {
    chokidarModule = await importEsm<Chokidar>("chokidar");
  }

  // Only watch paths that exist
  const existingPaths = config.libraryPaths.filter((p) => fs.existsSync(p));

  if (existingPaths.length === 0) return;

  watcher = chokidarModule!.watch(existingPaths, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  // The scan that follows tells the user what actually changed (a move shows up here as a file
  // removed plus one added).
  const debouncedUpdate = () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(async () => {
      console.log("Library change detected, updating cache...");
      await updateLibrary();
    }, 2000); // Wait 2 seconds of silence before updating
  };

  // Only audio files (and whole folders, which may contain them) affect the library; covers,
  // playlists and other files next to the music are ignored.
  const onFile = (label: string) => (path: string) => {
    if (!isMediaFile(path)) return;
    console.log(`File ${label}: ${path}`);
    debouncedUpdate();
  };

  watcher
    .on("add", onFile("added"))
    .on("change", onFile("changed"))
    .on("unlink", onFile("removed"))
    .on("addDir", (path: string) => {
      console.log(`Directory added: ${path}`);
      debouncedUpdate();
    })
    .on("unlinkDir", (path: string) => {
      console.log(`Directory removed: ${path}`);
      debouncedUpdate();
    })
    .on("error", (error: Error) => console.error(`Watcher error: ${error}`));
};
