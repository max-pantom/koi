export type ColorFormat = "hex" | "rgb" | "hsl";

export function formatColor(hex: string, format: ColorFormat) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex.toUpperCase();
  if (format === "rgb") return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  if (format === "hsl") {
    const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  return `#${[rgb.r, rgb.g, rgb.b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hexToRgb(value: string) {
  const compact = value.trim().replace(/^#/, "");
  const expanded = compact.length === 3
    ? compact.split("").map((character) => character.repeat(2)).join("")
    : compact;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return undefined;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return {
    h: hue,
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}
