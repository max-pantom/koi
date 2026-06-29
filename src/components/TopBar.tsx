import { FolderPlus, Search } from "lucide-react";
import type { RefObject } from "react";
import { formatCount } from "../lib/media";
import type { Folder } from "../lib/types";
import { FolderPill } from "./FolderPill";

export function TopBar({
  folder,
  total,
  isLoading,
  isSearchOpen,
  query,
  onAddFolder,
  onToggleSearch,
  onQueryChange,
  searchRef,
}: {
  folder?: Folder;
  total: number;
  isLoading: boolean;
  isSearchOpen: boolean;
  query: string;
  onAddFolder: () => void;
  onToggleSearch: () => void;
  onQueryChange: (query: string) => void;
  searchRef: RefObject<HTMLInputElement>;
}) {
  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <button className="icon-button" type="button" onClick={onAddFolder} title="Add folder">
          <FolderPlus size={14} />
        </button>
        <FolderPill folder={folder} fallback="My mind" onClick={onAddFolder} />
      </div>

      <div className="toolbar-right">
        <span className="count-pill">{isLoading ? "Scanning" : formatCount(total)}</span>
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
      </div>
    </header>
  );
}
