import { isGeneratedLinkPlaceholder, mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";
import { memo, useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { SavedPageCard } from "./SavedPageCard";

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
  const [mediaError, setMediaError] = useState(false);
  const isLinkPlaceholder = isGeneratedLinkPlaceholder(item);

  useEffect(() => {
    setMediaError(false);
  }, [item.id]);

  return (
    <button
      className={`${isActive ? "tile is-active" : "tile"}${item.missing ? " is-missing" : ""}`}
      data-media-id={item.id}
      style={style}
      type="button"
      onClick={() => onActivate(index)}
      onContextMenu={(event) => onContextMenu(event, index)}
      aria-label={`${item.captureType === "link" ? "Saved page: " : ""}${item.sourceTitle || item.name}`}
      title={showImageTooltip ? item.sourceTitle || item.name : undefined}
    >
      {mediaError || isLinkPlaceholder ? (
        <SavedPageCard item={item} compact unavailable={mediaError && !isLinkPlaceholder} />
      ) : item.kind === "video" ? (
        <video
          src={mediaSrc(item)}
          aria-hidden="true"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          draggable={false}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (video.videoWidth && video.videoHeight && (item.width !== video.videoWidth || item.height !== video.videoHeight)) {
              onMeasure(item.id, video.videoWidth, video.videoHeight);
            }
          }}
          onError={() => setMediaError(true)}
        />
      ) : <img
        src={mediaSrc(item)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable
        onError={() => setMediaError(true)}
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
      />}
      {item.captureType === "link" && <span className="tile-kind">Saved page</span>}
      {item.captureType === "article" && <span className="tile-kind">Article</span>}
      {item.captureType === "gif" && <span className="tile-kind">GIF</span>}
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
