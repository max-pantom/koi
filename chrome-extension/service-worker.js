import { downloadImageWithFallback, downloadTextFile } from "./downloads.js";
import { buildCaptureMetadata } from "./capture-metadata.js";
import { routeCaptureToKoi } from "./koi-bridge.js";

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
  const capture = info.menuItemId === IMAGE_MENU_ID
    ? {
        type: "KOI_CAPTURE_IMAGE",
        tabId: tab?.id,
        imageUrl: info.srcUrl,
        imageTitle: tab?.title || "Image",
        sourceLinkUrl: info.linkUrl || "",
        page: {
          pageUrl: info.pageUrl || tab?.url || "",
          canonicalUrl: "",
          title: tab?.title || "",
          siteName: hostname(info.pageUrl || tab?.url),
          images: [],
        },
      }
    : info.menuItemId === PAGE_MENU_ID
      ? {
          type: "KOI_CAPTURE_PAGE",
          tabId: tab?.id,
          page: {
            pageUrl: info.linkUrl || info.pageUrl || tab?.url || "",
            canonicalUrl: "",
            title: tab?.title || "",
            siteName: hostname(info.linkUrl || info.pageUrl || tab?.url),
            images: [],
          },
          sourceLinkUrl: info.linkUrl || "",
        }
      : undefined;

  const task = capture ? handleContextCapture(capture) : undefined;

  task?.catch((error) => console.error("Koi capture failed", error));
});

async function handleContextCapture(capture) {
  const settings = await chrome.storage.local.get(["askEveryTime", "quickSaveFolderId"]);
  if (settings.askEveryTime !== false) {
    await chrome.storage.local.set({ pendingContextCapture: capture });
    await chrome.windows.create({
      url: chrome.runtime.getURL("popup.html?context=1"),
      type: "popup",
      width: 390,
      height: 690,
      focused: true,
    });
    return;
  }

  const message = { ...capture, destinationFolderId: settings.quickSaveFolderId || "" };
  if (message.type === "KOI_CAPTURE_IMAGE") {
    return captureImage({
      imageUrl: message.imageUrl,
      page: message.page,
      fallbackTitle: message.imageTitle,
      sourceLinkUrl: message.sourceLinkUrl,
      tabId: message.tabId,
      destinationFolderId: message.destinationFolderId,
    });
  }
  return capturePage({
    pageUrl: message.page.pageUrl,
    page: message.page,
    fallbackTitle: message.page.title,
    tabId: message.tabId,
    sourceLinkUrl: message.sourceLinkUrl,
    destinationFolderId: message.destinationFolderId,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "KOI_CAPTURE_IMAGE" && message?.type !== "KOI_CAPTURE_PAGE") return false;

  const task = message.type === "KOI_CAPTURE_IMAGE"
    ? captureImage({
        imageUrl: message.imageUrl,
        pageUrl: message.page?.pageUrl,
        fallbackTitle: message.imageTitle || message.page?.title,
        tabId: message.tabId ?? sender.tab?.id,
        page: message.page,
        sourceLinkUrl: message.sourceLinkUrl,
        destinationFolderId: message.destinationFolderId,
      })
    : capturePage({
        pageUrl: message.page?.pageUrl,
        fallbackTitle: message.page?.title,
        tabId: message.tabId ?? sender.tab?.id,
        page: message.page,
        sourceLinkUrl: message.sourceLinkUrl,
        destinationFolderId: message.destinationFolderId,
      });

  task
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
  return true;
});

async function captureImage({
  imageUrl,
  pageUrl,
  fallbackTitle,
  tabId,
  page,
  sourceLinkUrl,
  destinationFolderId,
}) {
  if (!isDownloadableUrl(imageUrl)) throw new Error("This image uses a browser-only URL and cannot be downloaded.");
  const metadata = typeof tabId === "number"
    ? await readPage(tabId, { ...page, pageUrl: page?.pageUrl || pageUrl, title: page?.title || fallbackTitle })
    : page || { pageUrl, title: fallbackTitle, images: [] };
  return downloadCapture({
    captureType: "image",
    imageUrl,
    page: metadata,
    title: fallbackTitle || metadata.title || fileStemFromUrl(imageUrl),
    sourceLinkUrl,
    destinationFolderId,
  });
}

async function capturePage({ pageUrl, fallbackTitle, tabId, page, sourceLinkUrl, destinationFolderId }) {
  let metadata = typeof tabId === "number"
    ? await readPage(tabId, { ...page, pageUrl: page?.pageUrl || pageUrl, title: page?.title || fallbackTitle })
    : page || { pageUrl, title: fallbackTitle, images: [] };
  const previewUrl = metadata.ogImage || metadata.images?.[0]?.url;
  if (pageUrl && (
    (metadata.pageUrl && normalisePageUrl(pageUrl) !== normalisePageUrl(metadata.pageUrl))
    || !isDownloadableUrl(previewUrl)
  )) {
    metadata = await readRemotePage(pageUrl, fallbackTitle);
  }
  const resolvedPreviewUrl = metadata.ogImage || metadata.images?.[0]?.url;
  if (!isDownloadableUrl(resolvedPreviewUrl)) {
    throw new Error("This page does not expose a downloadable preview image.");
  }
  return downloadCapture({
    captureType: "link",
    imageUrl: resolvedPreviewUrl,
    page: metadata,
    title: metadata.title || fallbackTitle || hostname(pageUrl),
    sourceLinkUrl,
    destinationFolderId,
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
      canonicalUrl: resolveUrl(extractLinkHref(html, "canonical"), resolvedPageUrl),
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

function extractLinkHref(html, rel) {
  for (const tag of html.match(/<link\s+[^>]*>/gi) || []) {
    const attributes = readAttributes(tag);
    if ((attributes.rel || "").toLowerCase().split(/\s+/).includes(rel) && attributes.href) {
      return decodeEntities(attributes.href);
    }
  }
  return "";
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

async function downloadCapture({ captureType, imageUrl, page, title, sourceLinkUrl, destinationFolderId }) {
  const extension = await inferExtension(imageUrl);
  const stem = captureStem(title, page.siteName || hostname(page.pageUrl));
  const imageFilename = `${CAPTURE_DIRECTORY}/${stem}.${extension}`;
  const sidecarFilename = `${CAPTURE_DIRECTORY}/${stem}.koi.json`;
  const capturedAt = new Date().toISOString();
  const imageDownload = await downloadImageWithFallback({
    downloads: chrome.downloads,
    fetchImpl: fetch,
    url: imageUrl,
    filename: imageFilename,
    sourcePageUrl: page.pageUrl,
  });
  const [completedDownload] = await chrome.downloads.search({ id: imageDownload.id }).catch(() => []);
  const metadata = buildCaptureMetadata({
    captureType,
    imageUrl,
    finalUrl: isDownloadableUrl(completedDownload?.finalUrl) ? completedDownload.finalUrl : imageUrl,
    page,
    title,
    sourceLinkUrl,
    capturedAt,
    imageFilename: `${stem}.${extension}`,
    destinationFolderId,
  });

  let metadataDownloadId;
  try {
    metadataDownloadId = await downloadTextFile({
      downloads: chrome.downloads,
      text: `${JSON.stringify(metadata, null, 2)}\n`,
      filename: sidecarFilename,
    });
  } catch (error) {
    throw new Error(`The image was saved, but its source information was not: ${readableError(error)}`);
  }

  let destinationFolderName = "Koi Captures";
  if (destinationFolderId) {
    try {
      const route = await routeCaptureToKoi({
        destinationFolderId,
        imageFilename: `${stem}.${extension}`,
        sidecarFilename: `${stem}.koi.json`,
      });
      destinationFolderName = route.folderName || destinationFolderName;
    } catch (error) {
      throw new Error(`The capture is safe in Downloads/Koi Captures, but it was not moved: ${readableError(error)}`);
    }
  }

  await chrome.storage.local.set({
    lastCapture: {
      ...metadata,
      imageFilename,
      sidecarFilename,
      imageDownloadId: imageDownload.id,
      metadataDownloadId,
      usedFallback: imageDownload.usedFallback,
      destinationFolderName,
    },
  });
  return {
    imageFilename,
    sidecarFilename,
    imageDownloadId: imageDownload.id,
    metadataDownloadId,
    usedFallback: imageDownload.usedFallback,
    destinationFolderName,
  };
}


async function readPage(tabId, fallback) {
  if (typeof tabId !== "number") return { ...fallback, images: [] };
  try {
    const page = await chrome.tabs.sendMessage(tabId, { type: "KOI_GET_PAGE" });
    return { ...fallback, ...page, images: page.images || fallback.images || [] };
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
