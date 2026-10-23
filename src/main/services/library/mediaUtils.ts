import path from "path";

export const isMediaFile = (fileName: string): boolean => {
  const mediaExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];
  const ext = path.extname(fileName).toLowerCase();
  return mediaExtensions.includes(ext);
};
