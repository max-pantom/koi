import { Check, Folder as FolderIcon, FolderPlus, LayoutGrid, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { formatCount } from "../lib/media";
import type { Folder, SearchMode } from "../lib/types";
import { FolderPill } from "./FolderPill";

export function TopBar({
  folder,
  folders,
  activeFolderId,
  gridColumns,
  searchMode,
  total,
  isLoading,
  isSearchOpen,
  query,
  onAddFolder,
  onSelectFolder,
  onGridColumnsChange,
  onSearchModeChange,
  onToggleSearch,
  onQueryChange,
  searchRef,
}: {
  folder?: Folder;
  folders: Folder[];
  activeFolderId: string;
  gridColumns: number;
  searchMode: SearchMode;
  total: number;
  isLoading: boolean;
  isSearchOpen: boolean;
  query: string;
  onAddFolder: () => void;
  onSelectFolder: (folderId: string) => void;
  onGridColumnsChange: (columns: number) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onToggleSearch: () => void;
  onQueryChange: (query: string) => void;
  searchRef: RefObject<HTMLInputElement>;
}) {
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const folderMenuId = useId();
  const folderTriggerId = useId();
  const searchInputId = useId();
  const searchToolsId = useId();
  const folderSwitchRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFolderMenuOpen) return;

    const closeMenu = () => setIsFolderMenuOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!folderSwitchRef.current?.contains(event.target as Node)) closeMenu();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      folderSwitchRef.current?.querySelector<HTMLButtonElement>(".folder-pill")?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", closeMenu);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", closeMenu);
    };
  }, [isFolderMenuOpen]);

  const focusFolderMenuEdge = (edge: "first" | "last") => {
    setIsFolderMenuOpen(true);
    window.requestAnimationFrame(() => {
      const buttons = folderMenuRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      buttons[edge === "first" ? 0 : buttons.length - 1]?.focus();
    });
  };

  const handleFolderTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    focusFolderMenuEdge(event.key === "ArrowDown" ? "first" : "last");
  };

  const handleFolderMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (!buttons.length || currentIndex === -1) return;

    event.preventDefault();
    if (event.key === "Home") return buttons[0]?.focus();
    if (event.key === "End") return buttons[buttons.length - 1]?.focus();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus();
  };

  const selectFolder = (folderId: string) => {
    onSelectFolder(folderId);
    setIsFolderMenuOpen(false);
  };

  const addFolder = () => {
    setIsFolderMenuOpen(false);
    onAddFolder();
  };

  return (
    <header className={`toolbar${isSearchOpen ? " is-searching" : ""}`}>
      <div className="window-drag-region" data-tauri-drag-region aria-hidden="true" />

      <div className="toolbar-left">
        <button className="icon-button" type="button" onClick={onAddFolder} aria-label="Add folder" title="Add folder">
          <FolderPlus size={16} aria-hidden="true" />
        </button>
        <div
          className="folder-switch"
          ref={folderSwitchRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFolderMenuOpen(false);
          }}
        >
          <FolderPill
            id={folderTriggerId}
            folder={activeFolderId === "all" ? undefined : folder}
            fallback={activeFolderId === "all" ? "All folders" : "My mind"}
            expanded={isFolderMenuOpen}
            controls={folderMenuId}
            onKeyDown={handleFolderTriggerKeyDown}
            onClick={() => setIsFolderMenuOpen((value) => !value)}
          />
          {isFolderMenuOpen && (
            <div
              className="folder-menu"
              id={folderMenuId}
              ref={folderMenuRef}
              role="group"
              aria-labelledby={folderTriggerId}
              onKeyDown={handleFolderMenuKeyDown}
            >
              <button
                className={activeFolderId === "all" ? "is-current" : ""}
                type="button"
                aria-current={activeFolderId === "all" ? "true" : undefined}
                onClick={() => selectFolder("all")}
              >
                <FolderIcon size={15} aria-hidden="true" />
                <span>All folders</span>
                {activeFolderId === "all" && <Check className="menu-check" size={14} aria-hidden="true" />}
              </button>
              {folders.map((item) => (
                <button
                  className={activeFolderId === item.id ? "is-current" : ""}
                  key={item.id}
                  type="button"
                  aria-current={activeFolderId === item.id ? "true" : undefined}
                  onClick={() => selectFolder(item.id)}
                >
                  <FolderIcon size={15} aria-hidden="true" />
                  <span>{item.name}</span>
                  {activeFolderId === item.id && <Check className="menu-check" size={14} aria-hidden="true" />}
                </button>
              ))}
              <button className="folder-menu-add" type="button" onClick={addFolder}>
                <FolderPlus size={15} aria-hidden="true" />
                <span>Add folder</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-right">
        <output className={`count-pill${isLoading ? " is-loading" : ""}`} aria-live="polite" aria-atomic="true">
          {isLoading ? "Scanning…" : formatCount(total)}
        </output>

        <label className="density-control" title={`${gridColumns} grid columns`}>
          <LayoutGrid size={15} aria-hidden="true" />
          <span className="sr-only">Grid columns</span>
          <input
            type="range"
            min="4"
            max="16"
            value={gridColumns}
            aria-label="Grid columns"
            aria-valuetext={`${gridColumns} columns`}
            onChange={(event) => onGridColumnsChange(Number(event.target.value))}
          />
          <span className="density-value" aria-hidden="true">{gridColumns}</span>
        </label>

        {isSearchOpen && (
          <div className="search-tools" id={searchToolsId}>
            <div className="search-mode" role="group" aria-label="Search scope">
              <button
                className={searchMode === "normal" ? "is-active" : ""}
                type="button"
                aria-pressed={searchMode === "normal"}
                title="Search names, tags, folders, sites, and types"
                onClick={() => onSearchModeChange("normal")}
              >
                Standard
              </button>
              <button
                className={searchMode === "smart" ? "is-active" : ""}
                type="button"
                aria-pressed={searchMode === "smart"}
                title="Also search colors, paths, and full URLs"
                onClick={() => onSearchModeChange("smart")}
              >
                Expanded
              </button>
            </div>

            <div className="search-box" role="search">
              <Search size={15} aria-hidden="true" />
              <label className="sr-only" htmlFor={searchInputId}>Search library</label>
              <input
                id={searchInputId}
                ref={searchRef}
                type="search"
                value={query}
                autoComplete="off"
                spellCheck="false"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={searchMode === "smart" ? "Search everything, including colors…" : "Search your library…"}
              />
              {query && (
                <button
                  className="clear-search"
                  type="button"
                  onClick={() => {
                    onQueryChange("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        <button
          className={`search-toggle${isSearchOpen ? " is-active" : ""}`}
          type="button"
          onClick={onToggleSearch}
          aria-label={isSearchOpen ? "Close search" : "Open search"}
          aria-expanded={isSearchOpen}
          aria-controls={searchToolsId}
          aria-keyshortcuts="Meta+F"
          title={isSearchOpen ? "Close search" : "Search (⌘F)"}
        >
          {isSearchOpen ? <X size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          {!isSearchOpen && <span>Search</span>}
          {!isSearchOpen && <kbd aria-hidden="true">⌘F</kbd>}
        </button>
      </div>
    </header>
  );
}
