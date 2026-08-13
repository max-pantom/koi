import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";
import { memo, type CSSProperties, type MouseEvent } from "react";

type MediaTileProps = {
  item: MediaItem;
  index: number;
  isActive: boolean;
  showImageTooltip: boolean;
  style: CSSProperties;
  onActivate: (index: number) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>, index: number) => void;
  onMeasure: (mediaId: string, width: number, height: number) => void;
};

export const MediaTile = memo(function MediaTile({
  item,
  index,
  isActive,
  showImageTooltip,
  style,
  onActivate,
  onContextMenu,
  onMeasure,
}: MediaTileProps) {
  return (
    <button
      className={`${isActive ? "tile is-active" : "tile"}${item.missing ? " is-missing" : ""}`}
      style={style}
      type="button"
      onClick={() => onActivate(index)}
      onContextMenu={(event) => onContextMenu(event, index)}
      aria-label={`${item.captureType === "link" ? "Saved page: " : ""}${item.sourceTitle || item.name}`}
      title={showImageTooltip ? item.sourceTitle || item.name : undefined}
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
            onMeasure(item.id, image.naturalWidth, image.naturalHeight);
          }
        }}
      />
      {item.captureType === "link" && <span className="tile-kind">Saved page</span>}
    </button>
  );
}, sameTileProps);

function sameTileProps(previous: MediaTileProps, next: MediaTileProps) {
  return previous.item === next.item
    && previous.index === next.index
    && previous.isActive === next.isActive
    && previous.showImageTooltip === next.showImageTooltip
    && previous.onActivate === next.onActivate
    && previous.onContextMenu === next.onContextMenu
    && previous.onMeasure === next.onMeasure
    && previous.style.width === next.style.width
    && previous.style.height === next.style.height
    && previous.style.transform === next.style.transform;
}
