import type { MediaItem } from "./types";

export function searchMedia(items: MediaItem[], query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return items;

  return items.filter((item) => item.name.toLowerCase().includes(term));
}
