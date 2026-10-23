import React, { useEffect, useRef, useState } from "react";

import { HomeDetailKey, HomeView } from "./components/HomeView/HomeView";
import { PlaylistView } from "./components/PlaylistView";
import { SettingsView } from "./components/SettingsView";
import { SongDetailsView } from "./components/SongDetailsView";
import { PlaybackBar } from "./components/PlaybackBar";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { MiniPlayer } from "./components/MiniPlayer/MiniPlayer";
import { QueueView } from "./components/Queue/QueueView";
import { FileItem, SessionData, UserConfig } from "./types";
import { GlobalSearchNavTarget } from "./components/GlobalSearch/GlobalSearch";
import { normalizeGenre } from "../utils/metadata";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useEqualizer } from "../hooks/useEqualizer";
import { useLibrary } from "../hooks/useLibrary";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { LibraryView } from "./components/LibraryView";
import { Navbar } from "./components/Navbar/Navbar";
import { GroupedView } from "./components/GroupedView/GroupedView";
import { useQueue } from "../hooks/useQueue";
import { usePlaybackController } from "../hooks/usePlaybackController";
import { usePlayTracker } from "../hooks/usePlayTracker";
import { useLibraryScanStatus } from "../hooks/useLibraryScanStatus";
import { useToasts } from "../hooks/useToasts";
import { usePlaybackPositionSaver } from "../hooks/usePlaybackPosition";
import { Toasts } from "./components/Toasts/Toasts";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "./components/ConfirmDialog/ConfirmDialog";
import { colors, buildRootCss, DEFAULT_PALETTE, DEFAULT_THEME_COLOR } from "./theme/colors";
import { applyPalette } from "./theme/applyTheme";
import { getTheme, DEFAULT_THEME_ID } from "./theme/themes";

type Page =
  | "home"
  | "library"
  | "artists"
  | "genres"
  | "albums"
  | "playlists"
  | "details"
  | "queue"
  | "settings";
type GroupSortBy = "alphabet" | "count";

type NavSnapshot = {
  view: Page;
  activeTab: Exclude<Page, "details" | "queue" | "settings">;
  selectedGroup: { type: "artist" | "album" | "genre"; name: string } | null;
  searchQuery: string;
  sortBy: GroupSortBy;
  sortDescending: boolean;
  selectedLibraryPath: string | null;
  openPlaylistId: string | null;
  playlistsSearch: string;
  homeDetail: HomeDetailKey | null;
  scrollTop: number;
};

export default function App() {
  const [activeTab, setActiveTab] =
    useState<Exclude<Page, "details" | "queue" | "settings">>("home");
  const [view, setView] = useState<Page>("home");
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [tree, setTree] = useState<FileItem[]>([]);
  const [allTracks, setAllTracks] = useState<FileItem[]>([]);
  const [selectedLibraryPath, setSelectedLibraryPath] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{
    type: "artist" | "album" | "genre";
    name: string;
  } | null>(null);
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  // The song shown on the details page. Independent of playback: opening a song's details
  // never changes what is playing.
  const [detailsTrack, setDetailsTrack] = useState<FileItem | null>(null);
  const [openLyricsOnDetails, setOpenLyricsOnDetails] = useState(false);
  const [isMini, setIsMini] = useState(false);
  const { toasts, showToast, dismissToast } = useToasts();
  const { question, answer: answerQuestion, confirm } = useConfirm();
  // Song whose position the saved session holds (see the session-save effect).
  const sessionTrackPathRef = useRef<string | null>(null);

  const enterMini = () => {
    setIsMini(true);
    window.api.enterMiniMode();
  };
  const exitMini = () => {
    setIsMini(false);
    window.api.exitMiniMode();
  };

  // A song's tags were edited on the details page: show the new data everywhere it appears.
  const handleTrackUpdated = (updatedTrack: FileItem) => {
    const replace = (t: FileItem) => (t.path === updatedTrack.path ? updatedTrack : t);
    setDetailsTrack(updatedTrack);
    setCurrentTrack((prev) => (prev ? replace(prev) : prev));
    setAllTracks((prev) => prev.map(replace));
    setQueue((prev) => prev.map(replace));
    setShuffledQueue((prev) => prev.map(replace));
  };

  // Single source of truth for theme color fallback
  const themeColor = config?.themeColor || DEFAULT_THEME_COLOR;

  // Search and Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<GroupSortBy>("alphabet");
  const [sortDescending, setSortDescending] = useState(false);

  // Navigation history
  const [navHistory, setNavHistory] = useState<NavSnapshot[]>([]);

  // Controlled open playlist (replaces playlistToOpen)
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [playlistsGlobalSearch, setPlaylistsGlobalSearch] = useState("");
  // Home's "Show all" page, if one is open (part of navigation history like any page).
  const [homeDetail, setHomeDetail] = useState<HomeDetailKey | null>(null);

  // Scroll container tracking for history restore
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pendingScrollRestoreRef = useRef<number>(0);
  // Forward ref so useKeyboardControls can reference handleGoBack before it's declared
  const handleGoBackRef = useRef<() => void>(() => {});
  // Ref to the global search input so a keyboard shortcut can focus it
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Audio Player
  const audioPlayerState = useAudioPlayer(config, setConfig);
  const {
    audioRef,

    isPlaying,
    duration,

    setDuration,
    setIsPlaying,

    togglePlay,

    handleSeek,
    seekForward,
    seekBackward,

    handleLoadedMetadata,
    previewVolume,
    commitVolume,
  } = audioPlayerState;

  // Insert the Web Audio equalizer between the <audio> element and the speakers.
  useEqualizer(audioRef, config);

  // Queue and Playback States
  const queueState = useQueue(currentTrack);
  const {
    queue,
    setQueue,
    currentIndex,
    setCurrentIndex,
    repeatMode,
    setRepeatMode,
    isShuffle,
    setIsShuffle,
    shuffledQueue,
    setShuffledQueue,

    activeQueue,
    handleShuffleToggle,
    handleRepeatToggle,
  } = queueState;

  // Use library
  useLibrary(setAllTracks, setTree, selectedLibraryPath);
  const scanStatus = useLibraryScanStatus();

  // Utilities that use both Playback and Queue
  const {
    playTrack,
    handleShufflePlay,
    handleNext,
    handlePrevious,
    handleEnded,
    handleDrop,
    playNext,
    playNextAndPlay,
    playNextMultiple,
    handleRemoveFromQueue,
    handleAudioError,
    handleAudioPlay,
    handleAudioPlaying,
    relocateCurrent,
  } = usePlaybackController({
    config,
    queueState,
    audioState: audioPlayerState,
    currentTrack,
    setCurrentTrack,
    notify: showToast,
  });

  // A library folder that was removed (e.g. in Settings) can't stay open on the Library page,
  // including when Back would return to it.
  const libraryPaths = config?.libraryPaths;
  useEffect(() => {
    if (selectedLibraryPath && libraryPaths && !libraryPaths.includes(selectedLibraryPath)) {
      setSelectedLibraryPath(null);
    }
  }, [libraryPaths, selectedLibraryPath]);

  // After a library update, swap the queue's song objects for the fresh ones (same path, or same
  // song id for a file that was moved or renamed) so the queue, playback bar and details page
  // show current tags and paths. Songs no longer in the library stay as they are.
  useEffect(() => {
    if (allTracks.length === 0) return;
    const byPath = new Map(allTracks.map((t) => [t.path, t]));
    const byId = new Map(allTracks.filter((t) => t.hash).map((t) => [t.hash!, t]));
    const refresh = (t: FileItem): FileItem =>
      byPath.get(t.path) ?? (t.hash ? byId.get(t.hash) : undefined) ?? t;
    if (currentTrack) {
      const fresh = refresh(currentTrack);
      if (fresh.path !== currentTrack.path) relocateCurrent(currentTrack.path, fresh.path);
    }
    setQueue((prev) => prev.map(refresh));
    setShuffledQueue((prev) => prev.map(refresh));
    setCurrentTrack((prev) => (prev ? refresh(prev) : prev));
    setDetailsTrack((prev) => (prev ? refresh(prev) : prev));
    // Only when the library changes; the playing song is read as of that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTracks]);

  usePlaybackPositionSaver(audioRef, config?.restoreSession ?? false);

  // Record plays once enough of a song has actually been listened to
  usePlayTracker(audioRef, currentTrack, config?.playCountThresholdPercent ?? 50);

  // Keyboard Controls
  useKeyboardControls({
    togglePlay,
    handleNext,
    handlePrevious,
    seekForward,
    seekBackward,
    goBack: () => handleGoBackRef.current(),
    focusSearch: () => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    },
    keybindings: config?.keybindings,
  });

  useEffect(() => {
    // Add global styles to remove margins
    const style = document.createElement("style");
    style.innerHTML = `
      :root {
        ${buildRootCss(DEFAULT_PALETTE, DEFAULT_THEME_COLOR)}
      }
      body, html {
        margin: 0;
        padding: 0;
        overflow: hidden;
        height: 100%;
        background-color: var(--bgBase);
      }
      * {
        box-sizing: border-box;
      }
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: var(--bgElevated);
      }
      ::-webkit-scrollbar-thumb {
        background: var(--borderSubtle);
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: var(--border);
      }
    `;
    document.head.appendChild(style);

    const init = async () => {
      try {
        const userConfig = await window.api.getConfig();
        setConfig(userConfig);

        // Load initial library tracks from cache immediately
        const tracks = await window.api.getLibraryFiles();
        setAllTracks(tracks);

        // Nothing to show on Home yet: start on Library, where folders are added (and the
        // first scan's progress is visible in the navbar).
        if (tracks.length === 0) {
          setActiveTab("library");
          setView("library");
        }

        if (userConfig.restoreSession) {
          const session = await window.api.getSession();
          if (session && session.queue && session.queue.length > 0) {
            const trackMap = new Map(tracks.map((t) => [t.path, t]));
            const restoredQueue = session.queue
              .map((p) => trackMap.get(p))
              .filter(Boolean) as FileItem[];
            const restoredShuffled = session.shuffledQueue
              .map((p) => trackMap.get(p))
              .filter(Boolean) as FileItem[];
            // Songs from the last session that are no longer in the library (moved or deleted)
            // are left out. Skipped while the library is still empty (first scan running).
            const missing = session.queue.length - restoredQueue.length;
            if (missing > 0 && tracks.length > 0) {
              showToast({
                level: "info",
                message:
                  restoredQueue.length === 0
                    ? "Your last session couldn't be restored: its songs are no longer in your library."
                    : `${missing} song${missing === 1 ? "" : "s"} from your last session ${missing === 1 ? "is" : "are"} no longer in your library and ${missing === 1 ? "was" : "were"} removed from the queue.`,
              });
            }
            if (restoredQueue.length > 0) {
              setQueue(restoredQueue);
              setShuffledQueue(restoredShuffled.length > 0 ? restoredShuffled : restoredQueue);
              setIsShuffle(session.isShuffle);
              setRepeatMode(session.repeatMode);
              const activeLen = session.isShuffle ? restoredShuffled.length : restoredQueue.length;
              const clampedIndex = Math.max(0, Math.min(session.currentIndex, activeLen - 1));
              const activeList = session.isShuffle ? restoredShuffled : restoredQueue;
              const trackToRestore =
                (session.currentTrackPath ? trackMap.get(session.currentTrackPath) : null) ??
                activeList[clampedIndex];
              // Locate the track in the restored list: removed songs shift the saved index.
              const restoredIndex = trackToRestore
                ? activeList.findIndex((t) => t.path === trackToRestore.path)
                : -1;
              setCurrentIndex(restoredIndex >= 0 ? restoredIndex : clampedIndex);
              if (trackToRestore) {
                setCurrentTrack(trackToRestore);
                if (trackToRestore.metadata?.duration)
                  setDuration(trackToRestore.metadata.duration);
                const audio = audioRef.current;
                if (audio) {
                  const normalizedPath = trackToRestore.path.replace(/\\/g, "/");
                  audio.src = `media://${encodeURIComponent(normalizedPath)}`;
                  // Continue where the user left off (only if it's the song that was playing).
                  const position = session.position ?? 0;
                  if (trackToRestore.path === session.currentTrackPath && position > 0) {
                    sessionTrackPathRef.current = trackToRestore.path;
                    audio.addEventListener(
                      "loadedmetadata",
                      () => {
                        if (position < audio.duration) audio.currentTime = position;
                      },
                      { once: true },
                    );
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load config or initial library:", error);
      }
    };
    init();

    return () => {
      document.head.removeChild(style);
    };
    // Startup runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the selected theme + per-role overrides to :root whenever they change.
  const appearance = config?.appearance;
  const configLoaded = config !== null;
  useEffect(() => {
    if (!configLoaded) return;
    const base = getTheme(appearance?.themeId ?? DEFAULT_THEME_ID)?.palette ?? DEFAULT_PALETTE;
    applyPalette({ ...base, ...(appearance?.colors ?? {}) }, themeColor);
  }, [configLoaded, appearance, themeColor]);

  const restoreSession = config?.restoreSession;
  useEffect(() => {
    if (restoreSession === undefined) return;

    if (!restoreSession) {
      window.api.clearSession();
      return;
    }

    if (!currentTrack) return;

    const data: SessionData = {
      currentTrackPath: currentTrack.path,
      queue: queue.map((t) => t.path),
      shuffledQueue: shuffledQueue.map((t) => t.path),
      currentIndex,
      isShuffle,
      repeatMode,
    };
    // A different song starts from the beginning; the same song keeps its saved position
    // (usePlaybackPositionSaver keeps it up to date).
    if (sessionTrackPathRef.current !== currentTrack.path) {
      sessionTrackPathRef.current = currentTrack.path;
      data.position = 0;
    }
    window.api.saveSession(data);
  }, [currentTrack, queue, shuffledQueue, currentIndex, isShuffle, repeatMode, restoreSession]);

  const handleScrollRef = (el: HTMLElement | null) => {
    scrollContainerRef.current = el;
    if (el && pendingScrollRestoreRef.current > 0) {
      const pos = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = 0;
      requestAnimationFrame(() => {
        el.scrollTop = pos;
      });
    }
  };

  const pushNav = () => {
    const snap: NavSnapshot = {
      view,
      activeTab,
      selectedGroup,
      searchQuery,
      sortBy,
      sortDescending,
      selectedLibraryPath,
      openPlaylistId,
      playlistsSearch: playlistsGlobalSearch,
      homeDetail,
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
    };
    // Keep at most `limit` entries (careful: slice(-0) would keep everything).
    const limit = Math.max(1, config?.navigationHistorySize ?? 20);
    setNavHistory((prev) => [...prev.slice(Math.max(0, prev.length - (limit - 1))), snap]);
  };

  const handleGoBack = () => {
    setNavHistory((prev) => {
      if (prev.length === 0) {
        // No history: step out of the current sub-page instead.
        if (view === "details") {
          setView(activeTab);
        } else if (selectedGroup) {
          setSelectedGroup(null);
          setSearchQuery("");
        } else if (openPlaylistId) {
          setOpenPlaylistId(null);
        } else if (view === "library" && selectedLibraryPath) {
          setSelectedLibraryPath(null);
        } else if (view === "home" && homeDetail) {
          setHomeDetail(null);
        }
        return prev;
      }
      const snap = prev[prev.length - 1];
      setView(snap.view as Page);
      setActiveTab(snap.activeTab);
      setSelectedGroup(snap.selectedGroup);
      setSearchQuery(snap.searchQuery);
      setSortBy(snap.sortBy);
      setSortDescending(snap.sortDescending);
      setSelectedLibraryPath(snap.selectedLibraryPath);
      setOpenPlaylistId(snap.openPlaylistId);
      setPlaylistsGlobalSearch(snap.playlistsSearch);
      setHomeDetail(snap.homeDetail);
      pendingScrollRestoreRef.current = snap.scrollTop;
      return prev.slice(0, -1);
    });
  };

  handleGoBackRef.current = handleGoBack;

  const toggleQueue = () => {
    if (view === "queue") {
      handleGoBack();
    } else {
      pushNav();
      setView("queue");
    }
  };

  const handleGroupSelect = (group: { type: "artist" | "album" | "genre"; name: string }) => {
    pushNav();
    setSelectedGroup(group);
    setSearchQuery("");
  };

  const handlePlaylistSelect = (id: string) => {
    pushNav();
    setOpenPlaylistId(id);
  };

  const handlePlaylistClose = () => handleGoBack();

  const handleGlobalSearchNavigate = (target: GlobalSearchNavTarget) => {
    pushNav();
    const tabName = target.tab as Exclude<Page, "details" | "queue" | "settings">;
    setActiveTab(tabName);
    setView(tabName);
    setSelectedGroup(null);

    if (target.tab === "playlists") {
      if (target.playlistId) setOpenPlaylistId(target.playlistId);
      if (target.query !== undefined) setPlaylistsGlobalSearch(target.query);
    } else {
      if (target.query !== undefined) setSearchQuery(target.query);
      if (target.groupName) {
        const type = target.tab === "albums" ? "album" : "artist";
        setSelectedGroup({ type: type as "album" | "artist", name: target.groupName });
        setSearchQuery("");
      }
    }
  };

  const showGroupContextMenu = async (e: React.MouseEvent, _name: string, songs: FileItem[]) => {
    e.preventDefault();
    if (songs.length === 0) return;
    const action = await window.api.showGroupContextMenu(_name);
    if (!action) return;

    if (action.type === "group-play") {
      playTrack(songs[0], songs);
    } else if (action.type === "group-play-next") {
      playNextMultiple(songs);
    } else if (action.type === "group-add-to-playlist") {
      await window.api.addSongsToPlaylist(
        action.playlistId,
        songs.map((s) => s.path),
      );
    }
  };

  const showContextMenu = async (e: React.MouseEvent, song: FileItem) => {
    e.preventDefault();
    const action = await window.api.showSongContextMenu(song);
    if (!action) return;

    if (action.type === "play-next") {
      playNext(song);
    } else if (action.type === "go-to-album") {
      const album = song.metadata?.album;
      if (!album) return; // the menu item is disabled for songs without an album
      pushNav();
      setActiveTab("albums");
      setView("albums");
      setSearchQuery("");
      setSelectedGroup({ type: "album", name: album });
    } else if (action.type === "go-to-artist") {
      pushNav();
      setActiveTab("artists");
      setView("artists");
      setSearchQuery("");
      setSelectedGroup({ type: "artist", name: action.artist });
    } else if (action.type === "open-details") {
      pushNav();
      setDetailsTrack(song);
      setView("details");
    } else if (action.type === "add-to-playlist") {
      await window.api.addSongsToPlaylist(action.playlistId, [song.path]);
    }
  };

  const handleTabChange = (tab: Exclude<Page, "details" | "queue" | "settings">) => {
    pushNav();
    setActiveTab(tab);
    setView(tab);
    setSelectedGroup(null);
    setSearchQuery("");
    setHomeDetail(null);
    if (tab !== "library") {
      setSelectedLibraryPath(null);
    }
  };

  const handleFileSelect = (item: FileItem, contextQueue?: FileItem[]) => {
    if (item.isMedia) {
      if (currentTrack?.path === item.path) {
        togglePlay();
      } else {
        playTrack(item, contextQueue);
      }
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        backgroundColor: colors.bgBase,
        color: colors.textPrimary,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
        overflow: "hidden",
      }}
    >
      {isMini ? (
        <MiniPlayer
          currentTrack={currentTrack || undefined}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onExitMini={exitMini}
          themeColor={themeColor}
        />
      ) : (
        <>
          <TitleBar
            onEnterMini={enterMini}
            themeColor={themeColor}
            scanStatus={scanStatus}
            onScanIndicatorClick={() => handleTabChange("library")}
          />
          {view !== "details" && (
            <Navbar
              activeTab={activeTab}
              themeColor={themeColor}
              onTabChange={handleTabChange}
              onQueueClick={toggleQueue}
              onSettingsClick={() => {
                pushNav();
                setView("settings");
              }}
              allTracks={allTracks}
              config={config}
              onPlaySong={(song) => playNextAndPlay(song)}
              onSongContextMenu={showContextMenu}
              onGroupContextMenu={showGroupContextMenu}
              onGlobalSearchNavigate={handleGlobalSearchNavigate}
              canGoBack={navHistory.length > 0}
              onGoBack={handleGoBack}
              searchInputRef={searchInputRef}
            />
          )}

          <main
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {(() => {
              if (view === "home") {
                return (
                  <HomeView
                    allTracks={allTracks}
                    currentTrack={currentTrack}
                    themeColor={themeColor}
                    config={config}
                    handleFileSelect={handleFileSelect}
                    handleShufflePlay={handleShufflePlay}
                    onContextMenu={showContextMenu}
                    onScrollRef={handleScrollRef}
                    onSelectArtist={(name) => {
                      pushNav();
                      setActiveTab("artists");
                      setView("artists");
                      setSearchQuery("");
                      setSelectedGroup({ type: "artist", name });
                    }}
                    onNavigateTab={handleTabChange}
                    detail={homeDetail}
                    onOpenDetail={(key) => {
                      pushNav();
                      setHomeDetail(key);
                    }}
                    onCloseDetail={handleGoBack}
                  />
                );
              }

              if (view === "library") {
                return (
                  <LibraryView
                    selectedLibraryPath={selectedLibraryPath}
                    tree={tree}
                    config={config}
                    setConfig={setConfig}
                    themeColor={themeColor}
                    setSelectedLibraryPath={setSelectedLibraryPath}
                    onOpenFolder={(path) => {
                      pushNav();
                      setSelectedLibraryPath(path);
                    }}
                    onCloseFolder={handleGoBack}
                    onScrollRef={handleScrollRef}
                    handleFileSelect={handleFileSelect}
                    onContextMenu={showContextMenu}
                  />
                );
              }

              if (view === "artists" || view === "albums" || view === "genres") {
                const groupedType =
                  view === "artists" ? "artist" : view === "albums" ? "album" : "genre";

                return (
                  <GroupedView
                    type={groupedType}
                    allTracks={allTracks}
                    selectedGroup={selectedGroup}
                    searchQuery={searchQuery}
                    sortBy={sortBy}
                    sortDescending={sortDescending}
                    currentTrack={currentTrack}
                    config={config}
                    themeColor={themeColor}
                    onGroupSelect={handleGroupSelect}
                    onGoBack={handleGoBack}
                    onScrollRef={handleScrollRef}
                    setSearchQuery={setSearchQuery}
                    setSortBy={setSortBy}
                    setSortDescending={setSortDescending}
                    normalizeGenre={normalizeGenre}
                    handleFileSelect={handleFileSelect}
                    handleShufflePlay={handleShufflePlay}
                    onContextMenu={showContextMenu}
                    onGroupContextMenu={showGroupContextMenu}
                  />
                );
              }

              if (view === "playlists") {
                return (
                  <PlaylistView
                    allTracks={allTracks}
                    themeColor={themeColor}
                    onPlayTrack={playTrack}
                    currentTrack={currentTrack}
                    configDoubleClickToPlay={config?.doubleClickToPlay ?? true}
                    onContextMenu={showContextMenu}
                    selectedPlaylistId={openPlaylistId}
                    onPlaylistSelect={handlePlaylistSelect}
                    onPlaylistClose={handlePlaylistClose}
                    onPlaylistDeleted={(id) => {
                      if (openPlaylistId === id) setOpenPlaylistId(null);
                    }}
                    onScrollRef={handleScrollRef}
                    initialSearch={playlistsGlobalSearch}
                    confirm={confirm}
                  />
                );
              }

              if (view === "queue") {
                return (
                  <QueueView
                    queue={activeQueue}
                    currentIndex={currentIndex}
                    themeColor={themeColor}
                    onPlayTrack={(track, index) => playTrack(track, undefined, index)}
                    onClearQueue={() => {
                      const kept = currentTrack ? [currentTrack] : [];
                      setQueue(kept);
                      setShuffledQueue(kept);
                      setCurrentIndex(0);
                    }}
                    onRemoveFromQueue={handleRemoveFromQueue}
                    activeItemRemovable={config?.removeCurrentSongBehavior === "play-next"}
                    onContextMenu={showContextMenu}
                  />
                );
              }

              if (view === "settings") {
                return (
                  <SettingsView
                    config={config}
                    setConfig={setConfig}
                    themeColor={themeColor}
                    confirm={confirm}
                  />
                );
              }

              if (view === "details") {
                return view === "details" && detailsTrack ? (
                  <SongDetailsView
                    currentTrack={detailsTrack}
                    themeColor={themeColor}
                    onBack={handleGoBack}
                    onNavigate={(type, name) => {
                      pushNav();
                      const tabName = `${type}s` as Exclude<Page, "details" | "queue" | "settings">;
                      setActiveTab(tabName);
                      setView(tabName);
                      setSearchQuery("");
                      setSelectedGroup({ type, name });
                    }}
                    onTrackUpdated={handleTrackUpdated}
                    openLyrics={openLyricsOnDetails}
                    onLyricsConsumed={() => setOpenLyricsOnDetails(false)}
                    notify={showToast}
                  />
                ) : null;
              }

              return null;
            })()}
          </main>

          <PlaybackBar
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            currentTrack={currentTrack || undefined}
            audioRef={audioRef}
            duration={duration}
            onSeek={handleSeek}
            onShowDetails={() => {
              if (!currentTrack) return;
              if (view !== "details") pushNav();
              setDetailsTrack(currentTrack);
              setView("details");
            }}
            onShowLyrics={() => {
              if (!currentTrack) return;
              if (view !== "details") pushNav();
              setDetailsTrack(currentTrack);
              setOpenLyricsOnDetails(true);
              setView("details");
            }}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isShuffle={isShuffle}
            onToggleShuffle={handleShuffleToggle}
            repeatMode={repeatMode}
            onToggleRepeat={handleRepeatToggle}
            onShowQueue={toggleQueue}
            volume={config?.volume ?? 0.5}
            onVolumeChange={previewVolume}
            onVolumeCommit={commitVolume}
            themeColor={themeColor}
            onContextMenu={showContextMenu}
          />
        </>
      )}

      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handleAudioPlay}
        onPlaying={handleAudioPlaying}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      <Toasts toasts={toasts} themeColor={themeColor} onDismiss={dismissToast} />
      <ConfirmDialog question={question} themeColor={themeColor} onAnswer={answerQuestion} />
    </div>
  );
}
