import crypto from "crypto";

// Location key of a file (normalized separators). A song's id (FileItem.hash) is created from it
// when the song first enters the library and is kept when the file is moved or renamed, so an id
// can differ from hashPath(song.path); the library cache is keyed by hashPath.
export const hashPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  return crypto.createHash("sha1").update(normalized).digest("hex");
};
