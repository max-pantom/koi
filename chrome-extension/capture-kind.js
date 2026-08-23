export function classifyPageCapture(page) {
  const host = hostname(page.pageUrl);
  const path = pathname(page.pageUrl);
  const markdownLength = page.articleMarkdown?.trim().length || 0;
  if (isInstagramHost(host)) return "link";
  if (isXHost(host)) {
    return /\/i\/article\/|\/article\//i.test(path)
      || (markdownLength >= 600 && !!page.articleImage)
      || (page.hasArticleSchema && markdownLength >= 120)
      ? "article"
      : "link";
  }
  const structuredArticle = page.hasArticleSchema && (markdownLength >= 120 || !!page.articleTitle);
  const semanticArticle = page.hasArticleContainer && !!page.articleTitle && markdownLength >= 240;
  const longFormArticle = markdownLength >= 700 && (page.articleParagraphCount || 0) >= 3;
  return structuredArticle || semanticArticle || longFormArticle ? "article" : "link";
}

export function isInstagramPage(value) {
  return isInstagramHost(hostname(value));
}

function isInstagramHost(host) {
  return host === "instagram.com" || host.endsWith(".instagram.com");
}

function isXHost(host) {
  return host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");
}

function hostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function pathname(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}
