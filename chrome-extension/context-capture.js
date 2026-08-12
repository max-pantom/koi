export function buildContextCapture(info, tab) {
  const pageUrl = info.pageUrl || tab?.url || "";

  if (info.menuItemId === "koi-save-image") {
    return {
      type: "KOI_CAPTURE_IMAGE",
      tabId: tab?.id,
      imageUrl: info.srcUrl || "",
      imageTitle: tab?.title || "Image",
      sourceLinkUrl: info.linkUrl || "",
      page: {
        pageUrl,
        canonicalUrl: "",
        title: tab?.title || "",
        siteName: hostname(pageUrl),
        images: [],
      },
    };
  }

  if (info.menuItemId === "koi-save-page") {
    const destinationUrl = info.linkUrl || pageUrl;
    return {
      type: "KOI_CAPTURE_PAGE",
      tabId: tab?.id,
      sourceLinkUrl: info.linkUrl || "",
      page: {
        pageUrl: destinationUrl,
        canonicalUrl: "",
        title: tab?.title || "",
        siteName: hostname(destinationUrl),
        images: [],
      },
    };
  }

  return undefined;
}

function hostname(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
