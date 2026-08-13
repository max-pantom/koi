import assert from "node:assert/strict";
import test from "node:test";
import { removeCaptureFromManifest, upsertCaptureManifest } from "./capture-manifest.js";

test("keeps one manifest keyed by image filename", () => {
  const first = upsertCaptureManifest(undefined, { imageFilename: "one.jpg", sourceUrl: "https://one" });
  const second = upsertCaptureManifest(first, { imageFilename: "two.png", sourceUrl: "https://two" });
  assert.equal(second.schemaVersion, 1);
  assert.deepEqual(Object.keys(second.captures), ["one.jpg", "two.png"]);
  assert.equal(second.captures["two.png"].sourceUrl, "https://two");
});

test("removes a routed capture without losing inbox records", () => {
  const manifest = {
    schemaVersion: 1,
    captures: { "one.jpg": { imageFilename: "one.jpg" }, "two.jpg": { imageFilename: "two.jpg" } },
  };
  assert.deepEqual(Object.keys(removeCaptureFromManifest(manifest, "one.jpg").captures), ["two.jpg"]);
});
