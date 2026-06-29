import { convertFileSrc } from "@tauri-apps/api/core";
import type { MediaItem } from "./types";

export function mediaSrc(item: MediaItem) {
  return convertFileSrc(item.path);
}

export function folderNameFromPath(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function formatCount(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
