import {
  Folder as FolderIcon,
  FolderPlus,
  Grid2X2,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useId, type RefObject } from "react";
import type { Folder, SearchMode } from "../lib/types";
import koiMark from "../assets/koi-mark.svg";

export function Sidebar({
  folders,
  activeFolderId,
  folderCounts,
  gridColumns,
  searchMode,
  total,
  resultCount,
  isLoading,
  isSearchOpen,
  isOpen,
  query,
  onAddFolder,
  onSelectFolder,
  onGridColumnsChange,
  onSearchModeChange,
  onToggleSearch,
  onQueryChange,
  onOpenSettings,
  onToggle,
  searchRef,
}: {
  folders: Folder[];
  activeFolderId: string;
  folderCounts: Map<string, number>;
  gridColumns: number;
  searchMode: SearchMode;
  total: number;
  resultCount: number;
  isLoading: boolean;
  isSearchOpen: boolean;
  isOpen: boolean;
  query: string;
  onAddFolder: () => void;
  onSelectFolder: (folderId: string) => void;
  onGridColumnsChange: (columns: number) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onToggleSearch: () => void;
  onQueryChange: (query: string) => void;
  onOpenSettings: () => void;
  onToggle: () => void;
  searchRef: RefObject<HTMLInputElement>;
}) {
  const searchInputId = useId();
  const searchPanelId = useId();
  const thumbnailSize = 20 - gridColumns;

  if (!isOpen) {
    return (
      <div className="sidebar-reveal-chrome" data-tauri-drag-region>
        <button
          className="sidebar-toggle sidebar-reveal"
          type="button"
          aria-label="Show sidebar"
          aria-controls="library-sidebar"
          aria-expanded="false"
          aria-keyshortcuts="Meta+Control+S"
          title="Show sidebar (⌃⌘S)"
          onClick={onToggle}
        >
          <PanelLeftOpen size={15} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <aside className="sidebar" id="library-sidebar" aria-label="Koi library">
      <div className="sidebar-titlebar" data-tauri-drag-region>
        <img className="sidebar-titlebar-mark" src={koiMark} alt="" aria-hidden="true" />
        <output
          className={isLoading ? "sidebar-count is-loading" : "sidebar-count"}
          aria-label={isLoading ? "Scanning library" : `${total.toLocaleString()} ${total === 1 ? "item" : "items"}`}
          aria-live="polite"
        >
          {isLoading ? "Scanning" : total.toLocaleString()}
        </output>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label="Hide sidebar"
          aria-controls="library-sidebar"
          aria-expanded="true"
          aria-keyshortcuts="Meta+Control+S"
          title="Hide sidebar (⌃⌘S)"
          onClick={onToggle}
        >
          <PanelLeftClose size={15} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>

      <div className="sidebar-body">
        <nav className="sidebar-nav" aria-label="Library navigation">
          <button
            className={activeFolderId === "all" && !isSearchOpen ? "sidebar-row is-active" : "sidebar-row"}
            type="button"
            aria-current={activeFolderId === "all" && !isSearchOpen ? "page" : undefined}
            onClick={() => onSelectFolder("all")}
          >
            <Images size={15} strokeWidth={1.7} aria-hidden="true" />
            <span>All images</span>
            <span className="sidebar-row-count">{total.toLocaleString()}</span>
          </button>

          <button
            className={isSearchOpen ? "sidebar-row is-active" : "sidebar-row"}
            type="button"
            aria-expanded={isSearchOpen}
            aria-controls={searchPanelId}
            aria-keyshortcuts="Meta+F"
            onClick={onToggleSearch}
          >
            {isSearchOpen ? (
              <X size={15} strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <Search size={15} strokeWidth={1.7} aria-hidden="true" />
            )}
            <span>{isSearchOpen ? "Close search" : "Search"}</span>
            {!isSearchOpen && <kbd aria-hidden="true">⌘F</kbd>}
          </button>

          {isSearchOpen && (
            <div className="sidebar-search" id={searchPanelId} role="search">
              <label className="sr-only" htmlFor={searchInputId}>Search library</label>
              <div className="sidebar-search-field">
                <Search size={14} strokeWidth={1.7} aria-hidden="true" />
                <input
                  id={searchInputId}
                  ref={searchRef}
                  type="search"
                  value={query}
                  autoComplete="off"
                  spellCheck="false"
                  placeholder="Name, tag, site…"
                  onChange={(event) => onQueryChange(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      onQueryChange("");
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="sidebar-search-mode" role="group" aria-label="Search depth">
                <button
                  className={searchMode === "normal" ? "is-active" : ""}
                  type="button"
                  aria-pressed={searchMode === "normal"}
                  onClick={() => onSearchModeChange("normal")}
                >
                  Standard
                </button>
                <button
                  className={searchMode === "smart" ? "is-active" : ""}
                  type="button"
                  aria-pressed={searchMode === "smart"}
                  onClick={() => onSearchModeChange("smart")}
                >
                  Expanded
                </button>
              </div>

              <output className="sidebar-search-count" aria-live="polite">
                {query ? `${resultCount.toLocaleString()} found` : "Type to search"}
              </output>
            </div>
          )}
        </nav>

        <section className="sidebar-section" aria-labelledby="folders-heading">
          <div className="sidebar-section-heading">
            <h2 id="folders-heading">Folders</h2>
            <button type="button" onClick={onAddFolder} aria-label="Add folder" title="Add folder">
              <FolderPlus size={14} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </div>

          <div className="sidebar-folder-list">
            {folders.map((folder) => (
              <button
                className={activeFolderId === folder.id ? "sidebar-row is-active" : "sidebar-row"}
                key={folder.id}
                type="button"
                aria-current={activeFolderId === folder.id ? "page" : undefined}
                title={folder.path}
                onClick={() => onSelectFolder(folder.id)}
              >
                <FolderIcon size={15} strokeWidth={1.7} aria-hidden="true" />
                <span>{folder.name}</span>
                <span className="sidebar-row-count">{(folderCounts.get(folder.id) ?? 0).toLocaleString()}</span>
              </button>
            ))}
            {!folders.length && (
              <button className="sidebar-empty" type="button" onClick={onAddFolder}>
                Add your first folder
              </button>
            )}
          </div>
        </section>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <label className="sidebar-density">
            <span>
              <Grid2X2 size={14} strokeWidth={1.7} aria-hidden="true" />
              Thumbnail size
            </span>
            <input
              type="range"
              min="4"
              max="16"
              value={thumbnailSize}
              aria-label="Thumbnail size"
              aria-valuetext={`${thumbnailSize} of 16`}
              onChange={(event) => onGridColumnsChange(20 - Number(event.target.value))}
            />
          </label>
          <button className="sidebar-row" type="button" onClick={onOpenSettings}>
            <Settings2 size={15} strokeWidth={1.7} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
