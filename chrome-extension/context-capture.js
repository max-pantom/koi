export function buildContextCapture(info, tab) {
  const pageUrl = info.pageUrl || tab?.url || "";
  const menuItemId = String(info.menuItemId || "");
  const isUnifiedAction = ["koi-quick-save", "koi-save-to"].includes(menuItemId);
  const promptForDestination = menuItemId === "koi-save-to"
    || /-to$/.test(menuItemId)
      ? true
      : menuItemId.includes("quick-save")
        ? false
        : undefined;

  if ((isUnifiedAction && info.mediaType === "image") || ["koi-save-image", "koi-quick-save-image", "koi-save-image-to"].includes(menuItemId)) {
    return {
      type: "KOI_CAPTURE_IMAGE",
      promptForDestination,
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

  if ((isUnifiedAction && info.mediaType === "video") || ["koi-quick-save-video", "koi-save-video-to"].includes(menuItemId)) {
    return {
      type: "KOI_CAPTURE_VIDEO",
      promptForDestination,
      tabId: tab?.id,
      videoUrl: info.srcUrl || "",
      videoTitle: tab?.title || "Video",
      page: {
        pageUrl,
        canonicalUrl: "",
        title: tab?.title || "",
        siteName: hostname(pageUrl),
        images: [],
        videos: [],
      },
    };
  }

  if (isUnifiedAction || ["koi-save-page", "koi-quick-save-page", "koi-save-page-to"].includes(menuItemId)) {
    const destinationUrl = info.linkUrl || pageUrl;
    return {
      type: "KOI_CAPTURE_PAGE",
      promptForDestination,
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
