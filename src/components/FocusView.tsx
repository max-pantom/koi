import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { useRef, type WheelEvent } from "react";
import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";

export function FocusView({
  item,
  mode,
  isClosing,
  showPalette,
  onCopyColor,
  onClose,
  onPrevious,
  onNext,
  onOpenSource,
}: {
  item: MediaItem;
  mode: "quick" | "focus";
  isClosing: boolean;
  showPalette: boolean;
  onCopyColor: (hex: string) => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSource: () => void;
}) {
  const lastWheelAt = useRef(0);
  const sourceUrl = item.sourceLinkUrl
    || item.sourcePageUrl
    || item.sourceCanonicalUrl
    || item.sourceFinalUrl
    || item.sourceUrl;
  const sourceHost = sourceHostname(sourceUrl) || item.sourceSiteName || "Open source";

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelAt.current < 240 || Math.abs(event.deltaY) < 12) return;
    lastWheelAt.current = now;
    if (event.deltaY > 0) onNext();
    else onPrevious();
  };

  return (
    <div
      className={`preview-layer preview-${mode}${isClosing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={item.sourceTitle || item.name}
      onPointerDown={onClose}
      onWheel={onWheel}
    >
      <img className="preview-blur" src={mediaSrc(item)} alt="" draggable={false} />
      <button
        className="preview-close"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onClose}
        aria-label="Close preview"
        title="Close"
      >
        <X size={17} aria-hidden="true" />
      </button>
      <button
        className="preview-nav left"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onPrevious}
        aria-label="Previous image"
        title="Previous"
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div className="preview-media">
        <img src={mediaSrc(item)} alt={item.sourceTitle || item.name} draggable={false} onPointerDown={(event) => event.stopPropagation()} />
        {showPalette && (
          <div className="focus-palette" onPointerDown={(event) => event.stopPropagation()}>
            {item.dominantColors.slice(0, 5).map((hex) => (
              <button
                key={hex}
                type="button"
                style={{ background: hex }}
                onClick={() => onCopyColor(hex)}
                aria-label={`Copy color ${hex}`}
                title={`Copy ${hex}`}
              />
            ))}
          </div>
        )}
      </div>
      <button
        className="preview-nav right"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onNext}
        aria-label="Next image"
        title="Next"
      >
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <div className="preview-caption">
        <span>{item.sourceTitle || item.name}</span>
        {sourceUrl && (
          <button
            className="preview-source"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onOpenSource}
            aria-label={`Open source${item.sourceSiteName ? ` on ${item.sourceSiteName}` : ""}`}
            title={sourceUrl}
          >
            <ExternalLink size={12} aria-hidden="true" />
            {sourceHost}
          </button>
        )}
      </div>
    </div>
  );
}

function sourceHostname(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
