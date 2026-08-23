import { downloadImageWithFallback } from "./downloads.js";
import { buildCaptureMetadata } from "./capture-metadata.js";
import { buildContextCapture } from "./context-capture.js";
import { routeCaptureToKoi } from "./koi-bridge.js";
import { classifyPageCapture } from "./capture-kind.js";
import { articleMetadataFromHtml } from "./article-html.js";
import "./social-platforms.js";

const CAPTURE_DIRECTORY = "Koi Captures";
const ROOT_MENU_ID = "koi-save";

chrome.runtime.onInstalled.addListener(registerContextMenus);

function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: ROOT_MENU_ID,
      title: "Save to Koi",
      contexts: ["image", "page", "link", "video"],
    });
    chrome.contextMenus.create({
      id: "koi-quick-save",
      parentId: ROOT_MENU_ID,
      title: "Quick save",
      contexts: ["image", "page", "link", "video"],
    });
    chrome.contextMenus.create({
      id: "koi-save-to",
      parentId: ROOT_MENU_ID,
      title: "Choose folder…",
      contexts: ["image", "page", "link", "video"],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const capture = buildContextCapture(info, tab);
  if (!capture) return;
  void handleContextCapture(capture).catch((error) => {
    void rememberCaptureError(error);
  });
});

async function handleContextCapture(capture) {
  const resolvedCapture = await resolveContextMedia(capture);
  const settings = await readLocal(["askEveryTime", "quickSaveFolderId"]);
  const shouldPrompt = typeof resolvedCapture.promptForDestination === "boolean"
    ? resolvedCapture.promptForDestination
    : settings.askEveryTime !== false;
  if (shouldPrompt) {
    await writeLocal({ pendingContextCapture: resolvedCapture });
    await chrome.windows.create({
      url: chrome.runtime.getURL("popup.html?context=1"),
      type: "popup",
      width: 390,
      height: 690,
      focused: true,
    });
    return;
  }

  const message = { ...resolvedCapture, destinationFolderId: settings.quickSaveFolderId || "" };
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
  if (message.type === "KOI_CAPTURE_VIDEO") {
    return captureVideo({
      videoUrl: message.videoUrl,
      page: message.page,
      fallbackTitle: message.videoTitle,
      tabId: message.tabId,
      destinationFolderId: message.destinationFolderId,
      isGif: message.isGif,
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
  if (!["KOI_CAPTURE_IMAGE", "KOI_CAPTURE_VIDEO", "KOI_CAPTURE_PAGE"].includes(message?.type)) return false;

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
    : message.type === "KOI_CAPTURE_VIDEO"
      ? captureVideo({
          videoUrl: message.videoUrl,
          fallbackTitle: message.videoTitle || message.page?.title,
          tabId: message.tabId ?? sender.tab?.id,
          page: message.page,
          destinationFolderId: message.destinationFolderId,
          isGif: message.isGif,
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
  const resolvedImage = await resolveImage(tabId, imageUrl, sourceLinkUrl);
  const metadata = typeof tabId === "number"
    ? await readPage(tabId, { ...page, pageUrl: page?.pageUrl || pageUrl, title: page?.title || fallbackTitle })
    : page || { pageUrl, title: fallbackTitle, images: [] };
  return downloadCapture({
    captureType: "image",
    imageUrl: resolvedImage.imageUrl,
    page: metadata,
    title: fallbackTitle || metadata.title || fileStemFromUrl(resolvedImage.imageUrl),
    sourceLinkUrl: resolvedImage.sourceLinkUrl,
    destinationFolderId,
  });
}

async function captureVideo({ videoUrl, fallbackTitle, tabId, page, destinationFolderId, isGif = false }) {
  const resolvedVideo = await resolveVideo(tabId, videoUrl, isGif);
  if (!isDownloadableUrl(resolvedVideo.videoUrl) || /\.(?:m3u8|mpd)(?:[?#]|$)/i.test(resolvedVideo.videoUrl)) {
    throw new Error("Koi found a streaming player but not its downloadable video file. Start the video, then try again.");
  }
  const metadata = typeof tabId === "number"
    ? await readPage(tabId, { ...page, title: page?.title || fallbackTitle })
    : page || { title: fallbackTitle, images: [], videos: [] };
  return downloadCapture({
    captureType: resolvedVideo.isGif ? "gif" : "video",
    imageUrl: resolvedVideo.videoUrl,
    page: metadata,
    title: fallbackTitle || metadata.title || fileStemFromUrl(resolvedVideo.videoUrl),
    sourceLinkUrl: "",
    destinationFolderId,
  });
}

async function capturePage({ pageUrl, fallbackTitle, tabId, page, sourceLinkUrl, destinationFolderId }) {
  const targetUrl = pageUrl || page?.pageUrl || "";
  if (globalThis.KoiSocialPlatforms.isSocialPostUrl(targetUrl)) {
    return captureSocialPost({
      targetUrl,
      fallbackTitle,
      tabId,
      page,
      sourceLinkUrl,
      destinationFolderId,
    });
  }
  let metadata = typeof tabId === "number"
    ? await readPage(tabId, { ...page, pageUrl: page?.pageUrl || pageUrl, title: page?.title || fallbackTitle })
    : page || { pageUrl, title: fallbackTitle, images: [] };
  let captureType = classifyPageCapture(metadata);
  const previewUrl = captureType === "article"
    ? metadata.articleImage || metadata.ogImage || metadata.images?.[0]?.url
    : metadata.ogImage || metadata.images?.[0]?.url;
  if (pageUrl && (
    (metadata.pageUrl && normalisePageUrl(pageUrl) !== normalisePageUrl(metadata.pageUrl))
    || !isDownloadableUrl(previewUrl)
  )) {
    metadata = await readRemotePage(pageUrl, fallbackTitle);
    captureType = classifyPageCapture(metadata);
  }
  const resolvedPreviewUrl = captureType === "article"
    ? metadata.articleImage || metadata.ogImage || metadata.images?.[0]?.url || articlePlaceholder(metadata)
    : metadata.ogImage || metadata.images?.[0]?.url || articlePlaceholder(metadata);
  return downloadCapture({
    captureType,
    imageUrl: resolvedPreviewUrl,
    page: metadata,
    title: captureType === "article"
      ? metadata.articleTitle || metadata.title || fallbackTitle || hostname(pageUrl)
      : metadata.title || fallbackTitle || hostname(pageUrl),
    sourceLinkUrl,
    destinationFolderId,
  });
}

async function captureSocialPost({ targetUrl, fallbackTitle, tabId, page, sourceLinkUrl, destinationFolderId }) {
  let resolved;
  if (typeof tabId === "number") {
    try {
      resolved = await chrome.tabs.sendMessage(tabId, { type: "KOI_RESOLVE_SOCIAL_MEDIA", targetUrl });
    } catch {
      resolved = undefined;
    }
  }

  let metadata = resolved?.page;
  let media = Array.isArray(resolved?.media) ? resolved.media : [];
  if (!media.length) {
    const remote = await readRemotePage(targetUrl, fallbackTitle);
    metadata = remote;
    if (isDownloadableUrl(remote.ogVideo)) {
      media = [{ kind: "video", url: remote.ogVideo, title: remote.title, isGif: false }];
    } else if (isDownloadableUrl(remote.ogImage) && isLikelySocialMediaUrl(remote.ogImage)) {
      media = [{ kind: "image", url: remote.ogImage, title: remote.title, sourceLinkUrl: targetUrl }];
    }
  }

  if (!media.length) {
    const platform = globalThis.KoiSocialPlatforms.socialPlatform(targetUrl);
    throw new Error(`Koi could not find downloadable media in this ${platform} post. Open the post, let its media load, then try again.`);
  }

  const socialPage = {
    ...(page || {}),
    ...(metadata || {}),
    pageUrl: targetUrl,
    canonicalUrl: targetUrl,
    articleMarkdown: "",
    hasArticleSchema: false,
    hasArticleContainer: false,
    images: [],
    videos: [],
  };
  const results = [];
  for (const item of media.slice(0, 20)) {
    const result = item.kind === "video"
      ? await captureVideo({
          videoUrl: item.url,
          fallbackTitle: item.title || fallbackTitle || socialPage.title,
          page: socialPage,
          destinationFolderId,
          isGif: item.isGif,
        })
      : await captureImage({
          imageUrl: item.url,
          fallbackTitle: item.title || fallbackTitle || socialPage.title,
          page: socialPage,
          sourceLinkUrl: item.sourceLinkUrl || sourceLinkUrl || targetUrl,
          destinationFolderId,
        });
    results.push(result);
  }
  return {
    ...results[0],
    savedCount: results.length,
    usedFallback: results.some((result) => result.usedFallback),
  };
}

function isLikelySocialMediaUrl(value) {
  try {
    return /pbs\.twimg\.com|cdninstagram\.com|fbcdn\.net|tiktokcdn|tiktokcdn-us|pinimg\.com|cdn\.bsky\.app/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
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
    const videoValue = extractMeta(html, [
      "og:video:secure_url",
      "og:video:url",
      "og:video",
      "twitter:player:stream",
    ]);
    const resolvedPageUrl = response.url || pageUrl;
    const article = articleMetadataFromHtml(html);
    return {
      pageUrl: resolvedPageUrl,
      canonicalUrl: resolveUrl(extractLinkHref(html, "canonical"), resolvedPageUrl),
      title,
      description,
      siteName,
      ogImage: resolveUrl(imageValue, resolvedPageUrl),
      ogVideo: resolveUrl(videoValue, resolvedPageUrl),
      articleImage: resolveUrl(imageValue, resolvedPageUrl),
      ...article,
      images: [],
      videos: [],
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

function articlePlaceholder(page) {
  const title = escapeXml(page.title || "Saved page").slice(0, 110);
  const site = escapeXml(page.siteName || hostname(page.pageUrl) || "Website").slice(0, 70);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#efefec"/><circle cx="1060" cy="120" r="170" fill="#deded8"/><path d="M0 570C290 460 490 720 800 560s400-20 400-20v135H0z" fill="#e4e4df"/><text x="88" y="116" fill="#686862" font-family="system-ui,sans-serif" font-size="25" font-weight="600">${site}</text><text x="88" y="242" fill="#292927" font-family="system-ui,sans-serif" font-size="54" font-weight="600">${title}</text><text x="88" y="585" fill="#777770" font-family="system-ui,sans-serif" font-size="22">Saved with Koi</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

async function downloadCapture({ captureType, imageUrl, page, title, sourceLinkUrl, destinationFolderId }) {
  const extension = await inferExtension(imageUrl, captureType);
  const stem = captureStem(title, page.siteName || hostname(page.pageUrl));
  const imageFilename = `${CAPTURE_DIRECTORY}/${stem}.${extension}`;
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

  let destinationFolderName = "Koi Captures";
  try {
    const route = await routeCaptureToKoi({
      destinationFolderId: destinationFolderId || "",
      imageFilename: `${stem}.${extension}`,
      metadata,
    });
    destinationFolderName = route.folderName || destinationFolderName;
  } catch (error) {
    throw new Error(`The image is safe in Downloads/Koi Captures, but Koi could not store its source information: ${readableError(error)}`);
  }

  await writeLocal({
    lastCapture: {
      ...metadata,
      imageFilename,
      imageDownloadId: imageDownload.id,
      usedFallback: imageDownload.usedFallback,
      destinationFolderName,
    },
  });
  return {
    imageFilename,
    imageDownloadId: imageDownload.id,
    usedFallback: imageDownload.usedFallback,
    destinationFolderName,
  };
}

async function resolveContextMedia(capture) {
  if (capture.type === "KOI_CAPTURE_IMAGE") {
    const resolved = await resolveImage(capture.tabId, capture.imageUrl, capture.sourceLinkUrl);
    return { ...capture, ...resolved };
  }
  if (capture.type === "KOI_CAPTURE_VIDEO") {
    const resolved = await resolveVideo(capture.tabId, capture.videoUrl, capture.isGif);
    return { ...capture, ...resolved };
  }
  return capture;
}

async function resolveImage(tabId, imageUrl, sourceLinkUrl) {
  const originalFallback = platformOriginalUrl(imageUrl);
  if (typeof tabId !== "number") return { imageUrl: originalFallback, sourceLinkUrl: sourceLinkUrl || "" };
  try {
    const resolved = await chrome.tabs.sendMessage(tabId, { type: "KOI_RESOLVE_IMAGE", imageUrl });
    return {
      imageUrl: platformOriginalUrl(isDownloadableUrl(resolved?.imageUrl) ? resolved.imageUrl : originalFallback),
      sourceLinkUrl: resolved?.sourceLinkUrl || sourceLinkUrl || "",
    };
  } catch {
    return { imageUrl: originalFallback, sourceLinkUrl: sourceLinkUrl || "" };
  }
}

async function resolveVideo(tabId, videoUrl, isGif = false) {
  if (typeof tabId !== "number") return { videoUrl: isDownloadableUrl(videoUrl) ? videoUrl : "", isGif };
  try {
    const resolved = await chrome.tabs.sendMessage(tabId, { type: "KOI_RESOLVE_VIDEO", videoUrl });
    return {
      videoUrl: isDownloadableUrl(resolved?.videoUrl) ? resolved.videoUrl : (isDownloadableUrl(videoUrl) ? videoUrl : ""),
      isGif: !!resolved?.isGif || isGif,
    };
  } catch {
    return { videoUrl: isDownloadableUrl(videoUrl) ? videoUrl : "", isGif };
  }
}

function platformOriginalUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== "pbs.twimg.com") return url.href;
    if (url.searchParams.has("name")) url.searchParams.set("name", "orig");
    const profileMatch = url.pathname.match(/^(\/profile_images\/[^/]+\/[^/]+)_\w+(\.[a-z0-9]+)$/i);
    if (profileMatch) url.pathname = `${profileMatch[1]}${profileMatch[2]}`;
    return url.href;
  } catch {
    return value || "";
  }
}

async function readLocal(keys) {
  try {
    return await chrome.storage.local.get(keys);
  } catch {
    return {};
  }
}

async function writeLocal(value) {
  try {
    await chrome.storage.local.set(value);
  } catch (error) {
    throw new Error(`Koi could not save its extension state: ${readableError(error)}`);
  }
}

async function rememberCaptureError(error) {
  const message = readableError(error);
  try {
    await chrome.storage.local.set({ lastCaptureError: message });
  } catch {
    // The extension was reloaded while the old service worker was still finishing.
  }
}


async function readPage(tabId, fallback) {
  if (typeof tabId !== "number") return { ...fallback, images: [] };
  try {
    const page = await chrome.tabs.sendMessage(tabId, { type: "KOI_GET_PAGE" });
    return {
      ...fallback,
      ...page,
      images: page.images || fallback.images || [],
      videos: page.videos || fallback.videos || [],
    };
  } catch {
    return { ...fallback, siteName: hostname(fallback.pageUrl), images: [] };
  }
}

async function inferExtension(url, captureType) {
  const fromPath = extensionFromUrl(url);
  try {
    const response = await fetch(url, { method: "HEAD", credentials: "include" });
    const contentType = response.headers.get("content-type")?.split(";")[0].trim();
    return extensionFromMime(contentType) || fromPath || (["video", "gif"].includes(captureType) ? "mp4" : "jpg");
  } catch {
    return fromPath || (["video", "gif"].includes(captureType) ? "mp4" : "jpg");
  }
}

function extensionFromUrl(value) {
  const dataMime = typeof value === "string" ? value.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() : "";
  if (dataMime) return extensionFromMime(dataMime);
  try {
    const extension = new URL(value).pathname.split(".").pop()?.toLowerCase();
    return ["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp", "m4v", "mov", "mp4", "ogv", "webm"].includes(extension)
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
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/ogg": "ogv",
    "video/webm": "webm",
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
