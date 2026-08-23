import { convertFileSrc } from "@tauri-apps/api/core";
import type { MediaItem } from "./types";

export function mediaSrc(item: MediaItem) {
  return convertFileSrc(item.path);
}

export function isGeneratedLinkPlaceholder(item: MediaItem) {
  return item.captureType === "link" && /^clipboard-link-\d+\.(?:png|jpe?g|webp)$/i.test(item.name);
}

export function sourceHostname(item: MediaItem) {
  const value = item.sourceLinkUrl
    || item.sourcePageUrl
    || item.sourceCanonicalUrl
    || item.sourceFinalUrl
    || item.sourceUrl;
  if (!value) return item.sourceSiteName || "Saved page";
  try {
    return new URL(value).hostname.replace(/^www\./, "") || item.sourceSiteName || "Saved page";
  } catch {
    return item.sourceSiteName || "Saved page";
  }
}

export function folderNameFromPath(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function formatCount(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
