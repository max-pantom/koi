import { Copy, FolderSearch, Palette, Tag, X } from "lucide-react";
import type { MediaItem } from "../lib/types";

export function MediaContextMenu({
  item,
  x,
  y,
  onClose,
  onReveal,
  onCopyPath,
  onCopyName,
  onCopyPalette,
  onEditTags,
  onShowPalette,
  onResolveFolder,
}: {
  item: MediaItem;
  x: number;
  y: number;
  onClose: () => void;
  onReveal: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onCopyPalette: () => void;
  onEditTags: () => void;
  onShowPalette: () => void;
  onResolveFolder: () => void;
}) {
  return (
    <div className="context-layer" onPointerDown={onClose}>
      <div
        className="context-menu"
        style={{ left: x, top: y }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="context-title">
          <span>{item.name}</span>
          <button type="button" onClick={onClose} title="Close">
            <X size={13} />
          </button>
        </div>
        <button type="button" onClick={onReveal}>
          <FolderSearch size={14} />
          Reveal in Finder
        </button>
        <button type="button" onClick={onCopyPath}>
          <Copy size={14} />
          Copy path
        </button>
        <button type="button" onClick={onCopyName}>
          <Copy size={14} />
          Copy name
        </button>
        <button type="button" onClick={onEditTags}>
          <Tag size={14} />
          Tags
        </button>
        <button type="button" onClick={onShowPalette}>
          <Palette size={14} />
          Palette
        </button>
        <button type="button" onClick={onCopyPalette}>
          <Copy size={14} />
          Copy palette
        </button>
        {item.missing && (
          <button type="button" onClick={onResolveFolder}>
            <FolderSearch size={14} />
            Locate folder
          </button>
        )}
      </div>
    </div>
  );
}
