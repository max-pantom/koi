import type { MediaItem, SearchMode } from "./types";

export function searchMedia(items: MediaItem[], query: string, mode: SearchMode, folderNames = new Map<string, string>()) {
  const term = query.trim().toLowerCase();
  if (!term) return items;
  const tokens = term.split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    const normalText = `${item.name} ${folderNames.get(item.folderId) ?? ""} ${item.tags.join(" ")}`.toLowerCase();

    if (mode === "smart") {
      const smartText = `${normalText} ${item.colorNames.join(" ")} ${item.dominantColors.join(" ")}`.toLowerCase();
      return tokens.every((token) => smartText.includes(token));
    }

    return normalText.includes(term);
  });
}
