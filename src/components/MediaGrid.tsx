import { Grid2X2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { GridLayout, MediaItem } from "../lib/types";
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
  onContextMenu,
  onMeasure,
  onIndexColors,
  gridColumns,
  gridLayout,
  onScrollChange,
}: {
  items: MediaItem[];
  selectedItem?: MediaItem;
  isLoading: boolean;
  hasFolders: boolean;
  onAddFolder: () => void;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  onContextMenu: (event: MouseEvent, index: number) => void;
  onMeasure: (mediaId: string, width: number, height: number) => void;
  onIndexColors: (mediaId: string, dominantColors: string[], colorNames: string[]) => void;
  gridColumns: number;
  gridLayout: GridLayout;
  onScrollChange: (scrollTop: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const saveScrollRef = useRef<number | undefined>(undefined);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewport, setViewport] = useState({ top: 0, height: 800 });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const update = (saveScroll: boolean) => {
      setContainerWidth(element.clientWidth);
      setViewport({ top: element.scrollTop, height: element.clientHeight });
      if (!saveScroll) return;
      window.clearTimeout(saveScrollRef.current);
      saveScrollRef.current = window.setTimeout(() => onScrollChange(element.scrollTop), 180);
    };
    const requestUpdate = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = undefined;
        update(true);
      });
    };
    const resizeObserver = new ResizeObserver(() => update(false));
    resizeObserver.observe(element);
    element.addEventListener("scroll", requestUpdate, { passive: true });
    update(false);
    element.scrollTop = readNumber("koi.scrollTop", 0);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.clearTimeout(saveScrollRef.current);
      resizeObserver.disconnect();
      element.removeEventListener("scroll", requestUpdate);
    };
  }, []);

  const masonry = useMemo(
    () => buildLayout(items, Math.max(containerWidth - 72, 0), viewport.top, viewport.height, gridColumns, gridLayout),
    [containerWidth, gridColumns, gridLayout, items, viewport.height, viewport.top],
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
            onContextMenu={(event) => onContextMenu(event, position.index)}
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

function buildLayout(
  items: MediaItem[],
  availableWidth: number,
  scrollTop: number,
  viewportHeight: number,
  targetColumns: number,
  layout: GridLayout,
) {
  const gutter = availableWidth >= 980 ? 36 : 32;
  const columnCount = Math.max(1, Math.min(targetColumns, Math.floor((availableWidth + gutter) / (72 + gutter))));
  const columnWidth = Math.max(42, Math.floor((availableWidth - gutter * (columnCount - 1)) / columnCount));
  const positions = layout === "aligned"
    ? buildAlignedRows(items, columnCount, columnWidth, gutter)
    : buildPackedColumns(items, columnCount, columnWidth, gutter);

  const overscan = viewportHeight * 2;
  const minY = Math.max(0, scrollTop - overscan);
  const maxY = scrollTop + viewportHeight + overscan;
  const visible = positions.filter((position) => position.y + position.height >= minY && position.y <= maxY);

  return {
    visible,
    height: Math.max(...positions.map((position) => position.y + position.height), 0),
  };
}

function buildPackedColumns(items: MediaItem[], columnCount: number, columnWidth: number, gutter: number) {
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

  return positions;
}

function buildAlignedRows(items: MediaItem[], columnCount: number, columnWidth: number, gutter: number) {
  const positions: MasonryPosition[] = [];
  let y = 0;

  for (let index = 0; index < items.length; index += columnCount) {
    const row = items.slice(index, index + columnCount);
    const rowHeights = row.map((item) => {
      const naturalWidth = item.width || 1;
      const naturalHeight = item.height || 1;
      return Math.max(48, Math.round((columnWidth * naturalHeight) / naturalWidth));
    });
    const rowHeight = Math.max(...rowHeights, 48);

    row.forEach((item, rowIndex) => {
      const x = rowIndex * (columnWidth + gutter);
      positions.push({ item, index: index + rowIndex, x, y, width: columnWidth, height: rowHeights[rowIndex] });
    });

    y += rowHeight + gutter;
  }

  return positions;
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

function readNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}
