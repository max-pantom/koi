export function buildContextCapture(info, tab) {
  const pageUrl = info.pageUrl || tab?.url || "";

  if (["koi-save-image", "koi-quick-save-image", "koi-save-image-to"].includes(info.menuItemId)) {
    return {
      type: "KOI_CAPTURE_IMAGE",
      promptForDestination: info.menuItemId === "koi-save-image-to" ? true : info.menuItemId === "koi-quick-save-image" ? false : undefined,
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

  if (["koi-save-page", "koi-quick-save-page", "koi-save-page-to"].includes(info.menuItemId)) {
    const destinationUrl = info.linkUrl || pageUrl;
    return {
      type: "KOI_CAPTURE_PAGE",
      promptForDestination: info.menuItemId === "koi-save-page-to" ? true : info.menuItemId === "koi-quick-save-page" ? false : undefined,
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
