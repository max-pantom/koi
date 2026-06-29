import { Folder as FolderIcon, FolderPlus, LayoutPanelTop, Search } from "lucide-react";
import { useState, type RefObject } from "react";
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

  return (
    <header className="toolbar" data-tauri-drag-region>
      <div className="toolbar-left">
        <button className="icon-button" type="button" onClick={onAddFolder} title="Add folder">
          <FolderPlus size={14} />
        </button>
        <div className="folder-switch">
          <FolderPill
            folder={activeFolderId === "all" ? undefined : folder}
            fallback={activeFolderId === "all" ? "All folders" : "My mind"}
            onClick={() => setIsFolderMenuOpen((value) => !value)}
          />
          {isFolderMenuOpen && (
            <div className="folder-menu">
              <button
                type="button"
                onClick={() => {
                  onSelectFolder("all");
                  setIsFolderMenuOpen(false);
                }}
              >
                <FolderIcon size={12} />
                All folders
              </button>
              {folders.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectFolder(item.id);
                    setIsFolderMenuOpen(false);
                  }}
                >
                  <FolderIcon size={12} />
                  {item.name}
                </button>
              ))}
              <button type="button" onClick={onAddFolder}>
                <FolderPlus size={12} />
                Add folder
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-right">
        <span className="count-pill">{isLoading ? "Scanning" : formatCount(total)}</span>
        <label className="density-control" title="Grid size">
          <input
            type="range"
            min="4"
            max="16"
            value={gridColumns}
            onChange={(event) => onGridColumnsChange(Number(event.target.value))}
          />
        </label>
        {isSearchOpen && (
          <div className="search-mode">
            <button
              className={searchMode === "normal" ? "is-active" : ""}
              type="button"
              onClick={() => onSearchModeChange("normal")}
            >
              Normal
            </button>
            <button
              className={searchMode === "smart" ? "is-active" : ""}
              type="button"
              onClick={() => onSearchModeChange("smart")}
            >
              Smart
            </button>
          </div>
        )}
        {isSearchOpen && (
          <label className="search-box">
            <Search size={13} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search"
            />
          </label>
        )}
        <button className="icon-button" type="button" onClick={onToggleSearch} title="Search">
          <Search size={14} />
        </button>
        <button className="icon-button wide" type="button" title="Layout">
          <LayoutPanelTop size={14} />
        </button>
      </div>
    </header>
  );
}
