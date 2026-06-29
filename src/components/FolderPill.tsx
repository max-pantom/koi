import { Folder } from "lucide-react";
import type { Folder as FolderType } from "../lib/types";

export function FolderPill({
  folder,
  fallback,
  onClick,
}: {
  folder?: FolderType;
  fallback: string;
  onClick: () => void;
}) {
  return (
    <button className="folder-pill" type="button" onClick={onClick} title={folder?.path ?? fallback}>
      <Folder size={13} />
      <span>{folder?.name ?? fallback}</span>
    </button>
  );
}
