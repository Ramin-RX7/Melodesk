import { app } from "electron";
import fs from "fs";
import path from "path";
import { FileItem } from "../../renderer/types";


const CACHE_PATH = path.join(app.getPath("userData"), "library_cache.json");



export const getCache = (): FileItem[] => {
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

export const saveCache = (cache: FileItem[]) => {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache)); // No formatting to keep it smaller
    console.log(`Saved ${cache.length} items to cache.`);
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
};
