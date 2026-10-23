import fs from "fs";

import { getConfig } from "../configService";
import { updateLibrary } from "./libraryUpdater";

let watcher: any = null;
let chokidarModule: any = null;
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
    chokidarModule = await eval('import("chokidar")');
  }

  // Only watch paths that exist
  const existingPaths = config.libraryPaths.filter((p) => fs.existsSync(p));

  if (existingPaths.length === 0) return;

  watcher = chokidarModule.watch(existingPaths, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  const debouncedUpdate = () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(async () => {
      console.log("Library change detected, updating cache...");
      await updateLibrary();
    }, 2000); // Wait 2 seconds of silence before updating
  };

  watcher
    .on("add", (path: string) => {
      console.log(`File added: ${path}`);
      debouncedUpdate();
    })
    .on("change", (path: string) => {
      console.log(`File changed: ${path}`);
      debouncedUpdate();
    })
    .on("unlink", (path: string) => {
      console.log(`File removed: ${path}`);
      debouncedUpdate();
    })
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
