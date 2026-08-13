const ORIGINAL_IMAGE_ATTRIBUTES = [
  "data-original",
  "data-original-src",
  "data-full",
  "data-full-src",
  "data-large",
  "data-large-src",
  "data-zoom-image",
  "data-orig-file",
  "data-image-url",
  "data-lazy-src",
];

function bestImageUrl(image, baseUrl) {
  if (!image) return "";
  const candidates = [];
  const add = (value, score) => {
    const url = absoluteUrl(value, baseUrl);
    if (isHttpUrl(url)) candidates.push({ url, score });
  };

  ORIGINAL_IMAGE_ATTRIBUTES.forEach((attribute, index) => {
    add(image.getAttribute?.(attribute), 4_000_000 - index);
  });

  const anchor = image.closest?.("a[href]");
  const anchorUrl = absoluteUrl(anchor?.getAttribute?.("href"), baseUrl);
  if (looksLikeImageUrl(anchorUrl) || anchor?.hasAttribute?.("download")) {
    add(anchorUrl, 3_000_000);
  }

  const sources = Array.from(image.closest?.("picture")?.querySelectorAll?.("source[srcset]") || []);
  for (const source of sources) addSrcset(candidates, source.getAttribute("srcset"), baseUrl, 2_100_000);
  addSrcset(candidates, image.getAttribute?.("srcset"), baseUrl, 2_000_000);

  add(image.currentSrc, 1_100_000 + imageArea(image));
  add(image.getAttribute?.("src"), 1_000_000 + imageArea(image));
  add(image.src, 900_000 + imageArea(image));

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.url || "";
}

function imageIncludesUrl(image, expectedUrl, baseUrl) {
  const expected = absoluteUrl(expectedUrl, baseUrl);
  if (!expected) return false;
  const urls = new Set([
    absoluteUrl(image.currentSrc, baseUrl),
    absoluteUrl(image.src, baseUrl),
    absoluteUrl(image.getAttribute?.("src"), baseUrl),
    bestImageUrl(image, baseUrl),
  ]);
  for (const value of parseSrcset(image.getAttribute?.("srcset"), baseUrl)) urls.add(value.url);
  return urls.has(expected);
}

function parseSrcset(srcset, baseUrl) {
  if (!srcset) return [];
  return srcset
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => {
      const [value, descriptor = ""] = candidate.split(/\s+/, 2);
      const width = descriptor.endsWith("w") ? Number.parseFloat(descriptor) : 0;
      const density = descriptor.endsWith("x") ? Number.parseFloat(descriptor) : 0;
      return {
        url: absoluteUrl(value, baseUrl),
        quality: Number.isFinite(width) && width > 0
          ? width
          : Number.isFinite(density) && density > 0
            ? density * 1_000
            : 1,
      };
    })
    .filter((candidate) => isHttpUrl(candidate.url));
}

function addSrcset(candidates, srcset, baseUrl, baseScore) {
  for (const candidate of parseSrcset(srcset, baseUrl)) {
    candidates.push({ url: candidate.url, score: baseScore + candidate.quality });
  }
}

function imageArea(image) {
  return Math.min((image.naturalWidth || 0) * (image.naturalHeight || 0), 500_000);
}

function looksLikeImageUrl(value) {
  if (!value) return false;
  try {
    return /\.(?:apng|avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return "";
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

globalThis.KoiImageCandidates = { bestImageUrl, imageIncludesUrl, parseSrcset };
