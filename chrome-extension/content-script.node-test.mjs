import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("page scripts can be injected repeatedly without duplicate declarations or listeners", async () => {
  const imageCandidatesSource = await readFile(new URL("./image-candidates.js", import.meta.url), "utf8");
  const articleContentSource = await readFile(new URL("./article-content.js", import.meta.url), "utf8");
  const videoCandidatesSource = await readFile(new URL("./video-candidates.js", import.meta.url), "utf8");
  const socialPlatformsSource = await readFile(new URL("./social-platforms.js", import.meta.url), "utf8");
  const xCaptureControlsSource = await readFile(new URL("./x-capture-controls.js", import.meta.url), "utf8");
  const contentScriptSource = await readFile(new URL("./content-script.js", import.meta.url), "utf8");
  const listeners = [];
  const context = vm.createContext({
    URL,
    location: { hostname: "example.com" },
    chrome: {
      runtime: {
        getManifest: () => ({ version: "0.2.5" }),
        onMessage: { addListener: (listener) => listeners.push(listener) },
      },
    },
  });

  vm.runInContext(imageCandidatesSource, context);
  vm.runInContext(articleContentSource, context);
  vm.runInContext(videoCandidatesSource, context);
  vm.runInContext(socialPlatformsSource, context);
  vm.runInContext(xCaptureControlsSource, context);
  vm.runInContext(contentScriptSource, context);
  vm.runInContext(imageCandidatesSource, context);
  vm.runInContext(articleContentSource, context);
  vm.runInContext(videoCandidatesSource, context);
  vm.runInContext(socialPlatformsSource, context);
  vm.runInContext(xCaptureControlsSource, context);
  vm.runInContext(contentScriptSource, context);

  assert.equal(context.KoiImageCandidatesVersion, "0.2.5");
  assert.equal(context.KoiArticleContentVersion, "0.2.5");
  assert.equal(context.KoiVideoCandidatesVersion, "0.2.5");
  assert.equal(context.KoiSocialPlatformsVersion, "0.2.5");
  assert.equal(context.KoiXCaptureControlsVersion, "0.2.5");
  assert.equal(context.KoiContentScriptVersion, "0.2.5");
  assert.equal(listeners.length, 1);
});
