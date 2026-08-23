import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/components/ArticleReader";

describe("parseMarkdown", () => {
  it("renders saved article markdown as semantic blocks without HTML", () => {
    expect(parseMarkdown("# Title\n\nIntro copy.\n\n- One\n- Two\n\n> A quote")).toEqual([
      { kind: "heading", level: 2, text: "Title" },
      { kind: "paragraph", text: "Intro copy." },
      { kind: "list", items: ["One", "Two"] },
      { kind: "quote", text: "A quote" },
    ]);
  });
});
