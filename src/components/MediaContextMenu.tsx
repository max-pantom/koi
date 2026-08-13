import { Copy, ExternalLink, FolderSearch, Palette, Tag, Trash2, X } from "lucide-react";
import type { MediaItem } from "../lib/types";

export function MediaContextMenu({
  item,
  x,
  y,
  onClose,
  onReveal,
  onCopyPath,
  onCopyImage,
  onCopyName,
  onCopyPalette,
  onEditTags,
  onShowPalette,
  onResolveFolder,
  onOpenSource,
  onDelete,
}: {
  item: MediaItem;
  x: number;
  y: number;
  onClose: () => void;
  onReveal: () => void;
  onCopyPath: () => void;
  onCopyImage: () => void;
  onCopyName: () => void;
  onCopyPalette: () => void;
  onEditTags: () => void;
  onShowPalette: () => void;
  onResolveFolder: () => void;
  onOpenSource: () => void;
  onDelete: () => void;
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
            <X size={13} aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={onReveal}>
          <FolderSearch size={14} aria-hidden="true" />
          Reveal in Finder
        </button>
        {(item.sourceLinkUrl || item.sourcePageUrl || item.sourceCanonicalUrl || item.sourceFinalUrl || item.sourceUrl) && (
          <button type="button" onClick={onOpenSource}>
            <ExternalLink size={14} aria-hidden="true" />
            Open original website
          </button>
        )}
        <button type="button" onClick={onCopyPath}>
          <Copy size={14} aria-hidden="true" />
          Copy path
        </button>
        <button type="button" onClick={onCopyImage}>
          <Copy size={14} aria-hidden="true" />
          Copy image
        </button>
        <button type="button" onClick={onCopyName}>
          <Copy size={14} aria-hidden="true" />
          Copy name
        </button>
        <button type="button" onClick={onEditTags}>
          <Tag size={14} aria-hidden="true" />
          Tags
        </button>
        <button type="button" onClick={onShowPalette}>
          <Palette size={14} aria-hidden="true" />
          Palette
        </button>
        <button type="button" onClick={onCopyPalette}>
          <Copy size={14} aria-hidden="true" />
          Copy palette
        </button>
        {item.missing && (
          <button type="button" onClick={onResolveFolder}>
            <FolderSearch size={14} aria-hidden="true" />
            Locate folder
          </button>
        )}
        <button className="is-destructive" type="button" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" />
          Move to Trash
        </button>
      </div>
    </div>
  );
}
