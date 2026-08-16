import { ChevronRight, Copy, ExternalLink, FolderSearch, Palette, Tag, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { MediaItem } from "../lib/types";

export function MediaContextMenu({
  item,
  x,
  y,
  onClose,
  onReveal,
  onCopyImage,
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
  onCopyImage: () => void;
  onEditTags: () => void;
  onShowPalette: () => void;
  onResolveFolder: () => void;
  onOpenSource: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const menuTop = Math.max(8, Math.min(y, window.innerHeight - (showMoreActions ? 292 : 214)));

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previousFocus?.focus();
  }, []);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowRight" && document.activeElement?.matches("[data-more-actions]")) {
      event.preventDefault();
      setShowMoreActions(true);
      window.requestAnimationFrame(() => {
        menuRef.current?.querySelector<HTMLButtonElement>(".context-menu-group button")?.focus();
      });
      return;
    }
    if (event.key === "ArrowLeft" && (document.activeElement as HTMLElement | null)?.closest(".context-menu-group")) {
      event.preventDefault();
      setShowMoreActions(false);
      window.requestAnimationFrame(() => {
        menuRef.current?.querySelector<HTMLButtonElement>("[data-more-actions]")?.focus();
      });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const actions = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const currentIndex = actions.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    actions[(currentIndex + delta + actions.length) % actions.length]?.focus();
  };

  return (
    <div className="context-layer" onPointerDown={onClose}>
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: menuTop }}
        role="menu"
        aria-label="Image actions"
        onKeyDown={onMenuKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={onCopyImage}>
          <Copy size={14} aria-hidden="true" />
          Copy image
        </button>
        {(item.sourceLinkUrl || item.sourcePageUrl || item.sourceCanonicalUrl || item.sourceFinalUrl || item.sourceUrl) && (
          <button type="button" role="menuitem" onClick={onOpenSource}>
            <ExternalLink size={14} aria-hidden="true" />
            Open original website
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          data-more-actions
          aria-expanded={showMoreActions}
          onClick={() => setShowMoreActions((current) => !current)}
        >
          <ChevronRight className={showMoreActions ? "is-expanded" : ""} size={14} aria-hidden="true" />
          More actions
        </button>
        {showMoreActions && (
          <div className="context-menu-group" role="group" aria-label="More image actions">
            <button type="button" role="menuitem" onClick={onReveal}>
              <FolderSearch size={14} aria-hidden="true" />
              Reveal in Finder
            </button>
            <button type="button" role="menuitem" onClick={onEditTags}>
              <Tag size={14} aria-hidden="true" />
              Edit tags…
            </button>
            <button type="button" role="menuitem" onClick={onShowPalette}>
              <Palette size={14} aria-hidden="true" />
              Show palette
            </button>
          </div>
        )}
        {item.missing && (
          <button type="button" role="menuitem" onClick={onResolveFolder}>
            <FolderSearch size={14} aria-hidden="true" />
            Locate folder
          </button>
        )}
        <button className="is-destructive" type="button" role="menuitem" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" />
          Move to Trash
        </button>
      </div>
    </div>
  );
}
