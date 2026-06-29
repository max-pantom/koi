import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    void store.loadLibrary();
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
        folder={store.folders[store.folders.length - 1]}
        total={store.filteredItems.length}
        isLoading={store.isLoading}
        isSearchOpen={isSearchOpen}
        query={store.query}
        onAddFolder={() => void store.addFolder()}
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
