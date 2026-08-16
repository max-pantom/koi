(() => {
const SCRIPT_VERSION = chrome.runtime.getManifest().version;
if (globalThis.KoiContentScriptVersion === SCRIPT_VERSION) return;

const { bestImageUrl, imageIncludesUrl } = globalThis.KoiImageCandidates;

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, document.baseURI).href;
  } catch {
    return "";
  }
}

function metaContent(...selectors) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content")?.trim();
    if (value) return value;
  }
  return "";
}

function pageMetadata() {
  const pageUrl = location.href;
  const canonicalUrl = absoluteUrl(document.querySelector('link[rel="canonical"]')?.getAttribute("href"));
  const title = metaContent('meta[property="og:title"]', 'meta[name="twitter:title"]') || document.title;
  const description = metaContent(
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  );
  const siteName = metaContent('meta[property="og:site_name"]') || location.hostname.replace(/^www\./, "");
  const ogImage = absoluteUrl(
    metaContent(
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ),
  );
  const images = Array.from(document.images)
    .map((image) => ({
      url: bestImageUrl(image, document.baseURI),
      displayUrl: absoluteUrl(image.currentSrc || image.src),
      alt: image.alt.trim(),
      title: image.title.trim(),
      linkUrl: absoluteUrl(image.closest("a[href]")?.getAttribute("href")),
      width: image.naturalWidth,
      height: image.naturalHeight,
    }))
    .filter((image) => image.url && image.width >= 120 && image.height >= 80)
    .sort((left, right) => right.width * right.height - left.width * left.height)
    .filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index)
    .slice(0, 40);

  return {
    pageUrl,
    canonicalUrl,
    title,
    description,
    siteName,
    ogImage: ogImage || images[0]?.url || "",
    images,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "KOI_GET_PAGE") {
    sendResponse(pageMetadata());
    return false;
  }
  if (message?.type !== "KOI_RESOLVE_IMAGE") return false;
  const image = Array.from(document.images).find((candidate) => (
    imageIncludesUrl(candidate, message.imageUrl, document.baseURI)
  ));
  sendResponse({
    imageUrl: bestImageUrl(image, document.baseURI) || message.imageUrl || "",
    sourceLinkUrl: absoluteUrl(image?.closest("a[href]")?.getAttribute("href")),
  });
  return false;
});

globalThis.KoiContentScriptVersion = SCRIPT_VERSION;
})();
