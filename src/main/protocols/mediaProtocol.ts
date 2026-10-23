import { protocol } from "electron";
import fs from "fs";
import path from "path";

const getMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    case ".m4a":
      return "audio/mp4";
    case ".flac":
      return "audio/flac";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
};

// Parses a single-range "Range" header ("bytes=start-end", "bytes=start-" or "bytes=-suffix").
// Returns null for headers to ignore (malformed or multi-range: the whole file is sent, as HTTP
// allows), or "unsatisfiable" when the range lies outside the file (answered with 416).
const parseRange = (
  header: string,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;

  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (match[2] !== "" && Number(match[2]) < start) return null;
  if (start >= size) return "unsatisfiable";
  return { start, end };
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
      const rangeHeader = request.headers.get("range");
      const range = rangeHeader ? parseRange(rangeHeader, stats.size) : null;

      if (range === "unsatisfiable") {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${stats.size}`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (range) {
        const { start, end } = range;
        const chunksize = end - start + 1;

        const file = fs.createReadStream(decodedPath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": mimeType,
          // Required so the Web Audio equalizer can process media:// audio
          // without the element being treated as cross-origin (which mutes it).
          "Access-Control-Allow-Origin": "*",
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
          "Access-Control-Allow-Origin": "*",
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
