import { protocol } from "electron";
import fs from "fs";
import path from "path";

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


export function registerMediaProtocol() {
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

}