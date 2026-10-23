import path from "path";

// Comparable form of a folder path: absolute, no trailing separator, and case-insensitive on
// Windows (where "D:\Music" and "d:\music" are the same folder).
const comparable = (p: string): string => {
  let resolved = path.resolve(p);
  if (resolved.length > path.parse(resolved).root.length) {
    resolved = resolved.replace(/[\\/]+$/, "");
  }
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

export const isSamePath = (a: string, b: string): boolean => comparable(a) === comparable(b);

// True if `target` is `folder` itself or anything inside it. Compares whole path segments, so
// "D:\Music\AB" is not inside "D:\Music\A".
export const isSameOrInside = (target: string, folder: string): boolean => {
  const t = comparable(target);
  const f = comparable(folder);
  if (t === f) return true;
  return t.startsWith(f.endsWith(path.sep) ? f : f + path.sep);
};

// Drops folders that are inside another folder of the list (and duplicates), so nothing is
// scanned twice even if an older config still contains nested library folders.
export const outermostFolders = (folders: string[]): string[] =>
  folders.filter(
    (folder, i) =>
      !folders.some(
        (other, j) =>
          j !== i &&
          isSameOrInside(folder, other) &&
          // of two identical entries, keep the first
          (!isSamePath(folder, other) || j < i),
      ),
  );
