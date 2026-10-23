# Changelog

All notable changes to MeloDesk are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add several library folders at once: the "Add Folder" picker now lets you select multiple folders.
- Library scans now show their progress in the title bar ("Scanning library… 329 / 666"); hover to see the file being read, click to open the Library page.

### Changed

- When your library is empty, MeloDesk opens on the Library page so you can add a folder right away.
- Rescanning the library only re-reads songs that were added or changed since the last scan, so refreshes and restarts are much faster.
- Library folders open instantly, even large ones.

### Fixed

- Adding or removing a library folder now updates your library right away, instead of waiting for a refresh or restart.
- Starting a new library scan (refresh, folder change or files changing on disk) now replaces the scan in progress instead of running alongside it.

## [0.2.0] - 2026-10-23

### Added

#### Library

- Add your music folders and MeloDesk scans them in the background, reading tags and embedded cover art from MP3, FLAC, M4A, OGG and WAV files.
- The library is cached for instant startup and updates itself automatically when files are added, changed or removed.
- Browse each library folder as a tree and play files straight from it.

#### Browsing

- Home page with recently played, most played, popular artists, never-played songs and library statistics.
- Artists, Albums and Genres pages with search and sorting. Songs with several artists ("A feat. B", "A & B") appear under each of them.
- Artist pages with an editable bio and picture.
- Global search across songs, albums, artists and playlists.
- Back navigation (button, Esc and the mouse back button) that remembers where you were, including scroll position.

#### Playback

- Play queue with play next, remove and clear, plus shuffle and repeat (all / one).
- Playback resumes where you left off: the queue, current song, shuffle and repeat state are restored on launch.
- Drag and drop audio files onto the window to play them.
- Control playback from the OS media controls and media keys, with song info and cover art shown by the system.
- 10-band equalizer with presets (Bass Boost, Vocal, Rock, Jazz and more) and custom settings.
- Play counts are recorded once you have actually listened to a configurable share of a song.
- Lyrics view for songs with embedded lyrics.

#### Playlists

- Create, rename and delete playlists, with optional descriptions.
- Add songs from anywhere via the right-click menu, reorder them by dragging, or sort by title, artist or duration.

#### Song details

- Full song details page with metadata, cover art and lyrics.
- Edit song tags (MP3 files).

#### Personalization

- 9 built-in themes (Dark, Light, Midnight, Dracula, Nord, Ocean, Ember, Forest, Graphite), per-color overrides and a custom accent color.
- Rebindable keyboard shortcuts.
- Settings page for playback, startup, Home page and library options.

#### Window

- Frameless window with a custom title bar; its size, position and maximized state are remembered.
- Mini-player: a small always-on-top widget with cover art and playback controls.

#### Downloads

- Windows installer, portable zip and portable single executable; Linux AppImage; macOS disk images for Intel and Apple Silicon.

[Unreleased]: https://github.com/Ramin-RX7/Melodesk/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Ramin-RX7/Melodesk/releases/tag/v0.2.0
