import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { CommandMenu } from "../components/CommandMenu";
import { FocusView } from "../components/FocusView";
import { MediaGrid } from "../components/MediaGrid";
import { TopBar } from "../components/TopBar";
import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";
import { initialRoute } from "./routes";
import { useKeyboard } from "../state/useKeyboard";
import { useLibraryStore } from "../state/useLibraryStore";
import "../styles/app.css";

export function App() {
  const store = useLibraryStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"none" | "quick" | "focus">("none");
  const [showSimilar, setShowSimilar] = useState(false);
  const [route, setRoute] = useState(initialRoute);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const closeLayer = () => {
    if (isSearchOpen) store.setQuery("");
    setIsSearchOpen(false);
    setIsCommandOpen(false);
    setShowSimilar(false);
    setPreviewMode("none");
    setRoute({ view: "grid" });
  };

  const similarItems = store.selectedItem ? findSimilar(store.filteredItems, store.selectedItem) : [];

  const revealSelected = () => {
    if (store.selectedItem) void revealItemInDir(store.selectedItem.path);
  };

  const copyPath = () => {
    if (store.selectedItem) void navigator.clipboard.writeText(store.selectedItem.path);
  };

  const copyName = () => {
    if (store.selectedItem) void navigator.clipboard.writeText(store.selectedItem.name);
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
    } catch {
      copyPath();
    }
  };

  const commands = [
    { id: "add-folder", label: "Add folder", shortcut: "Cmd O", run: () => void store.addFolder() },
    { id: "search", label: "Search", shortcut: "Cmd F", run: () => setIsSearchOpen(true) },
    { id: "all-folders", label: "Show all folders", shortcut: "All", run: () => store.setActiveFolderId("all") },
    { id: "current-folder", label: "Show current folder", shortcut: "Folder", run: () => store.selectedItem && store.setActiveFolderId(store.selectedItem.folderId) },
    { id: "rescan", label: "Rescan", shortcut: "Manual", run: () => void store.rescan() },
    { id: "reveal", label: "Reveal in Finder", shortcut: "Cmd Shift R", run: revealSelected },
    { id: "copy-path", label: "Copy path", shortcut: "Cmd Shift C", run: copyPath },
    { id: "copy-name", label: "Copy image name", shortcut: "Cmd Opt C", run: copyName },
    { id: "edit-tags", label: "Edit tags", shortcut: "Later", run: () => undefined },
    { id: "open-inbox", label: "Open inbox", shortcut: "Cmd Shift I", run: () => store.inboxFolderId && store.setActiveFolderId(store.inboxFolderId) },
    { id: "set-inbox", label: "Set current folder as inbox", shortcut: "Local", run: () => activeFolder && store.setInboxFolderId(activeFolder.id) },
    { id: "toggle-sounds", label: "Toggle sounds", shortcut: "Later", run: () => undefined },
    { id: "compact-grid", label: "Toggle compact grid", shortcut: "Cmd +/-", run: () => store.setGridColumns(store.gridColumns >= 10 ? 6 : 12) },
  ];

  useKeyboard({
    addFolder: () => void store.addFolder(),
    openCommandMenu: () => setIsCommandOpen(true),
    openSearch: () => setIsSearchOpen(true),
    closeLayer,
    openSelected: () => store.selectedItem && setPreviewMode("focus"),
    quickLook: () => store.selectedItem && setPreviewMode("quick"),
    toggleSimilar: () => setShowSimilar((value) => !value),
    moveSelection: store.moveSelection,
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

  return (
    <main className={isFocusOpen ? "app is-previewing" : "app"}>
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
          }}
          onMeasure={store.updateItemSize}
          onIndexColors={(mediaId, dominantColors, colorNames) =>
            void store.saveMediaIndex(mediaId, dominantColors, colorNames)
          }
          gridColumns={store.gridColumns}
          onScrollChange={(scrollTop) => localStorage.setItem("koi.scrollTop", String(scrollTop))}
        />
      </section>

      {store.error && (
        <button className="toast" type="button" onClick={store.clearError}>
          {store.error}
        </button>
      )}

      {isFocusOpen && store.selectedItem && (
        <FocusView
          item={store.selectedItem}
          mode={previewMode === "quick" ? "quick" : "focus"}
          similarItems={similarItems}
          showSimilar={showSimilar}
          onClose={() => {
            setShowSimilar(false);
            setPreviewMode("none");
          }}
          onPrevious={() => store.moveSelection(-1)}
          onNext={() => store.moveSelection(1)}
          onToggleSimilar={() => setShowSimilar((value) => !value)}
          onSelectSimilar={(item) => {
            store.setSelectedIndex(store.filteredItems.findIndex((candidate) => candidate.id === item.id));
            setPreviewMode("focus");
          }}
        />
      )}

      {isCommandOpen && <CommandMenu commands={commands} onClose={() => setIsCommandOpen(false)} />}

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
