import { describe, expect, it } from "vitest";
import { parseSearchQuery, searchMedia } from "../src/lib/search";
import type { MediaItem } from "../src/lib/types";

const folders = new Map([
  ["inspiration", "Brand inspiration"],
  ["archive", "Archive"],
]);

function item(id: string, overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id,
    folderId: "inspiration",
    path: `/images/${id}.jpg`,
    name: `${id}.jpg`,
    extension: "jpg",
    kind: "image",
    tags: [],
    dominantColors: [],
    colorNames: [],
    missing: false,
    ...overrides,
  };
}

describe("searchMedia", () => {
  it("normalises accents and ranks a filename match first", () => {
    const exact = item("cafe-poster", { name: "Café poster.jpg" });
    const tagged = item("reference", { tags: ["cafe", "poster"] });

    expect(searchMedia([tagged, exact], "cafe poster", folders)).toEqual([exact, tagged]);
  });

  it("ranks items matching every token above single-token matches", () => {
    const full = item("landing", { tags: ["editorial"], sourceSiteName: "Are.na" });
    const partial = item("landing-2", { tags: ["editorial"], sourceSiteName: "Dribbble" });

    expect(searchMedia([partial, full], "editorial arena", folders)).toEqual([full, partial]);
  });

  it("supports quoted fields and exclusions", () => {
    const kept = item("warm", { tags: ["deep blue"], captureType: "link", sourceSiteName: "Example" });
    const excluded = item("cold", { tags: ["deep blue", "draft"], captureType: "link", sourceSiteName: "Example" });

    expect(searchMedia([excluded, kept], 'tag:"deep blue" type:link -tag:draft', folders)).toEqual([kept]);
  });

  it("matches colors without needing a special mode", () => {
    const blue = item("ocean", { colorNames: ["blue"], dominantColors: ["#204080"] });

    expect(searchMedia([blue], "blue", folders)).toEqual([blue]);
    expect(searchMedia([blue], "-color:blue", folders)).toEqual([]);
  });

  it("tolerates a one-character typo for words of four or more characters", () => {
    const poster = item("typography-poster");
    expect(searchMedia([poster], "typograpy", folders)).toEqual([poster]);
  });

  it("treats an adjacent transposition as a single edit", () => {
    const sorted = item("sort-palette");
    expect(searchMedia([sorted], "srot", folders)).toEqual([sorted]);
    expect(searchMedia([item("unrelated-file")], "srot", folders)).toEqual([]);
  });
});

describe("parseSearchQuery", () => {
  it("parses field aliases, quotes, and negative terms", () => {
    expect(parseSearchQuery('source:"Example Studio" -colour:red')).toEqual([
      { value: "example studio", exclude: false, field: "site" },
      { value: "red", exclude: true, field: "color" },
    ]);
  });
});
