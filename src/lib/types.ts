export type Folder = {
  id: string;
  name: string;
  path: string;
  addedAt: number;
};

export type MediaKind = "image" | "gif";

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
};

export type LibraryState = {
  folders: Folder[];
  items: MediaItem[];
};

export type ViewMode = "grid" | "focus";
export type SearchMode = "normal" | "smart";
export type GridLayout = "packed" | "aligned";
