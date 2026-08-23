(() => {
const SCRIPT_VERSION = globalThis.chrome?.runtime?.getManifest?.().version || "test";
if (globalThis.KoiSocialPlatformsVersion === SCRIPT_VERSION) return;

const PLATFORM_RULES = [
  { id: "x", hosts: ["x.com", "twitter.com"], path: /^\/[^/]+\/status\/\d+/i },
  { id: "instagram", hosts: ["instagram.com"], path: /^\/(?:p|reel|tv)\/[^/]+/i },
  { id: "tiktok", hosts: ["tiktok.com"], path: /^\/@[^/]+\/video\/\d+/i },
  { id: "facebook", hosts: ["facebook.com", "fb.watch"], path: /\/(?:reel\/\d+|watch\/?|[^/]+\/posts\/[^/]+|share\/[^/]+)/i },
  { id: "threads", hosts: ["threads.net"], path: /^\/@[^/]+\/post\/[^/]+/i },
  { id: "bluesky", hosts: ["bsky.app"], path: /^\/profile\/[^/]+\/post\/[^/]+/i },
  { id: "pinterest", hosts: ["pinterest.com"], path: /^\/pin\/\d+/i },
  { id: "pinterest", hosts: ["pin.it"], path: /^\/[^/]+/i },
];

function socialPlatform(value) {
  const url = parseUrl(value);
  if (!url) return "";
  return PLATFORM_RULES.find((rule) => (
    rule.hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    && rule.path.test(url.pathname)
  ))?.id || "";
}

function isSocialPostUrl(value) {
  return !!socialPlatform(value);
}

function socialPostKey(value) {
  const url = parseUrl(value);
  const platform = socialPlatform(value);
  if (!url || !platform) return "";
  let path = url.pathname.replace(/\/+$/, "").toLowerCase();
  if (platform === "x") path = path.match(/^\/[^/]+\/status\/\d+/i)?.[0]?.toLowerCase() || path;
  if (platform === "facebook" && /\/watch\/?$/i.test(path)) path += `?v=${url.searchParams.get("v") || ""}`;
  return `${platform}:${path}`;
}

function sameSocialPost(left, right) {
  const leftKey = socialPostKey(left);
  return !!leftKey && leftKey === socialPostKey(right);
}

function parseUrl(value) {
  try {
    const url = new URL(value);
    url.hostname = url.hostname.replace(/^www\./, "");
    return /^https?:$/.test(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

globalThis.KoiSocialPlatforms = { isSocialPostUrl, sameSocialPost, socialPlatform, socialPostKey };
globalThis.KoiSocialPlatformsVersion = SCRIPT_VERSION;
})();
