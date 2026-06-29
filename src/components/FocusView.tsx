import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";

export function FocusView({
  item,
  onClose,
  onPrevious,
  onNext,
}: {
  item: MediaItem;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="preview-layer" role="dialog" aria-modal="true">
      <button className="preview-close" type="button" onClick={onClose} title="Close">
        <X size={17} />
      </button>
      <button className="preview-nav left" type="button" onClick={onPrevious} title="Previous">
        <ArrowLeft size={18} />
      </button>
      <div className="preview-media">
        <img src={mediaSrc(item)} alt="" draggable={false} />
      </div>
      <button className="preview-nav right" type="button" onClick={onNext} title="Next">
        <ArrowRight size={18} />
      </button>
      <div className="preview-caption">{item.name}</div>
    </div>
  );
}
