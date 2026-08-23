import assert from "node:assert/strict";
import test from "node:test";
import { buildContextCapture } from "./context-capture.js";

test("builds an image capture without losing its page or enclosing link", () => {
  const capture = buildContextCapture({
    menuItemId: "koi-save-image",
    srcUrl: "https://cdn.example.com/chair.webp",
    pageUrl: "https://example.com/gallery?slide=2",
    linkUrl: "https://example.com/products/chair",
  }, {
    id: 14,
    title: "Furniture gallery",
    url: "https://example.com/gallery?slide=2",
  });

  assert.equal(capture.imageUrl, "https://cdn.example.com/chair.webp");
  assert.equal(capture.page.pageUrl, "https://example.com/gallery?slide=2");
  assert.equal(capture.sourceLinkUrl, "https://example.com/products/chair");
  assert.equal(capture.page.siteName, "example.com");
});

test("builds a linked-page capture with the clicked destination intact", () => {
  const capture = buildContextCapture({
    menuItemId: "koi-save-page",
    pageUrl: "https://example.com/index",
    linkUrl: "https://notes.example.net/article",
  }, { id: 9, title: "Index" });

  assert.equal(capture.page.pageUrl, "https://notes.example.net/article");
  assert.equal(capture.sourceLinkUrl, "https://notes.example.net/article");
  assert.equal(capture.page.siteName, "notes.example.net");
});

test("builds a video capture with the direct media URL", () => {
  const capture = buildContextCapture({
    menuItemId: "koi-quick-save-video",
    srcUrl: "https://video.example/demo.mp4",
    pageUrl: "https://example.com/watch",
  }, { id: 18, title: "Demo reel" });

  assert.equal(capture.type, "KOI_CAPTURE_VIDEO");
  assert.equal(capture.videoUrl, "https://video.example/demo.mp4");
  assert.equal(capture.promptForDestination, false);
});

test("ignores unrelated context-menu events", () => {
  assert.equal(buildContextCapture({ menuItemId: "something-else" }, {}), undefined);
});

test("quick-save context actions bypass the destination prompt", () => {
  const capture = buildContextCapture({
    menuItemId: "koi-quick-save-image",
    srcUrl: "https://cdn.example.com/chair.webp",
    pageUrl: "https://example.com/gallery",
  }, { id: 14, title: "Furniture gallery" });

  assert.equal(capture.promptForDestination, false);
});

test("save-to context actions always ask for a destination", () => {
  const capture = buildContextCapture({
    menuItemId: "koi-save-page-to",
    pageUrl: "https://example.com/gallery",
  }, { id: 14, title: "Furniture gallery" });

  assert.equal(capture.promptForDestination, true);
});

test("unified context actions choose the clicked media type without duplicate menu entries", () => {
  const image = buildContextCapture({
    menuItemId: "koi-quick-save",
    mediaType: "image",
    srcUrl: "https://cdn.example.com/post.jpg",
    pageUrl: "https://x.com/koi/status/123",
  }, { id: 22, title: "Post" });
  const link = buildContextCapture({
    menuItemId: "koi-save-to",
    pageUrl: "https://x.com/home",
    linkUrl: "https://x.com/koi/status/123",
  }, { id: 22, title: "Post" });

  assert.equal(image.type, "KOI_CAPTURE_IMAGE");
  assert.equal(image.promptForDestination, false);
  assert.equal(link.type, "KOI_CAPTURE_PAGE");
  assert.equal(link.page.pageUrl, "https://x.com/koi/status/123");
  assert.equal(link.promptForDestination, true);
});
