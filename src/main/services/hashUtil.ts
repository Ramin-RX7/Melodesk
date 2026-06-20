import crypto from "crypto";

// Stable identifier for a song. Derived from the file path (normalized separators)
// so it survives metadata/tag edits, which rewrite the file in place without
// changing its location.
export const hashPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  return crypto.createHash("sha1").update(normalized).digest("hex");
};
