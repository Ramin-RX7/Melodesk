import { setupArtistHandlers } from "./artistHandlers";
import { registerConfigHandlers } from "./configHandlers";
import { registerLibraryHandlers } from "./libraryHandlers";
import { registerMenuHandlers } from "./menuHandlers";
import { registerMetadataHandlers } from "./metadataHandlers";
import { setupPlaylistHandlers } from "./playlistHandlers";
import { registerShellHandlers } from "./shellHandlers";
import { setupSessionHandlers } from "./sessionHandlers";
import { registerTrackerHandlers } from "./trackerHandlers";


export function registerIpcHandlers() {
  setupArtistHandlers();
  setupPlaylistHandlers();
  setupSessionHandlers();
  registerConfigHandlers();
  registerLibraryHandlers();
  registerMenuHandlers();
  registerMetadataHandlers();
  registerShellHandlers();
  registerTrackerHandlers();
}
