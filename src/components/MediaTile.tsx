import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";
import type { CSSProperties, MouseEvent } from "react";
import { extractColorIndex } from "../lib/colorIndex";

export function MediaTile({
  item,
  isActive,
  style,
  onSelect,
  onContextMenu,
  onMeasure,
  onIndexColors,
}: {
  item: MediaItem;
  isActive: boolean;
  style: CSSProperties;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onMeasure: (width: number, height: number) => void;
  onIndexColors: (dominantColors: string[], colorNames: string[]) => void;
}) {
  return (
    <button
      className={`${isActive ? "tile is-active" : "tile"}${item.missing ? " is-missing" : ""}`}
      style={style}
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={item.name}
    >
      <img
        src={mediaSrc(item)}
        alt=""
        loading="eager"
        decoding="async"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", item.path);
          event.dataTransfer.setData("text/uri-list", `file://${item.path}`);
        }}
        onLoad={(event) => {
          const image = event.currentTarget;
          onMeasure(image.naturalWidth, image.naturalHeight);
          if (!item.colorNames.length) {
            const index = extractColorIndex(image);
            if (index) onIndexColors(index.dominantColors, index.colorNames);
          }
        }}
      />
    </button>
  );
}
