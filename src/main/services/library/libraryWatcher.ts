import fs from "fs";

import { getConfig } from "../configService";
import { notify } from "../notifyService";
import { updateLibrary } from "./libraryUpdater";
import { isMediaFile } from "./mediaUtils";

let watcher: any = null;
let chokidarModule: any = null;
let updateTimeout: NodeJS.Timeout | null = null;

type ChangeKind = "added" | "changed" | "removed" | "folders";
// Changes seen since the last update; summarized in the notification, then reset.
let pending: Record<ChangeKind, number> = { added: 0, changed: 0, removed: 0, folders: 0 };

const describeChanges = () => {
  const songs = (n: number) => `${n} song${n === 1 ? "" : "s"}`;
  const parts = [
    pending.added && `${songs(pending.added)} added`,
    pending.changed && `${songs(pending.changed)} changed`,
    pending.removed && `${songs(pending.removed)} removed`,
    pending.folders &&
      `${pending.folders} folder${pending.folders === 1 ? "" : "s"} added or removed`,
  ].filter(Boolean);
  return parts.join(", ");
};

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

  const debouncedUpdate = (kind: ChangeKind) => {
    pending[kind]++;
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(async () => {
      console.log("Library change detected, updating cache...");
      notify(
        "info",
        `Changes found in your library folders (${describeChanges()}). Updating your library in the background…`,
      );
      pending = { added: 0, changed: 0, removed: 0, folders: 0 };
      await updateLibrary();
    }, 2000); // Wait 2 seconds of silence before updating
  };

  // Only audio files (and whole folders, which may contain them) affect the library; covers,
  // playlists and other files next to the music are ignored.
  const onFile = (kind: ChangeKind, label: string) => (path: string) => {
    if (!isMediaFile(path)) return;
    console.log(`File ${label}: ${path}`);
    debouncedUpdate(kind);
  };

  watcher
    .on("add", onFile("added", "added"))
    .on("change", onFile("changed", "changed"))
    .on("unlink", onFile("removed", "removed"))
    .on("addDir", (path: string) => {
      console.log(`Directory added: ${path}`);
      debouncedUpdate("folders");
    })
    .on("unlinkDir", (path: string) => {
      console.log(`Directory removed: ${path}`);
      debouncedUpdate("folders");
    })
    .on("error", (error: Error) => console.error(`Watcher error: ${error}`));
};
