import { describe, expect, it } from "vitest";
import { buildLayout, findVisiblePositions } from "../src/components/MediaGrid";
import type { MediaItem } from "../src/lib/types";

function item(index: number): MediaItem {
  return {
    id: String(index),
    folderId: "library",
    path: `/images/${index}.jpg`,
    name: `${index}.jpg`,
    extension: "jpg",
    kind: "image",
    width: 600 + (index % 7) * 80,
    height: 400 + (index % 11) * 90,
    tags: [],
    dominantColors: [],
    colorNames: [],
    missing: false,
  };
}

describe("virtual masonry layout", () => {
  it.each(["packed", "aligned"] as const)("returns exactly the visible overscan window for %s rows", (mode) => {
    const layout = buildLayout(Array.from({ length: 10_000 }, (_, index) => item(index)), 1_200, 8, mode);
    const scrollTop = 18_000;
    const viewportHeight = 800;
    const minY = scrollTop - viewportHeight * 2;
    const maxY = scrollTop + viewportHeight * 3;

    const visible = findVisiblePositions(layout, scrollTop, viewportHeight);
    const expected = layout.positions.filter(
      (position) => position.y + position.height >= minY && position.y <= maxY,
    );

    expect(visible.map((position) => position.item.id)).toEqual(expected.map((position) => position.item.id));
    expect(visible.length).toBeLessThan(500);
  });
});
