const COLOR_NAMES = [
  { name: "black", rgb: [18, 18, 18] },
  { name: "white", rgb: [242, 242, 238] },
  { name: "gray", rgb: [128, 128, 128] },
  { name: "red", rgb: [216, 48, 42] },
  { name: "orange", rgb: [235, 127, 38] },
  { name: "yellow", rgb: [232, 205, 48] },
  { name: "green", rgb: [48, 155, 74] },
  { name: "blue", rgb: [50, 100, 210] },
  { name: "purple", rgb: [125, 75, 180] },
  { name: "pink", rgb: [226, 94, 154] },
  { name: "brown", rgb: [126, 82, 48] },
];

export type ColorIndex = {
  dominantColors: string[];
  colorNames: string[];
};

export function extractColorIndex(image: HTMLImageElement): ColorIndex | null {
  try {
    const canvas = document.createElement("canvas");
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { rgb: [number, number, number]; count: number }>();

    for (let i = 0; i < pixels.length; i += 16) {
      const alpha = pixels[i + 3];
      if (alpha < 160) continue;

      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count += 1;
      } else {
        buckets.set(key, { rgb: [r, g, b], count: 1 });
      }
    }

    const dominant = Array.from(buckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((bucket) => bucket.rgb);
    const dominantColors = dominant.map((rgb) => rgbToHex(rgb));
    const colorNames = Array.from(new Set(dominant.map(nearestColorName))).slice(0, 5);

    return { dominantColors, colorNames };
  } catch {
    return null;
  }
}

function nearestColorName(rgb: [number, number, number]) {
  let best = COLOR_NAMES[0];
  let bestDistance = Infinity;

  for (const color of COLOR_NAMES) {
    const distance =
      (rgb[0] - color.rgb[0]) ** 2 +
      (rgb[1] - color.rgb[1]) ** 2 +
      (rgb[2] - color.rgb[2]) ** 2;
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }

  return best.name;
}

function rgbToHex(rgb: [number, number, number]) {
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
