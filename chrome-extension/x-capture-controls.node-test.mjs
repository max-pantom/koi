import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function controls() {
  const source = await readFile(new URL("./x-capture-controls.js", import.meta.url), "utf8");
  const context = vm.createContext({
    URL,
    chrome: { runtime: { getManifest: () => ({ version: "0.3.0" }) } },
  });
  vm.runInContext(source, context);
  return context.KoiXCaptureControls;
}

test("finds and cleans an X post URL from article links", async () => {
  const { statusUrlFromHrefs } = await controls();
  assert.equal(statusUrlFromHrefs([
    "/someone",
    "/someone/status/123456?ref_src=timeline",
  ], "https://x.com/home"), "https://x.com/someone/status/123456");
});

test("rejects status-looking links from another host", async () => {
  const { statusUrlFromHrefs } = await controls();
  assert.equal(statusUrlFromHrefs(["https://example.com/someone/status/123"], "https://x.com"), "");
});
