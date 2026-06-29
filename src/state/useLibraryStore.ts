import { invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useState } from "react";
import { searchMedia } from "../lib/search";
import type { Folder, LibraryState, MediaItem, SearchMode, ViewMode } from "../lib/types";

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
  inboxFolderId: string;
  viewMode: ViewMode;
  isLoading: boolean;
  error: string;
  loadLibrary: () => Promise<void>;
  addFolder: () => Promise<void>;
  addFolderPath: (path: string) => Promise<void>;
  rescan: () => Promise<void>;
  removeSelected: () => void;
  updateItemSize: (mediaId: string, width: number, height: number) => void;
  saveMediaIndex: (mediaId: string, dominantColors: string[], colorNames: string[]) => Promise<void>;
  setQuery: (query: string) => void;
  setSearchMode: (mode: SearchMode) => void;
  setActiveFolderId: (folderId: string) => void;
  setGridColumns: (columns: number) => void;
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
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("normal");
  const [activeFolderId, setActiveFolderId] = useState(() => localStorage.getItem("koi.activeFolderId") ?? "all");
  const [gridColumns, setGridColumnsState] = useState(() => readNumber("koi.gridColumns", 6));
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
      setLibrary(await invoke<LibraryState>("get_library"));
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
    } catch (err) {
      setError(readError(err));
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
      await addFolder();
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      for (const folder of folders) {
        await invoke<MediaItem[]>("scan_folder", { folderPath: folder.path });
      }
      setLibrary(await invoke<LibraryState>("get_library"));
    } catch (err) {
      setError(readError(err));
    } finally {
      setIsLoading(false);
    }
  }, [addFolder, folders, setLibrary]);

  const removeSelected = useCallback(() => {
    if (!selectedItem) return;
    setItems((current) => current.filter((item) => item.id !== selectedItem.id));
    setSelectedIndexState((index) => Math.min(index, Math.max(filteredItems.length - 2, 0)));
  }, [filteredItems.length, selectedItem]);

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
    setItems((current) =>
      current.map((item) => {
        if (item.id !== mediaId || (item.width === width && item.height === height)) return item;
        return { ...item, width, height };
      }),
    );
  }, []);

  const saveMediaIndex = useCallback(async (mediaId: string, dominantColors: string[], colorNames: string[]) => {
    setItems((current) =>
      current.map((item) => (item.id === mediaId ? { ...item, dominantColors, colorNames } : item)),
    );
    try {
      await invoke("save_media_index", { mediaId, dominantColors, colorNames });
    } catch {
      // Color indexing is best-effort and should never interrupt browsing.
    }
  }, []);

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
    inboxFolderId,
    viewMode,
    isLoading,
    error,
    loadLibrary,
    addFolder,
    addFolderPath,
    rescan,
    removeSelected,
    updateItemSize,
    saveMediaIndex,
    setQuery,
    setSearchMode,
    setActiveFolderId: (folderId) => {
      localStorage.setItem("koi.activeFolderId", folderId);
      setActiveFolderId(folderId);
      setSelectedIndexState(0);
    },
    setGridColumns: (columns) => {
      const next = clamp(columns, 4, 16);
      localStorage.setItem("koi.gridColumns", String(next));
      setGridColumnsState(next);
    },
    setInboxFolderId: (folderId) => {
      localStorage.setItem("koi.inboxFolderId", folderId);
      setInboxFolderIdState(folderId);
    },
    setViewMode,
    setSelectedIndex,
    moveSelection,
    jumpToTop: () => setSelectedIndexState(0),
    jumpToBottom: () => setSelectedIndexState(Math.max(filteredItems.length - 1, 0)),
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
