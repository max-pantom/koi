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
  const pageUrl = document.querySelector('link[rel="canonical"]')?.href || location.href;
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
      url: absoluteUrl(image.currentSrc || image.src),
      alt: image.alt.trim(),
      width: image.naturalWidth,
      height: image.naturalHeight,
    }))
    .filter((image) => image.url && image.width >= 120 && image.height >= 80)
    .sort((left, right) => right.width * right.height - left.width * left.height)
    .filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index)
    .slice(0, 40);

  return {
    pageUrl,
    title,
    description,
    siteName,
    ogImage: ogImage || images[0]?.url || "",
    images,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "KOI_GET_PAGE") return false;
  sendResponse(pageMetadata());
  return false;
});
