import { setupArtistHandlers } from "./artistHandlers";
import { registerConfigHandlers } from "./configHandlers";
import { registerLibraryHandlers } from "./libraryHandlers";
import { registerMenuHandlers } from "./menuHandlers";
import { registerMetadataHandlers } from "./metadataHandlers";
import { setupPlaylistHandlers } from "./playlistHandlers";
import { registerShellHandlers } from "./shellHandlers";


export function registerIpcHandlers() {
  setupArtistHandlers();
  setupPlaylistHandlers();
  registerConfigHandlers();
  registerLibraryHandlers();
  registerMenuHandlers();
  registerMetadataHandlers();
  registerShellHandlers();
}
