import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } from "electron";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

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
    album?: string;
    genre?: string[];
    duration?: number;
    picture?: string; // Base64 picture
  };
}

/* ---------------- CONFIG & CACHE ---------------- */

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const CACHE_PATH = path.join(app.getPath("userData"), "library_cache.json");
const DEFAULT_CONFIG: UserConfig = {
  doubleClickToPlay: true,
  libraryPaths: [`D:\\music\\Favorite Fa`],
  minSongsForAlbum: 3,
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

/* ---------------- UTILS ---------------- */

const isMediaFile = (fileName: string): boolean => {
  const mediaExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];
  const ext = path.extname(fileName).toLowerCase();
  return mediaExtensions.includes(ext);
};

let musicMetadataModule: any = null;

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
            let pictureBase64 = undefined;
            if (metadata.common.picture && metadata.common.picture.length > 0) {
              const pic = metadata.common.picture[0];
              // Ensure we use Buffer.from to get a real Node Buffer before base64 encoding
              const base64Data = Buffer.from(pic.data).toString("base64");
              pictureBase64 = `data:${pic.format};base64,${base64Data}`;
            }

            item.metadata = {
              title: metadata.common.title,
              artist: metadata.common.artist,
              album: metadata.common.album,
              genre: metadata.common.genre,
              duration: metadata.format.duration,
              picture: pictureBase64,
            };
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
          let pictureBase64 = undefined;
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            // Ensure we use Buffer.from to get a real Node Buffer before base64 encoding
            const base64Data = Buffer.from(pic.data).toString("base64");
            // pictureBase64 = `data:${pic.format};base64,${base64Data}`;
          }

          results.push({
            name: file.name,
            path: fullPath,
            isDirectory: false,
            isMedia: true,
            metadata: {
              title: metadata.common.title,
              artist: metadata.common.artist,
              album: metadata.common.album,
              genre: metadata.common.genre,
              duration: metadata.format.duration,
              // picture: pictureBase64,
            },
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

ipcMain.handle("update-config", (_event, partialConfig: Partial<UserConfig>) => {
  const currentConfig = getConfig();
  const newConfig = { ...currentConfig, ...partialConfig };
  saveConfig(newConfig);
  return newConfig;
});

ipcMain.handle("get-library-files", async () => {
  const cachedFiles = getCache();

  // Start async update
  const config = getConfig();
  (async () => {
    let allFiles: FileItem[] = [];
    for (const dirPath of config.libraryPaths) {
      const files = await getAllMediaFiles(dirPath);
      allFiles = allFiles.concat(files);
    }
    saveCache(allFiles);
    // Note: We don't have an easy way to push this to the renderer
    // without a custom event, but the next time they call it they'll get fresh data.
    // Or we can emit an IPC message.
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send("library-updated", allFiles);
    });
  })();

  return cachedFiles;
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

app.whenReady().then(() => {
  // Handle media:// protocol
  protocol.handle("media", (request) => {
    try {
      const url = new URL(request.url);
      // The path is encoded in the "hostname" and "pathname" parts if we use media://encodedPath
      // But it's easier to just grab everything after media://
      const encodedPath = request.url.slice("media://".length);
      const decodedPath = decodeURIComponent(encodedPath);

      // On Windows, if the path was D:/music..., it might come out as D:/music...
      // pathToFileURL handles this correctly if it's a valid absolute path
      return net.fetch(pathToFileURL(decodedPath).toString());
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
