import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } from "electron";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import crypto from "crypto";

/* ---------------- PROTOCOL ---------------- */

// Register media protocol to handle local file loading
protocol.registerSchemesAsPrivileged([
  { scheme: "media", privileges: { bypassCSP: true, stream: true } }
]);

/* ---------------- TYPES ---------------- */

interface UserConfig {
  doubleClickToPlay: boolean;
  libraryPaths: string[];
  minSongsForAlbum: number;
  themeColor: string;
  volume: number;
}

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isMedia: boolean;
  children?: FileItem[];
  metadata?: {
    title?: string;
    artist?: string;
    artists?: string[];
    album?: string;
    genre?: string[];
    duration?: number;
    picture?: string; // Path or URL
  };
}

interface Playlist {
  id: string;
  name: string;
  songs: string[];
  createdAt: string;
  updatedAt: string;
}

/* ---------------- CONFIG & CACHE ---------------- */

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const CACHE_PATH = path.join(app.getPath("userData"), "library_cache.json");
const ART_CACHE_DIR = path.join(app.getPath("userData"), "art_cache");
const PLAYLISTS_DIR = path.join(app.getPath("userData"), "playlists");

if (!fs.existsSync(ART_CACHE_DIR)) {
  fs.mkdirSync(ART_CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(PLAYLISTS_DIR)) {
  fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
}
const DEFAULT_CONFIG: UserConfig = {
  doubleClickToPlay: true,
  libraryPaths: [`D:\\music\\Favorite Fa`],
  minSongsForAlbum: 3,
  themeColor: "#1db954",
  volume: 0.5,
};

const getConfig = (): UserConfig => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Failed to read config:", error);
  }
  return DEFAULT_CONFIG;
};

const saveConfig = (config: UserConfig) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Failed to save config:", error);
  }
};

const getCache = (): FileItem[] => {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const data = fs.readFileSync(CACHE_PATH, "utf-8");
      const cache = JSON.parse(data);
      console.log(`Loaded ${cache.length} items from cache.`);
      console.log(app.getPath("userData"));
      return cache;
    }
  } catch (error) {
    console.error("Failed to read cache:", error);
  }
  console.log("No cache found or failed to read.");
  return [];
};

const saveCache = (cache: FileItem[]) => {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache)); // No formatting to keep it smaller
    console.log(`Saved ${cache.length} items to cache.`);
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
};

/* ---------------- LIBRARY WATCHER ---------------- */

let watcher: any = null;
let chokidarModule: any = null;
let updateTimeout: NodeJS.Timeout | null = null;

const updateLibrary = async () => {
  console.log("Starting library update...");
  const config = getConfig();
  let allFiles: FileItem[] = [];
  for (const dirPath of config.libraryPaths) {
    if (fs.existsSync(dirPath)) {
      const files = await getAllMediaFiles(dirPath);
      allFiles = allFiles.concat(files);
    }
  }
  saveCache(allFiles);
  console.log(`Library update complete. Found ${allFiles.length} files.`);
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("library-updated", allFiles);
  });
};

const setupWatcher = async () => {
  if (watcher) {
    console.log("Closing existing watcher...");
    await watcher.close();
    watcher = null;
  }

  const config = getConfig();
  if (config.libraryPaths.length === 0) {
    console.log("No library paths to watch.");
    return;
  }

  console.log("Setting up watcher for paths:", config.libraryPaths);
  if (!chokidarModule) {
    chokidarModule = await eval('import("chokidar")');
  }

  // Only watch paths that exist
  const existingPaths = config.libraryPaths.filter(p => fs.existsSync(p));

  if (existingPaths.length === 0) return;

  watcher = chokidarModule.watch(existingPaths, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  const debouncedUpdate = () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(async () => {
      console.log("Library change detected, updating cache...");
      await updateLibrary();
    }, 2000); // Wait 2 seconds of silence before updating
  };

  watcher
    .on("add", (path: string) => {
      console.log(`File added: ${path}`);
      debouncedUpdate();
    })
    .on("change", (path: string) => {
      console.log(`File changed: ${path}`);
      debouncedUpdate();
    })
    .on("unlink", (path: string) => {
      console.log(`File removed: ${path}`);
      debouncedUpdate();
    })
    .on("addDir", (path: string) => {
      console.log(`Directory added: ${path}`);
      debouncedUpdate();
    })
    .on("unlinkDir", (path: string) => {
      console.log(`Directory removed: ${path}`);
      debouncedUpdate();
    })
    .on("error", (error: Error) => console.error(`Watcher error: ${error}`));
};

/* ---------------- UTILS ---------------- */

const isMediaFile = (fileName: string): boolean => {
  const mediaExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];
  const ext = path.extname(fileName).toLowerCase();
  return mediaExtensions.includes(ext);
};

const getMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    case ".m4a": return "audio/mp4";
    case ".flac": return "audio/flac";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    default: return "application/octet-stream";
  }
};

let musicMetadataModule: any = null;

const saveArt = (buffer: Buffer, format: string, filePath: string): string | undefined => {
  try {
    const hash = crypto.createHash("md5").update(filePath).digest("hex");
    const ext = format.split("/")[1] || "jpg";
    const artPath = path.join(ART_CACHE_DIR, `${hash}.${ext}`);

    if (!fs.existsSync(artPath)) {
      fs.writeFileSync(artPath, buffer);
    }
    return artPath;
  } catch (err) {
    console.error("Failed to save art:", err);
    return undefined;
  }
};

const splitArtists = (value: string): string[] => {
  return value
    .split(/[,;&/]|\s+feat\.?\s+|\s+ft\.?\s+/i)
    .map((a) => a.trim())
    .filter(Boolean);
};

const getArtists = (metadata: any): string[] => {
  const artistSet = new Set<string>();

  // Main artists
  if (Array.isArray(metadata.common.artists)) {
    metadata.common.artists.forEach((a: string) => {
      splitArtists(a).forEach((x) => artistSet.add(x));
    });
  }

  // Single artist string fallback
  if (metadata.common.artist) {
    splitArtists(metadata.common.artist).forEach((x) =>
      artistSet.add(x)
    );
  }

  // Album artists
  if (Array.isArray(metadata.common.albumartists)) {
    metadata.common.albumartists.forEach((a: string) => {
      splitArtists(a).forEach((x) => artistSet.add(x));
    });
  }

  // Single album artist fallback
  if (metadata.common.albumartist) {
    splitArtists(metadata.common.albumartist).forEach((x) =>
      artistSet.add(x)
    );
  }

  return Array.from(artistSet);
};

const extractMetadata = (metadata: any, fullPath: string, artPath?: string) => {
  const stats = fs.statSync(fullPath);
  return {
    title: metadata.common.title,
    artist: metadata.common.artist,
    artists: getArtists(metadata),
    album: metadata.common.album,
    genre: metadata.common.genre,
    duration: metadata.format.duration,
    picture: artPath,
    year: metadata.common.year || (metadata.common.date ? parseInt(metadata.common.date.substring(0, 4)) : undefined),
    trackNumber: metadata.common.track?.no,
    fileSize: stats.size,
    format: metadata.format.codec || metadata.format.container,
    bitrate: metadata.format.bitrate,
    bpm: metadata.common.bpm,
  };
};

const getDirectoryTree = async (dirPath: string): Promise<FileItem[]> => {
  try {
    if (!musicMetadataModule) {
      // Use eval to prevent tsc from transpiling import() to require()
      musicMetadataModule = await eval('import("music-metadata")');
    }

    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    const items: FileItem[] = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dirPath, file.name);
        const isDirectory = file.isDirectory();
        const isMedia = !isDirectory && isMediaFile(file.name);

        const item: FileItem = {
          name: file.name,
          path: fullPath,
          isDirectory,
          isMedia,
        };

        if (isDirectory) {
          item.children = await getDirectoryTree(fullPath);
        } else if (isMedia) {
          try {
            const metadata = await musicMetadataModule.parseFile(fullPath);
            let artPath = undefined;
            if (metadata.common.picture && metadata.common.picture.length > 0) {
              const pic = metadata.common.picture[0];
              artPath = saveArt(Buffer.from(pic.data), pic.format, fullPath);
            }

            item.metadata = extractMetadata(metadata, fullPath, artPath);
          } catch (err) {
            console.error(`Failed to parse metadata for ${fullPath}:`, err);
          }
        }

        return item;
      })
    );

    // Sort: Directories first, then files alphabetically
    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
};

const getAllMediaFiles = async (dirPath: string): Promise<FileItem[]> => {
  let results: FileItem[] = [];
  try {
    if (!musicMetadataModule) {
      musicMetadataModule = await eval('import("music-metadata")');
    }

    if (!fs.existsSync(dirPath)) return [];
    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        const subFiles = await getAllMediaFiles(fullPath);
        results = results.concat(subFiles);
      } else if (isMediaFile(file.name)) {
        try {
          const metadata = await musicMetadataModule.parseFile(fullPath);
          let artPath = undefined;
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            artPath = saveArt(Buffer.from(pic.data), pic.format, fullPath);
          }

          results.push({
            name: file.name,
            path: fullPath,
            isDirectory: false,
            isMedia: true,
            metadata: extractMetadata(metadata, fullPath, artPath),
          });
        } catch (err) {
          console.error(`Failed to parse metadata for ${fullPath}:`, err);
          results.push({
            name: file.name,
            path: fullPath,
            isDirectory: false,
            isMedia: true,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error crawling directory ${dirPath}:`, error);
  }
  return results;
};

/* ---------------- IPC HANDLER ---------------- */

ipcMain.handle("get-config", () => {
  return getConfig();
});

ipcMain.handle("update-config", async (_event, partialConfig: Partial<UserConfig>) => {
  const currentConfig = getConfig();
  const newConfig = { ...currentConfig, ...partialConfig };
  saveConfig(newConfig);

  // Re-setup watcher if library paths changed
  if (partialConfig.libraryPaths) {
    await setupWatcher();
  }

  return newConfig;
});

ipcMain.handle("get-library-files", async () => {
  const cachedFiles = getCache();

  // Always check if cache is consistent with library paths on startup/request
  const config = getConfig();
  const allExisting = cachedFiles.filter(f => {
    return config.libraryPaths.some(lp => f.path.startsWith(lp));
  });

  if (allExisting.length !== cachedFiles.length) {
    console.log("Cache contains stale paths, updating...");
    updateLibrary();
  } else if (cachedFiles.length === 0) {
    updateLibrary();
  }

  return allExisting;
});

ipcMain.handle("show-context-menu", (event) => {
  const template = [
    { label: "Option 1", click: () => console.log("Option 1 clicked") },
    { label: "Option 2", click: () => console.log("Option 2 clicked") },
    { type: "separator" as const },
    { label: "Static Action", click: () => console.log("Static Action clicked") },
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! });
});

ipcMain.handle("get-directory-tree", async (_event, dirPath: string) => {
  return getDirectoryTree(dirPath);
});

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("refresh-library", async () => {
  await updateLibrary();
});

ipcMain.handle("get-metadata", async (_event, filePath: string) => {
  if (!musicMetadataModule) {
    musicMetadataModule = await eval('import("music-metadata")');
  }

  const isMedia = isMediaFile(filePath);
  if (!isMedia) return null;

  try {
    const metadata = await musicMetadataModule.parseFile(filePath);
    let artPath = undefined;
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      artPath = saveArt(Buffer.from(pic.data), pic.format, filePath);
    }

    return {
      name: path.basename(filePath),
      path: filePath,
      isDirectory: false,
      isMedia: true,
      metadata: extractMetadata(metadata, filePath, artPath),
    };
  } catch (err) {
    console.error(`Failed to parse metadata for ${filePath}:`, err);
    return {
      name: path.basename(filePath),
      path: filePath,
      isDirectory: false,
      isMedia: true,
    };
  }
});

let nodeId3Module: any = null;

ipcMain.handle("write-metadata", async (_event, filePath: string, tags: any) => {
  try {
    if (!nodeId3Module) {
      nodeId3Module = await eval('import("node-id3")');
    }
    const success = nodeId3Module.default.update(tags, filePath);
    return success === true;
  } catch (error) {
    console.error("Failed to write metadata (node-id3 might not be installed):", error);
    return false;
  }
});

/* ---------------- PLAYLIST IPC HANDLERS ---------------- */

const getAllPlaylists = (): Playlist[] => {
  try {
    const files = fs.readdirSync(PLAYLISTS_DIR).filter(f => f.endsWith(".json"));
    return files.map(f => {
      const data = fs.readFileSync(path.join(PLAYLISTS_DIR, f), "utf-8");
      return JSON.parse(data) as Playlist;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error("Failed to read playlists:", error);
    return [];
  }
};

const savePlaylist = (playlist: Playlist) => {
  const filePath = path.join(PLAYLISTS_DIR, `${playlist.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(playlist, null, 2));
};

ipcMain.handle("get-playlists", () => {
  return getAllPlaylists();
});

ipcMain.handle("get-playlist", (_event, id: string) => {
  const filePath = path.join(PLAYLISTS_DIR, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as Playlist;
    }
  } catch (error) {
    console.error("Failed to read playlist:", error);
  }
  return null;
});

ipcMain.handle("create-playlist", (_event, name: string) => {
  const playlist: Playlist = {
    id: crypto.randomUUID(),
    name,
    songs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  savePlaylist(playlist);
  return playlist;
});

ipcMain.handle("update-playlist", (_event, id: string, data: Partial<Pick<Playlist, 'name' | 'songs'>>) => {
  const filePath = path.join(PLAYLISTS_DIR, `${id}.json`);
  try {
    if (!fs.existsSync(filePath)) return null;
    const existing = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Playlist;
    const updated: Playlist = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    savePlaylist(updated);
    return updated;
  } catch (error) {
    console.error("Failed to update playlist:", error);
    return null;
  }
});

ipcMain.handle("delete-playlist", (_event, id: string) => {
  const filePath = path.join(PLAYLISTS_DIR, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete playlist:", error);
  }
});

/* ---------------- WINDOW ---------------- */

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile(path.join(__dirname, "renderer/index.html"));

}

app.whenReady().then(async () => {
  // Setup file watcher
  await setupWatcher();

  // Also run a background update on startup
  updateLibrary();

  // Handle media:// protocol
  protocol.handle("media", (request) => {
    try {
      const encodedPath = request.url.slice("media://".length);
      let decodedPath = decodeURIComponent(encodedPath);

      // Normalize path for Windows
      if (process.platform === "win32") {
        if (decodedPath.startsWith("/") && /^\/[a-zA-Z]:/.test(decodedPath)) {
          decodedPath = decodedPath.slice(1);
        }
      }

      if (!fs.existsSync(decodedPath)) {
        console.error(`File not found: ${decodedPath}`);
        return new Response("File not found", { status: 404 });
      }

      const stats = fs.statSync(decodedPath);
      const mimeType = getMimeType(decodedPath);
      const range = request.headers.get("range");

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;

        const file = fs.createReadStream(decodedPath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": mimeType,
        };

        return new Response(file as any, {
          status: 206,
          headers: head,
        });
      } else {
        const head = {
          "Content-Length": stats.size.toString(),
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
        };

        return new Response(fs.createReadStream(decodedPath) as any, {
          status: 200,
          headers: head,
        });
      }
    } catch (error) {
      console.error("Protocol handler error:", error);
      return new Response("Invalid media URL", { status: 400 });
    }
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
