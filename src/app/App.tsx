import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { FocusView } from "../components/FocusView";
import { MediaGrid } from "../components/MediaGrid";
import { TopBar } from "../components/TopBar";
import { initialRoute } from "./routes";
import { useKeyboard } from "../state/useKeyboard";
import { useLibraryStore } from "../state/useLibraryStore";
import "../styles/app.css";

export function App() {
  const store = useLibraryStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [route, setRoute] = useState(initialRoute);
  const searchRef = useRef<HTMLInputElement>(null);

  const isFocusOpen = route.view === "focus" && !!store.selectedItem;
  const activeFolder =
    store.activeFolderId === "all"
      ? undefined
      : store.folders.find((folder) => folder.id === store.activeFolderId);

  useEffect(() => {
    void store.loadLibrary();
  }, []);

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
    setRoute({ view: "grid" });
  };

  useKeyboard({
    addFolder: () => void store.addFolder(),
    openSearch: () => setIsSearchOpen(true),
    closeLayer,
    openSelected: () => store.selectedItem && setRoute({ view: "focus" }),
    moveSelection: store.moveSelection,
  });

  return (
    <main className="app">
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
            setRoute({ view: "focus" });
          }}
          onMeasure={store.updateItemSize}
          onIndexColors={(mediaId, dominantColors, colorNames) =>
            void store.saveMediaIndex(mediaId, dominantColors, colorNames)
          }
          gridColumns={store.gridColumns}
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
          onClose={() => setRoute({ view: "grid" })}
          onPrevious={() => store.moveSelection(-1)}
          onNext={() => store.moveSelection(1)}
        />
      )}

    </main>
  );
}
