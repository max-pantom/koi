import assert from "node:assert/strict";
import test from "node:test";
import { downloadImageWithFallback, downloadTextFile, waitForDownload } from "./downloads.js";

function createDownloads(outcomes) {
  let nextId = 1;
  const listeners = new Set();
  const items = new Map();
  const calls = [];

  return {
    calls,
    onChanged: {
      addListener(listener) { listeners.add(listener); },
      removeListener(listener) { listeners.delete(listener); },
    },
    async download(options) {
      const id = nextId++;
      const outcome = outcomes.shift() || { state: "complete" };
      calls.push(options);
      items.set(id, { id, state: "in_progress" });
      if (outcome.state !== "pending") {
        setTimeout(() => {
          items.set(id, { id, state: outcome.error ? "interrupted" : outcome.state, error: outcome.error });
          const delta = outcome.error
            ? { id, state: { current: "interrupted" }, error: { current: outcome.error } }
            : { id, state: { current: outcome.state } };
          for (const listener of listeners) listener(delta);
        }, 0);
      }
      return id;
    },
    async search({ id }) {
      return items.has(id) ? [items.get(id)] : [];
    },
  };
}

test("waits until a direct image download completes", async () => {
  const downloads = createDownloads([{ state: "complete" }]);
  const result = await downloadImageWithFallback({
    downloads,
    fetchImpl: () => assert.fail("fallback fetch should not run"),
    url: "https://images.example/reference.png",
    filename: "Koi Captures/reference.png",
    timeoutMs: 100,
  });

  assert.deepEqual(result, { id: 1, usedFallback: false });
  assert.equal(downloads.calls.length, 1);
  assert.equal(downloads.calls[0].url, "https://images.example/reference.png");
});

test("retries an interrupted CDN download through an image data URL", async () => {
  const downloads = createDownloads([
    { error: "SERVER_UNAUTHORIZED" },
    { state: "complete" },
  ]);
  const result = await downloadImageWithFallback({
    downloads,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer,
    }),
    url: "https://protected.example/reference",
    filename: "Koi Captures/reference.png",
    timeoutMs: 100,
  });

  assert.deepEqual(result, { id: 2, usedFallback: true });
  assert.equal(downloads.calls.length, 2);
  assert.match(downloads.calls[1].url, /^data:image\/png;base64,/);
});

test("waits for the consolidated capture manifest too", async () => {
  const downloads = createDownloads([{ state: "complete" }]);
  const id = await downloadTextFile({
    downloads,
    text: "{\"sourceUrl\":\"https://example.com/image.jpg\"}\n",
    filename: "Koi Captures/koi-manifest.json",
    timeoutMs: 100,
  });

  assert.equal(id, 1);
  assert.match(downloads.calls[0].url, /^data:application\/json/);
});

test("reports a download that never finishes", async () => {
  const downloads = createDownloads([{ state: "pending" }]);
  await assert.rejects(() => waitForDownload(downloads, 7, 10), /did not finish/);
});
