(() => {
const SCRIPT_VERSION = chrome.runtime.getManifest().version;
if (globalThis.KoiVideoCandidatesVersion === SCRIPT_VERSION) return;

function absoluteHttpUrl(value, base) {
  if (!value) return "";
  try {
    const url = new URL(value, base);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function directVideoUrls(video, base) {
  if (!video) return [];
  const values = [
    video.currentSrc,
    video.src,
    video.getAttribute?.("src"),
    ...Array.from(video.querySelectorAll?.("source[src]") || []).map((source) => source.getAttribute("src")),
  ];
  return unique(values.map((value) => absoluteHttpUrl(value, base)).filter(Boolean));
}

function videoResourceUrls(entries, pageHostname = "") {
  const candidates = entries
    .map((entry) => ({
      url: absoluteHttpUrl(entry.name),
      contentType: String(entry.contentType || "").toLowerCase(),
      initiatorType: String(entry.initiatorType || "").toLowerCase(),
      startTime: Number(entry.startTime) || 0,
      transferSize: Number(entry.transferSize) || 0,
    }))
    .filter((entry) => entry.url)
    .filter((entry) => (
      entry.contentType.startsWith("video/")
      || entry.initiatorType === "video"
      || /(?:\.mp4|\.m4v|\.mov|\.webm)(?:[?#]|$)/i.test(entry.url)
      || /video\.twimg\.com|cdninstagram\.com|fbcdn\.net/i.test(entry.url)
    ));
  const files = candidates.filter((entry) => !/\.(?:m3u8|mpd)(?:[?#]|$)/i.test(entry.url));
  const pool = files.length ? files : candidates;
  const seenAssets = new Set();
  return pool
    .sort((left, right) => scoreResource(right, pageHostname) - scoreResource(left, pageHostname))
    .map((entry) => entry.url)
    .filter((url) => {
      const key = mediaKey(url);
      if (seenAssets.has(key)) return false;
      seenAssets.add(key);
      return true;
    });
}

function bestVideoUrl(video, base, entries = []) {
  const direct = directVideoUrls(video, base).sort((left, right) => scoreCodec(right) - scoreCodec(left));
  const directFile = direct.find((url) => /\.(?:mp4|m4v|mov|webm|ogv)(?:[?#]|$)/i.test(url));
  if (directFile) return directFile;
  return videoResourceUrls(entries, hostname(base))[0] || direct[0] || "";
}

function looksLikeGifVideo(video) {
  if (!video) return false;
  const label = [
    video.getAttribute?.("aria-label"),
    video.getAttribute?.("title"),
    video.closest?.("[aria-label]")?.getAttribute("aria-label"),
  ].filter(Boolean).join(" ");
  return /\bgif\b/i.test(label) || (video.loop && video.muted && !video.controls);
}

function scoreResource(entry, pageHostname) {
  let score = entry.startTime / 10_000 + Math.min(entry.transferSize / 1_000_000, 20);
  if (entry.contentType.startsWith("video/")) score += 100;
  if (entry.initiatorType === "video") score += 80;
  if (/\.mp4(?:[?#]|$)/i.test(entry.url)) score += 70;
  score += scoreCodec(entry.url);
  if (/video\.twimg\.com/i.test(entry.url) && /(?:^|\.)x\.com$|(?:^|\.)twitter\.com$/.test(pageHostname)) score += 60;
  if (/cdninstagram\.com|fbcdn\.net/i.test(entry.url) && /(?:^|\.)instagram\.com$/.test(pageHostname)) score += 60;
  const dimensions = entry.url.match(/\/(\d{2,5})x(\d{2,5})\//);
  if (dimensions) score += Math.min((Number(dimensions[1]) * Number(dimensions[2])) / 100_000, 60);
  return score;
}

function scoreCodec(value) {
  if (/\bavc1\b|\bh264\b/i.test(value)) return 90;
  if (/\b(?:av01|av1)\b/i.test(value)) return -90;
  return 0;
}

function hostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function mediaKey(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname.replace(/\/vid\/(?:avc1\/)?\d+x\d+\//i, "/vid/{size}/")}`;
  } catch {
    return value;
  }
}

function unique(values) {
  return Array.from(new Set(values));
}

globalThis.KoiVideoCandidates = { bestVideoUrl, directVideoUrls, looksLikeGifVideo, videoResourceUrls };
globalThis.KoiVideoCandidatesVersion = SCRIPT_VERSION;
})();
