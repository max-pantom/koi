export function articleMetadataFromHtml(html) {
  const hasArticleSchema = /<meta[^>]+(?:property|name)=["']og:type["'][^>]+content=["']article["']/i.test(html)
    || /<meta[^>]+content=["']article["'][^>]+(?:property|name)=["']og:type["']/i.test(html)
    || /"@type"\s*:\s*"(?:Article|NewsArticle|BlogPosting)"/i.test(html);
  const parts = [];
  for (const match of html.matchAll(/<(h1|h2|h3|p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = decodeHtml(stripTags(match[2])).replace(/\s+/g, " ").trim();
    if (text.length < 2) continue;
    parts.push({ tag: match[1].toLowerCase(), text });
  }
  const articleMarkdown = markdownFromParts(parts).slice(0, 45_000);
  return {
    hasArticleSchema,
    hasArticleContainer: /<article\b|itemprop=["']articleBody["']/i.test(html),
    articleTitle: parts.find((part) => part.tag === "h1")?.text || "",
    articleParagraphCount: parts.filter((part) => part.tag === "p").length,
    articleMarkdown,
  };
}

function markdownFromParts(parts) {
  const lines = [];
  let previous = "";
  for (const part of parts) {
    if (part.text === previous) continue;
    previous = part.text;
    if (part.tag === "h1") lines.push(`# ${part.text}`);
    else if (part.tag === "h2") lines.push(`## ${part.text}`);
    else if (part.tag === "h3") lines.push(`### ${part.text}`);
    else if (part.tag === "li") lines.push(`- ${part.text}`);
    else if (part.tag === "blockquote") lines.push(`> ${part.text}`);
    else lines.push(part.text);
  }
  return lines.join("\n\n");
}

function stripTags(value) {
  return value.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
