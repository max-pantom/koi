export function buildCaptureMetadata({
  captureType,
  imageUrl,
  finalUrl,
  page,
  title,
  sourceLinkUrl,
  capturedAt,
  imageFilename,
  destinationFolderId,
}) {
  return {
    schemaVersion: 2,
    captureType,
    sourceUrl: imageUrl,
    sourceFinalUrl: finalUrl || imageUrl,
    sourcePageUrl: page.pageUrl || "",
    sourceCanonicalUrl: page.canonicalUrl || "",
    sourceLinkUrl: sourceLinkUrl || "",
    sourceTitle: title || page.title || "",
    sourcePageTitle: page.title || "",
    sourceSiteName: page.siteName || hostname(page.pageUrl),
    sourceDescription: page.description || "",
    sourceByline: page.byline || "",
    sourceContentMarkdown: page.articleMarkdown || "",
    capturedAt,
    imageFilename,
    destinationFolderId: destinationFolderId || "",
  };
}

function hostname(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
