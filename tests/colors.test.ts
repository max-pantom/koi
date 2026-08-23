import { describe, expect, it } from "vitest";
import { formatColor } from "../src/lib/colors";

describe("formatColor", () => {
  it("formats a swatch in each supported clipboard format", () => {
    expect(formatColor("#ff8000", "hex")).toBe("#FF8000");
    expect(formatColor("#ff8000", "rgb")).toBe("rgb(255, 128, 0)");
    expect(formatColor("#ff8000", "hsl")).toBe("hsl(30, 100%, 50%)");
  });

  it("supports compact hex and leaves invalid values readable", () => {
    expect(formatColor("#abc", "rgb")).toBe("rgb(170, 187, 204)");
    expect(formatColor("blue", "hsl")).toBe("BLUE");
  });
});
