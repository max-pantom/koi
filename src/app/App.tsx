import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { CommandMenu } from "../components/CommandMenu";
import { FocusView } from "../components/FocusView";
import { MediaContextMenu } from "../components/MediaContextMenu";
import { MediaGrid } from "../components/MediaGrid";
import { SettingsWindow } from "../components/SettingsWindow";
import { TagEditor } from "../components/TagEditor";
import { TopBar } from "../components/TopBar";
import { mediaSrc } from "../lib/media";
import { areSoundsEnabled, getSoundVolume, playSound, setSoundVolume, setSoundsEnabled } from "../lib/sound";
import type { MediaItem } from "../lib/types";
import { initialRoute } from "./routes";
import { useKeyboard } from "../state/useKeyboard";
import { useLibraryStore } from "../state/useLibraryStore";
import "../styles/app.css";

export function App() {
  const store = useLibraryStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("koi.theme") === "dark");
  const [soundsEnabled, setSoundsEnabledState] = useState(() => areSoundsEnabled());
  const [soundVolume, setSoundVolumeState] = useState(() => getSoundVolume());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: MediaItem } | undefined>();
  const [previewMode, setPreviewMode] = useState<"none" | "quick" | "focus">("none");
  const [isPreviewClosing, setIsPreviewClosing] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);
  const [route, setRoute] = useState(initialRoute);
  const searchRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isFocusOpen = previewMode !== "none" && !!store.selectedItem;
  const activeFolder =
    store.activeFolderId === "all"
      ? undefined
      : store.folders.find((folder) => folder.id === store.activeFolderId);

  useEffect(() => {
    void store.loadLibrary();
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;
      const [path] = event.payload.paths;
      if (path) void store.addFolderPath(path);
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => cleanup?.();
  }, [store.addFolderPath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("library-changed", () => {
      void store.loadLibrary();
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (isSearchOpen) searchRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (isTagEditorOpen) tagInputRef.current?.focus();
  }, [isTagEditorOpen]);

  const closePreview = () => {
    if (previewMode === "none") return;
    setIsPreviewClosing(true);
    playSound("focus_close");
    window.setTimeout(() => {
      setShowSimilar(false);
      setIsPaletteOpen(false);
      setPreviewMode("none");
      setIsPreviewClosing(false);
    }, 220);
  };

  const closeLayer = () => {
    if (previewMode !== "none") closePreview();
    if (isSearchOpen) store.setQuery("");
    setIsSearchOpen(false);
    setIsCommandOpen(false);
    setIsTagEditorOpen(false);
    setIsPaletteOpen(false);
    setIsSettingsOpen(false);
    setContextMenu(undefined);
    setRoute({ view: "grid" });
  };

  const similarItems = store.selectedItem ? findSimilar(store.filteredItems, store.selectedItem) : [];

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

  const copyImage = async () => {
    if (!store.selectedItem || !("ClipboardItem" in window)) {
      copyPath();
      return;
    }

    try {
      const response = await fetch(mediaSrc(store.selectedItem));
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      playSound("copy");
    } catch {
      copyPath();
    }
  };

  const editTags = () => {
    if (!store.selectedItem) return;
    setPreviewMode("none");
    setShowSimilar(false);
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

  const commands = [
    { id: "add-folder", label: "Add folder", shortcut: "Cmd O", run: () => void store.addFolder().then(() => playSound("folder_added")) },
    { id: "search", label: "Search", shortcut: "Cmd F", run: () => {
      setIsSearchOpen(true);
      playSound("search_open");
    } },
    { id: "all-folders", label: "Show all folders", shortcut: "All", run: () => store.setActiveFolderId("all") },
    { id: "current-folder", label: "Show current folder", shortcut: "Folder", run: () => store.selectedItem && store.setActiveFolderId(store.selectedItem.folderId) },
    { id: "rescan", label: "Rescan", shortcut: "Cmd R", run: () => void store.rescan().then(() => playSound("folder_added")) },
    { id: "reveal", label: "Reveal in Finder", shortcut: "Cmd Shift R", run: revealSelected },
    { id: "copy-path", label: "Copy path", shortcut: "Cmd Shift C", run: copyPath },
    { id: "copy-name", label: "Copy image name", shortcut: "Cmd Opt C", run: copyName },
    { id: "palette", label: "Show palette", shortcut: "P", run: openPalette },
    { id: "copy-palette", label: "Copy palette", shortcut: "Palette", run: () => copyPalette() },
    { id: "edit-tags", label: "Edit tags", shortcut: "T", run: editTags },
    { id: "resolve-missing", label: "Locate missing folder", shortcut: "Local", run: () => resolveFolder() },
    { id: "open-inbox", label: "Open inbox", shortcut: "Cmd Shift I", run: () => store.inboxFolderId && store.setActiveFolderId(store.inboxFolderId) },
    { id: "set-inbox", label: "Set current folder as inbox", shortcut: "Local", run: () => activeFolder && store.setInboxFolderId(activeFolder.id) },
    { id: "toggle-sounds", label: "Toggle sounds", shortcut: soundsEnabled ? "On" : "Off", run: toggleSounds },
    { id: "toggle-dark", label: "Toggle dark mode", shortcut: "M", run: toggleDarkMode },
    { id: "compact-grid", label: "Toggle compact grid", shortcut: "Cmd +/-", run: () => store.setGridColumns(store.gridColumns >= 10 ? 6 : 12) },
  ];

  useKeyboard({
    addFolder: () => void store.addFolder().then(() => playSound("folder_added")),
    openCommandMenu: () => {
      setIsCommandOpen(true);
      playSound("command_open");
    },
    openSearch: () => {
      setIsSearchOpen(true);
      playSound("search_open");
    },
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
    toggleSimilar: () => setShowSimilar((value) => !value),
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
    rescan: () => void store.rescan().then(() => playSound("folder_added")),
    removeSelected: () => {
      store.removeSelected();
      playSound("command_open");
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
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("koi-menu", (event) => {
      const id = event.payload;

      if (id === "add-folder") void store.addFolder().then(() => playSound("folder_added"));
      if (id === "rescan") void store.rescan().then(() => playSound("folder_added"));
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
        setIsSearchOpen(true);
        playSound("search_open");
      }
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
      if (id === "similar") setShowSimilar((value) => !value);
      if (id === "reveal") revealSelected();
      if (id === "copy-path") copyPath();
      if (id === "copy-name") copyName();
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => unlisten?.();
  });

  return (
    <main className={`${isFocusOpen ? "app is-previewing" : "app"}${isDark ? " is-dark" : ""}`}>
      <TopBar
        folder={activeFolder}
        folders={store.folders}
        activeFolderId={store.activeFolderId}
        gridColumns={store.gridColumns}
        searchMode={store.searchMode}
        total={store.filteredItems.length}
        isLoading={store.isLoading}
        isSearchOpen={isSearchOpen}
        query={store.query}
        onAddFolder={() => void store.addFolder()}
        onSelectFolder={store.setActiveFolderId}
        onGridColumnsChange={store.setGridColumns}
        onSearchModeChange={store.setSearchMode}
        onToggleSearch={() => setIsSearchOpen((value) => !value)}
        onQueryChange={store.setQuery}
        searchRef={searchRef}
      />

      <section className="workspace">
        <MediaGrid
          items={store.filteredItems}
          selectedItem={store.selectedItem}
          isLoading={store.isLoading}
          hasFolders={store.folders.length > 0}
          onAddFolder={() => void store.addFolder()}
          onSelect={store.setSelectedIndex}
          onOpen={(index) => {
            store.setSelectedIndex(index);
            setPreviewMode("focus");
            playSound("focus_open");
          }}
          onContextMenu={(event, index) => {
            event.preventDefault();
            store.setSelectedIndex(index);
            setContextMenu({ x: event.clientX, y: event.clientY, item: store.filteredItems[index] });
          }}
          onMeasure={store.updateItemSize}
          onIndexColors={(mediaId, dominantColors, colorNames) =>
            void store.saveMediaIndex(mediaId, dominantColors, colorNames)
          }
          gridColumns={store.gridColumns}
          gridLayout={store.gridLayout}
          onScrollChange={(scrollTop) => localStorage.setItem("koi.scrollTop", String(scrollTop))}
        />
      </section>

      {store.error && (
        <button className="toast" type="button" onClick={store.clearError}>
          {store.error}
        </button>
      )}

      {missingCount > 0 && (
        <button className="missing-toast" type="button" onClick={() => resolveFolder()}>
          {missingCount} missing
        </button>
      )}

      {isFocusOpen && store.selectedItem && (
        <FocusView
          item={store.selectedItem}
          mode={previewMode === "quick" ? "quick" : "focus"}
          isClosing={isPreviewClosing}
          similarItems={similarItems}
          showSimilar={showSimilar}
          showPalette={isPaletteOpen}
          onCopyColor={copyHex}
          onClose={closePreview}
          onPrevious={() => store.moveSelection(-1)}
          onNext={() => store.moveSelection(1)}
          onToggleSimilar={() => setShowSimilar((value) => !value)}
          onSelectSimilar={(item) => {
            store.setSelectedIndex(store.filteredItems.findIndex((candidate) => candidate.id === item.id));
            setPreviewMode("focus");
            setIsPreviewClosing(false);
          }}
        />
      )}

      {isCommandOpen && <CommandMenu commands={commands} onClose={() => setIsCommandOpen(false)} />}

      {isSettingsOpen && (
        <SettingsWindow
          isDark={isDark}
          soundsEnabled={soundsEnabled}
          soundVolume={soundVolume}
          gridLayout={store.gridLayout}
          onToggleDark={toggleDarkMode}
          onToggleSounds={toggleSounds}
          onSoundVolumeChange={(volume) => {
            setSoundVolume(volume);
            setSoundVolumeState(volume);
          }}
          onGridLayoutChange={store.setGridLayout}
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
          onCopyPath={() => {
            void navigator.clipboard.writeText(contextMenu.item.path);
            setContextMenu(undefined);
            playSound("copy");
          }}
          onCopyName={() => {
            void navigator.clipboard.writeText(contextMenu.item.name);
            setContextMenu(undefined);
            playSound("copy");
          }}
          onCopyPalette={() => {
            copyPalette(contextMenu.item);
            setContextMenu(undefined);
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

function findSimilar(items: MediaItem[], item: MediaItem) {
  const ratio = (item.width || 1) / Math.max(item.height || 1, 1);

  return items
    .filter((candidate) => candidate.id !== item.id)
    .map((candidate) => {
      const candidateRatio = (candidate.width || 1) / Math.max(candidate.height || 1, 1);
      const sharedColors = candidate.colorNames.filter((color) => item.colorNames.includes(color)).length;
      const sameFolder = candidate.folderId === item.folderId ? 1 : 0;
      const sameAspect = Math.abs(candidateRatio - ratio) < 0.2 ? 1 : 0;
      return { candidate, score: sharedColors * 3 + sameFolder + sameAspect };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 18)
    .map((entry) => entry.candidate);
}
  const copyHex = (hex: string) => {
    void navigator.clipboard.writeText(hex);
    playSound("copy");
  };
