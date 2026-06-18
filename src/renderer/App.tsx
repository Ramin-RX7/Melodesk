import React, { useEffect, useState } from "react";

import { PlaylistView } from "./components/PlaylistView";
import { SongDetailsView } from "./components/SongDetailsView";
import { PlaybackBar } from "./components/PlaybackBar";
import { QueueView } from "./components/Queue/QueueView";
import { FileItem, UserConfig } from "./types";
import { normalizeGenre } from "../utils/metadata";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useLibrary } from "../hooks/useLibrary";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { LibraryView } from "./components/LibraryView";
import { Navbar } from "./components/Navbar/Navbar";
import { GroupedView } from "./components/GroupedView/GroupedView";
import { useQueue } from "../hooks/useQueue";
import { usePlaybackController } from "../hooks/usePlaybackController";


type Page = 'library' | 'artists' | 'genres' | 'albums' | 'playlists' | 'details' | 'queue';
type GroupSortBy = 'alphabet' | 'count';

const DEFAULT_THEME_COLOR = "#1db954";

export default function App() {
  const [activeTab, setActiveTab] = useState<Exclude<Page, 'details' | 'queue'>>('library');
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
      } catch (error) {
        console.error("Failed to load config or initial library:", error);
      }
    };
    init();

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const showContextMenu = async (e: React.MouseEvent, song: FileItem) => {
    e.preventDefault();
    const action = await window.api.showSongContextMenu(song);
    if (!action) return;

    if (action.type === 'play-next') {
        playNext(song);
    } else if (action.type === 'go-to-album') {
        const tabName = 'albums';
        setActiveTab(tabName);
        setView(tabName);
        setSearchQuery("");
        setSelectedGroup({ type: 'album', name: song.metadata?.album || 'Unknown Album' });
    } else if (action.type === 'go-to-artist') {
        const tabName = 'artists';
        setActiveTab(tabName);
        setView(tabName);
        setSearchQuery("");
        setSelectedGroup({ type: 'artist', name: action.artist });
    } else if (action.type === 'open-details') {
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

  const handleTabChange = (tab: Exclude<Page, 'details' | 'queue'>) => {
    setActiveTab(tab);
    setView(tab);
    setSelectedGroup(null);
    setSearchQuery(""); // Clear search on tab change
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
          onQueueClick={() => setView("queue")}
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
                setSelectedGroup={setSelectedGroup}
                setSearchQuery={setSearchQuery}
                setSortBy={setSortBy}
                setSortDescending={setSortDescending}
                normalizeGenre={normalizeGenre}
                handleFileSelect={handleFileSelect}
                handleShufflePlay={handleShufflePlay}
                onContextMenu={showContextMenu}
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
                configDoubleClickToPlay={
                  config?.doubleClickToPlay ?? true
                }
                onContextMenu={showContextMenu}
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
                onClearQueue={() => setQueue([])}
                onRemoveFromQueue={handleRemoveFromQueue}
                activeItemRemovable={config?.removeCurrentSongBehavior === "play-next"}
                onContextMenu={showContextMenu}
              />
            );
          }

          if (view === "details") {
            return view === "details" && currentTrack ? (
              <SongDetailsView
                currentTrack={currentTrack}
                themeColor={themeColor}
                onBack={() => setView(activeTab)}
                onNavigate={(type, name) => {
                  const tabName = `${type}s` as any;
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
