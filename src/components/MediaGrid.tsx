import { Grid2X2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaItem } from "../lib/types";
import { MediaTile } from "./MediaTile";

type MasonryPosition = {
  item: MediaItem;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function MediaGrid({
  items,
  selectedItem,
  isLoading,
  hasFolders,
  onAddFolder,
  onSelect,
  onOpen,
  onMeasure,
  onIndexColors,
  gridColumns,
}: {
  items: MediaItem[];
  selectedItem?: MediaItem;
  isLoading: boolean;
  hasFolders: boolean;
  onAddFolder: () => void;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  onMeasure: (mediaId: string, width: number, height: number) => void;
  onIndexColors: (mediaId: string, dominantColors: string[], colorNames: string[]) => void;
  gridColumns: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewport, setViewport] = useState({ top: 0, height: 800 });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const update = () => {
      setContainerWidth(element.clientWidth);
      setViewport({ top: element.scrollTop, height: element.clientHeight });
    };
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();

    return () => {
      resizeObserver.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  const masonry = useMemo(
    () => buildMasonry(items, Math.max(containerWidth - 72, 0), viewport.top, viewport.height, gridColumns),
    [containerWidth, gridColumns, items, viewport.height, viewport.top],
  );

  if (!items.length) {
    return (
      <div className="grid-wrap" ref={scrollRef}>
        <button className="quiet-empty" type="button" onClick={onAddFolder}>
          <Grid2X2 size={17} />
          <span>{isLoading ? "Scanning" : hasFolders ? "No images found" : "Add a folder"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid-wrap" ref={scrollRef}>
      <div className="mood-grid" style={{ height: masonry.height }}>
        {masonry.visible.map((position) => (
          <MediaTile
            key={position.item.id}
            item={position.item}
            isActive={position.item.id === selectedItem?.id}
            style={{
              width: position.width,
              height: position.height,
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            }}
            onSelect={() => {
              onSelect(position.index);
              onOpen(position.index);
            }}
            onMeasure={(width, height) => onMeasure(position.item.id, width, height)}
            onIndexColors={(dominantColors, colorNames) =>
              onIndexColors(position.item.id, dominantColors, colorNames)
            }
          />
        ))}
      </div>
    </div>
  );
}

function buildMasonry(
  items: MediaItem[],
  availableWidth: number,
  scrollTop: number,
  viewportHeight: number,
  targetColumns: number,
) {
  const gutter = availableWidth >= 980 ? 36 : 32;
  const columnCount = Math.max(1, Math.min(targetColumns, Math.floor((availableWidth + gutter) / (72 + gutter))));
  const columnWidth = Math.max(42, Math.floor((availableWidth - gutter * (columnCount - 1)) / columnCount));
  const columns = Array.from({ length: columnCount }, () => 0);
  const positions: MasonryPosition[] = [];

  items.forEach((item, index) => {
    const columnIndex = shortestColumn(columns);
    const naturalWidth = item.width || 1;
    const naturalHeight = item.height || 1;
    const renderedHeight = Math.max(48, Math.round((columnWidth * naturalHeight) / naturalWidth));
    const x = columnIndex * (columnWidth + gutter);
    const y = columns[columnIndex];

    positions.push({ item, index, x, y, width: columnWidth, height: renderedHeight });
    columns[columnIndex] += renderedHeight + gutter;
  });

  const overscan = viewportHeight * 2;
  const minY = Math.max(0, scrollTop - overscan);
  const maxY = scrollTop + viewportHeight + overscan;
  const visible = positions.filter((position) => position.y + position.height >= minY && position.y <= maxY);

  return {
    visible,
    height: Math.max(...columns, 0),
  };
}

function shortestColumn(columns: number[]) {
  let index = 0;
  for (let i = 1; i < columns.length; i += 1) {
    if (columns[i] < columns[index]) index = i;
  }
  return index;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
