import { Grid2X2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
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

type MediaMeasurement = {
  mediaId: string;
  width: number;
  height: number;
};

type MasonryLayout = {
  positions: MasonryPosition[];
  height: number;
  maxItemHeight: number;
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
  onMeasureBatch,
  gridColumns,
  gridLayout,
  onScrollChange,
  onStartWindowDrag,
}: {
  items: MediaItem[];
  selectedItem?: MediaItem;
  isLoading: boolean;
  hasFolders: boolean;
  onAddFolder: () => void;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  onContextMenu: (event: MouseEvent, index: number) => void;
  onMeasureBatch: (measurements: MediaMeasurement[]) => void;
  gridColumns: number;
  gridLayout: GridLayout;
  onScrollChange: (scrollTop: number) => void;
  onStartWindowDrag: (event: PointerEvent<HTMLElement>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const saveScrollRef = useRef<number | undefined>(undefined);
  const resizeThrottleRef = useRef<number | undefined>(undefined);
  const measurementFrameRef = useRef<number | undefined>(undefined);
  const pendingMeasurementsRef = useRef<Map<string, MediaMeasurement>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewport, setViewport] = useState({ top: 0, height: 800 });

  const queueMeasurement = useCallback((mediaId: string, width: number, height: number) => {
    pendingMeasurementsRef.current.set(mediaId, { mediaId, width, height });
    if (measurementFrameRef.current !== undefined) return;
    measurementFrameRef.current = window.requestAnimationFrame(() => {
      measurementFrameRef.current = undefined;
      const measurements = Array.from(pendingMeasurementsRef.current.values());
      pendingMeasurementsRef.current.clear();
      onMeasureBatch(measurements);
    });
  }, [onMeasureBatch]);

  const activateTile = useCallback((index: number) => {
    onSelect(index);
    onOpen(index);
  }, [onOpen, onSelect]);

  const openTileMenu = useCallback((event: MouseEvent<HTMLButtonElement>, index: number) => {
    onContextMenu(event, index);
  }, [onContextMenu]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateViewport = (saveScroll: boolean) => {
      const nextTop = element.scrollTop;
      const nextHeight = element.clientHeight;
      setViewport((current) => (
        current.top === nextTop && current.height === nextHeight
          ? current
          : { top: nextTop, height: nextHeight }
      ));
      if (!saveScroll) return;
      window.clearTimeout(saveScrollRef.current);
      saveScrollRef.current = window.setTimeout(() => onScrollChange(nextTop), 180);
    };
    const updateSize = () => {
      const nextWidth = readContentWidth(element);
      setContainerWidth((current) => current === nextWidth ? current : nextWidth);
      updateViewport(false);
    };
    const requestScrollUpdate = () => {
      if (frameRef.current !== undefined) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = undefined;
        updateViewport(true);
      });
    };
    const requestResizeUpdate = () => {
      // Sidebar and window animations can emit a ResizeObserver entry every frame.
      // Three measured layouts over a 220 ms transition look just as fluid and
      // avoid rebuilding thousands of masonry positions 12–15 times.
      if (resizeThrottleRef.current !== undefined) return;
      resizeThrottleRef.current = window.setTimeout(() => {
        resizeThrottleRef.current = undefined;
        updateSize();
      }, 72);
    };
    const resizeObserver = new ResizeObserver(requestResizeUpdate);
    resizeObserver.observe(element);
    element.addEventListener("scroll", requestScrollUpdate, { passive: true });
    updateSize();
    element.scrollTop = readNumber("koi.scrollTop", 0);
    updateViewport(false);

    return () => {
      if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current);
      if (measurementFrameRef.current !== undefined) window.cancelAnimationFrame(measurementFrameRef.current);
      window.clearTimeout(saveScrollRef.current);
      window.clearTimeout(resizeThrottleRef.current);
      resizeObserver.disconnect();
      element.removeEventListener("scroll", requestScrollUpdate);
    };
  }, []);

  const layout = useMemo(
    () => buildLayout(items, containerWidth, gridColumns, gridLayout),
    [containerWidth, gridColumns, gridLayout, items],
  );
  const visible = useMemo(
    () => findVisiblePositions(layout, viewport.top, viewport.height),
    [layout, viewport.height, viewport.top],
  );

  if (!items.length) {
    return (
      <div className="grid-wrap" ref={scrollRef} onPointerDown={onStartWindowDrag}>
        <button className="quiet-empty" type="button" onClick={onAddFolder}>
          <Grid2X2 size={17} aria-hidden="true" />
          <span>{isLoading ? "Scanning" : hasFolders ? "No images found" : "Add a folder"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid-wrap" ref={scrollRef} onPointerDown={onStartWindowDrag}>
      <div className="mood-grid" style={{ height: layout.height }}>
        {visible.map((position) => (
          <MediaTile
            key={position.item.id}
            item={position.item}
            index={position.index}
            isActive={position.item.id === selectedItem?.id}
            style={{
              width: position.width,
              height: position.height,
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            }}
            onActivate={activateTile}
            onContextMenu={openTileMenu}
            onMeasure={queueMeasurement}
          />
        ))}
      </div>
    </div>
  );
}

export function buildLayout(
  items: MediaItem[],
  availableWidth: number,
  targetColumns: number,
  layout: GridLayout,
): MasonryLayout {
  const gutter = availableWidth >= 980 ? 10 : 8;
  const columnCount = Math.max(1, Math.min(targetColumns, Math.floor((availableWidth + gutter) / (72 + gutter))));
  const columnWidth = Math.max(42, Math.floor((availableWidth - gutter * (columnCount - 1)) / columnCount));
  const positions = layout === "aligned"
    ? buildAlignedRows(items, columnCount, columnWidth, gutter)
    : buildPackedColumns(items, columnCount, columnWidth, gutter);

  let height = 0;
  let maxItemHeight = 0;
  for (const position of positions) {
    height = Math.max(height, position.y + position.height);
    maxItemHeight = Math.max(maxItemHeight, position.height);
  }

  return {
    height,
    maxItemHeight,
    positions,
  };
}

export function findVisiblePositions(layout: MasonryLayout, scrollTop: number, viewportHeight: number) {
  const overscan = viewportHeight * 2;
  const minY = Math.max(0, scrollTop - overscan);
  const maxY = scrollTop + viewportHeight + overscan;
  // Position y values are monotonic for both supported layout algorithms. The
  // max-height allowance keeps a tall image whose top is above minY visible.
  const start = lowerBoundY(layout.positions, Math.max(0, minY - layout.maxItemHeight));
  const end = upperBoundY(layout.positions, maxY);
  return layout.positions
    .slice(start, end)
    .filter((position) => position.y + position.height >= minY);
}

function lowerBoundY(positions: MasonryPosition[], target: number) {
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (positions[middle].y < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBoundY(positions: MasonryPosition[], target: number) {
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (positions[middle].y <= target) low = middle + 1;
    else high = middle;
  }
  return low;
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

function readNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function readContentWidth(element: HTMLElement) {
  const styles = window.getComputedStyle(element);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  return Math.max(0, element.clientWidth - paddingLeft - paddingRight);
}
