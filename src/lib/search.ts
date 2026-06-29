import type { MediaItem, SearchMode } from "./types";

export function searchMedia(items: MediaItem[], query: string, mode: SearchMode, folderNames = new Map<string, string>()) {
  const term = query.trim().toLowerCase();
  if (!term) return items;

  return items.filter((item) => {
    if (mode === "smart") {
      return item.colorNames.some((color) => color.includes(term));
    }

    return `${item.name} ${folderNames.get(item.folderId) ?? ""} ${item.tags.join(" ")}`
      .toLowerCase()
      .includes(term);
  });
}
