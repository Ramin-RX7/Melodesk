import React, { useEffect, useRef, useState } from "react";

import { PlaylistView } from "./components/PlaylistView";
import { SettingsView } from "./components/SettingsView";
import { SongDetailsView } from "./components/SongDetailsView";
import { PlaybackBar } from "./components/PlaybackBar";
import { QueueView } from "./components/Queue/QueueView";
import { FileItem, SessionData, UserConfig } from "./types";
import { GlobalSearchNavTarget } from "./components/GlobalSearch/GlobalSearch";
import { normalizeGenre } from "../utils/metadata";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useLibrary } from "../hooks/useLibrary";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { LibraryView } from "./components/LibraryView";
import { Navbar } from "./components/Navbar/Navbar";
import { GroupedView } from "./components/GroupedView/GroupedView";
import { useQueue } from "../hooks/useQueue";
import { usePlaybackController } from "../hooks/usePlaybackController";


type Page = 'library' | 'artists' | 'genres' | 'albums' | 'playlists' | 'details' | 'queue' | 'settings';
type GroupSortBy = 'alphabet' | 'count';

type NavSnapshot = {
  view: Page;
  activeTab: Exclude<Page, 'details' | 'queue' | 'settings'>;
  selectedGroup: { type: 'artist' | 'album' | 'genre', name: string } | null;
  searchQuery: string;
  sortBy: GroupSortBy;
  sortDescending: boolean;
  selectedLibraryPath: string | null;
  openPlaylistId: string | null;
  playlistsSearch: string;
  scrollTop: number;
};

const DEFAULT_THEME_COLOR = "#1db954";

export default function App() {
  const [activeTab, setActiveTab] = useState<Exclude<Page, 'details' | 'queue' | 'settings'>>('library');
  const [view, setView] = useState<Page>('library');
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [tree, setTree] = useState<FileItem[]>([]);
  const [allTracks, setAllTracks] = useState<FileItem[]>([]);
  const [selectedLibraryPath, setSelectedLibraryPath] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ type: 'artist' | 'album' | 'genre', name: string } | null>(null);
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);

  const handleTrackUpdated = (updatedTrack: FileItem) => {
    setCurrentTrack(updatedTrack);
    setAllTracks(prev => prev.map(t => t.path === updatedTrack.path ? updatedTrack : t));
  };

  // Single source of truth for theme color fallback
  const themeColor = config?.themeColor || DEFAULT_THEME_COLOR;

  // Search and Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<GroupSortBy>('alphabet');
  const [sortDescending, setSortDescending] = useState(false);

  // Navigation history
  const [navHistory, setNavHistory] = useState<NavSnapshot[]>([]);

  // Controlled open playlist (replaces playlistToOpen)
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [playlistsGlobalSearch, setPlaylistsGlobalSearch] = useState("");

  // Scroll container tracking for history restore
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pendingScrollRestoreRef = useRef<number>(0);
  // Forward ref so useKeyboardControls can reference handleGoBack before it's declared
  const handleGoBackRef = useRef<() => void>(() => {});

  // Audio Player
  const audioPlayerState = useAudioPlayer(config, setConfig);
  const {
    audioRef,

    isPlaying,
    currentTime,
    duration,

    setDuration,
    setIsPlaying,

    togglePlay,

    handleSeek,
    seekForward,
    seekBackward,

    handleTimeUpdate,
    handleLoadedMetadata,
    handleVolumeChange,
  } = audioPlayerState;

  // Queue and Playback States
  const queueState = useQueue(currentTrack);
  const {
    queue, setQueue,
    currentIndex, setCurrentIndex,
    repeatMode, setRepeatMode,
    isShuffle, setIsShuffle,
    shuffledQueue, setShuffledQueue,

    activeQueue,
    removeFromQueue,
    handleShuffleToggle,
    handleRepeatToggle,
  } = queueState;

  // Use library
  useLibrary(setAllTracks, setTree, selectedLibraryPath);

  // Utilities that use both Playback and Queue
  const {
    playTrack,
    handleShufflePlay,
    handleNext,
    handlePrevious,
    handleEnded,
    handleDrop,
    playNext,
    playNextMultiple,
    handleRemoveFromQueue,
  } = usePlaybackController({
    config,
    queueState,
    audioState: audioPlayerState,
    currentTrack,
    setCurrentTrack,
  });

  // Keyboard Controls
  useKeyboardControls({
    togglePlay,
    handleNext,
    handlePrevious,
    seekForward,
    seekBackward,
    goBack: () => handleGoBackRef.current(),
  });


  useEffect(() => {
    // Add global styles to remove margins
    const style = document.createElement('style');
    style.innerHTML = `
      body, html {
        margin: 0;
        padding: 0;
        overflow: hidden;
        height: 100%;
        background-color: #121212;
      }
      * {
        box-sizing: border-box;
      }
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #1e1e1e;
      }
      ::-webkit-scrollbar-thumb {
        background: #333;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #444;
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

        if (userConfig.restoreSession) {
          const session = await window.api.getSession();
          if (session && session.queue && session.queue.length > 0) {
            const trackMap = new Map(tracks.map(t => [t.path, t]));
            const restoredQueue = session.queue.map(p => trackMap.get(p)).filter(Boolean) as FileItem[];
            const restoredShuffled = session.shuffledQueue.map(p => trackMap.get(p)).filter(Boolean) as FileItem[];
            if (restoredQueue.length > 0) {
              setQueue(restoredQueue);
              setShuffledQueue(restoredShuffled.length > 0 ? restoredShuffled : restoredQueue);
              setIsShuffle(session.isShuffle);
              setRepeatMode(session.repeatMode);
              const activeLen = session.isShuffle ? restoredShuffled.length : restoredQueue.length;
              const clampedIndex = Math.max(0, Math.min(session.currentIndex, activeLen - 1));
              setCurrentIndex(clampedIndex);
              const activeList = session.isShuffle ? restoredShuffled : restoredQueue;
              const trackToRestore = (session.currentTrackPath ? trackMap.get(session.currentTrackPath) : null) ?? activeList[clampedIndex];
              if (trackToRestore) {
                setCurrentTrack(trackToRestore);
                if (trackToRestore.metadata?.duration) setDuration(trackToRestore.metadata.duration);
                if (audioRef.current) {
                  const normalizedPath = trackToRestore.path.replace(/\\/g, "/");
                  audioRef.current.src = `media://${encodeURIComponent(normalizedPath)}`;
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
  }, []);

  useEffect(() => {
    if (!config) return;

    if (!config.restoreSession) {
      window.api.clearSession();
      return;
    }

    if (!currentTrack) return;

    const data: SessionData = {
      currentTrackPath: currentTrack.path,
      queue: queue.map(t => t.path),
      shuffledQueue: shuffledQueue.map(t => t.path),
      currentIndex,
      isShuffle,
      repeatMode,
    };
    window.api.saveSession(data);
  }, [currentTrack, queue, shuffledQueue, currentIndex, isShuffle, repeatMode, config?.restoreSession]);

  const handleScrollRef = (el: HTMLElement | null) => {
    scrollContainerRef.current = el;
    if (el && pendingScrollRestoreRef.current > 0) {
      const pos = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = 0;
      requestAnimationFrame(() => { el.scrollTop = pos; });
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
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
    };
    const limit = config?.navigationHistorySize ?? 20;
    setNavHistory(prev => [...prev.slice(-(limit - 1)), snap]);
  };

  const handleGoBack = () => {
    setNavHistory(prev => {
      if (prev.length === 0) {
        if (selectedGroup) { setSelectedGroup(null); setSearchQuery(''); }
        else if (openPlaylistId) { setOpenPlaylistId(null); }
        else if (view === 'details') { setView(activeTab); }
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
      pendingScrollRestoreRef.current = snap.scrollTop;
      return prev.slice(0, -1);
    });
  };

  handleGoBackRef.current = handleGoBack;

  const handleGroupSelect = (group: { type: 'artist' | 'album' | 'genre', name: string }) => {
    pushNav();
    setSelectedGroup(group);
    setSearchQuery('');
  };

  const handlePlaylistSelect = (id: string) => {
    pushNav();
    setOpenPlaylistId(id);
  };

  const handlePlaylistClose = () => handleGoBack();

  const handleGlobalSearchNavigate = (target: GlobalSearchNavTarget) => {
    pushNav();
    const tabName = target.tab as Exclude<Page, 'details' | 'queue' | 'settings'>;
    setActiveTab(tabName);
    setView(tabName);
    setSelectedGroup(null);

    if (target.tab === 'playlists') {
      if (target.playlistId) setOpenPlaylistId(target.playlistId);
      if (target.query !== undefined) setPlaylistsGlobalSearch(target.query);
    } else {
      if (target.query !== undefined) setSearchQuery(target.query);
      if (target.groupName) {
        const type = target.tab === 'albums' ? 'album' : 'artist';
        setSelectedGroup({ type: type as 'album' | 'artist', name: target.groupName });
        setSearchQuery('');
      }
    }
  };

  const showGroupContextMenu = async (e: React.MouseEvent, _name: string, songs: FileItem[]) => {
    e.preventDefault();
    if (songs.length === 0) return;
    const action = await window.api.showGroupContextMenu(_name);
    if (!action) return;

    if (action.type === 'group-play') {
      playTrack(songs[0], songs);
    } else if (action.type === 'group-play-next') {
      playNextMultiple(songs);
    } else if (action.type === 'group-add-to-playlist') {
      const playlist = await window.api.getPlaylist(action.playlistId);
      if (playlist) {
        const newPaths = songs.map(s => s.path).filter(p => !playlist.songs.includes(p));
        await window.api.updatePlaylist(action.playlistId, {
          songs: [...playlist.songs, ...newPaths]
        });
      }
    }
  };

  const showContextMenu = async (e: React.MouseEvent, song: FileItem) => {
    e.preventDefault();
    const action = await window.api.showSongContextMenu(song);
    if (!action) return;

    if (action.type === 'play-next') {
        playNext(song);
    } else if (action.type === 'go-to-album') {
        pushNav();
        setActiveTab('albums');
        setView('albums');
        setSearchQuery("");
        setSelectedGroup({ type: 'album', name: song.metadata?.album || 'Unknown Album' });
    } else if (action.type === 'go-to-artist') {
        pushNav();
        setActiveTab('artists');
        setView('artists');
        setSearchQuery("");
        setSelectedGroup({ type: 'artist', name: action.artist });
    } else if (action.type === 'open-details') {
        pushNav();
        setCurrentTrack(song);
        setView('details');
    } else if (action.type === 'add-to-playlist') {
        const playlist = await window.api.getPlaylist(action.playlistId);
        if (playlist) {
            await window.api.updatePlaylist(action.playlistId, {
                songs: [...playlist.songs, song.path]
            });
        }
    }
  };

  const handleTabChange = (tab: Exclude<Page, 'details' | 'queue' | 'settings'>) => {
    pushNav();
    setActiveTab(tab);
    setView(tab);
    setSelectedGroup(null);
    setSearchQuery("");
    if (tab !== 'library') {
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
        backgroundColor: "#121212",
        color: "#fff",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
        overflow: "hidden"
      }}>
      {view !== "details" && (
        <Navbar
          activeTab={activeTab}
          themeColor={themeColor}
          onTabChange={handleTabChange}
          onQueueClick={() => { pushNav(); setView("queue"); }}
          onSettingsClick={() => { pushNav(); setView("settings"); }}
          allTracks={allTracks}
          config={config}
          onPlaySong={(song, queue) => playTrack(song, queue)}
          onGlobalSearchNavigate={handleGlobalSearchNavigate}
          canGoBack={navHistory.length > 0}
          onGoBack={handleGoBack}
        />
      )}

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative"
        }}
      >
        {(() => {
          if (view === "library") {
            return (
              <LibraryView
                selectedLibraryPath={selectedLibraryPath}
                tree={tree}
                config={config}
                setConfig={setConfig}
                themeColor={themeColor}
                setSelectedLibraryPath={setSelectedLibraryPath}
                handleFileSelect={handleFileSelect}
                onContextMenu={showContextMenu}
              />
            );
          }

          if (
            view === "artists" ||
            view === "albums" ||
            view === "genres"
          ) {
            const groupedType =
              view === "artists"
                ? "artist"
                : view === "albums"
                  ? "album"
                  : "genre";

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
                onPlaylistDeleted={(id) => { if (openPlaylistId === id) setOpenPlaylistId(null); }}
                onScrollRef={handleScrollRef}
                initialSearch={playlistsGlobalSearch}
              />
            );
          }

          if (view === "queue") {
            return (
              <QueueView
                queue={activeQueue}
                currentIndex={currentIndex}
                themeColor={themeColor}
                onPlayTrack={playTrack}
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
              />
            );
          }

          if (view === "details") {
            return view === "details" && currentTrack ? (
              <SongDetailsView
                currentTrack={currentTrack}
                themeColor={themeColor}
                onBack={handleGoBack}
                onNavigate={(type, name) => {
                  pushNav();
                  const tabName = `${type}s` as Exclude<Page, 'details' | 'queue' | 'settings'>;
                  setActiveTab(tabName);
                  setView(tabName);
                  setSearchQuery("");
                  setSelectedGroup({ type, name });
                }}
                onTrackUpdated={handleTrackUpdated}
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
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        onShowDetails={() => setView('details')}
        onNext={handleNext}
        onPrevious={handlePrevious}
        isShuffle={isShuffle}
        onToggleShuffle={handleShuffleToggle}
        repeatMode={repeatMode}
        onToggleRepeat={handleRepeatToggle}
        onShowQueue={() => setView('queue')}
        volume={config?.volume ?? 0.5}
        onVolumeChange={handleVolumeChange}
        themeColor={themeColor}
        onContextMenu={showContextMenu}
      />

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
      />
    </div>
  );
}
