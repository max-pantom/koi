import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("page scripts can be injected repeatedly without duplicate declarations or listeners", async () => {
  const imageCandidatesSource = await readFile(new URL("./image-candidates.js", import.meta.url), "utf8");
  const contentScriptSource = await readFile(new URL("./content-script.js", import.meta.url), "utf8");
  const listeners = [];
  const context = vm.createContext({
    URL,
    chrome: {
      runtime: {
        getManifest: () => ({ version: "0.2.5" }),
        onMessage: { addListener: (listener) => listeners.push(listener) },
      },
    },
  });

  vm.runInContext(imageCandidatesSource, context);
  vm.runInContext(contentScriptSource, context);
  vm.runInContext(imageCandidatesSource, context);
  vm.runInContext(contentScriptSource, context);

  assert.equal(context.KoiImageCandidatesVersion, "0.2.5");
  assert.equal(context.KoiContentScriptVersion, "0.2.5");
  assert.equal(listeners.length, 1);
});
