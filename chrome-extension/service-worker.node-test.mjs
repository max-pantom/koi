import assert from "node:assert/strict";
import test from "node:test";

test("service worker starts and registers its Chrome listeners", async () => {
  const registered = [];
  const menuItems = [];
  const listener = (name) => ({ addListener(callback) { registered.push([name, callback]); } });
  globalThis.chrome = {
    runtime: { onInstalled: listener("installed"), onMessage: listener("message"), getURL: (path) => path },
    contextMenus: { onClicked: listener("context"), removeAll(callback) { callback(); }, create(item) { menuItems.push(item); } },
    storage: { local: { get: async () => ({}), set: async () => undefined } },
    windows: { create: async () => undefined },
    downloads: { onChanged: listener("download"), search: async () => [] },
    tabs: { sendMessage: async () => ({ images: [] }) },
  };

  await import(`./service-worker.js?smoke=${Date.now()}`);

  assert.deepEqual(registered.map(([name]) => name), ["installed", "context", "message"]);
  assert.equal(registered.every(([, callback]) => typeof callback === "function"), true);
  registered.find(([name]) => name === "installed")[1]();
  assert.deepEqual(menuItems.map(({ id, title }) => [id, title]), [
    ["koi-save", "Save to Koi"],
    ["koi-quick-save-image", "Quick save"],
    ["koi-save-image-to", "Choose folder…"],
    ["koi-quick-save-page", "Quick save"],
    ["koi-save-page-to", "Choose folder…"],
  ]);
  delete globalThis.chrome;
});

test("service worker independently upgrades X thumbnails from old tabs", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./service-worker.js", import.meta.url), "utf8"));
  assert.match(source, /platformOriginalUrl\(isDownloadableUrl\(resolved\?\.imageUrl\)/);
  assert.match(source, /url\.searchParams\.set\("name", "orig"\)/);
});
