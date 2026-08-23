import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { confirm } from "@tauri-apps/plugin-dialog";
import { CommandMenu } from "../components/CommandMenu";
import { ProductPreview, type ProductPreviewKind } from "../components/ProductPreview";
import { FocusView } from "../components/FocusView";
import { MediaContextMenu } from "../components/MediaContextMenu";
import { MediaGrid } from "../components/MediaGrid";
import { SettingsWindow } from "../components/SettingsWindow";
import { TagEditor } from "../components/TagEditor";
import { Sidebar } from "../components/Sidebar";
import { Toaster, toast } from "sonner";
import { mediaSrc } from "../lib/media";
import { checkForKoiUpdate, installKoiUpdate, type KoiUpdate } from "../lib/updater";
import { formatColor, type ColorFormat } from "../lib/colors";
import { areSoundsEnabled, getSoundVolume, playSound, setSoundVolume, setSoundsEnabled } from "../lib/sound";
import type { MediaItem } from "../lib/types";
import { initialRoute } from "./routes";
import { useKeyboard } from "../state/useKeyboard";
import { useLibraryStore } from "../state/useLibraryStore";
import "../styles/app.css";

const EXTENSION_DOWNLOAD_URL = "https://github.com/max-pantom/koi/releases/latest/download/Koi-Capture-0.3.0.zip";
const ONBOARDING_STORAGE_KEY = "koi.onboarding.v1.completed";

function initialProductPreview(): ProductPreviewKind | undefined {
  if (import.meta.env.DEV) {
    const preview = new URLSearchParams(window.location.search).get("preview");
    if (preview === "installer" || preview === "onboarding") return preview;
  }
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true" ? undefined : "onboarding";
}

export function App() {
  const store = useLibraryStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [productPreview, setProductPreview] = useState<ProductPreviewKind | undefined>(initialProductPreview);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem("koi.sidebar") !== "closed");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("koi.theme") === "dark");
  const [soundsEnabled, setSoundsEnabledState] = useState(() => areSoundsEnabled());
  const [soundVolume, setSoundVolumeState] = useState(() => getSoundVolume());
  const [showImageTooltips, setShowImageTooltips] = useState(
    () => localStorage.getItem("koi.image-name-tooltips") !== "hidden",
  );
  const [colorFormat, setColorFormat] = useState<ColorFormat>(() => {
    const stored = localStorage.getItem("koi.color-format");
    return stored === "rgb" || stored === "hsl" ? stored : "hex";
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: MediaItem } | undefined>();
  const [previewMode, setPreviewMode] = useState<"none" | "quick" | "focus">("none");
  const [isPreviewClosing, setIsPreviewClosing] = useState(false);
  const [route, setRoute] = useState(initialRoute);
  const [updateStatus, setUpdateStatus] = useState("Ready");
  const searchRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const menuEventHandlerRef = useRef<(id: string) => void>(() => undefined);
  const updateCheckInFlight = useRef(false);
  const availableUpdate = useRef<KoiUpdate>();

  useEffect(() => {
    document.documentElement.classList.toggle("koi-dark", isDark);
    return () => document.documentElement.classList.remove("koi-dark");
  }, [isDark]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let isDisposed = false;
    let unlisten: (() => void) | undefined;

    const syncFullscreenState = () => {
      void appWindow.isFullscreen().then((fullscreen) => {
        if (!isDisposed) setIsFullscreen(fullscreen);
      });
    };

    syncFullscreenState();
    void appWindow.onResized(syncFullscreenState).then((cleanup) => {
      if (isDisposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      isDisposed = true;
      unlisten?.();
    };
  }, []);

  const isFocusOpen = previewMode !== "none" && !!store.selectedItem;
  const activeFolder =
    store.activeFolderId === "all"
      ? undefined
      : store.folders.find((folder) => folder.id === store.activeFolderId);
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of store.items) counts.set(item.folderId, (counts.get(item.folderId) ?? 0) + 1);
    return counts;
  }, [store.items]);

  useEffect(() => {
    void store.loadLibrary();
  }, []);

  useEffect(() => {
    let isDisposed = false;
    let cleanup: (() => void) | undefined;
    void getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;
      const [path] = event.payload.paths;
      if (path) void store.addFolderPath(path);
    }).then((unlisten) => {
      if (isDisposed) unlisten();
      else cleanup = unlisten;
    });

    return () => {
      isDisposed = true;
      cleanup?.();
    };
  }, [store.addFolderPath]);

  useEffect(() => {
    let isDisposed = false;
    let unlisten: (() => void) | undefined;
    void listen("library-changed", () => {
      void store.loadLibrary();
    }).then((cleanup) => {
      if (isDisposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      isDisposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (isSearchOpen) searchRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (isTagEditorOpen) tagInputRef.current?.focus();
  }, [isTagEditorOpen]);

  useEffect(() => {
    if (!store.error) return;
    showToast(store.error, "error", 5200);
    store.clearError();
  }, [store.error]);

  useEffect(() => {
    if (store.isLoading) toast.loading("Scanning library…", { id: "library-progress", duration: Infinity });
    else toast.dismiss("library-progress");
  }, [store.isLoading]);

  const previousItemIds = useRef<Set<string>>();
  const hasSeenLibraryLoad = useRef(false);
  useEffect(() => {
    if (store.isLoading) {
      hasSeenLibraryLoad.current = true;
      return;
    }
    const nextIds = new Set(store.items.map((item) => item.id));
    const previous = previousItemIds.current;
    if (!previous && !hasSeenLibraryLoad.current) return;
    previousItemIds.current = nextIds;
    if (!previous) return;
    const added = store.items.filter((item) => !previous.has(item.id)).length;
    if (added > 0) showToast(added === 1 ? "New image added" : `${added} new images added`, "added");
  }, [store.isLoading, store.items]);

  const closePreview = () => {
    if (previewMode === "none") return;
    setIsPreviewClosing(true);
    playSound("focus_close");
    window.setTimeout(() => {
      setIsPaletteOpen(false);
      setPreviewMode("none");
      setIsPreviewClosing(false);
    }, 220);
  };

  const closeProductPreview = () => {
    if (productPreview === "onboarding") localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setProductPreview(undefined);
  };

  const closeLayer = () => {
    if (previewMode !== "none") closePreview();
    if (isSearchOpen) store.setQuery("");
    setIsSearchOpen(false);
    setIsCommandOpen(false);
    setIsTagEditorOpen(false);
    setIsPaletteOpen(false);
    setIsSettingsOpen(false);
    closeProductPreview();
    setContextMenu(undefined);
    setRoute({ view: "grid" });
  };

  const revealSelected = () => {
    if (store.selectedItem) void revealItemInDir(store.selectedItem.path);
  };

  const copyPath = () => {
    if (store.selectedItem) {
      void navigator.clipboard.writeText(store.selectedItem.path);
      playSound("copy");
    }
  };

  const copyName = () => {
    if (store.selectedItem) {
      void navigator.clipboard.writeText(store.selectedItem.name);
      playSound("copy");
    }
  };

  const copyPalette = (item = store.selectedItem) => {
    if (!item) return;
    const palette = item.dominantColors.slice(0, 5).join(" ");
    if (!palette) return;
    void navigator.clipboard.writeText(palette);
    playSound("copy");
  };

  const copyHex = (hex: string) => {
    const value = formatColor(hex, colorFormat);
    void navigator.clipboard.writeText(value);
    showToast(`${value} copied`, "success");
    playSound("copy");
  };

  const openSource = (item = store.selectedItem) => {
    const url = item?.sourceLinkUrl || item?.sourcePageUrl || item?.sourceCanonicalUrl || item?.sourceFinalUrl || item?.sourceUrl;
    if (!url || !/^https?:\/\//i.test(url)) return;
    void openUrl(url);
  };

  const copyImage = async (item = store.selectedItem) => {
    if (!item) return;
    if (item.kind === "video") {
      await navigator.clipboard.writeText(item.path);
      showToast("Video path copied", "success");
      playSound("copy");
      return;
    }

    try {
      await invoke("copy_media_image", { mediaId: item.id });
      showToast("Image copied", "success");
      playSound("copy");
    } catch (error) {
      showToast(`Couldn’t copy image · ${String(error)}`, "error", 5200);
    }
  };

  const pasteClipboard = async () => {
    try {
      const result = await invoke<{ kind: "image" | "link"; label: string }>("import_clipboard");
      showToast(result.label, "added");
      playSound("folder_added");
    } catch (error) {
      showToast(String(error), "error");
    }
  };

  const toggleImageTooltips = () => {
    setShowImageTooltips((current) => {
      const next = !current;
      localStorage.setItem("koi.image-name-tooltips", next ? "shown" : "hidden");
      return next;
    });
  };

  const editTags = () => {
    if (!store.selectedItem) return;
    setPreviewMode("none");
    setIsTagEditorOpen(true);
    playSound("command_open");
  };

  const toggleSounds = () => {
    const next = !areSoundsEnabled();
    setSoundsEnabled(next);
    setSoundsEnabledState(next);
  };

  const toggleDarkMode = () => {
    setIsDark((value) => {
      const next = !value;
      localStorage.setItem("koi.theme", next ? "dark" : "light");
      playSound("command_open");
      return next;
    });
  };

  const openPalette = () => {
    if (!store.selectedItem) return;
    if (!store.selectedItem.dominantColors.length && store.selectedItem.kind !== "video") {
      void store.extractMediaIndex(store.selectedItem.id);
    }
    if (previewMode === "none") setPreviewMode("quick");
    setIsPaletteOpen(true);
    setContextMenu(undefined);
    playSound("command_open");
  };

  const searchColor = (color: string) => {
    store.setSearchMode("smart");
    store.setQuery(color);
    setIsSearchOpen(true);
    setIsPaletteOpen(false);
    playSound("search_open");
  };

  const resolveFolder = (folderId?: string) => {
    const targetFolderId = folderId ?? store.selectedItem?.folderId ?? activeFolder?.id;
    if (!targetFolderId || targetFolderId === "all") return;
    void store.reconnectFolder(targetFolderId).then(() => playSound("folder_added"));
  };

  const missingCount = store.items.filter((item) => item.missing).length;

  const setSidebarOpen = (isOpen: boolean) => {
    localStorage.setItem("koi.sidebar", isOpen ? "open" : "closed");
    setIsSidebarOpen(isOpen);
  };

  const toggleSidebar = () => {
    if (!isFullscreen) setSidebarOpen(!isSidebarOpen);
  };

  const showToast = (message: string, tone: ToastTone, duration = 2600) => {
    const options = { duration: tone === "error" ? Infinity : duration, closeButton: tone === "error" };
    if (tone === "error") return toast.error(message, options);
    if (tone === "progress") return toast.loading(message, { id: "library-progress", duration: Infinity });
    if (tone === "success" || tone === "added") return toast.success(message, options);
    if (tone === "delete") return toast(message, options);
    return toast(message, options);
  };

  const installAvailableUpdate = async (update: KoiUpdate) => {
    setUpdateStatus("Downloading…");
    try {
      await installKoiUpdate(update, ({ phase, percent }) => {
        const label = phase === "installing"
          ? "Installing update…"
          : `Downloading update${percent === undefined ? "…" : ` · ${percent}%`}`;
        setUpdateStatus(phase === "installing" ? "Installing…" : percent === undefined ? "Downloading…" : `${percent}%`);
        toast.loading(label, { id: "koi-update-progress", duration: Infinity });
      });
    } catch (error) {
      setUpdateStatus("Try again");
      toast.error(`Couldn’t install the update · ${String(error)}`, {
        id: "koi-update-progress",
        duration: Infinity,
        closeButton: true,
      });
    }
  };

  const checkForUpdates = async (manual = true) => {
    if (updateCheckInFlight.current) return;
    if (availableUpdate.current) {
      toast("A Koi update is ready", {
        id: "koi-update-available",
        duration: Infinity,
        action: { label: "Install", onClick: () => void installAvailableUpdate(availableUpdate.current!) },
      });
      return;
    }
    updateCheckInFlight.current = true;
    setUpdateStatus("Checking…");
    try {
      const update = await checkForKoiUpdate();
      if (!update) {
        setUpdateStatus("Up to date");
        if (manual) toast.success("Koi is up to date");
        return;
      }
      availableUpdate.current = update;
      setUpdateStatus(`Koi ${update.version}`);
      toast(`Koi ${update.version} is available`, {
        id: "koi-update-available",
        description: update.body || "Download the update and relaunch Koi.",
        duration: Infinity,
        action: { label: "Install", onClick: () => void installAvailableUpdate(update) },
      });
    } catch (error) {
      setUpdateStatus("Try again");
      if (manual) showToast(`Couldn’t check for updates · ${String(error)}`, "error", 5200);
    } finally {
      updateCheckInFlight.current = false;
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => void checkForUpdates(false), 4_500);
    return () => window.clearTimeout(timeout);
  }, []);

  const runLibraryAction = async (action: () => Promise<boolean>, success: string, tone: ToastTone = "success") => {
    if (await action()) showToast(success, tone);
  };

  const deleteItem = async (item = store.selectedItem) => {
    if (!item) return;
    const approved = await confirm(`Move “${item.sourceTitle || item.name}” to Trash?`, {
      title: "Delete image",
      kind: "warning",
      okLabel: "Move to Trash",
      cancelLabel: "Cancel",
    });
    if (!approved) return;
    closePreview();
    if (await store.removeItem(item.id)) showToast("Moved to Trash", "delete");
    playSound("command_open");
  };

  const startWindowDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, [role='slider'], .tile, .grid-wrap, .article-reader-wrap, .preview-layer, .modal-layer, .settings-layer, .product-preview-stage")) return;
    void getCurrentWindow().startDragging();
  };

  const commands = [
    { id: "add-folder", label: "Add folder…", shortcut: "⌘O", keywords: "library import", run: () => void runLibraryAction(store.addFolder, "Folder added", "added") },
    { id: "search", label: "Search library", shortcut: "⌘F", keywords: "find images", run: () => {
      setSidebarOpen(true);
      setIsSearchOpen(true);
      playSound("search_open");
    } },
    { id: "paste", label: "Save from clipboard", shortcut: "⌘V", keywords: "paste image link", run: () => void pasteClipboard() },
    ...(!isFullscreen ? [{ id: "toggle-sidebar", label: isSidebarOpen ? "Hide sidebar" : "Show sidebar", shortcut: "⌃⌘S", keywords: "panel", run: toggleSidebar }] : []),
    { id: "rescan", label: "Rescan folders", shortcut: "⌘R", keywords: "refresh reload", run: () => void runLibraryAction(store.rescan, "Library is up to date") },
    ...(store.inboxFolderId ? [{ id: "open-inbox", label: "Open capture inbox", shortcut: "⇧⌘I", keywords: "extension saves", run: () => store.setActiveFolderId(store.inboxFolderId) }] : []),
    ...(store.selectedItem ? [
      { id: "copy-image", label: store.selectedItem.kind === "video" ? "Copy video path" : "Copy image", shortcut: "⌘C", keywords: "clipboard", run: () => void copyImage() },
      { id: "reveal", label: "Reveal image in Finder", shortcut: "⇧⌘R", keywords: "file locate", run: revealSelected },
      { id: "palette", label: "Show color palette", shortcut: "P", keywords: "colors", run: openPalette },
      { id: "edit-tags", label: "Edit image tags", shortcut: "T", keywords: "metadata labels", run: editTags },
      { id: "delete", label: "Move image to Trash", shortcut: "⌫", keywords: "delete remove", run: () => void deleteItem() },
    ] : []),
    { id: "toggle-dark", label: isDark ? "Use light appearance" : "Use dark appearance", shortcut: "M", keywords: "theme mode", run: toggleDarkMode },
    { id: "check-update", label: "Check for updates", keywords: "upgrade version release", run: () => void checkForUpdates() },
    { id: "preview-installer", label: "Preview Mac installer", keywords: "dmg setup install drag applications", run: () => {
      setProductPreview("installer");
      setIsSettingsOpen(false);
    } },
    { id: "preview-onboarding", label: "Preview onboarding", keywords: "welcome setup first launch", run: () => {
      setProductPreview("onboarding");
      setIsSettingsOpen(false);
    } },
    { id: "settings", label: "Open settings", shortcut: "⌘,", keywords: "preferences sound layout", run: () => setIsSettingsOpen(true) },
  ];

  useKeyboard({
    addFolder: () => void runLibraryAction(store.addFolder, "Folder added", "added"),
    openCommandMenu: () => {
      setIsCommandOpen(true);
      playSound("command_open");
    },
    openSearch: () => {
      setSidebarOpen(true);
      setIsSearchOpen(true);
      playSound("search_open");
    },
    toggleSidebar,
    closeLayer,
    editTags,
    showPalette: openPalette,
    toggleDarkMode,
    openSelected: () => {
      if (previewMode === "focus") {
        closePreview();
      } else if (store.selectedItem) {
        setPreviewMode("focus");
        setIsPreviewClosing(false);
        playSound("focus_open");
      }
    },
    quickLook: () => {
      if (previewMode !== "none") {
        closePreview();
      } else if (store.selectedItem) {
        setPreviewMode("quick");
        setIsPreviewClosing(false);
        playSound("focus_open");
      }
    },
    moveSelection: (delta) => {
      store.moveSelection(delta);
      playSound("select");
    },
    jumpToTop: () => {
      store.jumpToTop();
      playSound("select");
    },
    jumpToBottom: () => {
      store.jumpToBottom();
      playSound("select");
    },
    rescan: () => void runLibraryAction(store.rescan, "Library is up to date"),
    removeSelected: () => {
      void deleteItem();
    },
    showGrid: () => {
      setPreviewMode("none");
      setRoute({ view: "grid" });
      playSound("focus_close");
    },
    showFocus: () => {
      if (store.selectedItem) {
        setPreviewMode("focus");
        setIsPreviewClosing(false);
        setRoute({ view: "focus" });
        playSound("focus_open");
      }
    },
    openPreferences: () => {
      setIsSettingsOpen(true);
      playSound("command_open");
    },
    revealInFinder: revealSelected,
    copyImage,
    copyPath,
    copyName,
    largerThumbnails: () => store.setGridColumns(store.gridColumns - 1),
    smallerThumbnails: () => store.setGridColumns(store.gridColumns + 1),
    resetThumbnails: () => store.setGridColumns(6),
    openInbox: () => {
      if (store.inboxFolderId) store.setActiveFolderId(store.inboxFolderId);
      else setIsCommandOpen(true);
    },
    pasteClipboard: () => void pasteClipboard(),
  });

  menuEventHandlerRef.current = (id) => {
      if (id === "add-folder") void runLibraryAction(store.addFolder, "Folder added", "added");
      if (id === "rescan") void runLibraryAction(store.rescan, "Library is up to date");
      if (id === "open-inbox") {
        if (store.inboxFolderId) store.setActiveFolderId(store.inboxFolderId);
        else setIsCommandOpen(true);
      }
      if (id === "reconnect-folder") resolveFolder();
      if (id === "preferences") {
        setIsSettingsOpen(true);
        playSound("command_open");
      }
      if (id === "search") {
        setSidebarOpen(true);
        setIsSearchOpen(true);
        playSound("search_open");
      }
      if (id === "toggle-sidebar") toggleSidebar();
      if (id === "command-menu") {
        setIsCommandOpen(true);
        playSound("command_open");
      }
      if (id === "grid-view") closePreview();
      if (id === "focus-view" && store.selectedItem) {
        setPreviewMode("focus");
        setIsPreviewClosing(false);
        playSound("focus_open");
      }
      if (id === "toggle-dark") toggleDarkMode();
      if (id === "bigger-thumbnails") store.setGridColumns(store.gridColumns - 1);
      if (id === "smaller-thumbnails") store.setGridColumns(store.gridColumns + 1);
      if (id === "reset-thumbnails") store.setGridColumns(6);
      if (id === "quick-look") {
        if (previewMode !== "none") closePreview();
        else if (store.selectedItem) {
          setPreviewMode("quick");
          setIsPreviewClosing(false);
          playSound("focus_open");
        }
      }
      if (id === "show-palette") openPalette();
      if (id === "edit-tags") editTags();
      if (id === "reveal") revealSelected();
      if (id === "copy-path") copyPath();
      if (id === "copy-name") copyName();
  };

  useEffect(() => {
    let isDisposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>("koi-menu", (event) => {
      menuEventHandlerRef.current(event.payload);
    }).then((cleanup) => {
      if (isDisposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      isDisposed = true;
      unlisten?.();
    };
  }, []);

  return (
    <main className={`${isFocusOpen ? "app is-previewing" : "app"}${isDark ? " is-dark" : ""}${isSidebarOpen && !isFullscreen ? "" : " is-sidebar-collapsed"}${isFullscreen ? " is-fullscreen" : ""}`}>
      {!productPreview && !isFullscreen && <Sidebar
        folders={store.folders}
        activeFolderId={store.activeFolderId}
        folderCounts={folderCounts}
        gridColumns={store.gridColumns}
        total={store.items.length}
        resultCount={store.filteredItems.length}
        isLoading={store.isLoading}
        isSearchOpen={isSearchOpen}
        isOpen={isSidebarOpen}
        query={store.query}
        onAddFolder={() => void runLibraryAction(store.addFolder, "Folder added", "added")}
        onSelectFolder={store.setActiveFolderId}
        onGridColumnsChange={store.setGridColumns}
        onSearchFocusChange={setIsSearchOpen}
        onQueryChange={store.setQuery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggle={toggleSidebar}
        onStartWindowDrag={startWindowDrag}
        searchRef={searchRef}
      />}

      {!productPreview && <section className="workspace">
        <div className="workspace-titlebar-drag" aria-hidden="true" onPointerDown={startWindowDrag} />
        <MediaGrid
          items={store.filteredItems}
          selectedItem={store.selectedItem}
          isLoading={store.isLoading}
          hasFolders={store.folders.length > 0}
          onAddFolder={() => void runLibraryAction(store.addFolder, "Folder added", "added")}
          onSelect={store.setSelectedIndex}
          onOpen={(index) => {
            store.setSelectedIndex(index);
            setPreviewMode("focus");
            playSound("focus_open");
          }}
          onContextMenu={(event, index) => {
            event.preventDefault();
            store.setSelectedIndex(index);
            setContextMenu({
              x: Math.max(8, Math.min(event.clientX, window.innerWidth - 208)),
              y: Math.max(8, Math.min(event.clientY, window.innerHeight - 214)),
              item: store.filteredItems[index],
            });
          }}
          onMeasureBatch={store.updateItemSizes}
          onIndex={(mediaId, dominantColors, colorNames) => {
            if (dominantColors.length) void store.saveMediaIndex(mediaId, dominantColors, colorNames);
            else void store.extractMediaIndex(mediaId);
          }}
          gridColumns={store.gridColumns}
          gridLayout={store.gridLayout}
          showImageTooltips={showImageTooltips}
          onScrollChange={(scrollTop) => localStorage.setItem("koi.scrollTop", String(scrollTop))}
          query={store.query}
          onClearSearch={() => store.setQuery("")}
        />
        <div className="grid-edge-blur is-top" aria-hidden="true" />
        <div className="grid-edge-blur is-bottom" aria-hidden="true" />
      </section>}

      {productPreview && (
        <ProductPreview
          key={productPreview}
          initialPreview={productPreview}
          onClose={closeProductPreview}
          onStartWindowDrag={startWindowDrag}
        />
      )}

      <Toaster
        position="bottom-right"
        visibleToasts={2}
        gap={6}
        offset={12}
        theme={isDark ? "dark" : "light"}
        toastOptions={{ className: "koi-toast" }}
      />

      {!productPreview && missingCount > 0 && (
        <button className="missing-toast" type="button" onClick={() => resolveFolder()}>
          {missingCount} missing · Locate folder
        </button>
      )}

      {isFocusOpen && store.selectedItem && (
        <FocusView
          item={store.selectedItem}
          mode={previewMode === "quick" ? "quick" : "focus"}
          isClosing={isPreviewClosing}
          showPalette={isPaletteOpen}
          colorFormat={colorFormat}
          onCopyColor={copyHex}
          onCopyImage={() => void copyImage()}
          onClose={closePreview}
          onPrevious={() => store.moveSelection(-1)}
          onNext={() => store.moveSelection(1)}
          onOpenSource={() => openSource()}
        />
      )}

      {isCommandOpen && <CommandMenu commands={commands} onClose={() => setIsCommandOpen(false)} />}

      {isSettingsOpen && (
        <SettingsWindow
          isDark={isDark}
          soundsEnabled={soundsEnabled}
          soundVolume={soundVolume}
          gridLayout={store.gridLayout}
          showImageTooltips={showImageTooltips}
          colorFormat={colorFormat}
          updateStatus={updateStatus}
          onToggleDark={toggleDarkMode}
          onToggleSounds={toggleSounds}
          onSoundVolumeChange={(volume) => {
            setSoundVolume(volume);
            setSoundVolumeState(volume);
          }}
          onGridLayoutChange={store.setGridLayout}
          onToggleImageTooltips={toggleImageTooltips}
          onColorFormatChange={(format) => {
            localStorage.setItem("koi.color-format", format);
            setColorFormat(format);
          }}
          onDownloadExtension={() => void openUrl(EXTENSION_DOWNLOAD_URL)}
          onPreviewInstaller={() => {
            setIsSettingsOpen(false);
            setProductPreview("installer");
          }}
          onPreviewOnboarding={() => {
            setIsSettingsOpen(false);
            setProductPreview("onboarding");
          }}
          onCheckForUpdates={() => void checkForUpdates()}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {contextMenu && (
        <MediaContextMenu
          item={contextMenu.item}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(undefined)}
          onReveal={() => {
            void revealItemInDir(contextMenu.item.path);
            setContextMenu(undefined);
          }}
          onCopyImage={() => {
            const item = contextMenu.item;
            setContextMenu(undefined);
            void copyImage(item);
          }}
          onEditTags={() => {
            setContextMenu(undefined);
            editTags();
          }}
          onShowPalette={() => {
            setContextMenu(undefined);
            setPreviewMode("quick");
            setIsPreviewClosing(false);
            setIsPaletteOpen(true);
          }}
          onResolveFolder={() => {
            resolveFolder(contextMenu.item.folderId);
            setContextMenu(undefined);
          }}
          onOpenSource={() => {
            openSource(contextMenu.item);
            setContextMenu(undefined);
          }}
          onDelete={() => {
            const item = contextMenu.item;
            setContextMenu(undefined);
            void deleteItem(item);
          }}
        />
      )}

      {isTagEditorOpen && store.selectedItem && (
        <TagEditor
          item={store.selectedItem}
          inputRef={tagInputRef}
          onClose={() => setIsTagEditorOpen(false)}
          onSave={(tags) => {
            void store.saveTags(store.selectedItem!.id, tags);
            setIsTagEditorOpen(false);
            playSound("copy");
          }}
        />
      )}

    </main>
  );
}

type ToastTone = "success" | "error" | "delete" | "added" | "progress";
