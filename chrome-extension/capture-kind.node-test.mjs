import assert from "node:assert/strict";
import test from "node:test";
import { classifyPageCapture, isInstagramPage } from "./capture-kind.js";

test("never classifies an Instagram carousel as an article", () => {
  assert.equal(classifyPageCapture({
    pageUrl: "https://www.instagram.com/p/example/",
    articleMarkdown: "post copy ".repeat(200),
    articleImage: "https://scontent.cdninstagram.com/carousel.jpg",
  }), "link");
  assert.equal(isInstagramPage("https://instagram.com/reel/example"), true);
});

test("classifies X Articles by their route and article header", () => {
  assert.equal(classifyPageCapture({
    pageUrl: "https://x.com/i/article/123456",
    articleMarkdown: "A short X Article",
    articleImage: "https://pbs.twimg.com/media/header.jpg",
  }), "article");
});

test("keeps ordinary X posts as saved links", () => {
  assert.equal(classifyPageCapture({
    pageUrl: "https://x.com/example/status/123456",
    articleMarkdown: "A post with an article element in the X DOM.",
    articleImage: "https://pbs.twimg.com/media/post.jpg",
  }), "link");
});

test("classifies a semantic article even without perfect metadata", () => {
  assert.equal(classifyPageCapture({
    pageUrl: "https://example.com/field-guide",
    articleTitle: "A field guide",
    articleMarkdown: "Useful reporting ".repeat(30),
    articleParagraphCount: 6,
    hasArticleContainer: true,
  }), "article");
});
