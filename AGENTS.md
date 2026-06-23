# AGENT GUIDE

## 1. Project Overview

Desktop Music/Video Player built with Electron + React + TypeScript.
A modern, customizable media player with a dark UI and dynamic pages driven by user config.

---

## 2. Core Rules

### Dependencies

- NEVER install or modify `package.json` without explicit user approval.
- If a dependency is needed: explain why, suggest the package, wait for confirmation.

### Scope

- Only modify files directly related to the task.
- Do NOT refactor unrelated code or restructure the project unless asked.

### Architecture

- UI (React): presentation only — no business logic inside components.
- Backend (Electron/Node): logic, file system, media handling.
- All UI ↔ backend interactions go through the IPC layer.
- Every feature must have UI + backend + IPC — no half-implementations.

### UI

- Dark theme, clean and minimal.
- Functional components, small and reusable.
- Components must be modular and decoupled from hardcoded routing (UI is eventually config-driven).

### Code Style

- Follow existing patterns. No new abstractions unless necessary.
- No unnecessary comments. No placeholder logic.

---

## 3. Terminology

- **pages**: views of the app. Navbar tabs (Home, Library, Artists, Albums, Genres, Playlists) plus non-tab pages (Queue, Song Details, Settings).
- **config**: JSON saved in appData — stores user-editable settings (library paths, accent + theme/appearance colors, volume, playback/home/search options, etc.).
- **cache**: hash-keyed JSON map of all scanned library files saved to disk for fast startup. Updated asynchronously in the background.
- **session**: JSON in appData persisting playback state (current track, queue, shuffle/repeat) and window bounds, for restore-on-launch.
- **tracker**: JSON in appData recording per-song play counts and a monthly play history; powers the Home page stats.
- **theme**: a complete color palette (one of several built-ins) plus per-role user overrides and an accent color, applied at runtime via CSS custom properties on `:root`.

---

## 4. File Structure

```text
src/
├── main.ts                          # Electron entry — frameless BrowserWindow; registers IPC + protocol + watcher;
│                                    #   window-control + mini-player-mode IPC; persists/restores window bounds (session)
├── preload.ts                       # Exposes window.api to renderer via contextBridge (library, config, playlists,
│                                    #   metadata, artists, shell, session, tracker, window controls, mini-mode)

├── hooks/                           # React hooks (state + lifecycle only, no UI)
│   ├── useAudioPlayer.ts            # HTML5 audio element state (play/pause, seek, duration, volume)
│   ├── useQueue.ts                  # Playback queue state, shuffle, repeat mode, current index
│   ├── usePlaybackController.ts     # Coordinates audio + queue; next/prev navigation; queue mutations
│   ├── useKeyboardControls.ts       # Keyboard shortcuts (Space, PageUp/Down, arrows)
│   ├── useLibrary.ts                # Subscribes to library-updated events; loads directory trees
│   └── usePlayTracker.ts            # Records a play (window.api.recordPlay) once a configurable % of a song is actually listened to

├── types/
│   └── queue.ts                     # RepeatMode type ("none" | "all" | "one")

├── utils/
│   ├── array.ts                     # shuffleArray() — Fisher-Yates
│   ├── metadata.ts                  # normalizeGenre(), formatArtists()
│   └── time.ts                      # formatDuration() — seconds → MM:SS

├── renderer/                        # React frontend
│   ├── main.tsx                     # Mounts <App /> to #root
│   ├── index.html                   # HTML entry point
│   ├── App.tsx                      # Root component — global state, page routing, nav history, hooks wiring,
│   │                                #   theme application, session restore, mini-player toggle
│   ├── types.d.ts                   # Shared interfaces: UserConfig, Appearance, WindowBounds, SessionData, FileItem
│   │                                #   (incl. isMedia + hash), Playlist, ArtistInfo, PlayRecord, context-menu actions; declares window.api
│   ├── css-modules.d.ts             # CSS Modules type shim
│   │
│   ├── theme/                       # Runtime theming (CSS custom properties on :root)
│   │   ├── colors.ts                # DEFAULT_PALETTE + color-role keys; `colors` (var(--x) refs); accent presets; Settings UI metadata
│   │   ├── themes.ts                # Built-in themes (Dark, Light, Midnight, Dracula, Nord, Ocean, Ember, Forest, Graphite)
│   │   └── applyTheme.ts            # applyPalette() — writes resolved palette + accent to :root style
│   │
│   └── components/
│       ├── Navbar/
│       │   ├── Navbar.tsx           # Tab navigation bar
│       │   ├── navConfig.ts         # Tab config array (Home, Library, Artists, Albums, Genres, Playlists)
│       │   ├── types.ts             # Page and NavTab types
│       │   └── Navbar.module.css
│       │
│       ├── TitleBar/
│       │   └── TitleBar.tsx         # Custom frameless window chrome — title, mini-player/minimize/maximize/close buttons
│       │
│       ├── MiniPlayer/
│       │   └── MiniPlayer.tsx       # Floating always-on-top mini widget — cover art + transport controls; JS window dragging
│       │
│       ├── GlobalSearch/
│       │   ├── GlobalSearch.tsx     # Library-wide search dropdown — songs/albums/artists/playlists with navigation
│       │   └── GlobalSearch.module.css
│       │
│       ├── HomeView/
│       │   ├── HomeView.tsx         # Home page — recently played, most played, popular artists, never played, library statistics (tracker-driven)
│       │   └── HomeView.module.css
│       │
│       ├── LibraryView.tsx          # Switches between folder list and directory tree
│       ├── LibraryFoldersView.tsx   # Shows library paths with Add/Remove/Refresh
│       ├── LibraryFolderView.tsx    # Directory tree for a selected library path
│       ├── DirectoryTree.tsx        # Recursive folder/file tree with expand/collapse and sorting
│       │
│       ├── GroupedView/
│       │   ├── GroupedView.tsx      # Container for Artists/Albums/Genres views; search + sort
│       │   ├── GroupList.tsx        # Grid of group cards
│       │   ├── SongGrid.tsx         # Grid of song cards filtered to selected group
│       │   ├── GroupCard.tsx        # Card: group name, count, picture; right-click group context menu
│       │   ├── SongCard.tsx         # Card: song artwork, title, artist
│       │   ├── GroupedViewHeader.tsx # Header with title and sort/filter controls
│       │   ├── groupedView.utils.ts # getFilteredSongs(), getGroupEntries()
│       │   ├── types.ts             # GroupType, GroupSortBy, SelectedGroup
│       │   └── GroupedView.module.css
│       │
│       ├── PlaybackBar.tsx          # Bottom control bar — track info, play controls, progress, volume, repeat/shuffle
│       │
│       ├── Queue/
│       │   ├── QueueView.tsx        # Full queue list with header and clear button
│       │   ├── QueueItem.tsx        # Single queue row — number, title, artist, duration, remove button
│       │   └── QueueHeader.tsx      # Queue stats (count, total duration) and controls
│       │
│       ├── PlaylistView.tsx         # Playlist page — create, view, edit, add/remove songs, drag-reorder, sort
│       ├── SongDetailsView.tsx      # Full-screen detail — metadata, editable tags, album art, lyrics, add-to-playlist
│       └── SettingsView.tsx         # Settings page — appearance (theme/accent/per-role colors), playback, startup, home, library options, library folders

└── main/                            # Electron main process
    │
    ├── ipc/
    │   ├── index.ts                 # Registers all IPC handler modules
    │   ├── libraryHandlers.ts       # get-library-files, get-directory-tree, select-directory, refresh-library
    │   ├── configHandlers.ts        # get-config, update-config (re-inits watcher when libraryPaths change)
    │   ├── metadataHandlers.ts      # get-metadata (incl. hash), write-metadata (node-id3 tag writing)
    │   ├── playlistHandlers.ts      # get-playlists, get-playlist, create-playlist, update-playlist, delete-playlist
    │   ├── artistHandlers.ts        # get-artist-info, update-artist-info, select-artist-image
    │   ├── menuHandlers.ts          # show-song-context-menu + show-group-context-menu (play, play-next, go-to-album/artist, open-details, add-to-playlist)
    │   ├── shellHandlers.ts         # show-file-in-folder, open-external-url
    │   ├── sessionHandlers.ts       # get-session, save-session, clear-session
    │   └── trackerHandlers.ts       # record-play, get-play-counts, get-recent-plays
    │
    ├── protocols/
    │   └── mediaProtocol.ts         # Registers media:// protocol — streams audio/images, handles range requests
    │
    └── services/
        ├── configService.ts         # Loads/saves userData/config.json; default config schema lives here
        ├── cacheService.ts          # Disk cache at userData/library_cache.json — hash-keyed FileItem map (migrates legacy array format)
        ├── metadataService.ts       # Extracts tags from music files via music-metadata; saves album art
        ├── hashUtil.ts              # hashPath() — stable sha1 song id derived from the (normalized) file path
        ├── sessionService.ts        # Loads/saves userData/session.json — playback state + window/mini-window bounds
        ├── trackerService.ts        # userData/tracker/ — play_counts.json + monthly play_history; recordPlay/getPlayCounts/getRecentPlays
        │
        └── library/
            ├── libraryScanner.ts    # Recursive directory scan; builds FileItem tree; extracts metadata
            ├── libraryUpdater.ts    # Scans all configured paths; updates cache; broadcasts library-updated
            ├── libraryWatcher.ts    # Chokidar watcher on library paths; debounced (2s) change detection
            └── mediaUtils.ts        # isMediaFile() — checks extension against supported formats
```
