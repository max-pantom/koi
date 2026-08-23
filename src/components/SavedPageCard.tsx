import { ImageOff, Link2 } from "lucide-react";
import { sourceHostname } from "../lib/media";
import type { MediaItem } from "../lib/types";

export function SavedPageCard({ item, compact = false, unavailable = false }: {
  item: MediaItem;
  compact?: boolean;
  unavailable?: boolean;
}) {
  const title = unavailable
    ? "Preview unavailable"
    : item.sourceTitle || item.sourcePageTitle || sourceHostname(item);
  const description = unavailable
    ? "The original file is still saved in your library."
    : item.sourceDescription || "Open the source to revisit this page.";
  const Icon = unavailable ? ImageOff : Link2;

  return (
    <div className={`saved-page-card${compact ? " is-compact" : ""}`} aria-hidden={compact || undefined}>
      <span className="saved-page-icon" aria-hidden="true"><Icon size={compact ? 16 : 22} /></span>
      <div className="saved-page-copy">
        <span className="saved-page-site">{unavailable ? "Koi library" : sourceHostname(item)}</span>
        <strong>{title}</strong>
        {!compact && <p>{description}</p>}
      </div>
    </div>
  );
}
