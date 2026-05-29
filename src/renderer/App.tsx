import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  IoArrowBack,
  IoFolder,
  IoPerson,
  IoDisc,
  IoMusicalNotes,
  IoClose,
  IoMusicalNote,
  IoSearch,
  IoSwapVertical
} from "react-icons/io5";

import { DirectoryTree } from "./components/DirectoryTree";
import { PlaylistView } from "./components/PlaylistView";
import { SongDetailsView } from "./components/SongDetailsView";
import { PlaybackBar } from "./components/PlaybackBar";
import { QueueView } from "./components/Queue/QueueView";
import { FileItem, UserConfig } from "./types";
import { shuffleArray } from "../utils/array";
import { normalizeGenre } from "../utils/metadata";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useLibrary } from "../hooks/useLibrary";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { LibraryView } from "./components/LibraryView";
import { Navbar } from "./components/Navbar/Navbar";
import { GroupedView } from "./components/GroupedView/GroupedView";


type Page = 'library' | 'artists' | 'genres' | 'albums' | 'playlists' | 'details' | 'queue';
type GroupSortBy = 'alphabet' | 'count';
type RepeatMode = 'none' | 'one' | 'all';

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

  // Search and Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<GroupSortBy>('alphabet');
  const [sortDescending, setSortDescending] = useState(false);

  // Queue and Playback States
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<FileItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const activeQueue = isShuffle ? shuffledQueue : queue;

  // Audio Player
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
  } = useAudioPlayer(config);


  // Single source of truth for theme color fallback
  const themeColor = config?.themeColor || DEFAULT_THEME_COLOR;

  const handleShuffleToggle = () => {
    if (!currentTrack) {
      setIsShuffle((prev) => !prev);
      return
    };
    if (!isShuffle) {
      // Remove current track from queue before shuffling, Shuffle remaining tracks, Put current track first
      const remainingTracks = queue.filter(
        (t) => t.path !== currentTrack.path
      );
      const shuffledRemaining = shuffleArray(remainingTracks);
      const newShuffled = [currentTrack, ...shuffledRemaining];
      setShuffledQueue(newShuffled);
      setCurrentIndex(0);
    } else {
      // Restore original queue position
      const originalIdx = queue.findIndex(
        (t) => t.path === currentTrack.path
      );
      setCurrentIndex(originalIdx);
    }
    setIsShuffle((prev) => !prev);
  };

  const handleRepeatToggle = () => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  const playTrack = (track: FileItem, newQueue?: FileItem[]) => {
    setCurrentTrack(track);

    if (newQueue) {
      setQueue(newQueue);
      if (isShuffle) {
        const newShuffled = shuffleArray(newQueue);
        setShuffledQueue(newShuffled);
        setCurrentIndex(newShuffled.findIndex(t => t.path === track.path));
      } else {
        setCurrentIndex(newQueue.findIndex(t => t.path === track.path));
      }
    } else {
      // Just update index in current active queue
      setCurrentIndex(activeQueue.findIndex(t => t.path === track.path));
    }

    if (track.metadata?.duration) {
      setDuration(track.metadata.duration);
    } else {
      setDuration(0);
    }

    if (audioRef.current) {
      const normalizedPath = track.path.replace(/\\/g, "/");
      audioRef.current.src = `media://${encodeURIComponent(normalizedPath)}`;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (activeQueue.length === 0) return;

    let nextIdx = currentIndex + 1;
    if (nextIdx >= activeQueue.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        return; // End of queue
      }
    }
    playTrack(activeQueue[nextIdx]);
  };

  const handlePrevious = () => {
    if (activeQueue.length === 0) return;

    // If more than 3 seconds in, restart track
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }

    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      if (repeatMode === 'all') {
        prevIdx = activeQueue.length - 1;
      } else {
        return; // Start of queue
      }
    }
    playTrack(activeQueue[prevIdx]);
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      handleNext();
    }
  };

  const handleTrackUpdated = (updatedTrack: FileItem) => {
    setCurrentTrack(updatedTrack);
    setAllTracks(prev => prev.map(t => t.path === updatedTrack.path ? updatedTrack : t));
  };


  useLibrary(setAllTracks, setTree, selectedLibraryPath);


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

  const handleAddFolder = async () => {
    const path = await window.api.selectDirectory();
    if (path && config) {
      if (!config.libraryPaths.includes(path)) {
        const newConfig = await window.api.updateConfig({
          libraryPaths: [...config.libraryPaths, path]
        });
        setConfig(newConfig);
      }
    }
  };

  const handleRemoveFolder = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (config) {
      const newConfig = await window.api.updateConfig({
        libraryPaths: config.libraryPaths.filter(p => p !== path)
      });
      setConfig(newConfig);
      if (selectedLibraryPath === path) {
        setSelectedLibraryPath(null);
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

  const handleVolumeChange = async (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (config) {
      const newConfig = await window.api.updateConfig({ volume: newVolume });
      setConfig(newConfig);
    }
  };

  const handleRefreshLibrary = async () => {
    await window.api.refreshLibrary();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const item = await window.api.getMetadata(file.path);
      if (item && item.isMedia) {
        playTrack(item, [item]);
      }
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

  useKeyboardControls({
    togglePlay,
    handleNext,
    handlePrevious,
    seekForward,
    seekBackward,
  });

  const renderDetails = () => {
    if (!currentTrack) return <div style={{ padding: 20 }}>No track selected</div>;
    return (
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
    );
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
                themeColor={themeColor}
                setSelectedLibraryPath={setSelectedLibraryPath}
                handleFileSelect={handleFileSelect}
                handleAddFolder={handleAddFolder}
                handleRefreshLibrary={handleRefreshLibrary}
                handleRemoveFolder={handleRemoveFolder}
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
              />
            );
          }

          if (view === "details") {
            return renderDetails();
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
