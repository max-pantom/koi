(() => {
const SCRIPT_VERSION = chrome.runtime.getManifest().version;
if (globalThis.KoiArticleContentVersion === SCRIPT_VERSION) return;

function extractArticleMarkdown(root = document) {
  const schemaBody = articleBodyFromSchema(root);
  if (schemaBody.length >= 120) return schemaBody.slice(0, 45_000);
  const container = bestArticleContainer(root);
  if (!container) return "";
  const parts = Array.from(container.querySelectorAll("h1, h2, h3, p, li, blockquote, pre"))
    .filter((element) => !element.closest("nav, footer, aside, form, [aria-hidden='true']"))
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim(),
    }));
  return markdownFromParts(parts).slice(0, 45_000);
}

function articleBodyFromSchema(root = document) {
  for (const script of root.querySelectorAll?.('script[type="application/ld+json"]') || []) {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed?.["@graph"] || [])];
      const article = nodes.find((node) => node && typeof node === "object" && typeof node.articleBody === "string");
      if (article?.articleBody) return article.articleBody.replace(/\s+/g, " ").trim();
    } catch {
      // Invalid structured data should not stop DOM extraction.
    }
  }
  return "";
}

function bestArticleContainer(root = document) {
  const candidates = Array.from(root.querySelectorAll?.(
    "[itemprop='articleBody'], article, [role='article'], main, [role='main']",
  ) || []);
  if (root.body) candidates.push(root.body);
  return candidates
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .map((candidate) => ({ candidate, score: articleContainerScore(candidate, root.body) }))
    .sort((left, right) => right.score - left.score)[0]?.candidate || null;
}

function articleContainerScore(container, body) {
  const textLength = (container.innerText || container.textContent || "").replace(/\s+/g, " ").trim().length;
  const paragraphs = container.querySelectorAll?.("p")?.length || 0;
  const headings = container.querySelectorAll?.("h1, h2")?.length || 0;
  const semanticBonus = container.matches?.("article, [itemprop='articleBody']") ? 900 : 0;
  const bodyPenalty = container === body ? 900 : 0;
  return Math.min(textLength, 30_000) + Math.min(paragraphs, 30) * 45 + Math.min(headings, 6) * 80 + semanticBonus - bodyPenalty;
}

function markdownFromParts(parts) {
  const lines = [];
  let previous = "";
  for (const part of parts) {
    const text = String(part.text || "").trim();
    if (text.length < 2 || text === previous) continue;
    previous = text;
    if (part.tag === "h1") lines.push(`# ${text}`);
    else if (part.tag === "h2") lines.push(`## ${text}`);
    else if (part.tag === "h3") lines.push(`### ${text}`);
    else if (part.tag === "li") lines.push(`- ${text}`);
    else if (part.tag === "blockquote") lines.push(`> ${text}`);
    else if (part.tag === "pre") lines.push(`\`\`\`\n${text}\n\`\`\``);
    else lines.push(text);
  }
  return lines.join("\n\n");
}

globalThis.KoiArticleContent = { articleBodyFromSchema, bestArticleContainer, extractArticleMarkdown, markdownFromParts };
globalThis.KoiArticleContentVersion = SCRIPT_VERSION;
})();
