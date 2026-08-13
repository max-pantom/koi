import {
  Folder as FolderIcon,
  FolderPlus,
  Grid2X2,
  Grid3X3,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Square,
  X,
} from "lucide-react";
import { Fragment, useId, type PointerEvent, type RefObject } from "react";
import type { Folder } from "../lib/types";

export function Sidebar({
  folders,
  activeFolderId,
  folderCounts,
  gridColumns,
  total,
  resultCount,
  isLoading,
  isSearchOpen,
  isOpen,
  query,
  onAddFolder,
  onSelectFolder,
  onGridColumnsChange,
  onSearchFocusChange,
  onQueryChange,
  onOpenSettings,
  onToggle,
  onStartWindowDrag,
  searchRef,
}: {
  folders: Folder[];
  activeFolderId: string;
  folderCounts: Map<string, number>;
  gridColumns: number;
  total: number;
  resultCount: number;
  isLoading: boolean;
  isSearchOpen: boolean;
  isOpen: boolean;
  query: string;
  onAddFolder: () => void;
  onSelectFolder: (folderId: string) => void;
  onGridColumnsChange: (columns: number) => void;
  onSearchFocusChange: (isFocused: boolean) => void;
  onQueryChange: (query: string) => void;
  onOpenSettings: () => void;
  onToggle: () => void;
  onStartWindowDrag: (event: PointerEvent<HTMLElement>) => void;
  searchRef: RefObject<HTMLInputElement>;
}) {
  const searchInputId = useId();
  const densityPreset = gridColumns <= 4 ? "xl" : gridColumns <= 7 ? "large" : gridColumns <= 11 ? "medium" : "small";

  return (
    <Fragment>
      <div className={`sidebar-reveal-chrome${isOpen ? " is-hidden" : ""}`} onPointerDown={onStartWindowDrag}>
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
      <aside
        className={`sidebar${isOpen ? "" : " is-closed"}`}
        id="library-sidebar"
        aria-label="Koi library"
        aria-hidden={!isOpen}
        {...(!isOpen ? { inert: "" } : {}) as Record<string, string>}
      >
      <div className="sidebar-titlebar" onPointerDown={onStartWindowDrag}>
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
            className={activeFolderId === "all" && !query ? "sidebar-row is-active" : "sidebar-row"}
            type="button"
            aria-current={activeFolderId === "all" && !query ? "page" : undefined}
            onClick={() => onSelectFolder("all")}
          >
            <Images size={15} strokeWidth={1.7} aria-hidden="true" />
            <span>All images</span>
            <span className="sidebar-row-count">{total.toLocaleString()}</span>
          </button>

          <div className={`sidebar-search-field${isSearchOpen || query ? " is-active" : ""}`} role="search">
            <label className="sr-only" htmlFor={searchInputId}>Search library</label>
            <Search size={14} strokeWidth={1.7} aria-hidden="true" />
            <input
              id={searchInputId}
              ref={searchRef}
              type="search"
              value={query}
              autoComplete="off"
              spellCheck="false"
              placeholder="Search images…"
              aria-keyshortcuts="Meta+F"
              onFocus={() => onSearchFocusChange(true)}
              onBlur={() => onSearchFocusChange(false)}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => {
                  onQueryChange("");
                  searchRef.current?.focus();
                }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            ) : (
              <kbd aria-hidden="true">⌘F</kbd>
            )}
          </div>
          {query && <output className="sidebar-search-count" aria-live="polite">{resultCount.toLocaleString()} found</output>}
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
          <section className="thumbnail-control" aria-labelledby="thumbnail-heading">
            <div className="thumbnail-control-heading">
              <span id="thumbnail-heading">Image size</span>
              <output>{densityPreset === "xl" ? "XL" : densityPreset === "large" ? "Large" : densityPreset === "medium" ? "Medium" : "Small"}</output>
            </div>
            <div className="thumbnail-presets" role="group" aria-label="Thumbnail size">
              <button
                className={densityPreset === "xl" ? "is-active" : ""}
                type="button"
                aria-pressed={densityPreset === "xl"}
                onClick={() => onGridColumnsChange(3)}
                title="Extra-large thumbnails"
              >
                <Square size={15} strokeWidth={1.7} aria-hidden="true" />
                <span>XL</span>
              </button>
              <button
                className={densityPreset === "large" ? "is-active" : ""}
                type="button"
                aria-pressed={densityPreset === "large"}
                onClick={() => onGridColumnsChange(5)}
                title="Large thumbnails"
              >
                <Images size={15} strokeWidth={1.7} aria-hidden="true" />
                <span>Large</span>
              </button>
              <button
                className={densityPreset === "medium" ? "is-active" : ""}
                type="button"
                aria-pressed={densityPreset === "medium"}
                onClick={() => onGridColumnsChange(9)}
                title="Medium thumbnails"
              >
                <Grid2X2 size={15} strokeWidth={1.7} aria-hidden="true" />
                <span>Medium</span>
              </button>
              <button
                className={densityPreset === "small" ? "is-active" : ""}
                type="button"
                aria-pressed={densityPreset === "small"}
                onClick={() => onGridColumnsChange(14)}
                title="Small thumbnails"
              >
                <Grid3X3 size={15} strokeWidth={1.7} aria-hidden="true" />
                <span>Small</span>
              </button>
            </div>
          </section>
          <button className="sidebar-row" type="button" onClick={onOpenSettings}>
            <Settings2 size={15} strokeWidth={1.7} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>
      </aside>
    </Fragment>
  );
}
