import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("turns article blocks into compact markdown", async () => {
  const source = await readFile(new URL("./article-content.js", import.meta.url), "utf8");
  const context = vm.createContext({
    chrome: { runtime: { getManifest: () => ({ version: "0.2.6" }) } },
  });
  vm.runInContext(source, context);

  const markdown = context.KoiArticleContent.markdownFromParts([
    { tag: "h1", text: "A field guide" },
    { tag: "p", text: "Read this first." },
    { tag: "p", text: "Read this first." },
    { tag: "li", text: "Keep the useful parts" },
    { tag: "blockquote", text: "Good tools disappear." },
  ]);

  assert.equal(markdown, "# A field guide\n\nRead this first.\n\n- Keep the useful parts\n\n> Good tools disappear.");
});

test("scores a semantic article above a noisy page body", async () => {
  const source = await readFile(new URL("./article-content.js", import.meta.url), "utf8");
  const context = vm.createContext({
    chrome: { runtime: { getManifest: () => ({ version: "0.3.0" }) } },
  });
  vm.runInContext(source, context);
  const article = fakeContainer({ textLength: 900, paragraphs: 7, headings: 1, semantic: true });
  const body = fakeContainer({ textLength: 1300, paragraphs: 2, headings: 0 });
  const root = { body, querySelectorAll: () => [article] };
  assert.equal(context.KoiArticleContent.bestArticleContainer(root), article);
});

function fakeContainer({ textLength, paragraphs, headings, semantic = false }) {
  return {
    innerText: "x".repeat(textLength),
    matches: () => semantic,
    querySelectorAll: (selector) => selector === "p"
      ? Array.from({ length: paragraphs })
      : Array.from({ length: headings }),
  };
}
