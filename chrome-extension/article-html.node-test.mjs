import assert from "node:assert/strict";
import test from "node:test";
import { articleMetadataFromHtml } from "./article-html.js";

test("recovers article signals and readable content from remote HTML", () => {
  const metadata = articleMetadataFromHtml(`
    <meta property="og:type" content="article">
    <article><h1>A field guide</h1><p>First useful paragraph.</p><p>Second useful paragraph.</p></article>
  `);
  assert.equal(metadata.hasArticleSchema, true);
  assert.equal(metadata.articleTitle, "A field guide");
  assert.equal(metadata.articleParagraphCount, 2);
  assert.match(metadata.articleMarkdown, /First useful paragraph/);
});
