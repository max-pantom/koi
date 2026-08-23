import { invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useState } from "react";
import { searchMedia } from "../lib/search";
import type { Folder, GridLayout, LibraryState, MediaItem, SearchMode, ViewMode } from "../lib/types";

type LibraryStore = {
  folders: Folder[];
  items: MediaItem[];
  filteredItems: MediaItem[];
  selectedIndex: number;
  selectedItem?: MediaItem;
  query: string;
  searchMode: SearchMode;
  activeFolderId: string;
  gridColumns: number;
  gridLayout: GridLayout;
  inboxFolderId: string;
  viewMode: ViewMode;
  isLoading: boolean;
  error: string;
  loadLibrary: () => Promise<void>;
  addFolder: () => Promise<boolean>;
  addFolderPath: (path: string) => Promise<void>;
  rescan: () => Promise<boolean>;
  removeSelected: () => Promise<boolean>;
  removeItem: (mediaId: string) => Promise<boolean>;
  updateItemSize: (mediaId: string, width: number, height: number) => void;
  updateItemSizes: (measurements: Array<{ mediaId: string; width: number; height: number }>) => void;
  saveMediaIndex: (mediaId: string, dominantColors: string[], colorNames: string[]) => Promise<void>;
  extractMediaIndex: (mediaId: string) => Promise<void>;
  saveTags: (mediaId: string, tags: string[]) => Promise<void>;
  reconnectFolder: (folderId: string) => Promise<void>;
  setQuery: (query: string) => void;
  setSearchMode: (mode: SearchMode) => void;
  setActiveFolderId: (folderId: string) => void;
  setGridColumns: (columns: number) => void;
  setGridLayout: (layout: GridLayout) => void;
  setInboxFolderId: (folderId: string) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setSelectedIndex: (index: number) => void;
  moveSelection: (delta: number) => void;
  jumpToTop: () => void;
  jumpToBottom: () => void;
  clearError: () => void;
};

export function useLibraryStore(): LibraryStore {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectedIndex, setSelectedIndexState] = useState(() => readNumber("koi.selectedIndex", 0));
  const [query, setQueryState] = useState("");
  const [searchMode, setSearchModeState] = useState<SearchMode>("normal");
  const [activeFolderId, setActiveFolderId] = useState(() => localStorage.getItem("koi.activeFolderId") ?? "all");
  const [gridColumns, setGridColumnsState] = useState(() => clamp(readNumber("koi.gridColumns", 6), 3, 16));
  const [gridLayout, setGridLayoutState] = useState<GridLayout>(
    () => (localStorage.getItem("koi.gridLayout") === "aligned" ? "aligned" : "packed"),
  );
  const [inboxFolderId, setInboxFolderIdState] = useState(() => localStorage.getItem("koi.inboxFolderId") ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const scopedItems = useMemo(() => {
    if (activeFolderId === "all") return items;
    return items.filter((item) => item.folderId === activeFolderId);
  }, [activeFolderId, items]);
  const folderNames = useMemo(() => new Map(folders.map((folder) => [folder.id, folder.name])), [folders]);
  const filteredItems = useMemo(
    () => searchMedia(scopedItems, query, searchMode, folderNames),
    [folderNames, query, scopedItems, searchMode],
  );
  const selectedItem = filteredItems[Math.min(selectedIndex, Math.max(filteredItems.length - 1, 0))];

  const setLibrary = useCallback((library: LibraryState) => {
    setFolders(library.folders);
    setItems(library.items);
  }, []);

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      let captureFolderError = "";
      try {
        await invoke<Folder>("ensure_capture_folder");
      } catch (err) {
        captureFolderError = `Koi Capture cannot read Downloads. Allow folder access, then choose Rescan. ${readError(err)}`;
      }
      setLibrary(await invoke<LibraryState>("get_library"));
      if (captureFolderError) setError(captureFolderError);
    } catch (err) {
      setError(readError(err));
    } finally {
      setIsLoading(false);
    }
  }, [setLibrary]);

  const addFolder = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      await invoke<Folder>("add_folder");
      setLibrary(await invoke<LibraryState>("get_library"));
      return true;
    } catch (err) {
      setError(readError(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [setLibrary]);

  const addFolderPath = useCallback(async (path: string) => {
    setIsLoading(true);
    setError("");
    try {
      await invoke<Folder>("add_folder_path", { folderPath: path });
      setLibrary(await invoke<LibraryState>("get_library"));
    } catch (err) {
      setError(readError(err));
    } finally {
      setIsLoading(false);
    }
  }, [setLibrary]);

  const rescan = useCallback(async () => {
    if (!folders.length) {
      return addFolder();
    }

    setIsLoading(true);
    setError("");
    try {
      for (const folder of folders) {
        await invoke<MediaItem[]>("scan_folder", { folderPath: folder.path, folderId: folder.id });
      }
      setLibrary(await invoke<LibraryState>("get_library"));
      return true;
    } catch (err) {
      setError(readError(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addFolder, folders, setLibrary]);

  const removeItem = useCallback(async (mediaId: string) => {
    setError("");
    try {
      await invoke("delete_media", { mediaId });
      setItems((current) => current.filter((item) => item.id !== mediaId));
      setSelectedIndexState((index) => Math.min(index, Math.max(filteredItems.length - 2, 0)));
      return true;
    } catch (err) {
      setError(readError(err));
      return false;
    }
  }, [filteredItems.length]);

  const removeSelected = useCallback(async () => {
    return selectedItem ? removeItem(selectedItem.id) : false;
  }, [removeItem, selectedItem]);

  const setSelectedIndex = useCallback((index: number) => {
    const next = clamp(index, 0, Math.max(filteredItems.length - 1, 0));
    localStorage.setItem("koi.selectedIndex", String(next));
    setSelectedIndexState(next);
  }, [filteredItems.length]);

  const moveSelection = useCallback((delta: number) => {
    setSelectedIndexState((index) => {
      const next = clamp(index + delta, 0, Math.max(filteredItems.length - 1, 0));
      localStorage.setItem("koi.selectedIndex", String(next));
      return next;
    });
  }, [filteredItems.length]);

  const updateItemSize = useCallback((mediaId: string, width: number, height: number) => {
    setItems((current) => updateOne(current, mediaId, (item) => (
      item.width === width && item.height === height ? item : { ...item, width, height }
    )));
  }, []);

  const updateItemSizes = useCallback((measurements: Array<{ mediaId: string; width: number; height: number }>) => {
    if (!measurements.length) return;
    const sizes = new Map(measurements.map((measurement) => [measurement.mediaId, measurement]));
    setItems((current) => {
      let hasChanges = false;
      const next = current.map((item) => {
        const size = sizes.get(item.id);
        if (!size || (item.width === size.width && item.height === size.height)) return item;
        hasChanges = true;
        return { ...item, width: size.width, height: size.height };
      });
      return hasChanges ? next : current;
    });
  }, []);

  const saveMediaIndex = useCallback(async (mediaId: string, dominantColors: string[], colorNames: string[]) => {
    setItems((current) => updateOne(current, mediaId, (item) => (
      equalStrings(item.dominantColors, dominantColors) && equalStrings(item.colorNames, colorNames)
        ? item
        : { ...item, dominantColors, colorNames }
    )));
    try {
      await invoke("save_media_index", { mediaId, dominantColors, colorNames });
    } catch {
      // Color indexing is best-effort and should never interrupt browsing.
    }
  }, []);

  const extractMediaIndex = useCallback(async (mediaId: string) => {
    try {
      const index = await invoke<{ dominantColors: string[]; colorNames: string[] }>("extract_media_colors", { mediaId });
      setItems((current) => updateOne(current, mediaId, (item) => ({
        ...item,
        dominantColors: index.dominantColors,
        colorNames: index.colorNames,
      })));
    } catch {
      // Unsupported and fully transparent images simply have no palette.
    }
  }, []);

  const saveTags = useCallback(async (mediaId: string, tags: string[]) => {
    setItems((current) => updateOne(current, mediaId, (item) => (
      equalStrings(item.tags, tags) ? item : { ...item, tags }
    )));
    try {
      await invoke("save_tags", { mediaId, tags });
    } catch (err) {
      setError(readError(err));
    }
  }, []);

  const reconnectFolder = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError("");
    try {
      await invoke("reconnect_folder", { folderId });
      setLibrary(await invoke<LibraryState>("get_library"));
    } catch (err) {
      setError(readError(err));
    } finally {
      setIsLoading(false);
    }
  }, [setLibrary]);

  return {
    folders,
    items,
    filteredItems,
    selectedIndex,
    selectedItem,
    query,
    searchMode,
    activeFolderId,
    gridColumns,
    gridLayout,
    inboxFolderId,
    viewMode,
    isLoading,
    error,
    loadLibrary,
    addFolder,
    addFolderPath,
    rescan,
    removeSelected,
    removeItem,
    updateItemSize,
    updateItemSizes,
    saveMediaIndex,
    extractMediaIndex,
    saveTags,
    reconnectFolder,
    setQuery: (nextQuery) => {
      setQueryState(nextQuery);
      localStorage.setItem("koi.selectedIndex", "0");
      setSelectedIndexState(0);
    },
    setSearchMode: (mode) => {
      setSearchModeState(mode);
      localStorage.setItem("koi.selectedIndex", "0");
      setSelectedIndexState(0);
    },
    setActiveFolderId: (folderId) => {
      localStorage.setItem("koi.activeFolderId", folderId);
      localStorage.setItem("koi.selectedIndex", "0");
      setActiveFolderId(folderId);
      setSelectedIndexState(0);
    },
    setGridColumns: (columns) => {
      const next = clamp(columns, 3, 16);
      localStorage.setItem("koi.gridColumns", String(next));
      setGridColumnsState(next);
    },
    setGridLayout: (layout) => {
      localStorage.setItem("koi.gridLayout", layout);
      setGridLayoutState(layout);
    },
    setInboxFolderId: (folderId) => {
      localStorage.setItem("koi.inboxFolderId", folderId);
      setInboxFolderIdState(folderId);
    },
    setViewMode,
    setSelectedIndex,
    moveSelection,
    jumpToTop: () => {
      localStorage.setItem("koi.selectedIndex", "0");
      setSelectedIndexState(0);
    },
    jumpToBottom: () => {
      const next = Math.max(filteredItems.length - 1, 0);
      localStorage.setItem("koi.selectedIndex", String(next));
      setSelectedIndexState(next);
    },
    clearError: () => setError(""),
  };
}

function readError(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function updateOne(
  items: MediaItem[],
  mediaId: string,
  update: (item: MediaItem) => MediaItem,
) {
  const index = items.findIndex((item) => item.id === mediaId);
  if (index < 0) return items;
  const item = items[index];
  const updated = update(item);
  if (updated === item) return items;
  const next = items.slice();
  next[index] = updated;
  return next;
}

function equalStrings(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
