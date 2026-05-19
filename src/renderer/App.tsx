import React, { useEffect, useState, useRef } from "react";
import { DirectoryTree } from "./components/DirectoryTree";
import { PlaybackBar } from "./components/PlaybackBar";
import { FileItem, UserConfig } from "./types";
import {
  IoArrowBack,
  IoFolder,
  IoPerson,
  IoDisc,
  IoMusicalNotes,
  IoClose,
  IoMusicalNote
} from "react-icons/io5";

type Page = 'library' | 'artists' | 'genres' | 'albums' | 'playlists' | 'details';

export default function App() {
  const [activeTab, setActiveTab] = useState<Exclude<Page, 'details'>>('library');
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

  const handleTabChange = (tab: Exclude<Page, 'details'>) => {
    setActiveTab(tab);
    setView(tab);
    setSelectedGroup(null);
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
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleFileSelect = (item: FileItem) => {
    if (item.isMedia) {
      if (currentTrack?.path === item.path) {
        togglePlay();
      } else {
        setCurrentTrack(item);
        if (audioRef.current) {
          const normalizedPath = item.path.replace(/\\/g, "/");
          audioRef.current.src = `media://${encodeURIComponent(normalizedPath)}`;
          audioRef.current.play();
          setIsPlaying(true);
        }
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

  const renderDetails = () => {
    if (!currentTrack) return <div style={{ padding: 20 }}>No track selected</div>;
    const { title, artist, album, genre, picture } = currentTrack.metadata || {};

    return (
      <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", textAlign: "center", overflowY: "auto", paddingBottom: "120px" }}>
        <button
          onClick={() => setView(activeTab)}
          style={{ alignSelf: "flex-start", background: "none", border: "1px solid #444", color: "#fff", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        >
          <IoArrowBack /> Back
        </button>

        <div style={{ width: "300px", height: "300px", backgroundColor: "#333", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "100px", marginBottom: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          {picture ? (
            <img src={picture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <IoMusicalNote style={{ color: "#555" }} />
          )}
        </div>

        <div style={{ maxWidth: "600px" }}>
          <h2 style={{ fontSize: "36px", margin: "0 0 10px 0" }}>{title || currentTrack.name}</h2>
          <p style={{ fontSize: "24px", color: "#1db954", margin: "0 0 10px 0", fontWeight: "bold" }}>{artist || "Unknown Artist"}</p>
          <p style={{ fontSize: "18px", color: "#aaa", margin: "0 0 5px 0" }}>{album ? `Album: ${album}` : "No Album"}</p>
          {genre && genre.length > 0 && (
            <p style={{ fontSize: "16px", color: "#666", marginTop: "15px" }}>Genre: {genre.join(", ")}</p>
          )}
        </div>
      </div>
    );
  };

  const renderGroupedView = (type: 'artist' | 'album' | 'genre') => {
    if (selectedGroup) {
      const filteredSongs = allTracks.filter(track => {
        const meta = track.metadata;
        if (!meta) return false;
        if (type === 'artist') return meta.artist === selectedGroup.name;
        if (type === 'album') return meta.album === selectedGroup.name;
        if (type === 'genre') return meta.genre?.includes(selectedGroup.name);
        return false;
      });

      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: "100px" }}>
          <div style={{ padding: "20px", display: "flex", alignItems: "center", gap: "15px", borderBottom: "1px solid #333" }}>
            <button
              onClick={() => setSelectedGroup(null)}
              style={{ background: "none", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <IoArrowBack /> Back to {type.charAt(0).toUpperCase() + type.slice(1)}s
            </button>
            <h2 style={{ margin: 0 }}>{selectedGroup.name}</h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "20px" }}>
              {filteredSongs.map(song => (
                <div
                  key={song.path}
                  onClick={() => handleFileSelect(song)}
                  onDoubleClick={() => config?.doubleClickToPlay && handleFileSelect(song)}
                  style={{
                    backgroundColor: "#1e1e1e",
                    padding: "15px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "center",
                    border: currentTrack?.path === song.path ? "1px solid #1db954" : "1px solid #333",
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
                      <img src={song.metadata.picture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                    color: currentTrack?.path === song.path ? "#1db954" : "#fff"
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

    const groups: { [key: string]: number } = {};
    allTracks.forEach(track => {
      const meta = track.metadata;
      if (!meta) return;
      if (type === 'artist' && meta.artist) {
        groups[meta.artist] = (groups[meta.artist] || 0) + 1;
      } else if (type === 'album' && meta.album) {
        groups[meta.album] = (groups[meta.album] || 0) + 1;
      } else if (type === 'genre' && meta.genre) {
        meta.genre.forEach(g => {
          groups[g] = (groups[g] || 0) + 1;
        });
      }
    });

    let groupEntries = Object.entries(groups);
    if (type === 'album' && config) {
      groupEntries = groupEntries.filter(([_, count]) => count >= config.minSongsForAlbum);
    }

    return (
      <div style={{ padding: "30px", overflowY: "auto", height: "100%", paddingBottom: "120px" }}>
        <h2 style={{ marginBottom: "30px" }}>{type.charAt(0).toUpperCase() + type.slice(1)}s</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "25px" }}>
          {groupEntries.map(([name, count]) => {
            // Find first track in group to get a picture
            const firstTrack = allTracks.find(track => {
              const meta = track.metadata;
              if (!meta) return false;
              if (type === 'artist') return meta.artist === name;
              if (type === 'album') return meta.album === name;
              if (type === 'genre') return meta.genre?.includes(name);
              return false;
            });
            const picture = firstTrack?.metadata?.picture;

            return (
              <div
                key={name}
                onClick={() => setSelectedGroup({ type, name })}
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
                    <img src={picture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
              No {type}s found in your library.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLibrary = () => {
    if (selectedLibraryPath) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: "100px" }}>
          <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: "15px", borderBottom: "1px solid #333", backgroundColor: "#181818" }}>
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
          <div style={{ flex: 1, overflow: "hidden" }}>
            <DirectoryTree
              items={tree}
              onFileSelect={handleFileSelect}
              useDoubleClick={config?.doubleClickToPlay ?? true}
            />
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: "30px", overflowY: "auto", height: "100%", paddingBottom: "120px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <h2 style={{ margin: 0 }}>Library Folders</h2>
          <button
            onClick={handleAddFolder}
            style={{ backgroundColor: "#1db954", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer", transition: "transform 0.2s" }}
            onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            Add Folder
          </button>
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
              <div style={{ fontSize: "40px", marginBottom: "10px", color: "#1db954" }}>
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
    borderBottom: activeTab === tab ? "3px solid #1db954" : "3px solid transparent",
    color: activeTab === tab ? "#fff" : "#888",
    fontWeight: activeTab === tab ? "bold" : "normal",
    transition: "all 0.2s"
  });

  return (
    <div style={{
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
        </nav>
      )}

      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {view === 'library' ? renderLibrary() :
          view === 'artists' ? renderGroupedView('artist') :
            view === 'albums' ? renderGroupedView('album') :
              view === 'genres' ? renderGroupedView('genre') :
                view === 'playlists' ? <div style={{ padding: 40 }}>Playlists (Coming Soon)</div> :
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
      />

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
