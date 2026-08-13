import assert from "node:assert/strict";
import test from "node:test";
import { getKoiFolders, KOI_BRIDGE_URL, routeCaptureToKoi } from "./koi-bridge.js";

test("reads folder choices without exposing path data", async () => {
  const folders = await getKoiFolders(async (url, options) => {
    assert.equal(url, `${KOI_BRIDGE_URL}/folders`);
    assert.equal(options.method, "GET");
    assert.equal(options.headers["X-Koi-Client"], "chrome-extension");
    return {
      ok: true,
      async json() {
        return { folders: [{ id: "folder-1", name: "References", isCaptureInbox: false }] };
      },
    };
  });

  assert.deepEqual(folders, [{ id: "folder-1", name: "References", isCaptureInbox: false }]);
  assert.equal("path" in folders[0], false);
});

test("routes a completed image and its manifest metadata", async () => {
  const metadata = { imageFilename: "capture.jpg", sourceUrl: "https://example.com/capture.jpg" };
  const result = await routeCaptureToKoi({
    destinationFolderId: "folder-1",
    imageFilename: "capture.jpg",
    metadata,
    fetchImpl: async (url, options) => {
      assert.equal(url, `${KOI_BRIDGE_URL}/captures/route`);
      assert.equal(options.method, "POST");
      assert.equal(options.headers["X-Koi-Client"], "chrome-extension");
      assert.deepEqual(JSON.parse(options.body), {
        destinationFolderId: "folder-1",
        imageFilename: "capture.jpg",
        metadata,
      });
      return {
        ok: true,
        async json() { return { routed: true, folderName: "References", isCaptureInbox: false }; },
      };
    },
  });

  assert.deepEqual(result, { routed: true, folderName: "References", isCaptureInbox: false });
});

test("stores inbox metadata without selecting a destination folder", async () => {
  const metadata = { imageFilename: "capture.jpg", sourceUrl: "https://example.com/capture.jpg" };
  const result = await routeCaptureToKoi({
    destinationFolderId: "",
    imageFilename: "capture.jpg",
    metadata,
    fetchImpl: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), {
        destinationFolderId: "",
        imageFilename: "capture.jpg",
        metadata,
      });
      return {
        ok: true,
        async json() { return { routed: true, folderName: "Koi Captures", isCaptureInbox: true }; },
      };
    },
  });

  assert.equal(result.isCaptureInbox, true);
});

test("surfaces a desktop routing failure", async () => {
  await assert.rejects(() => routeCaptureToKoi({
    destinationFolderId: "missing",
    imageFilename: "capture.jpg",
    metadata: { imageFilename: "capture.jpg" },
    fetchImpl: async () => ({
      ok: false,
      async json() { return { error: "That destination folder is no longer in Koi." }; },
    }),
  }), /no longer in Koi/);
});
