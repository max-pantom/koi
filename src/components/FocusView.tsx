import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useRef, type WheelEvent } from "react";
import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";

export function FocusView({
  item,
  mode,
  isClosing,
  similarItems,
  showSimilar,
  showPalette,
  onCopyColor,
  onClose,
  onPrevious,
  onNext,
  onToggleSimilar,
  onSelectSimilar,
}: {
  item: MediaItem;
  mode: "quick" | "focus";
  isClosing: boolean;
  similarItems: MediaItem[];
  showSimilar: boolean;
  showPalette: boolean;
  onCopyColor: (hex: string) => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleSimilar: () => void;
  onSelectSimilar: (item: MediaItem) => void;
}) {
  const lastWheelAt = useRef(0);

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
      onPointerDown={onClose}
      onWheel={onWheel}
    >
      <img className="preview-blur" src={mediaSrc(item)} alt="" draggable={false} />
      <button className="preview-close" type="button" onClick={onClose} title="Close">
        <X size={17} />
      </button>
      <button
        className="preview-nav left"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onPrevious}
        title="Previous"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="preview-media">
        <img src={mediaSrc(item)} alt="" draggable={false} onPointerDown={(event) => event.stopPropagation()} />
        {showPalette && (
          <div className="focus-palette" onPointerDown={(event) => event.stopPropagation()}>
            {item.dominantColors.slice(0, 5).map((hex) => (
              <button
                key={hex}
                type="button"
                style={{ background: hex }}
                onClick={() => onCopyColor(hex)}
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
        title="Next"
      >
        <ArrowRight size={18} />
      </button>
      <button
        className="similar-toggle"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onToggleSimilar}
      >
        Similar
      </button>
      <div className="preview-caption">{item.name}</div>
      {showSimilar && (
        <div className="similar-strip" onPointerDown={(event) => event.stopPropagation()}>
          {similarItems.map((similar) => (
            <button key={similar.id} type="button" onClick={() => onSelectSimilar(similar)} title={similar.name}>
              <img src={mediaSrc(similar)} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
