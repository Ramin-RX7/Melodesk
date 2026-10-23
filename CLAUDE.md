# CLAUDE.md

The single source of truth for working in this repository: rules, terminology, architecture, file map and per-feature entry points. Read it before touching code.

**Keep it current.** When a change adds, removes or renames a file, an IPC channel, a config field or a persisted file, update the matching section here in the same change.

---

## 1. Project overview

**MeloDesk** is a desktop music player built with Electron, React and TypeScript. It plays a local library only: the user adds folders, the app scans them, reads their tags and plays the files. The UI is modern and minimal, dark by default and fully themeable, in a frameless window with a custom title bar and a floating mini-player mode.

Long-term goal: **pages driven by user config**. Today, pages are hard-wired in `App.tsx`, so write components that don't depend on a fixed route (see §2 → UI).

Scope today is **audio only** (`.mp3 .wav .ogg .m4a .flac`). Video playback is not implemented.

| Layer | Tech                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| Shell | Electron 29 (frameless `BrowserWindow`, `contextIsolation`, `sandbox: true`)                                                |
| UI    | React 19 function components, inline styles + some CSS Modules, `react-icons`                                               |
| Build | `tsc` (main + preload → CommonJS in `dist/`), Vite 8 (renderer → `dist/renderer/`), electron-builder (installers)           |
| Media | `music-metadata` (read tags), `node-id3` (write tags), `chokidar` (folder watcher), HTML5 `<audio>` + Web Audio (equalizer) |
| Node  | `^20.19.0 \|\| >=22.12.0` (`engines`, required by Vite 8); `.nvmrc` pins `24.22.1`                                          |

There are **no tests and no linter**. Formatting is enforced by Prettier (`.prettierrc.json`: 2 spaces, double quotes, semicolons, trailing commas, width 100, LF). `.editorconfig` mirrors it for editors, and `.gitattributes` stores every text file with LF line endings.

---

## 2. Core rules

### Git: the user owns every commit

- **AI agents never commit, and never stage.** No `git commit`, `git add`, `git commit --amend`, `git tag`, `git push`, `git reset`/`rebase`/`stash` or anything else that changes the index, history, tags or remotes. Leave every change unstaged in the working tree; the user decides what to stage, commit, tag and push.
- This includes indirect routes: **never run `npm run release`** (it commits and tags) or any script that does git writes on the agent's behalf.
- Read-only git is fine and encouraged: `status`, `diff`, `log`, `show`, `blame`, `branch --list`, `tag --list`.
- When work is done, report what changed and, if useful, suggest a commit message (using the prefixes below) for the user to use.

### Dependencies

- **Never** install packages or modify `package.json` / `package-lock.json` without explicit user approval. That includes scripts, build config and version bumps.
- If a dependency is needed, explain why, suggest the package, and wait for confirmation.
- **Where a dependency goes:** `dependencies` is only for packages the **main process** `require`s at runtime (today `chokidar`, `music-metadata`, `node-id3`). Anything used only by the renderer (React, `react-icons`, any UI library) goes in **`devDependencies`**, because Vite already bundles it into `dist/renderer`. electron-builder ships everything in `dependencies` inside `app.asar`; putting React there grew the package from 1.9 MB to 90 MB.

### Scope

- Modify only files directly related to the task.
- Don't refactor unrelated code or restructure the project unless asked.

### Architecture

- **UI (React) is for presentation.** Components render props and raise callbacks. They don't touch the file system, parse metadata or persist anything.
- **Backend (Electron / Node) owns logic, the file system and media handling:** scanning, tag reading and writing, caching, and every read or write under `userData`.
- **All UI ↔ backend interaction goes through IPC** (`window.api`, see the IPC recipe in §10).
- **Every feature is complete:** UI + IPC + backend wherever the feature needs the backend. No half-implementations.
- Display-only data derived from data the renderer already has (grouping, filtering, sorting, Home-page stats) is computed in renderer utilities and hooks, e.g. `groupedView.utils.ts`. Keep that kind of logic in hooks and `*.utils.ts` files, **not inside component bodies**.

### UI

- Clean and minimal. **Dark is the default theme, but the app is themeable:** never hard-code colors. Use `colors.*` or `var(--role)` (§6 → Theming).
- Functional components only. Keep them small and reusable.
- Components must be modular and not tied to hard-coded routing. Take data and navigation as props or callbacks rather than reaching into `App.tsx` state, because the UI is meant to become config-driven.

### Code style

- Follow existing patterns. No new abstractions unless necessary.
- No unnecessary comments. No placeholder logic.

### Changelog

- **Every user-facing change adds an entry to `CHANGELOG.md` under `## [Unreleased]` in the same commit.** Every `[feat]` and `[fix]` commit needs one; CI fails a push or PR whose `[feat]`/`[fix]` commits don't touch `CHANGELOG.md`.
- Use the Keep a Changelog categories as `###` headings (`Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`); `####` feature-area subheadings are optional. One `- ` bullet per change.
- Write for users, not developers: what they can now do or what no longer goes wrong ("Playlists can be sorted by duration"), not internals ("refactor usePlaybackController").
- Never edit released version sections or the link definitions at the bottom. `npm run release` manages those.

### Commits

Messages use a bracketed type prefix: `[feat] …`, `[fix] …`, `[refactor] …`, `[chore] …`, `[config] …`, and `[release] vX.Y.Z` (created only by `npm run release`).

---

## 3. Terminology

- **pages**: views of the app. Navbar **tabs** (Home, Library, Artists, Albums, Genres, Playlists) plus **non-tab pages** (Queue, Song Details, Settings). Represented by the `Page` type.
- **config**: `userData/config.json`, the user-editable settings (`UserConfig`): library paths, accent + theme/appearance colors, volume, playback/home/search options, equalizer, keybindings, etc.
- **cache**: `userData/library_cache.json`, a hash-keyed map of every scanned library file, so startup is fast. Rebuilt asynchronously in the background.
- **session**: `userData/session.json`, the playback state (current track, queue, shuffle/repeat) plus normal and mini window bounds, restored on launch.
- **tracker**: `userData/tracker/`, per-song play counts plus a monthly play history. Powers the Home page stats.
- **theme**: a complete color palette (one of several built-ins) plus per-role user overrides and an accent color, applied at runtime as CSS custom properties on `:root`.
- **accent / themeColor**: the user's highlight color (`config.themeColor`), passed around as a hex string.
- **song hash**: a song's stable id, `sha1(normalized file path)` (`hashUtil.ts`).
- **mini-player / mini mode**: the same window shrunk to a small, always-on-top widget.
- **keybindings**: user-rebindable keyboard shortcuts stored in config (`utils/keybindings.ts`).
- **equalizer (EQ)**: the 10-band Web Audio filter chain between the `<audio>` element and the speakers.

---

## 4. Build, run & release

```bash
npm ci             # install exactly what package-lock.json pins (use `npm install` when changing deps)
```

| Script                                        | What it does                                                                                                            | When to use it                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                                 | Watches `src/` and `assets/`; on every change runs `npm start` again (rebuild + restart Electron)                       | Day-to-day development                                                 |
| `npm start`                                   | `compile`, then launches Electron                                                                                       | One-off run of the current code                                        |
| `npm run compile`                             | `clean` → `tsc` (main + preload → `dist/`) → copy `assets/` → `dist/assets` → `vite build` (renderer → `dist/renderer`) | Build without launching; every packaging script runs it first          |
| `npm run clean`                               | Deletes `dist/` (Node `fs.rmSync`, cross-platform)                                                                      | Drop stale output from deleted or renamed files                        |
| `npm run typecheck`                           | `tsc --noEmit` over all of `src/` (Vite doesn't type-check)                                                             | After any TS change                                                    |
| `npm run format`                              | Prettier `--write` on the whole repo                                                                                    | Before committing                                                      |
| `npm run format:check`                        | Prettier `--check`; fails if anything is unformatted                                                                    | CI / pre-commit                                                        |
| `npm run check`                               | `typecheck` + `format:check` + `changelog:verify`                                                                       | **Run before every commit**: the fastest "is this mergeable" gate      |
| `npm run changelog:verify`                    | Validates `CHANGELOG.md` structure (`scripts/changelog.mjs verify`)                                                     | Part of `check`                                                        |
| `npm run pack`                                | `compile` → `electron-builder --dir`: unpacked app in `release/<platform>-unpacked/`, no installer                      | Test the packaged app quickly (asar contents, icons, production paths) |
| `npm run build`                               | `compile` → installers for the current OS into `release/` (`--publish never`)                                           | Local test of release artifacts                                        |
| `npm run build:win` / `:mac` / `:linux`       | Same, for a specific OS (build on that OS, see §5); CI uses these                                                       | Local test of release artifacts                                        |
| `npm run release -- <bump>`                   | Cuts a release: version bump + CHANGELOG + `[release]` commit + `vX.Y.Z` tag (never pushes). `--dry-run` to preview     | Releasing (see below)                                                  |
| `npm run release:patch` / `:minor` / `:major` | Shortcuts for `release -- patch` etc.                                                                                   | Releasing                                                              |

- `tsconfig.json`: `rootDir: src`, `outDir: dist`, CommonJS. `vite.config.ts`: `root: src/renderer`, `base: "./"`, output `dist/renderer`. `tsc` also emits renderer `.js` files into `dist/`; Vite replaces `dist/renderer`, and the extra `dist/hooks` files are harmless.
- `npm run dev` restarts the whole app on every save (no HMR). That's fine for now; a Vite dev server with HMR is a possible later upgrade.
- There are no automated tests. To verify a change: `npm run check`, then `npm start` and exercise the feature. Main-process logs (`console.*` in `src/main/`) print to the terminal; renderer logs go to DevTools (`Ctrl+Shift+I`).
- **Running Electron from Claude Code inside VS Code:** that environment sets `ELECTRON_RUN_AS_NODE=1`, which makes `electron .` run as plain Node and crash with `Cannot read properties of undefined (reading 'getPath')`. Unset it for the command first (PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`). Normal terminals aren't affected.
- **Windows packaging needs Developer Mode** (Settings → System → For developers) or an admin shell. electron-builder extracts its code-signing tools archive, which contains symlinks, and Windows only lets you create symlinks with that privilege. Without it, `pack`/`build` fail with `Cannot create symbolic link : A required privilege is not held by the client`, before the exe icon and version info are embedded.
- `dist/`, `release/` and `node_modules/` are gitignored.

### Versioning

- The app version lives in `package.json` → `version` and must be **valid semver `MAJOR.MINOR.PATCH`** (e.g. `0.2.0`, not `0.2`). electron-builder uses it for artifact names and installer metadata.
- **Don't bump it by hand.** `npm run release` bumps `package.json` and `package-lock.json` together. Releasing is done by the user only: agents never run it, because it commits and tags (§2 → Git).
- `patch` for fixes only, `minor` for new features, `major` for breaking changes (e.g. incompatible config/data formats).

### Releasing

1. While developing, entries accumulate under `## [Unreleased]` in `CHANGELOG.md` (§2 → Changelog).
2. `npm run release -- minor` (or `patch` / `major` / `X.Y.Z`; add `--dry-run` to preview). It refuses to run unless you're on `master`, the tree is clean, you're not behind `origin`, the tag is new, Unreleased has entries and `npm run check` passes. It then bumps the version, moves Unreleased to `## [X.Y.Z] - <date>`, commits `[release] vX.Y.Z` and creates an annotated tag `vX.Y.Z`.
3. `git push origin master --follow-tags`. Pushing the tag triggers `.github/workflows/release.yml`, which:
   - runs `npm run check` and verifies that the tag matches `package.json`;
   - builds on Windows, Linux and macOS runners;
   - creates a **draft** GitHub Release. It has every file plus `SHA256SUMS.txt`; its description is that version's CHANGELOG section followed by `.github/release-footer.md` (the downloads table and install notes). A version with a `-` suffix (e.g. `1.0.0-beta.1`) becomes a pre-release.

   Undo before pushing: `git tag -d vX.Y.Z && git reset --hard HEAD~1`.

4. When the run finishes (about 10–15 minutes), open the draft under **Releases**, try the installer, edit the description if you like, then click **Publish release**. Nothing is public until then.

Running the Release workflow by hand (Actions → Release → Run workflow):

- **On a branch:** builds only; download the files from the run's Artifacts (kept 7 days). Use it to test a build without releasing.
- **On a tag** ("Use workflow from" → Tags → `vX.Y.Z`): builds and drafts that tag's release. Use it when the tag push didn't trigger the workflow (this happened for v0.2.0, whose tag was pushed together with the commit that first added the workflow).
- Re-running it for a tag whose release already exists replaces the files and description instead of failing.

Release artifacts (names come from `artifactName` in `package.json` → `build`):

| File                                            | What it is                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `MeloDesk-Setup-X.Y.Z.exe`                      | Windows NSIS installer (choose install dir, Start menu entry, uninstaller) |
| `MeloDesk-X.Y.Z-portable.exe`                   | Windows portable single file (self-extracts to temp on each launch)        |
| `MeloDesk-X.Y.Z-win-x64.zip`                    | Windows portable folder (unzip, run `melodesk.exe`)                        |
| `MeloDesk-X.Y.Z-x86_64.AppImage`                | Linux                                                                      |
| `MeloDesk-X.Y.Z-mac-arm64.dmg` / `-mac-x64.dmg` | macOS, Apple Silicon / Intel                                               |
| `SHA256SUMS.txt`                                | Checksums of all the files above (written by the release workflow)         |

None of the builds are code-signed: Windows SmartScreen and macOS Gatekeeper warn on first launch (the release footer explains the workaround). If you rename artifacts or add a platform, update `.github/release-footer.md` too.

### CI (`.github/workflows/ci.yml`)

Runs on every push to `master` and on PRs to `master`:

- **check** (Ubuntu): `npm ci`, `npm run check`, plus `changelog.mjs verify <before> <after>`, which fails if the pushed range has `[feat]`/`[fix]` commits but no `CHANGELOG.md` change.
- **build** (Windows + Linux, after check): `npm run build:win` / `build:linux`. The files are uploaded as workflow artifacts for 7 days, which is handy for testing a commit without releasing.

macOS is only built by the release workflow, to save runner minutes.

---

## 5. Platform support

Development and testing happen on **Windows**. Releases ship Windows, Linux (AppImage) and macOS (dmg) builds produced on GitHub runners (§4 → Releasing). The code is written to be cross-platform. All runtime dependencies are pure JS (no native modules), paths are normalized before hashing or building URLs, and Cmd is treated as Ctrl in shortcuts. So cloning and running `npm start` should work on macOS and Linux, but neither has been tested.

Build installers on the target OS: `.dmg` can only be built on macOS, and unsigned macOS builds trigger Gatekeeper warnings. On Linux, electron-builder's default AppImage target needs nothing extra.

Known platform gaps (not yet fixed):

| Platform              | Issue                                                                                                                                                                                                                                                                                  | Where                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| macOS                 | The release workflow builds unsigned x64 + arm64 dmgs (icon converted from the 512×512 `assets/icon.png`), but they haven't been tested on a real Mac. Gatekeeper may report the app as damaged until the user runs `xattr -cr`.                                                       | `package.json`, `release.yml` |
| macOS                 | After the window closes the app keeps running (normal on macOS), but there is no `activate` handler to reopen the window; the user must Cmd+Q. Window/mini-mode IPC handlers are registered inside `createWindow()`, so creating a second window would throw duplicate-handler errors. | `src/main.ts`                 |
| macOS                 | No native traffic-light buttons (frameless window); the custom `TitleBar` buttons are used instead.                                                                                                                                                                                    | `TitleBar.tsx`                |
| macOS / Linux         | The font stack starts with Windows-only "Segoe UI", so other systems fall back to Tahoma / Verdana / sans-serif.                                                                                                                                                                       | `App.tsx`                     |
| Linux (Wayland)       | Wayland doesn't let apps position windows, so mini-player JS dragging, window-position restore and possibly always-on-top may not work. X11 is fine.                                                                                                                                   | `main.ts`, `MiniPlayer.tsx`   |
| Linux (Ubuntu 23.10+) | Unpackaged `electron .` can fail with an Electron "SUID sandbox helper" error caused by AppArmor. Packaged builds usually avoid it; `--no-sandbox` works around it for local dev only.                                                                                                 | —                             |

---

## 6. Architecture

```
┌──────────────────────── Renderer (React, sandboxed) ────────────────────────┐
│ App.tsx  ── global state, page routing, nav history, theme, session restore  │
│   ├─ hooks/  (audio, queue, playback controller, library, tracker, EQ, keys) │
│   └─ components/  (pages + widgets, presentation only)                        │
│                     │ window.api.* (Promise-based)   ▲ events               │
└─────────────────────┼────────────────────────────────┼──────────────────────┘
                 preload.ts  (contextBridge → ipcRenderer.invoke / .on)
┌─────────────────────┼────────────────────────────────┼──────────────────────┐
│ Main process        ▼ ipcMain.handle                  │ webContents.send    │
│ main.ts ── window creation, window-control + mini-mode IPC, bounds persist  │
│ main/ipc/*Handlers.ts ── thin handlers, one file per domain                  │
│ main/services/* ── config, cache, session, tracker, metadata, library scan   │
│ main/protocols/mediaProtocol.ts ── media:// file streaming (range requests)  │
└─────────────────────────────────────────────────────────────────────────────┘
                 userData/  (JSON files on disk, see §7)
```

### Startup sequence

1. `main.ts` registers the `media://` scheme as privileged with `stream` and `corsEnabled`. CORS is required; without it the Web Audio EQ graph outputs silence.
2. **Single instance:** `app.requestSingleInstanceLock()`. A second launch on the same profile quits at once; the running app gets `second-instance` and restores and focuses its window. Two processes would otherwise overwrite each other's JSON files.
3. `app.whenReady` → `registerIpcHandlers()` → `setupWatcher()` → `updateLibrary()` (background rescan) → `registerMediaProtocol()` → `createWindow()`.
4. The renderer's `App.tsx` `init()`: `getConfig()` → `getLibraryFiles()` (served instantly from the cache) → if `config.restoreSession`, rebuild the queue and current track from `getSession()` (paths mapped back to `FileItem`s).
5. When the background scan finishes, main broadcasts `library-updated` with the full file list, and `useLibrary` updates `allTracks`.

### Library pipeline

**Library folders never overlap.** Folders are added only through `add-library-folders` (`libraryHandlers.ts`), which enforces:

- a folder that is, or is inside, a library folder is refused with a toast;
- a folder that contains library folders replaces them only if the user confirms a native dialog, otherwise it isn't added.

Path checks use `libraryPaths.ts`: whole path segments, case-insensitive on Windows, so `D:\Music\A` never matches `D:\Music\AB`. As a safety net for older configs, `updateLibrary` scans only `outermostFolders(libraryPaths)`, so no file is found twice.

`libraryUpdater.updateLibrary()` is the only entry point for a scan. It's called:

- at startup (`main.ts`);
- by `refresh-library`;
- by `update-config` when `libraryPaths` changes (after restarting the watcher);
- by `libraryWatcher` (chokidar) after 2 s of filesystem silence;
- by `get-library-files` when the cache is empty or stale, but only if no scan is running.

**Only one scan runs at a time.** Each call aborts the previous run through its `AbortController`; an aborted run exits without saving or broadcasting.

`libraryScanner.scanLibrary(dirs, { signal, previous, onProgress })` works in two phases:

1. **Discovering:** lists every media file (`isMediaFile()`) under the configured folders.
2. **Reading:** for each file, `stat`s it. If its `mtime` and size match the entry in `previous`, that entry is **reused**. Otherwise the file's tags are parsed with `music-metadata` and its cover art saved to `userData/art_cache/`.

`previous` is the updater's in-memory `known` map: the cache plus every file parsed since the last save. A cancelled run's work is therefore reused by the next run. On success, `saveCache()` assigns hashes and writes the cache, then `library-updated` is broadcast with the full list.

Progress is throttled to about every 150 ms and sent as `library-scan-status` (`LibraryScanStatus`); `get-library-scan-status` returns the current value, since the startup scan begins before the window exists. The renderer reads it with `useLibraryScanStatus`, and `TitleBar/ScanIndicator` shows it.

The Library tab's folder view (`get-directory-tree` → `getDirectoryTree`) lists the folder with `readdir` and takes song details **from the cache**; it never parses tags.

The whole library is sent to the renderer in one message after each scan. That's fine for typical libraries; keep it in mind for very large ones.

### Playback pipeline (renderer)

- A single `<audio>` element lives at the bottom of `App.tsx`. Its `src` is `media://<encodeURIComponent(path with forward slashes)>`.
- `useAudioPlayer` owns play/pause, duration, seek and volume.
  - **Volume:** `previewVolume` while the slider moves (sets the element only), then `commitVolume` on release (pointer-up / key-up), which writes config once.
  - **Playback position is deliberately not app state.** `useAudioTime(audioRef)` subscribes to the element and is used only by `PlaybackBar`, so `App` doesn't re-render about 4 times a second during playback. Never add per-`timeupdate` state to `App` or the playback hooks; read `audioRef.current.currentTime` when you need the position once.
- `useQueue` owns `queue`, `shuffledQueue`, `currentIndex`, `isShuffle` and `repeatMode`. `activeQueue` is whichever list is in use.
- `usePlaybackController` coordinates the two: `playTrack`, next/prev, `handleEnded` (repeat logic), play-next / play-next-multiple, remove-from-queue, shuffle-play, and drag-and-drop of files onto the window.
  - **`playTrack(track, list)`** makes `list` the queue. Without shuffle it plays `track` at its position. With shuffle, `track` plays **first** and the rest of the list follows in random order.
  - **Start playback with `startPlayback()`** (in `useAudioPlayer`), never with a bare `audio.play()`. It handles the rejected promise (`AbortError` when a newer src interrupts) so the UI never says "playing" when nothing plays.
  - **Missing or broken files are skipped, not removed:**
    - `handleAudioPlay` (the `<audio onPlay>`) checks via `file-exists` that the loaded file still exists. If a file vanished after loading, Chromium retries the request forever and never fires `error`, so the controller stops the element itself.
    - `handleAudioError` (`<audio onError>`) catches files that fail to load: missing, or damaged/unsupported.
    - Both go to `handleUnplayable`. It shows a "Skipped …" toast, rescans the library for missing files and calls `handleNext`. The song stays in the queue.
    - `skippedInARowRef` (reset by `<audio onPlaying>`) stops the skipping with a message once every queued song has failed.
    - If nothing was meant to be playing (e.g. the restored session's song is gone), it only shows the toast.
  - **Queue duplicates:** a song can be queued more than once, so queue operations are **index-based**. The Queue page plays `playTrack(track, undefined, index)`. `removeFromQueue` removes the same _occurrence_ from the other list (original or shuffled), not the first path match.
  - **Play counts:** `usePlayTracker` resets on path change, on a seek back to the start, and on the element's `loadstart` (the same song loaded again counts again).
  - **Session position:** `usePlaybackPositionSaver` saves `position` into the session every 10 s while playing, on pause and on close (fire-and-forget `save-playback-position`). The session-save effect resets it to 0 when the song changes. `init()` restores it once the restored song's metadata loads.
- **Playback vs. details page:** `currentTrack` is what's playing. `detailsTrack` (in `App.tsx`) is what the Song Details page shows. Opening details never touches `currentTrack`.
- **Library updates and tag edits** swap the queue's song objects for fresh ones by path (the `allTracks` effect and `handleTrackUpdated` in `App.tsx`). Songs no longer in the library stay in the queue until played or removed.

### Notifications (toasts)

`useToasts` (in `App.tsx`) owns the toast list; `components/Toasts` renders it bottom-right, above the playback bar. Levels are `info`, `success` and `error` (shown 5 s, 4 s and 9 s).

- **From the renderer:** `showToast({ level, message })`, passed down as needed (`usePlaybackController` gets it as `notify`).
- **From the main process:** `notify(level, message)` from `main/services/notifyService.ts`. It sends `notification` to every window, and `useToasts` subscribes through `window.api.onNotification`. Notifications raised before the renderer is listening (e.g. a damaged file found at startup) are queued and fetched once with `take-pending-notifications`.

Current senders:

- the library watcher ("Changes found in your library folders…");
- playlist recovery;
- missing or unplayable songs;
- session restore (songs that left the library).

Write messages for users: say what happened and what the app is doing about it.

- `useEqualizer` builds the Web Audio graph **once per element**: source → 10 peaking biquads → destination. A WeakMap guards it because `createMediaElementSource` throws if called twice. When the EQ is disabled, every band ramps to 0 dB; the graph is never torn down.
- `usePlayTracker` counts only time actually _listened_ (seeks don't count) and calls `recordPlay(hash)` once `playCountThresholdPercent` is reached.
- `useKeyboardControls` maps `config.keybindings` plus the built-in media keys to actions. Unmodified keys are ignored while the user is typing in an input. Mouse button 3 triggers "back".

### Routing & navigation (renderer)

There is **no router library**. `App.tsx` holds `view: Page` and `activeTab` and renders the page through an `if (view === …)` chain inside `<main>`. Back navigation uses a `NavSnapshot` stack (`pushNav()` / `handleGoBack()`, capped by `config.navigationHistorySize`), which also restores scroll position through `onScrollRef`. **Call `pushNav()` before every navigation that should be undoable.**

**Every sub-page lives in `App` state and in `NavSnapshot`,** so Back (button, Esc, mouse back) returns from it. That covers the open group, open playlist, open library folder (`selectedLibraryPath`) and Home's "Show all" page (`homeDetail`). A component never keeps its own "which page am I on" state: it gets `open…`/`close…` callbacks, where open means `pushNav()` + set and close means `handleGoBack`. Its scroll container passes `onScrollRef`. `handleGoBack` without history steps out of the current sub-page.

### Context menus

Menus are native Electron menus. The renderer calls `window.api.showSongContextMenu(song)` / `showGroupContextMenu(name)`. `menuHandlers.ts` builds the menu and resolves the Promise with a typed action (`ContextMenuAction` / `GroupContextMenuAction`), or `null` if the user dismissed it. `App.tsx` (`showContextMenu`, `showGroupContextMenu`) carries out the action.

### Theming

- `theme/colors.ts`: `DEFAULT_PALETTE` (role → color), `COLOR_KEYS`, `colors` (each role mapped to the string `"var(--role)"`), accent presets, and the Settings UI metadata (`colorGroups`, `CORE_KEYS`). **Components use `colors.x` (inline styles) or `var(--x)` (CSS Modules), never hex literals.**
- `theme/themes.ts`: built-in palettes (Dark, Light, Midnight, Dracula, Nord, Ocean, Ember, Forest, Graphite) and `getTheme()`.
- `theme/applyTheme.ts`: `applyPalette()` writes `{...theme.palette, ...config.appearance.colors}` and `--theme-color` to `:root`. `App.tsx` calls it whenever the config changes.
- The **accent** (`config.themeColor`) is passed down as a **real hex string prop** (`themeColor`), because components do alpha math with it, e.g. `${themeColor}22`.

### Mini-player

`App.tsx` `isMini` swaps the whole UI for `<MiniPlayer>` and calls `enterMiniMode` / `exitMiniMode`. `main.ts` resizes the same window, makes it always-on-top, and saves separate bounds for normal and mini mode. Dragging is done in JS: `getWindowBounds` + `setWindowPosition`, which calls `setBounds` with a fixed size to avoid DPI drift. Don't switch it to `-webkit-app-region: drag`, which suppresses the hover events the mini-player needs. (The main `TitleBar` does use `WebkitAppRegion: "drag"`.)

---

## 7. Data

### Key types (`src/renderer/types.d.ts`)

This file is the **shared contract**; the main process imports it too.

- `UserConfig`: every user setting. Defaults are in `main/services/configService.ts` → `DEFAULT_CONFIG`.
- `FileItem`: a file or folder node. Songs carry `isMedia`, `hash` and `metadata` (title, artists[], album, genre[], duration, picture path, year, trackNumber, bitrate, bpm, lyrics …).
- `Playlist`, `ArtistInfo`, `SessionData`, `WindowBounds`, `PlayRecord`, `Appearance`.
- `ContextMenuAction`, `GroupContextMenuAction`.
- `declare global { interface Window { api: {...} } }`: **the typed surface of every IPC call.**

Shared non-UI code imported by both processes lives in `src/utils/` (`configService` imports `keybindings.ts`, for example). `src/types/queue.ts` holds `RepeatMode`.

Songs are identified in two ways:

- by **`hash`**, which the library cache and the play tracker key on;
- by **`path`**, which playlists, the session and the queue store as absolute file paths.

Both are derived from the file location, so **moving or renaming a file drops it from playlists and resets its play count.**

### Persistence (`app.getPath("userData")`)

The folder is named after `package.json` → `name` (`melodesk`), in both dev and packaged builds:

- Windows: `%APPDATA%\melodesk` (e.g. `C:\Users\<user>\AppData\Roaming\melodesk`);
- macOS: `~/Library/Application Support/melodesk`;
- Linux: `~/.config/melodesk`.

To test against a throwaway profile without touching the real one, launch with `electron . --user-data-dir=<some folder>`.

| File / dir                                                      | Owner                                       | Contents                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `config.json`                                                   | `services/configService.ts`                 | `UserConfig`. `getConfig()` shallow-merges over `DEFAULT_CONFIG`; `appearance` and `keybindings` are deep-merged |
| `library_cache.json`                                            | `services/cacheService.ts`                  | `{ [hash]: FileItem }` (migrates the legacy array format)                                                        |
| `session.json`                                                  | `services/sessionService.ts`                | Queue / shuffle / repeat / current track path and playback `position`, plus normal and mini window bounds        |
| `tracker/play_counts.json`, `tracker/play_history/YYYY-MM.json` | `services/trackerService.ts`                | Play counts by hash; monthly play logs                                                                           |
| `playlists/<id>.json`                                           | `ipc/playlistHandlers.ts`                   | One file per playlist                                                                                            |
| `artists/<md5(name)>.json`                                      | `ipc/artistHandlers.ts`                     | Artist bio + picture                                                                                             |
| `art_cache/`                                                    | `metadataService.saveArt` / artist handlers | Extracted cover art and artist images                                                                            |

**All JSON persistence goes through `main/services/jsonStore.ts`.** Never `fs.writeFileSync` a data file directly.

- `writeJson(file, data, { pretty?, backup? })`:
  1. writes `<file>.tmp` and fsyncs it;
  2. copies the current file to `<file>.bak` if it still parses (skipped with `backup: false`, used for the rebuildable cache);
  3. renames the temp file over the original, retrying briefly on Windows `EPERM`/`EBUSY`.

  A crash leaves the old file or the new one, never half of one.

- `readJson(file, fallback, { label, notifyUser? })`: a file that doesn't parse is **never overwritten with defaults**. It's moved to `<file>.corrupt` (`setAside`), restored from `<file>.bak` when possible (and re-saved), and the user gets a toast naming `label` ("settings", "play counts", …). Without a usable backup it returns `fallback` and says so.
- **Playlists** use `writeJson` too. Their loader (`loadPlaylistFile`) also tries `.bak` first, then salvages songs from the damaged text.
- Files ending in `.tmp`, `.bak` or `.corrupt` are never loaded as data: playlist listing only reads `*.json`.

---

## 8. File structure

```text
assets/                              # icon.ico (Windows), icon.png (512×512, macOS/Linux/window icon); copied to dist/assets
.todo                                # Backlog (issues + feature ideas)
CHANGELOG.md                         # Keep a Changelog: Unreleased + released versions; source of release notes
package.json                         # Scripts (§4), deps, electron-builder config under "build"
.github/
├── release-footer.md                # Downloads table + unsigned-build notes appended to every release description
└── workflows/
    ├── ci.yml                       # Push/PR to master: check (typecheck, format, changelog) + Windows/Linux builds
    └── release.yml                  # Tag vX.Y.Z (or manual run): check → build win/linux/mac → draft GitHub Release
scripts/                             # Node ESM, no dependencies
├── changelog.mjs                    # CHANGELOG parse/serialize; CLI: `notes <version>`, `verify [<base> <head>]`
└── release.mjs                      # `npm run release` — version bump, changelog finalize, [release] commit, tag
tsconfig.json / vite.config.ts       # Main+preload compile (tsc → dist/) / renderer bundle (vite → dist/renderer/)
.prettierrc.json / .prettierignore   # Formatting rules (enforced by `npm run check`)
.editorconfig / .gitattributes       # Editor defaults / LF line endings for all text files
.nvmrc                               # Pinned Node version
src/
├── main.ts                          # Electron entry — frameless BrowserWindow; registers IPC + protocol + watcher;
│                                    #   window-control + mini-player-mode IPC; persists/restores window bounds (session)
├── preload.ts                       # Exposes window.api to renderer via contextBridge (library, config, playlists,
│                                    #   metadata, artists, shell, session, tracker, window controls, mini-mode)
│
├── hooks/                           # React hooks (state + lifecycle only, no UI)
│   ├── useAudioPlayer.ts            # HTML5 audio element state (play/pause, seek, duration, volume preview/commit)
│   ├── useAudioTime.ts              # Playback position from the <audio> element (used only by PlaybackBar)
│   ├── usePlaybackPosition.ts       # usePlaybackPositionSaver: saves the position into the session for restore
│   ├── useArtistPictures.ts         # All custom artist pictures in one IPC call (+ local update after edits)
│   ├── useQueue.ts                  # Playback queue state, shuffle, repeat mode, current index
│   ├── usePlaybackController.ts     # Coordinates audio + queue; next/prev, end-of-track, queue mutations, file drop
│   ├── useEqualizer.ts              # Web Audio 10-band EQ graph on the <audio> element; applies config gains
│   ├── useKeyboardControls.ts       # Global key/mouse-back handler driven by config.keybindings
│   ├── useLibrary.ts                # Subscribes to library-updated events; loads directory trees
│   ├── useLibraryScanStatus.ts      # Live LibraryScanStatus (initial fetch + library-scan-status events)
│   ├── useToasts.ts                 # Toast list: showToast/dismissToast + main-process "notification" events
│   └── usePlayTracker.ts            # Records a play (window.api.recordPlay) once a configurable % is actually listened to
│
├── types/
│   └── queue.ts                     # RepeatMode type ("none" | "all" | "one")
│
├── utils/                           # Pure helpers, shared by renderer and (some) main
│   ├── array.ts                     # shuffleArray() — Fisher-Yates
│   ├── equalizer.ts                 # EQ_FREQUENCIES, gain limits, EQ_PRESETS, normalizeBands(), formatFrequency()
│   ├── keybindings.ts               # Keybinding types, DEFAULT_KEYBINDINGS, BUILTIN_KEYBINDINGS (media keys),
│   │                                #   KEYBOARD_ACTIONS (settings labels/order), matchesKeybinding(), formatKeybinding()
│   ├── metadata.ts                  # normalizeGenre(), formatArtists()
│   └── time.ts                      # formatDuration() — seconds → MM:SS
│
├── renderer/                        # React frontend
│   ├── main.tsx                     # Mounts <App /> to #root
│   ├── index.html                   # HTML entry point
│   ├── App.tsx                      # Root component — global state, page routing, nav history, hooks wiring,
│   │                                #   context-menu actions, theme application, session restore/save, mini-player toggle
│   ├── types.d.ts                   # Shared interfaces (UserConfig, FileItem, Playlist, SessionData, …); declares window.api
│   ├── css-modules.d.ts             # CSS Modules type shim
│   │
│   ├── theme/                       # Runtime theming (CSS custom properties on :root)
│   │   ├── colors.ts                # DEFAULT_PALETTE + color-role keys; `colors` (var(--x) refs); accent presets;
│   │   │                            #   Settings UI metadata (colorGroups, CORE_KEYS); buildRootCss()
│   │   ├── themes.ts                # Built-in themes (Dark, Light, Midnight, Dracula, Nord, Ocean, Ember, Forest, Graphite)
│   │   └── applyTheme.ts            # applyPalette() — writes resolved palette + accent to :root style
│   │
│   └── components/
│       ├── Navbar/
│       │   ├── Navbar.tsx           # Tab bar + back button + queue/settings buttons; hosts GlobalSearch
│       │   ├── navConfig.ts         # Tab config array (Home, Library, Artists, Albums, Genres, Playlists)
│       │   ├── types.ts             # Page and NavTab types (Page is duplicated in App.tsx — keep in sync)
│       │   └── Navbar.module.css
│       │
│       ├── Toasts/
│       │   ├── Toasts.tsx           # Renders the toast list (info / success / error) bottom-right
│       │   └── Toasts.module.css
│       │
│       ├── TitleBar/
│       │   ├── TitleBar.tsx         # Custom frameless window chrome — title, scan indicator, mini-player/min/max/close
│       │   ├── ScanIndicator.tsx    # "Scanning library… n / total" pill while a library scan runs; click → Library
│       │   └── ScanIndicator.module.css
│       │
│       ├── MiniPlayer/
│       │   └── MiniPlayer.tsx       # Floating always-on-top mini widget — cover art + transport controls; JS window dragging
│       │
│       ├── GlobalSearch/
│       │   ├── GlobalSearch.tsx     # Library-wide search dropdown — songs/albums/artists/playlists with navigation
│       │   └── GlobalSearch.module.css
│       │
│       ├── HomeView/
│       │   ├── HomeView.tsx         # Home page — recently played, most played, popular artists, never played, library stats
│       │   └── HomeView.module.css
│       │
│       ├── LibraryView.tsx          # Switches between folder list and directory tree
│       ├── LibraryFoldersView.tsx   # Shows library paths with Add/Remove/Refresh
│       ├── LibraryFolderView.tsx    # Directory tree for a selected library path
│       ├── DirectoryTree.tsx        # Recursive folder/file tree with expand/collapse and sorting
│       │
│       ├── GroupedView/
│       │   ├── GroupedView.tsx      # Container for Artists/Albums/Genres views; search + sort; artist header (bio/picture)
│       │   ├── GroupList.tsx        # Grid of group cards
│       │   ├── SongGrid.tsx         # Grid of song cards filtered to selected group
│       │   ├── GroupCard.tsx        # Card: group name, count, picture; right-click group context menu
│       │   ├── SongCard.tsx         # Card: song artwork, title, artist
│       │   ├── GroupedViewHeader.tsx # Empty placeholder file (header lives inside GroupedView.tsx)
│       │   ├── groupedView.utils.ts # getFilteredSongs(), getGroupEntries()
│       │   ├── types.ts             # GroupType, GroupSortBy, SelectedGroup
│       │   └── GroupedView.module.css
│       │
│       ├── PlaybackBar.tsx          # Bottom control bar — track info, play controls, progress, volume, repeat/shuffle, lyrics/queue
│       │
│       ├── Queue/
│       │   ├── QueueView.tsx        # Full queue list with header and clear button
│       │   ├── QueueItem.tsx        # Single queue row — number, title, artist, duration, remove button
│       │   └── QueueHeader.tsx      # Queue stats (count, total duration) and controls
│       │
│       ├── PlaylistView.tsx         # Playlist page — create, view, edit, add/remove songs, drag-reorder, sort
│       ├── SongDetailsView.tsx      # Full-screen detail — metadata, editable tags (MP3), album art, lyrics, add-to-playlist
│       └── SettingsView.tsx         # Settings page — sections: Appearance, Playback, Equalizer, Startup, Home,
│                                    #   Library & Browsing, Keyboard Shortcuts, Library Folders
│
└── main/                            # Electron main process
    ├── ipc/
    │   ├── index.ts                 # Registers all IPC handler modules
    │   ├── libraryHandlers.ts       # get-library-files, get-library-scan-status, get-directory-tree,
    │   │                            #   select-directories (multi-select picker), add-library-folders
    │   │                            #   (no-overlap rules + replace dialog), refresh-library, file-exists
    │   │                            #   (events: library-scan-status, library-updated)
    │   ├── configHandlers.ts        # get-config, update-config (re-inits watcher when libraryPaths change)
    │   ├── metadataHandlers.ts      # get-metadata (incl. hash), write-metadata (node-id3 tag writing)
    │   ├── playlistHandlers.ts      # get-playlists, get-playlist, create-playlist, update-playlist, delete-playlist,
    │   │                            #   add-songs-to-playlist (duplicate dialog), remove-playlist-duplicates (confirm);
    │   │                            #   broadcasts playlists-changed; loadPlaylistFile() repairs damaged files
    │   ├── artistHandlers.ts        # get-artist-info, get-artist-pictures (all, by name), update-artist-info,
    │   │                            #   select-artist-image
    │   ├── menuHandlers.ts          # show-song-context-menu + show-group-context-menu
    │   ├── shellHandlers.ts         # show-file-in-folder, open-external-url
    │   ├── sessionHandlers.ts       # get-session, save-session, clear-session, save-playback-position (send)
    │   └── trackerHandlers.ts       # record-play, get-play-counts, get-recent-plays
    │                                # (window-*, get-window-bounds, set-window-position, enter/exit-mini-mode live in main.ts)
    │
    ├── protocols/
    │   └── mediaProtocol.ts         # media:// protocol — streams audio/images, range requests, CORS header, MIME types
    │
    └── services/
        ├── configService.ts         # Loads/saves userData/config.json; DEFAULT_CONFIG schema lives here
        ├── notifyService.ts         # notify(level, message) — toast in every window; queues early ones
        ├── jsonStore.ts             # readJson/writeJson: atomic writes, .bak backups, .corrupt + restore
        ├── cacheService.ts          # userData/library_cache.json — hash-keyed FileItem map (migrates legacy array format)
        ├── metadataService.ts       # Tag extraction helpers (artists splitting, extractMetadata); saves album art
        ├── hashUtil.ts              # hashPath() — stable sha1 song id derived from the (normalized) file path
        ├── sessionService.ts        # userData/session.json — playback state + window/mini-window bounds
        ├── trackerService.ts        # userData/tracker/ — play_counts.json + monthly play_history
        │
        └── library/
            ├── libraryScanner.ts    # scanLibrary() (cancellable, reuses unchanged files); getDirectoryTree() from cache
            ├── libraryUpdater.ts    # updateLibrary(): one scan at a time (aborts the previous), scan status, saves cache
            ├── libraryWatcher.ts    # Chokidar watcher on library paths (audio files + folders only); debounced
            │                        #   (2s) → notifies the user with a summary, then runs updateLibrary()
            ├── libraryPaths.ts      # isSamePath / isSameOrInside (segment-aware, case-insensitive on Windows),
            │                        #   outermostFolders() — library folders never overlap
            └── mediaUtils.ts        # isMediaFile() — supported extensions
```

---

## 9. Where to look — by feature area

Paths are relative to `src/`.

| Request is about…                                     | Start here                                                                                     | Also likely touches                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Play / pause / seek / volume**                      | `hooks/useAudioPlayer.ts`                                                                      | `components/PlaybackBar.tsx`, `MiniPlayer/MiniPlayer.tsx`                                                                                   |
| **Next / prev, repeat, shuffle, end-of-track**        | `hooks/usePlaybackController.ts`, `hooks/useQueue.ts`                                          | `PlaybackBar.tsx`, `types/queue.ts`                                                                                                         |
| **Queue page** (reorder, remove, clear)               | `components/Queue/QueueView.tsx`, `QueueItem.tsx`, `QueueHeader.tsx`                           | `usePlaybackController.ts` (`handleRemoveFromQueue`), `App.tsx` (`onClearQueue`)                                                            |
| **Equalizer**                                         | `hooks/useEqualizer.ts`, `utils/equalizer.ts` (bands, presets)                                 | `SettingsView.tsx` "Equalizer" section, `UserConfig.equalizer*`                                                                             |
| **Keyboard shortcuts**                                | `utils/keybindings.ts` (action ids, defaults, labels)                                          | `hooks/useKeyboardControls.ts` (action → handler map), `App.tsx` (passes handlers), `SettingsView.tsx` "Keyboard Shortcuts"                 |
| **Play counts / stats / Home page**                   | `components/HomeView/HomeView.tsx`                                                             | `hooks/usePlayTracker.ts`, `main/services/trackerService.ts`, `ipc/trackerHandlers.ts`                                                      |
| **Library scanning, supported formats, watcher**      | `main/services/library/*`                                                                      | `mediaUtils.ts` (extensions), `protocols/mediaProtocol.ts` (MIME types; add new formats in **both**)                                        |
| **Library scan progress / cancellation**              | `main/services/library/libraryUpdater.ts`, `libraryScanner.ts`                                 | `hooks/useLibraryScanStatus.ts`, `components/TitleBar/ScanIndicator.tsx`, `LibraryScanStatus` in `types.d.ts`                               |
| **Messages to the user (toasts)**                     | `hooks/useToasts.ts`, `components/Toasts/Toasts.tsx`                                           | `main/services/notifyService.ts` (from main), `AppNotification` in `types.d.ts`                                                             |
| **Missing / unplayable files**                        | `usePlaybackController.ts` (`handleAudioPlay`, `handleAudioError`)                             | `useAudioPlayer.startPlayback`, `file-exists` in `libraryHandlers.ts`                                                                       |
| **Start page** (empty library → Library tab)          | `App.tsx` `init()`                                                                             | —                                                                                                                                           |
| **Library page / folder tree**                        | `LibraryView.tsx` → `LibraryFoldersView.tsx` / `LibraryFolderView.tsx` → `DirectoryTree.tsx`   | `ipc/libraryHandlers.ts` (`get-directory-tree`, `select-directories`)                                                                       |
| **Artists / Albums / Genres pages**                   | `components/GroupedView/GroupedView.tsx`                                                       | `groupedView.utils.ts` (grouping/filter/sort, `minSongsForAlbum`), `GroupList` / `GroupCard` / `SongGrid` / `SongCard`, `utils/metadata.ts` |
| **Artist bio / picture**                              | `ipc/artistHandlers.ts`                                                                        | `GroupedView.tsx` (artist header)                                                                                                           |
| **Artist splitting** ("A feat. B", "A & B")           | `main/services/metadataService.ts` (`splitArtists`, `getArtists`)                              | `utils/metadata.ts` (`formatArtists`)                                                                                                       |
| **Playlists**                                         | `components/PlaylistView.tsx` (one large file: list, detail, editing, drag-reorder, sort)      | `ipc/playlistHandlers.ts`                                                                                                                   |
| **Song details, tag editing, lyrics, cover art**      | `components/SongDetailsView.tsx`                                                               | `ipc/metadataHandlers.ts` (`get-metadata`, `write-metadata` via node-id3, **MP3/ID3 only**), `metadataService.ts`                           |
| **Global search**                                     | `components/GlobalSearch/GlobalSearch.tsx` (rendered inside Navbar)                            | `App.tsx` `handleGlobalSearchNavigate`, `config.searchResultsPerCategory`                                                                   |
| **Navbar / tabs / back button**                       | `Navbar/Navbar.tsx`, `Navbar/navConfig.ts`, `Navbar/types.ts`                                  | `App.tsx` `handleTabChange`, `pushNav`, `handleGoBack`                                                                                      |
| **Right-click menus**                                 | `main/ipc/menuHandlers.ts`                                                                     | `types.d.ts` action unions, `App.tsx` `showContextMenu` / `showGroupContextMenu`                                                            |
| **Settings page**                                     | `components/SettingsView.tsx` (`<Section title=…>` blocks; `update(partial)` → `updateConfig`) | `UserConfig`, `DEFAULT_CONFIG`                                                                                                              |
| **Theme, colors, accent**                             | `theme/colors.ts`, `theme/themes.ts`, `theme/applyTheme.ts`                                    | `SettingsView.tsx` "Appearance", `App.tsx` theme effect                                                                                     |
| **Window chrome, min/max/close**                      | `components/TitleBar/TitleBar.tsx`                                                             | `main.ts` window IPC                                                                                                                        |
| **Mini-player**                                       | `components/MiniPlayer/MiniPlayer.tsx`                                                         | `main.ts` (`enter-/exit-mini-mode`, bounds), `App.tsx` `isMini`                                                                             |
| **Session restore / window size memory**              | `main/services/sessionService.ts`                                                              | `App.tsx` `init()` + session-save effect, `main.ts` `sanitizeBounds` / `flushBounds`                                                        |
| **Opening files in Explorer / external links**        | `ipc/shellHandlers.ts`                                                                         | —                                                                                                                                           |
| **Audio streaming problems** (seeking, CORS, silence) | `protocols/mediaProtocol.ts`                                                                   | `main.ts` `registerSchemesAsPrivileged`, `<audio crossOrigin="anonymous">` in `App.tsx`                                                     |
| **App lifecycle, platform behavior**                  | `src/main.ts`                                                                                  | §5 Platform support                                                                                                                         |
| **Packaging, icons, version**                         | `package.json` → `build`, `version` (needs approval)                                           | `assets/`, §4 Versioning                                                                                                                    |
| **Release, CI, changelog**                            | `scripts/release.mjs`, `scripts/changelog.mjs`, `.github/workflows/*.yml`                      | `CHANGELOG.md`, `package.json` scripts + `build.*.artifactName`, §4 Releasing                                                               |

---

## 10. Recipes

### Add a new IPC call (most features need one)

1. **Backend:** put the logic in a service under `main/services/`, or in the handler file if the domain already works that way (as playlists and artists do). Register `ipcMain.handle("kebab-case-name", …)` in the matching `main/ipc/<domain>Handlers.ts`. For a new domain, create `<domain>Handlers.ts` exporting `register<Domain>Handlers()` and call it from `main/ipc/index.ts`.
2. **Preload:** add a camelCase method to `src/preload.ts` → `ipcRenderer.invoke("kebab-case-name", …)`. For main→renderer events, copy the `onLibraryUpdated` pattern, which returns an unsubscribe function.
3. **Types:** add the signature to `Window.api` in `renderer/types.d.ts`.
4. **UI:** call `window.api.x()` from a hook or from `App.tsx`. Keep components presentational and pass data and callbacks in as props.
5. **Docs:** add the channel to the file tree in §8.

### Add a new user setting

1. Add the field to `UserConfig` (`types.d.ts`).
2. Add its default to `DEFAULT_CONFIG` (`configService.ts`). If it's a nested object, deep-merge it in `getConfig()` like `appearance` / `keybindings` so older configs still load.
3. Add a control to the relevant `<Section>` in `SettingsView.tsx` and save it with the existing `update({...})` helper.
4. Read it wherever it's used through the `config` prop or state (`config?.field ?? default`).

### Add a new page

1. Add it to the `Page` union, which is **duplicated** in `App.tsx` and `Navbar/types.ts`. Update both, plus the `Exclude<…>` used for `activeTab` / `NavTab` if it isn't a tab.
2. For a navbar tab, add it to `Navbar/navConfig.ts`.
3. Add an `if (view === "…")` branch in `App.tsx`'s `<main>` and pass props and callbacks. Navigate with `pushNav(); setView(…)`.
4. Pass `onScrollRef={handleScrollRef}` from the scroll container so that "back" restores the scroll position.
5. Add it to Terminology (§3) and the file tree (§8).

### Add a context-menu action

Add a variant to `ContextMenuAction` / `GroupContextMenuAction` in `types.d.ts` → add the menu item in `menuHandlers.ts` → handle the action in `App.tsx`.

### Add a keyboard shortcut

Add the id to `KeyboardActionId`, plus entries in `DEFAULT_KEYBINDINGS` and `KEYBOARD_ACTIONS` (`utils/keybindings.ts`) → add `{ id, run }` and a param in `useKeyboardControls.ts` → pass the handler from `App.tsx`. The config deep-merge adds the default for existing users automatically.

### Add a color role or a theme

Add the role to `DEFAULT_PALETTE` (`colors.ts`), give it a value **in every theme** in `themes.ts`, and add it to `colorGroups` in `colors.ts` if it should be user-editable. For a new theme, add one entry to `THEMES` in `themes.ts`.

### Support a new audio format

Add the extension to `mediaUtils.ts` **and** its MIME type to `getMimeType` in `mediaProtocol.ts`.

### Persist a new kind of data

Add a service in `main/services/` that reads and writes a JSON file under `app.getPath("userData")` with `readJson` / `writeJson` from `jsonStore.ts` (give it a user-facing `label`), expose it through IPC, and add a row to the persistence table in §7.

---

## 11. Conventions & gotchas

- **ESM-only packages** (`chokidar`, `music-metadata`, `node-id3`) are loaded with `await eval('import("pkg")')` and cached in a module variable. The `eval` stops `tsc` (CommonJS output) from rewriting the import into `require`. Keep the pattern for any ESM-only dependency.
- **Styling:** most components use inline `style={{}}` objects with `colors.*`. Larger widgets (Navbar, GroupedView, GlobalSearch, HomeView) use `*.module.css`. Match the style of the file you're editing. Global base CSS (scrollbars, body) is injected in the first effect of `App.tsx`.
- **Formatting** is Prettier's job. Don't hand-align code; run `npm run format` before committing, and make sure `npm run check` passes.
- **State lives in `App.tsx`** and flows down as props; there is no context or store. Hooks return large objects that `App.tsx` destructures. Keep that shape, and don't introduce Redux, Context or a router without asking.
- `config` is `UserConfig | null` until loaded, so always guard it (`config?.x ?? fallback`). After `updateConfig`, call `setConfig(newConfig)` with the returned value.
- **Playing songs from lists:** every song list plays on **double-click** when `config.doubleClickToPlay` (default `true`), else on single click: `onClick={() => !doubleClickToPlay && play()}` plus `onDoubleClick={() => doubleClickToPlay && play()}`. Pass the visible list as the queue (`handleFileSelect(song, list)` / `playTrack(song, list)`). The **Queue** page is the one exception: a single click there plays.
- **Adding songs to a playlist always goes through `window.api.addSongsToPlaylist(id, paths)`**, never `updatePlaylist` with a hand-built list. The main process asks about duplicates (add anyway / skip / cancel) and reports the result with a toast. Playlist changes are broadcast as `playlists-changed`, so open playlist pages reload by themselves.
- **Artists:** use `artistsOf(song)` from `utils/metadata.ts` (never `metadata.artists` directly) for grouping and navigation. Songs without an artist tag belong to `UNKNOWN_ARTIST`, a special group listed last, without bio or picture editing. Album links are only offered for songs that have an album.
- **Forms that edit saved data** (e.g. the artist bio) must cancel and reset when the user navigates away or the subject changes, so a draft is never saved onto the wrong item.
- Some types are re-declared locally on the main side (`Playlist` in `playlistHandlers.ts`, `ArtistInfo` in `artistHandlers.ts`). If you change a shape, update those copies too.
- `media://` paths: convert backslashes to `/`, then `encodeURIComponent`. The protocol strips a leading `/` before a drive letter on Windows.
- `write-metadata` uses node-id3, so tag writing works for **MP3 only**; other formats fail and return `false`. `SongDetailsView` disables editing for non-MP3 files.
- Keep path handling cross-platform: use `path.join`, and normalize separators before hashing or comparing paths (see §5).
- Errors: main-process code logs with `console.error` and returns a safe fallback (`null`, `[]`, `false`). It doesn't throw across IPC.
- Backlog ideas live in `.todo` (synced lyrics, cover-art writing, picture-in-picture).
- A finished feature isn't done until its `CHANGELOG.md` entry is written (§2 → Changelog).
