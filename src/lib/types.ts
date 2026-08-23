export type Folder = {
  id: string;
  name: string;
  path: string;
  addedAt: number;
};

export type MediaKind = "image" | "gif" | "video";
export type CaptureType = "image" | "link" | "article" | "video" | "gif";

export type MediaItem = {
  id: string;
  folderId: string;
  path: string;
  name: string;
  extension: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  createdAt?: number;
  modifiedAt?: number;
  tags: string[];
  dominantColors: string[];
  colorNames: string[];
  missing: boolean;
  captureType?: CaptureType;
  sourceUrl?: string;
  sourceFinalUrl?: string;
  sourcePageUrl?: string;
  sourceCanonicalUrl?: string;
  sourceLinkUrl?: string;
  sourceTitle?: string;
  sourcePageTitle?: string;
  sourceSiteName?: string;
  sourceDescription?: string;
  sourceByline?: string;
  sourceContentMarkdown?: string;
  capturedAt?: string;
};

export type LibraryState = {
  folders: Folder[];
  items: MediaItem[];
};

export type ViewMode = "grid" | "focus";
export type SearchMode = "normal" | "smart";
export type GridLayout = "packed" | "aligned";
