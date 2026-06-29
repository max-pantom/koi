import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";

export function FocusView({
  item,
  mode,
  similarItems,
  showSimilar,
  onClose,
  onPrevious,
  onNext,
  onToggleSimilar,
  onSelectSimilar,
}: {
  item: MediaItem;
  mode: "quick" | "focus";
  similarItems: MediaItem[];
  showSimilar: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleSimilar: () => void;
  onSelectSimilar: (item: MediaItem) => void;
}) {
  return (
    <div className={`preview-layer preview-${mode}`} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <img className="preview-blur" src={mediaSrc(item)} alt="" draggable={false} />
      <button className="preview-close" type="button" onClick={onClose} title="Close">
        <X size={17} />
      </button>
      <button
        className="preview-nav left"
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onPrevious}
        title="Previous"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="preview-media" onMouseDown={(event) => event.stopPropagation()}>
        <img src={mediaSrc(item)} alt="" draggable={false} />
      </div>
      <button
        className="preview-nav right"
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onNext}
        title="Next"
      >
        <ArrowRight size={18} />
      </button>
      <button
        className="similar-toggle"
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onToggleSimilar}
      >
        Similar
      </button>
      <div className="preview-caption">{item.name}</div>
      {showSimilar && (
        <div className="similar-strip" onMouseDown={(event) => event.stopPropagation()}>
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
