import assert from "node:assert/strict";
import test from "node:test";

test("service worker starts and registers its Chrome listeners", async () => {
  const registered = [];
  const listener = (name) => ({ addListener(callback) { registered.push([name, callback]); } });
  globalThis.chrome = {
    runtime: { onInstalled: listener("installed"), onMessage: listener("message"), getURL: (path) => path },
    contextMenus: { onClicked: listener("context"), removeAll(callback) { callback(); }, create() {} },
    storage: { local: { get: async () => ({}), set: async () => undefined } },
    windows: { create: async () => undefined },
    downloads: { onChanged: listener("download"), search: async () => [] },
    tabs: { sendMessage: async () => ({ images: [] }) },
  };

  await import(`./service-worker.js?smoke=${Date.now()}`);

  assert.deepEqual(registered.map(([name]) => name), ["installed", "context", "message"]);
  assert.equal(registered.every(([, callback]) => typeof callback === "function"), true);
  delete globalThis.chrome;
});
