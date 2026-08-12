import { ChevronDown, Folder } from "lucide-react";
import type { KeyboardEventHandler } from "react";
import type { Folder as FolderType } from "../lib/types";

export function FolderPill({
  id,
  folder,
  fallback,
  expanded,
  controls,
  onKeyDown,
  onClick,
}: {
  id: string;
  folder?: FolderType;
  fallback: string;
  expanded: boolean;
  controls: string;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  onClick: () => void;
}) {
  return (
    <button
      className="folder-pill"
      id={id}
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      onKeyDown={onKeyDown}
      title={folder?.path ?? fallback}
    >
      <Folder size={15} aria-hidden="true" />
      <span>{folder?.name ?? fallback}</span>
      <ChevronDown className="folder-pill-chevron" size={13} aria-hidden="true" />
    </button>
  );
}
