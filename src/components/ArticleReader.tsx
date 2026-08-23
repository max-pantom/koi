import type { MediaItem } from "../lib/types";

export function ArticleReader({ item }: { item: MediaItem }) {
  const blocks = parseMarkdown(item.sourceContentMarkdown || item.sourceDescription || "");
  return (
    <article className="article-reader">
      <header>
        {item.sourceSiteName && <p className="article-site">{item.sourceSiteName}</p>}
        <h1>{item.sourceTitle || item.sourcePageTitle || "Saved article"}</h1>
        {(item.sourceByline || item.sourceDescription) && (
          <div className="article-deck">
            {item.sourceByline && <p>By {item.sourceByline}</p>}
            {item.sourceDescription && <p>{item.sourceDescription}</p>}
          </div>
        )}
      </header>
      <div className="article-body">
        {blocks.map((block, index) => {
          if (block.kind === "heading") {
            const Heading = block.level === 2 ? "h2" : "h3";
            return <Heading key={index}>{block.text}</Heading>;
          }
          if (block.kind === "quote") return <blockquote key={index}>{block.text}</blockquote>;
          if (block.kind === "list") return <ul key={index}>{block.items.map((text) => <li key={text}>{text}</li>)}</ul>;
          if (block.kind === "code") return <pre key={index}><code>{block.text}</code></pre>;
          return <p key={index}>{block.text}</p>;
        })}
      </div>
    </article>
  );
}

type MarkdownBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "quote" | "code" | "paragraph"; text: string }
  | { kind: "list"; items: string[] };

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const chunks = markdown.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean);
  const blocks: MarkdownBlock[] = [];
  for (const chunk of chunks) {
    if (/^```/.test(chunk)) {
      blocks.push({ kind: "code", text: chunk.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "") });
    } else if (/^#{1,3}\s/.test(chunk)) {
      const level = chunk.startsWith("# ") ? 2 : 3;
      blocks.push({ kind: "heading", level, text: chunk.replace(/^#{1,3}\s+/, "") });
    } else if (chunk.split("\n").every((line) => /^-\s+/.test(line))) {
      blocks.push({ kind: "list", items: chunk.split("\n").map((line) => line.replace(/^-\s+/, "")) });
    } else if (chunk.startsWith("> ")) {
      blocks.push({ kind: "quote", text: chunk.replace(/^>\s?/gm, "") });
    } else {
      blocks.push({ kind: "paragraph", text: chunk.replace(/\n/g, " ") });
    }
  }
  return blocks;
}
