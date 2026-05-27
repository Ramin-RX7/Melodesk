import React, { useEffect, useState, useRef, useMemo } from "react";
import { DirectoryTree } from "./components/DirectoryTree";
import { PlaylistView } from "./components/PlaylistView";
import { SongDetailsView } from "./components/SongDetailsView";
import { PlaybackBar } from "./components/PlaybackBar";
import { FileItem, UserConfig } from "./types";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Single source of truth for theme color fallback
  const themeColor = config?.themeColor || DEFAULT_THEME_COLOR;

  // Utility to shuffle an array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleShuffleToggle = () => {
    if (!isShuffle) {
      // Enabling shuffle
      const newShuffled = shuffleArray(queue);
      // Ensure current track is at the current index in shuffled queue to avoid jumping
      if (currentTrack) {
        const currentIdxInShuffled = newShuffled.findIndex(t => t.path === currentTrack.path);
        if (currentIdxInShuffled !== -1) {
          // Move current track to position 0 for seamless playback?
          // Actually, let's just find its new index.
          setCurrentIndex(currentIdxInShuffled);
        }
      }
      setShuffledQueue(newShuffled);
    } else {
      // Disabling shuffle
      if (currentTrack) {
        const originalIdx = queue.findIndex(t => t.path === currentTrack.path);
        setCurrentIndex(originalIdx);
      }
    }
    setIsShuffle(!isShuffle);
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

  useEffect(() => {
    if (config && audioRef.current) {
      audioRef.current.volume = config.volume;
    }
  }, [config]);

  useEffect(() => {
    // Subscribe to updates
    const unsubscribe = window.api.onLibraryUpdated((updatedFiles) => {
      setAllTracks(updatedFiles);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedLibraryPath) {
      const loadTree = async () => {
        try {
          const data = await window.api.getDirectoryTree(selectedLibraryPath);
          setTree(data);
        } catch (error) {
          console.error("Failed to load directory tree:", error);
        }
      };
      loadTree();
    }
  }, [selectedLibraryPath]);

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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      if (isFinite(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      console.log("enter: handleSeek", time);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
    console.log("exit: handleSeek", currentTime);
  };

  const seekForward = () => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const newTime = Math.min(audio.duration || 0, audio.currentTime + 5);

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const seekBackward = () => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const newTime = Math.max(0, audio.currentTime - 5);

    audio.currentTime = newTime;
    setCurrentTime(newTime);
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

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTyping) return;

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlay();
          break;

        case 'PageDown':
          event.preventDefault();
          handleNext();
          break;

        case 'PageUp':
          event.preventDefault();
          handlePrevious();
          break;

        case 'MediaTrackNext':
          event.preventDefault();
          handleNext();
          break;

        case 'MediaTrackPrevious':
          event.preventDefault();
          handlePrevious();
          break;  
        case 'ArrowRight':
          event.preventDefault();
          seekForward();
          break;

        case 'ArrowLeft':
          event.preventDefault();
          seekBackward();
          break;

        case 'ArrowUp':
        case 'ArrowDown':
          const target = event.target as HTMLElement;
          const isScrollable = target.scrollHeight > target.clientHeight;
          if (!isScrollable) return;
          event.preventDefault();
          const scrollAmount = 40;
          if (event.code === 'ArrowDown') {
            target.scrollTop += scrollAmount;
          } else {
            target.scrollTop -= scrollAmount;
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, handleNext, handlePrevious, seekForward, seekBackward]);


  const renderQueue = () => {
    let totalDuration = 0;
    activeQueue.map((track, index) => totalDuration += track.metadata?.duration || 0)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 30px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#181818" }}>
          <h2 style={{ margin: 0 }}>Play Queue ({activeQueue.length} songs: {Math.floor(totalDuration / 60)}:{Math.floor(totalDuration % 60).toString().padStart(2, '0')})</h2>
          <button
            onClick={() => setQueue([])}
            style={{ background: "none", border: "1px solid #444", color: "#888", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
          >
            Clear Queue
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 0", paddingBottom: "120px" }}>
          {activeQueue.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#666" }}>Queue is empty</div>
          ) : (
            activeQueue.map((track, index) => (
              <div
                key={`${track.path}-${index}`}
                onClick={() => playTrack(track)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  padding: "10px 30px",
                  cursor: "pointer",
                  backgroundColor: index === currentIndex ? `${themeColor}22` : "transparent",
                  borderLeft: index === currentIndex ? `4px solid ${themeColor}` : "4px solid transparent",
                  transition: "background-color 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = index === currentIndex ? `${themeColor}33` : "#222"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = index === currentIndex ? `${themeColor}22` : "transparent"}
              >
                <div style={{ width: "30px", textAlign: "center", color: index === currentIndex ? (themeColor) : "#666", fontSize: "14px" }}>
                  {index + 1}
                </div>
                <div style={{ width: "40px", height: "40px", backgroundColor: "#333", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {track.metadata?.picture ? (
                    <img src={`media://${encodeURIComponent(track.metadata.picture)}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <IoMusicalNote style={{ color: "#555" }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", color: index === currentIndex ? (themeColor) : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {track.metadata?.title || track.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {track.metadata?.artist || "Unknown Artist"}
                  </div>
                </div>
                <div style={{ color: "#666", fontSize: "13px" }}>
                  {track.metadata?.duration ? `${Math.floor(track.metadata.duration / 60)}:${Math.floor(track.metadata.duration % 60).toString().padStart(2, '0')}` : "-:--"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const handleTrackUpdated = (updatedTrack: FileItem) => {
    setCurrentTrack(updatedTrack);
    setAllTracks(prev => prev.map(t => t.path === updatedTrack.path ? updatedTrack : t));
  };

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

  const renderGroupedView = (type: 'artist' | 'album' | 'genre') => {
    if (selectedGroup) {
      const filteredSongs = allTracks.filter(track => {
        const meta = track.metadata;
        if (!meta) return false;

        const isMatch = type === 'artist' ? (meta.artists ? meta.artists.includes(selectedGroup.name) : meta.artist === selectedGroup.name) :
                        type === 'album' ? meta.album === selectedGroup.name :
                        type === 'genre' ? meta.genre?.some((g: string) =>g.toLowerCase() === selectedGroup.name.toLowerCase()) : false;

        if (!isMatch) return false;

        // Internal search within the group
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const title = (meta.title || track.name).toLowerCase();
          const artist = (meta.artist || "").toLowerCase();
          const album = (meta.album || "").toLowerCase();
          return title.includes(query) || artist.includes(query) || album.includes(query);
        }

        return true;
      });

      // Sort songs by title
      filteredSongs.sort((a, b) => {
        const titleA = a.metadata?.title || a.name;
        const titleB = b.metadata?.title || b.name;
        const res = titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
        return sortDescending ? -res : res;
      });

      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: "100px" }}>
          <div style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <button
                onClick={() => {
                  setSelectedGroup(null);
                  setSearchQuery(""); // Clear search when going back
                }}
                style={{ background: "none", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <IoArrowBack /> Back to {type.charAt(0).toUpperCase() + type.slice(1)}s
              </button>
              <h2 style={{ margin: 0 }}>{selectedGroup.name}</h2>
            </div>

            {/* Internal Search */}
            <div style={{ position: "relative", width: "250px" }}>
              <IoSearch style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888" }} />
              <input
                type="text"
                placeholder={`Search in ${selectedGroup.name}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "#222",
                  border: "1px solid #333",
                  borderRadius: "20px",
                  padding: "8px 15px 8px 35px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none"
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", paddingBottom: "120px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "20px" }}>
              {filteredSongs.map(song => (
                <div
                  key={song.path}
                  onClick={() => handleFileSelect(song, filteredSongs)}
                  onDoubleClick={() => config?.doubleClickToPlay && handleFileSelect(song, filteredSongs)}
                  style={{
                    backgroundColor: "#1e1e1e",
                    padding: "15px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "center",
                    border: currentTrack?.path === song.path ? `1px solid ${themeColor}` : "1px solid #333",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#282828"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#1e1e1e"}
                >
                  <div style={{
                    width: "100%",
                    aspectRatio: "1/1",
                    backgroundColor: "#333",
                    borderRadius: "6px",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "40px",
                    overflow: "hidden"
                  }}>
                    {song.metadata?.picture ? (
                      <img
                        src={`media://${encodeURIComponent(song.metadata.picture)}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <IoMusicalNote style={{ color: "#555" }} />
                    )}
                  </div>
                  <div style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: currentTrack?.path === song.path ? (themeColor) : "#fff"
                  }}>
                    {song.metadata?.title || song.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {song.metadata?.artist || "Unknown Artist"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    const normalizeGenre = (genre: string): string => {
      return genre
        .toLowerCase()
        .split(' ')
        .map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(' ');
    };

    const groups: { [key: string]: number } = {};
    allTracks.forEach(track => {
      const meta = track.metadata;
      if (!meta) return;
      if (type === 'artist') {
        const artists = meta.artists || (meta.artist ? [meta.artist] : []);
        artists.forEach(a => {
          groups[a] = (groups[a] || 0) + 1;
        });
      } else if (type === 'album' && meta.album) {
        groups[meta.album] = (groups[meta.album] || 0) + 1;
      } else if (type === 'genre' && meta.genre) {
        meta.genre.forEach((g: string) => {
          const normalizedGenre = normalizeGenre(g.trim());
          groups[normalizedGenre] =
            (groups[normalizedGenre] || 0) + 1;
        });
      }
    });

    let groupEntries = Object.entries(groups);
    if (type === 'album' && config) {
      groupEntries = groupEntries.filter(([_, count]) => count >= config.minSongsForAlbum);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      groupEntries = groupEntries.filter(([name]) => name.toLowerCase().includes(query));
    }

    // Sort entries
    groupEntries.sort((a, b) => {
      let res = 0;
      if (sortBy === 'count') {
        res = a[1] - b[1];
        if (res === 0) res = a[0].localeCompare(b[0], undefined, { sensitivity: 'base' });
      } else {
        res = a[0].localeCompare(b[0], undefined, { sensitivity: 'base' });
      }
      return sortDescending ? -res : res;
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Page Header with Search and Sort */}
        <div style={{
          padding: "20px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #222",
          backgroundColor: "#181818"
        }}>
          <h2 style={{ margin: 0 }}>{type.charAt(0).toUpperCase() + type.slice(1)}s</h2>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {/* Sort Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#222", padding: "4px 12px", borderRadius: "20px", border: "1px solid #333" }}>
              <span style={{ fontSize: "12px", color: "#888" }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as GroupSortBy)}
                style={{ backgroundColor: "transparent", color: "#fff", border: "none", fontSize: "13px", cursor: "pointer", outline: "none" }}
              >
                <option value="alphabet" style={{ backgroundColor: "#222" }}>Alphabet</option>
                <option value="count" style={{ backgroundColor: "#222" }}>Song Count</option>
              </select>
              <button
                onClick={() => setSortDescending(!sortDescending)}
                style={{ background: "none", border: "none", color: sortDescending ? (themeColor) : "#888", display: "flex", alignItems: "center", cursor: "pointer", fontSize: "16px" }}
                title={sortDescending ? "Descending" : "Ascending"}
              >
                <IoSwapVertical />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: "relative", width: "300px" }}>
              <IoSearch style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888" }} />
              <input
                type="text"
                placeholder={`Search ${type}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "#222",
                  border: "1px solid #333",
                  borderRadius: "20px",
                  padding: "8px 15px 8px 35px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none"
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "30px", paddingBottom: "120px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "25px" }}>
            {groupEntries.map(([name, count]) => {
              // Find first track in group to get a picture
              const firstTrack = allTracks.find(track => {
                const meta = track.metadata;
                if (!meta) return false;
                if (type === 'artist') {
                  return meta.artists ? meta.artists.includes(name) : meta.artist === name;
                }
                if (type === 'album') return meta.album === name;
                if (type === 'genre') return meta.genre?.includes(name);
                return false;
              });
              const picture = firstTrack?.metadata?.picture;

              return (
                <div
                  key={name}
                  onClick={() => {
                    setSelectedGroup({ type, name });
                    setSearchQuery(""); // Clear search when entering a group
                  }}
                  style={{
                    backgroundColor: "#1e1e1e",
                    padding: "20px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.2s",
                    border: "1px solid #333"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#282828";
                    e.currentTarget.style.transform = "translateY(-5px)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#1e1e1e";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{
                    width: "120px",
                    height: "120px",
                    backgroundColor: "#333",
                    borderRadius: type === 'artist' ? "50%" : "8px",
                    margin: "0 auto 15px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "50px",
                    boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
                    overflow: "hidden"
                  }}>
                    {picture ? (
                      <img
                        src={`media://${encodeURIComponent(picture)}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      type === 'artist' ? <IoPerson style={{ color: "#555" }} /> :
                      type === 'album' ? <IoDisc style={{ color: "#555" }} /> :
                      <IoMusicalNotes style={{ color: "#555" }} />
                    )}
                  </div>
                  <div style={{ fontWeight: "bold", marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#888" }}>
                    {count} {count === 1 ? 'song' : 'songs'}
                  </div>
                </div>
              );
            })}
            {groupEntries.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "50px", color: "#666" }}>
                {searchQuery ? `No results for "${searchQuery}"` : `No ${type}s found in your library.`}
              </div>
            )}
          </div>
        </div>
        <div style={{marginBottom: "2%"}}></div>
      </div>
    );
  };

  const renderLibrary = () => {
    if (selectedLibraryPath) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: "15px",
            borderBottom: "1px solid #333",
            backgroundColor: "#181818",
            flexShrink: 0
          }}>
            <button
              onClick={() => setSelectedLibraryPath(null)}
              style={{ background: "none", border: "1px solid #444", color: "#fff", padding: "4px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
            >
              <IoArrowBack /> Back
            </button>
            <span style={{ fontSize: "13px", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedLibraryPath}
            </span>
          </div>
          <div style={{
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
            paddingBottom: "120px"
          }}>
            <DirectoryTree
              items={tree}
              onFileSelect={handleFileSelect}
              useDoubleClick={config?.doubleClickToPlay ?? true}
              themeColor={themeColor}
            />
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: "30px", overflowY: "auto", height: "100%", paddingBottom: "120px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <h2 style={{ margin: 0 }}>Library Folders</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleRefreshLibrary}
              style={{ backgroundColor: "#333", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              Refresh Library
            </button>
            <button
              onClick={handleAddFolder}
              style={{ backgroundColor: themeColor, color: "#fff", border: "none", padding: "10px 20px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              Add Folder
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
          {config?.libraryPaths.map((path) => (
            <div
              key={path}
              onClick={() => setSelectedLibraryPath(path)}
              style={{
                backgroundColor: "#1e1e1e",
                padding: "20px",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background-color 0.2s",
                position: "relative",
                border: "1px solid #333"
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#282828"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#1e1e1e"}
            >
              <div style={{ fontSize: "40px", marginBottom: "10px", color: themeColor }}>
                <IoFolder />
              </div>
              <div style={{ fontWeight: "bold", marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {path.split(/[\\/]/).pop()}
              </div>
              <div style={{ fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {path}
              </div>
              <button
                onClick={(e) => handleRemoveFolder(e, path)}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  background: "none",
                  border: "none",
                  color: "#666",
                  fontSize: "18px",
                  cursor: "pointer",
                  padding: "5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onMouseOver={(e) => e.currentTarget.style.color = "#ff4444"}
                onMouseOut={(e) => e.currentTarget.style.color = "#666"}
              >
                <IoClose />
              </button>
            </div>
          ))}
          {(!config || config.libraryPaths.length === 0) && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "50px", color: "#666" }}>
              No folders added to library. Click "Add Folder" to start.
            </div>
          )}
        </div>
      </div>
    );
  };

  const navItemStyle = (tab: Page): React.CSSProperties => ({
    padding: "10px 20px",
    cursor: "pointer",
    borderBottom: activeTab === tab ? `3px solid ${themeColor}` : "3px solid transparent",
    color: activeTab === tab ? "#fff" : "#888",
    fontWeight: activeTab === tab ? "bold" : "normal",
    transition: "all 0.2s"
  });

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
      {view !== 'details' && (
        <nav style={{
          display: "flex",
          backgroundColor: "#000",
          padding: "0 20px",
          gap: "10px",
          borderBottom: "1px solid #222",
          flexShrink: 0
        }}>
          <div style={navItemStyle('library')} onClick={() => handleTabChange('library')}>Library</div>
          <div style={navItemStyle('artists')} onClick={() => handleTabChange('artists')}>Artists</div>
          <div style={navItemStyle('albums')} onClick={() => handleTabChange('albums')}>Albums</div>
          <div style={navItemStyle('genres')} onClick={() => handleTabChange('genres')}>Genres</div>
          <div style={navItemStyle('playlists')} onClick={() => handleTabChange('playlists')}>Playlists</div>
          <div style={{ ...navItemStyle('queue' as any), marginLeft: 'auto' }} onClick={() => setView('queue')}>Queue</div>
        </nav>
      )}

      <main style={{
        flex: 1,
        minHeight: 0, // Critical for nested scrolling
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative"
      }}>
        {view === 'library' ? renderLibrary() :
          view === 'artists' ? renderGroupedView('artist') :
            view === 'albums' ? renderGroupedView('album') :
              view === 'genres' ? renderGroupedView('genre') :
                view === 'playlists' ? <PlaylistView allTracks={allTracks} themeColor={themeColor} onPlayTrack={playTrack} currentTrack={currentTrack} configDoubleClickToPlay={config?.doubleClickToPlay ?? true} /> :
                  view === 'queue' ? renderQueue() :
                    view === 'details' ? renderDetails() : null}
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
