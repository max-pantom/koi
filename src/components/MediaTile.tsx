import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";
import type { CSSProperties } from "react";

export function MediaTile({
  item,
  isActive,
  style,
  onSelect,
  onMeasure,
}: {
  item: MediaItem;
  isActive: boolean;
  style: CSSProperties;
  onSelect: () => void;
  onMeasure: (width: number, height: number) => void;
}) {
  return (
    <button
      className={isActive ? "tile is-active" : "tile"}
      style={style}
      type="button"
      onClick={onSelect}
      title={item.name}
    >
      <img
        src={mediaSrc(item)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={(event) => {
          const image = event.currentTarget;
          onMeasure(image.naturalWidth, image.naturalHeight);
        }}
      />
    </button>
  );
}
