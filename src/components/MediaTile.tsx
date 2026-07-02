import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";
import type { CSSProperties, MouseEvent } from "react";

export function MediaTile({
  item,
  isActive,
  style,
  onSelect,
  onContextMenu,
  onMeasure,
}: {
  item: MediaItem;
  isActive: boolean;
  style: CSSProperties;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onMeasure: (width: number, height: number) => void;
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
        loading="lazy"
        decoding="async"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", item.path);
          event.dataTransfer.setData("text/uri-list", `file://${item.path}`);
        }}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (item.width !== image.naturalWidth || item.height !== image.naturalHeight) {
            onMeasure(image.naturalWidth, image.naturalHeight);
          }
        }}
      />
    </button>
  );
}
