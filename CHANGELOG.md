# Changelog

All notable changes to MeloDesk are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- You're told when a library folder can't be found (for example an unplugged drive), and again when it's back.

- Add several library folders at once: the "Add Folder" picker now lets you select multiple folders.
- Library scans now show their progress in the title bar ("Scanning library… 329 / 666"); hover to see the file being read, click to open the Library page.
- Notifications: MeloDesk now tells you when something needs your attention, such as a song that can't be found, changes it noticed in your library folders, or a damaged playlist that was repaired.
- When your library folders change on disk (songs added, changed, moved or removed), the library updates itself and tells you what changed.
- Your settings, playlists, play counts, session and artist info are now backed up automatically. If one of these files gets damaged, MeloDesk restores it from the backup and tells you, instead of starting over with defaults.

- The playback position is remembered: when your last session is restored, the song continues where you left off.
- Adding songs to a playlist now tells you which ones are already in it, and lets you add them anyway, skip them or cancel.
- Playlists have a "Remove Duplicates" button (asks first, keeps the first copy of each song).
- An "Unknown Artist" page on the Artists tab gathers all songs without an artist tag; "Go to Artist" and the song details page lead there for such songs.
- Moving or renaming song files no longer loses them: their play counts and history are kept, playlists and the queue follow them to the new location, and a song that's playing carries on. This also works for files moved while MeloDesk was closed, and for songs that leave your library and come back later.

### Changed

- Questions and confirmations (duplicate songs, deleting a playlist, applying a theme, replacing library folders) now appear in MeloDesk's own dialog, matching your theme, instead of system message boxes. Problems saving tags are shown as notifications.
- "Add Folder" opens next to the folder you picked last time, and choosing an artist picture opens in the folder of the last picture you chose.
- Songs that can't be played (moved, deleted or damaged files) are now skipped automatically, with a message saying which song and why. They stay in the queue.
- An open playlist updates right away when songs are added to it from elsewhere (e.g. the right-click menu).
- Opening MeloDesk while it's already running now brings the open window to the front instead of starting a second copy.
- Library folders can no longer overlap. Adding a folder that is inside one of your library folders explains why it isn't needed. Adding a folder that contains library folders asks whether to replace them with it, or to cancel.
- Smoother playback: the app no longer redraws every page several times a second while a song plays.
- The Artists page and Home load artist pictures in one go, and artist cards on Home now show cover art when no custom picture is set.
- The volume is saved when you let go of the slider, instead of on every step while dragging.
- When your library is empty, MeloDesk opens on the Library page so you can add a folder right away.
- Songs now play on double-click everywhere (album, artist and genre pages, playlists and search results), following the "Double-click to play" setting. The queue still plays on a single click.
- Playing a song from a list while shuffle is on now plays that song first, followed by the rest of the list in random order.
- If songs from your last session are no longer in your library, you're told how many were removed from the restored queue.
- Rescanning the library only re-reads songs that were added or changed since the last scan, so refreshes and restarts are much faster.
- Library folders open instantly, even large ones.
- Long lists open instantly and scroll smoothly, even with thousands of songs: the queue, playlists, the "Add Songs" list, the Artists, Albums and Genres pages and Home's "Show all" pages. Covers load as they come into view.
- The Artists, Albums, Genres and Playlists pages respond faster in large libraries.
- Cover art takes less disk space: songs from the same album share one image, and images that are no longer used are removed automatically.
- MeloDesk now runs on Electron 44, with current Chromium security fixes. The macOS version needs macOS 13 (Ventura) or later.

### Fixed

- Adding or removing a library folder now updates your library right away, instead of waiting for a refresh or restart.
- Starting a new library scan (refresh, folder change or files changing on disk) now replaces the scan in progress instead of running alongside it.
- Opening a song's details from the right-click menu no longer changes the song shown in the playback bar, its play count or the saved session.
- Playing a song from a list with shuffle on no longer skips part of the list.
- Playing a song that was moved or deleted no longer leaves the player stuck on "playing"; you get an error and the library is refreshed.
- A damaged playlist file no longer hides all your playlists. As much of it as possible is recovered, and the original file is kept as a backup.
- An unsaved artist bio is now discarded when you leave the artist's page, so it can no longer be saved onto a different artist. Cancel now discards the draft.
- Editing a song's tags now updates it in the queue straight away.
- The playback bar's details button now records history, so Back returns to the page you were on.
- A crash or power cut while MeloDesk is saving can no longer leave a half-written settings, playlist or play-count file.
- The Windows media overlay (media keys, lock screen) now shows all of a song's artists, and no longer keeps the previous song's title for songs without cover art.
- Removing a library folder no longer leaves songs from a folder with a similar name (e.g. "Music\A" and "Music\AB") in your library.
- Songs no longer appear twice if your library folders overlapped.
- Seeking in songs is more reliable in edge cases.
- When a song is in the queue more than once, removing it removes exactly the copy you chose (also with shuffle on), and clicking a repeated song plays that copy.
- Playing a song again (e.g. picking it again from the queue) now counts as another play.
- Space now plays/pauses even right after you used the volume or seek slider.
- Back (button, Esc or mouse back button) now also returns from library folders and from Home's "Show all" pages, restoring where you had scrolled to. A history size of 1 no longer keeps unlimited history.
- Removing a library folder in Settings now closes it on the Library page.
- "Go to Album" is unavailable for songs without an album, instead of opening an empty page.
- Search ignores spaces at the start or end of what you type, so artists and albums no longer disappear from the results while you're typing (e.g. "alan ").
- A quick click on the mini-player can no longer leave the window following the mouse pointer.
- A song's cover updates when its embedded art is changed in another program.
- Replacing an artist picture no longer leaves the old image behind on disk.
- The mini-player no longer slowly grows when it's dragged around on displays with scaling (e.g. 125%).

### Security

- Links opened from MeloDesk can only be web pages; other kinds of links are refused.
- The app window can only read your library folders and its own files, can no longer navigate away or open new windows, and only runs MeloDesk's own code.
- Song tags can only be changed in MP3 files that are in your library.

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
