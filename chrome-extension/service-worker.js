const CAPTURE_DIRECTORY = "Koi Captures";
const IMAGE_MENU_ID = "koi-save-image";
const PAGE_MENU_ID = "koi-save-page";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: IMAGE_MENU_ID,
      title: "Save image to Koi",
      contexts: ["image"],
    });
    chrome.contextMenus.create({
      id: PAGE_MENU_ID,
      title: "Save page preview to Koi",
      contexts: ["page", "link"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const task = info.menuItemId === IMAGE_MENU_ID
    ? captureImage({
        imageUrl: info.srcUrl,
        pageUrl: info.pageUrl,
        fallbackTitle: tab?.title,
        tabId: tab?.id,
      })
    : info.menuItemId === PAGE_MENU_ID
      ? capturePage({ pageUrl: info.linkUrl || info.pageUrl, fallbackTitle: tab?.title, tabId: tab?.id })
      : undefined;

  task?.catch((error) => console.error("Koi capture failed", error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "KOI_CAPTURE_IMAGE" && message?.type !== "KOI_CAPTURE_PAGE") return false;

  const task = message.type === "KOI_CAPTURE_IMAGE"
    ? captureImage({
        imageUrl: message.imageUrl,
        pageUrl: message.page?.pageUrl,
        fallbackTitle: message.imageTitle || message.page?.title,
        tabId: sender.tab?.id,
        page: message.page,
      })
    : capturePage({
        pageUrl: message.page?.pageUrl,
        fallbackTitle: message.page?.title,
        tabId: sender.tab?.id,
        page: message.page,
      });

  task
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
  return true;
});

async function captureImage({ imageUrl, pageUrl, fallbackTitle, tabId, page }) {
  if (!isDownloadableUrl(imageUrl)) throw new Error("This image uses a browser-only URL and cannot be downloaded.");
  const metadata = page || await readPage(tabId, { pageUrl, title: fallbackTitle });
  return downloadCapture({
    captureType: "image",
    imageUrl,
    page: metadata,
    title: fallbackTitle || metadata.title || fileStemFromUrl(imageUrl),
  });
}

async function capturePage({ pageUrl, fallbackTitle, tabId, page }) {
  let metadata = page || await readPage(tabId, { pageUrl, title: fallbackTitle });
  if (pageUrl && metadata.pageUrl && normalisePageUrl(pageUrl) !== normalisePageUrl(metadata.pageUrl)) {
    metadata = await readRemotePage(pageUrl, fallbackTitle);
  }
  const previewUrl = metadata.ogImage || metadata.images?.[0]?.url;
  if (!isDownloadableUrl(previewUrl)) {
    throw new Error("This page does not expose a downloadable preview image.");
  }
  return downloadCapture({
    captureType: "link",
    imageUrl: previewUrl,
    page: { ...metadata, pageUrl: pageUrl || metadata.pageUrl },
    title: metadata.title || fallbackTitle || hostname(pageUrl),
  });
}

async function readRemotePage(pageUrl, fallbackTitle) {
  try {
    const response = await fetch(pageUrl, { credentials: "include" });
    if (!response.ok) throw new Error(`Website returned ${response.status}.`);
    const html = await response.text();
    const title = extractMeta(html, ["og:title", "twitter:title"]) || extractTitle(html) || fallbackTitle;
    const description = extractMeta(html, ["og:description", "twitter:description", "description"]);
    const siteName = extractMeta(html, ["og:site_name"]) || hostname(response.url || pageUrl);
    const imageValue = extractMeta(html, [
      "og:image:secure_url",
      "og:image",
      "twitter:image",
      "twitter:image:src",
    ]);
    const resolvedPageUrl = response.url || pageUrl;
    return {
      pageUrl: resolvedPageUrl,
      title,
      description,
      siteName,
      ogImage: resolveUrl(imageValue, resolvedPageUrl),
      images: [],
    };
  } catch (error) {
    throw new Error(`Unable to read that website's preview: ${readableError(error)}`);
  }
}

function extractMeta(html, names) {
  for (const tag of html.match(/<meta\s+[^>]*>/gi) || []) {
    const attributes = readAttributes(tag);
    const key = (attributes.property || attributes.name || "").toLowerCase();
    if (names.includes(key) && attributes.content) return decodeEntities(attributes.content);
  }
  return "";
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].replace(/\s+/g, " ").trim()) : "";
}

function readAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function resolveUrl(value, base) {
  if (!value) return "";
  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

function normalisePageUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return value || "";
  }
}

async function downloadCapture({ captureType, imageUrl, page, title }) {
  const extension = await inferExtension(imageUrl);
  const stem = captureStem(title, page.siteName || hostname(page.pageUrl));
  const imageFilename = `${CAPTURE_DIRECTORY}/${stem}.${extension}`;
  const sidecarFilename = `${CAPTURE_DIRECTORY}/${stem}.koi.json`;
  const capturedAt = new Date().toISOString();
  const metadata = {
    schemaVersion: 1,
    captureType,
    sourceUrl: imageUrl,
    sourcePageUrl: page.pageUrl || "",
    sourceTitle: page.title || title || "",
    sourceSiteName: page.siteName || hostname(page.pageUrl),
    sourceDescription: page.description || "",
    capturedAt,
    imageFilename: `${stem}.${extension}`,
  };

  const imageDownloadId = await chrome.downloads.download({
    url: imageUrl,
    filename: imageFilename,
    conflictAction: "uniquify",
    saveAs: false,
  });

  const sidecarUrl = `data:application/json;charset=utf-8,${encodeURIComponent(`${JSON.stringify(metadata, null, 2)}\n`)}`;
  const metadataDownloadId = await chrome.downloads.download({
    url: sidecarUrl,
    filename: sidecarFilename,
    conflictAction: "uniquify",
    saveAs: false,
  });

  await chrome.storage.local.set({
    lastCapture: { ...metadata, imageFilename, sidecarFilename, imageDownloadId, metadataDownloadId },
  });
  return { imageFilename, sidecarFilename, imageDownloadId, metadataDownloadId };
}

async function readPage(tabId, fallback) {
  if (typeof tabId !== "number") return { ...fallback, images: [] };
  try {
    const page = await chrome.tabs.sendMessage(tabId, { type: "KOI_GET_PAGE" });
    return { ...fallback, ...page };
  } catch {
    return { ...fallback, siteName: hostname(fallback.pageUrl), images: [] };
  }
}

async function inferExtension(url) {
  const fromPath = extensionFromUrl(url);
  try {
    const response = await fetch(url, { method: "HEAD", credentials: "include" });
    const contentType = response.headers.get("content-type")?.split(";")[0].trim();
    return extensionFromMime(contentType) || fromPath || "jpg";
  } catch {
    return fromPath || "jpg";
  }
}

function extensionFromUrl(value) {
  try {
    const extension = new URL(value).pathname.split(".").pop()?.toLowerCase();
    return ["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"].includes(extension)
      ? extension.replace("jpeg", "jpg")
      : "";
  } catch {
    return "";
  }
}

function extensionFromMime(value) {
  return ({
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/tiff": "tiff",
    "image/webp": "webp",
  })[value] || "";
}

function captureStem(title, siteName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const random = crypto.getRandomValues(new Uint16Array(1))[0].toString(36).padStart(3, "0");
  const slug = slugify([siteName, title].filter(Boolean).join(" ")) || "capture";
  return `${stamp}-${random}-${slug}`.slice(0, 140);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function fileStemFromUrl(value) {
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").pop() || "image").replace(/\.[^.]+$/, "");
  } catch {
    return "image";
  }
}

function hostname(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isDownloadableUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function readableError(error) {
  return error instanceof Error ? error.message : String(error);
}
