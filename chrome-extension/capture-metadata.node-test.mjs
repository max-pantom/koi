import assert from "node:assert/strict";
import test from "node:test";
import { buildCaptureMetadata } from "./capture-metadata.js";

test("keeps image, final, page, canonical, and enclosing-link URLs distinct", () => {
  const metadata = buildCaptureMetadata({
    captureType: "image",
    imageUrl: "https://cdn.example/raw/image?id=8",
    finalUrl: "https://images.example/final/image.webp",
    sourceLinkUrl: "https://shop.example/products/chair",
    page: {
      pageUrl: "https://example.com/gallery?slide=4",
      canonicalUrl: "https://example.com/gallery",
      title: "Design gallery",
      siteName: "Example",
      description: "A room full of design references.",
      byline: "Mara Example",
      articleMarkdown: "# Design gallery\n\nA room full of design references.",
    },
    title: "Oak chair",
    capturedAt: "2026-08-12T12:00:00.000Z",
    imageFilename: "capture.webp",
    destinationFolderId: "references",
  });

  assert.equal(metadata.schemaVersion, 2);
  assert.equal(metadata.sourceUrl, "https://cdn.example/raw/image?id=8");
  assert.equal(metadata.sourceFinalUrl, "https://images.example/final/image.webp");
  assert.equal(metadata.sourcePageUrl, "https://example.com/gallery?slide=4");
  assert.equal(metadata.sourceCanonicalUrl, "https://example.com/gallery");
  assert.equal(metadata.sourceLinkUrl, "https://shop.example/products/chair");
  assert.equal(metadata.sourceTitle, "Oak chair");
  assert.equal(metadata.sourcePageTitle, "Design gallery");
  assert.equal(metadata.sourceDescription, "A room full of design references.");
  assert.equal(metadata.sourceByline, "Mara Example");
  assert.match(metadata.sourceContentMarkdown, /Design gallery/);
});
