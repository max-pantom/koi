import { describe, expect, it } from "vitest";
import { isGeneratedLinkPlaceholder, sourceHostname } from "../src/lib/media";
import type { MediaItem } from "../src/lib/types";

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "saved-page",
    folderId: "library",
    path: "/captures/page.png",
    name: "page.png",
    extension: "png",
    kind: "image",
    tags: [],
    dominantColors: [],
    colorNames: [],
    missing: false,
    ...overrides,
  };
}

describe("saved page presentation", () => {
  it("recognises pasted-link covers from current and existing libraries", () => {
    expect(isGeneratedLinkPlaceholder(item({
      captureType: "link",
      name: "clipboard-link-1787425530785.png",
    }))).toBe(true);
    expect(isGeneratedLinkPlaceholder(item({ captureType: "image", name: "clipboard-link-1.png" }))).toBe(false);
    expect(isGeneratedLinkPlaceholder(item({ captureType: "link", name: "real-preview.png" }))).toBe(false);
  });

  it("uses the best saved source and strips www from its host", () => {
    expect(sourceHostname(item({
      sourceLinkUrl: "https://www.example.com/post/1",
      sourcePageUrl: "https://ignored.test",
    }))).toBe("example.com");
  });
});
