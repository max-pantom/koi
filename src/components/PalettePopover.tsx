import { Copy, Search, X } from "lucide-react";
import type { MediaItem } from "../lib/types";

export function PalettePopover({
  item,
  onClose,
  onCopyHex,
  onCopyPalette,
  onSearchColor,
}: {
  item: MediaItem;
  onClose: () => void;
  onCopyHex: (hex: string) => void;
  onCopyPalette: () => void;
  onSearchColor: (color: string) => void;
}) {
  const colors = item.dominantColors.slice(0, 5);

  return (
    <div className="modal-layer palette-layer" role="dialog" aria-modal="true" onPointerDown={onClose}>
      <section className="palette-popover" onPointerDown={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <span>Palette</span>
          <button type="button" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>
        <div className="palette-swatches">
          {colors.map((hex) => (
            <button key={hex} type="button" onClick={() => onCopyHex(hex)} title={`Copy ${hex}`}>
              <span style={{ background: hex }} />
              <kbd>{hex}</kbd>
            </button>
          ))}
        </div>
        <div className="palette-actions">
          <button type="button" onClick={onCopyPalette}>
            <Copy size={14} />
            Copy palette
          </button>
          {item.colorNames.slice(0, 3).map((color) => (
            <button key={color} type="button" onClick={() => onSearchColor(color)}>
              <Search size={14} />
              {color}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
