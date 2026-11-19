<div align="center">

# 🎵 MeloDesk

**A fast, beautiful, offline music player for your local library.**

Point it at your music folders and enjoy your collection with a themeable interface, an equalizer, playlists, lyrics and more. No accounts, no streaming, no cloud.

[Download](https://github.com/Ramin-RX7/Melodesk/releases) · [Changelog](CHANGELOG.md) · [Report a bug](https://github.com/Ramin-RX7/Melodesk/issues)

<!-- Add a screenshot or GIF here, e.g.:
![MeloDesk screenshot](assets/screenshot.png)
-->

</div>

---

## Features

### 📚 Library
- Add one or several music folders; MeloDesk scans them in the background and reads tags and embedded cover art from **MP3, FLAC, M4A, OGG and WAV** files.
- Instant startup thanks to a cached library, with incremental rescans that only re-read new or changed files.
- Watches your folders and updates itself when songs are added, changed, moved or removed, and tells you what changed.
- Moving or renaming files doesn't lose play counts, history, playlist entries or queue positions.
- Warns you when a library folder goes missing (e.g. an unplugged drive) and again when it's back.
- Browse folders as a tree and play straight from it.
- Stays smooth with libraries of thousands of songs.

### 🔎 Browsing
- Home page with recently played, most played, popular artists, never-played songs and library statistics.
- Artists, Albums and Genres pages with search and sorting. Songs with several artists ("A feat. B", "A & B") appear under each of them.
- Artist pages with an editable bio and picture, plus an "Unknown Artist" page for untagged songs.
- Global search across songs, albums, artists and playlists.
- Back navigation (button, `Esc` or mouse back button) that remembers where you were, including scroll position.

### ▶️ Playback
- Play queue with play next, remove, clear, shuffle and repeat (all / one).
- Drag songs to reorder the queue, in normal or shuffle mode.
- Your session is restored on launch: queue, current song, playback position, shuffle and repeat state.
- 10-band **equalizer** with presets (Bass Boost, Vocal, Rock, Jazz and more) and custom settings.
- Lyrics view for songs with embedded lyrics.
- Drag and drop audio files onto the window to play them.
- OS media controls and media keys, with song info and cover art shown by the system.
- Unplayable songs (moved, deleted or damaged files) are skipped automatically with a clear message.
- Play counts are recorded only once you've listened to a configurable share of a song.

### 📃 Playlists
- Create, rename and delete playlists, with optional descriptions.
- Add songs from anywhere via the right-click menu; reorder by dragging or sort by title, artist or duration.
- Duplicate detection when adding songs, and a one-click "Remove Duplicates".

### ✏️ Song details & tags
- Full song details page with metadata, cover art and lyrics.
- Edit tags for MP3 files in your library.

### 🎨 Personalization
- 9 built-in themes: Dark, Light, Midnight, Dracula, Nord, Ocean, Ember, Forest and Graphite.
- Per-color overrides and a custom accent color.
- Rebindable keyboard shortcuts.
- Settings for playback, startup, Home page and library behavior.
- Frameless window with a custom title bar, and an always-on-top **mini-player**.

### 🛡️ Reliable and safe
- Settings, playlists, play counts, session and artist info are backed up automatically and restored if a file gets damaged.
- Writes are crash-safe: a power cut can't leave half-written data behind.
- Hardened Electron setup: restricted file access, no arbitrary navigation, and only web links can be opened.

## Download

Grab the latest build from the [Releases page](https://github.com/Ramin-RX7/Melodesk/releases).

| Platform | Package |
| --- | --- |
| **Windows** | Installer, portable `.zip`, or portable single `.exe` |
| **Linux** | AppImage |
| **macOS** | Disk image for Intel and Apple Silicon (requires **macOS 13 Ventura** or later) |

## Development

MeloDesk is an [Electron](https://www.electronjs.org/) app written in TypeScript and built with [Vite](https://vitejs.dev/). Tests run on [Vitest](https://vitest.dev/).

### Prerequisites

- [Node.js](https://nodejs.org/), using the version pinned in [`.nvmrc`](.nvmrc) (`nvm use` if you use nvm)
- npm

### Getting started

```bash
# Clone the repository
git clone https://github.com/Ramin-RX7/Melodesk.git
cd Melodesk

# Install dependencies
npm install

# Start the app in development mode
npm run dev
```

> The commands above are the usual ones; check the `scripts` section of [`package.json`](package.json) for the exact names (for example the build and packaging scripts).

### Common tasks

```bash
npm test          # run the test suite (Vitest)
npm run lint      # lint with ESLint
npm run build     # production build
```

### Project structure

```
Melodesk/
├── src/          # Application source code
├── tests/        # Test suite
├── scripts/      # Build and maintenance scripts
├── assets/       # Icons and static assets
└── .github/      # CI workflows and GitHub config
```

Code style is enforced with ESLint and Prettier, and [`.editorconfig`](.editorconfig) keeps editors consistent.

## Contributing

Contributions, bug reports and ideas are welcome.

1. Fork the repository and create a branch for your change.
2. Make your changes, adding or updating tests where it makes sense.
3. Run the linter and tests locally.
4. Open a pull request describing what you changed and why.

For bugs, please [open an issue](https://github.com/Ramin-RX7/Melodesk/issues) with your OS, MeloDesk version and steps to reproduce.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes. This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## License

<!-- Add a LICENSE file to the repo and name it here, e.g. MIT. -->
Distributed under the terms of the license in the [LICENSE](LICENSE) file.
