import assert from "node:assert/strict";
import test from "node:test";
import "./image-candidates.js";

const { bestImageUrl, parseSrcset } = globalThis.KoiImageCandidates;

test("chooses the largest srcset candidate instead of the rendered currentSrc", () => {
  const image = fakeImage({
    currentSrc: "https://images.example/photo-640.jpg",
    src: "https://images.example/photo-640.jpg",
    attributes: { srcset: "/photo-640.jpg 640w, /photo-2400.jpg 2400w" },
  });
  assert.equal(bestImageUrl(image, "https://images.example/gallery"), "https://images.example/photo-2400.jpg");
});

test("prefers an explicit original image attribute", () => {
  const image = fakeImage({
    currentSrc: "https://images.example/photo-640.jpg",
    attributes: { "data-original": "/original/photo.tiff", srcset: "/photo-2000.jpg 2000w" },
  });
  assert.equal(bestImageUrl(image, "https://images.example/gallery"), "https://images.example/original/photo.tiff");
});

test("parses density descriptors as quality candidates", () => {
  assert.deepEqual(parseSrcset("one.jpg 1x, two.jpg 2x", "https://example.com/"), [
    { url: "https://example.com/one.jpg", quality: 1000 },
    { url: "https://example.com/two.jpg", quality: 2000 },
  ]);
});

function fakeImage({ currentSrc = "", src = "", attributes = {} }) {
  return {
    currentSrc,
    src,
    naturalWidth: 640,
    naturalHeight: 480,
    getAttribute(name) { return attributes[name] || ""; },
    closest() { return null; },
  };
}
