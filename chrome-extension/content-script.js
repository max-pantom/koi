(() => {
const SCRIPT_VERSION = chrome.runtime.getManifest().version;
if (globalThis.KoiContentScriptVersion === SCRIPT_VERSION) return;

const { bestImageUrl, imageIncludesUrl } = globalThis.KoiImageCandidates;
const { bestVideoUrl, looksLikeGifVideo, videoResourceUrls } = globalThis.KoiVideoCandidates;
const { extractArticleMarkdown } = globalThis.KoiArticleContent;
const { installXCaptureControls, statusUrlFromArticle } = globalThis.KoiXCaptureControls;
const { isSocialPostUrl, sameSocialPost, socialPlatform } = globalThis.KoiSocialPlatforms;

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
  const byline = metaContent('meta[name="author"]', 'meta[property="article:author"]');
  const ogImage = absoluteUrl(
    metaContent(
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ),
  );
  const articleContainer = globalThis.KoiArticleContent.bestArticleContainer(document);
  const articleTitle = articleContainer?.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
  const articleImage = Array.from(articleContainer?.querySelectorAll("img") || [])
    .map((image) => ({ url: bestImageUrl(image, document.baseURI), area: image.naturalWidth * image.naturalHeight }))
    .filter((image) => image.url && image.area >= 90_000 && !/profile_images|profile_pic|avatar/i.test(image.url))
    .sort((left, right) => right.area - left.area)[0]?.url || "";
  const images = Array.from(document.images)
    .map((image) => ({
      url: bestImageUrl(image, document.baseURI),
      displayUrl: absoluteUrl(image.currentSrc || image.src),
      alt: image.alt.trim(),
      title: image.title.trim(),
      linkUrl: absoluteUrl(image.closest("a[href]")?.getAttribute("href")),
      width: image.naturalWidth,
      height: image.naturalHeight,
      isInArticle: !!image.closest("article"),
    }))
    .filter((image) => image.url && image.width >= 120 && image.height >= 80)
    .filter((image) => !/instagram\.com$/i.test(location.hostname) || image.isInArticle)
    .sort((left, right) => right.width * right.height - left.width * left.height)
    .filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index)
    .slice(0, 40);
  const resourceEntries = performance.getEntriesByType("resource");
  const resourceVideos = videoResourceUrls(resourceEntries, location.hostname);
  const domVideos = Array.from(document.querySelectorAll("video"));
  const videos = domVideos
    .map((video, index) => ({
      url: bestVideoUrl(video, document.baseURI, resourceEntries) || resourceVideos[index] || "",
      poster: absoluteUrl(video.poster),
      title: video.getAttribute("aria-label")?.trim() || video.title.trim() || title,
      width: video.videoWidth || video.clientWidth,
      height: video.videoHeight || video.clientHeight,
      isGif: looksLikeGifVideo(video),
    }))
    .filter((video) => /^https?:\/\//i.test(video.url))
    .filter((video, index, all) => all.findIndex((candidate) => candidate.url === video.url) === index)
    .slice(0, 20);

  for (const [index, url] of resourceVideos.entries()) {
    if (videos.some((video) => video.url === url)) continue;
    const video = domVideos[index];
    videos.push({
      url,
      poster: absoluteUrl(video?.poster),
      title: video?.getAttribute("aria-label")?.trim() || video?.title.trim() || title,
      width: video?.videoWidth || video?.clientWidth || 0,
      height: video?.videoHeight || video?.clientHeight || 0,
      isGif: looksLikeGifVideo(video),
    });
    if (videos.length >= 20) break;
  }
  const videoPosters = new Set(videos.map((video) => video.poster).filter(Boolean));
  const captureImages = images.filter((image) => !videoPosters.has(image.url) && !videoPosters.has(image.displayUrl));

  const articleMarkdown = extractArticleMarkdown();
  return {
    pageUrl,
    canonicalUrl,
    title,
    description,
    byline,
    articleMarkdown,
    siteName,
    ogImage: ogImage || captureImages[0]?.url || "",
    articleImage,
    articleTitle,
    hasArticleSchema: hasArticleSchema(),
    hasArticleContainer: !!articleContainer?.matches?.("article, [itemprop='articleBody']"),
    articleParagraphCount: articleContainer?.querySelectorAll?.("p")?.length || 0,
    images: captureImages,
    videos,
  };
}

function socialMediaFor(targetUrl) {
  if (!isSocialPostUrl(targetUrl)) return { page: undefined, media: [] };
  const container = findSocialPostContainer(targetUrl);
  if (!container) return { page: undefined, media: [] };
  const entries = performance.getEntriesByType("resource");
  const videos = Array.from(container.querySelectorAll("video"))
    .map((video) => ({
      kind: "video",
      url: bestVideoUrl(video, document.baseURI, entries),
      poster: absoluteUrl(video.poster),
      title: socialPostTitle(container),
      isGif: looksLikeGifVideo(video),
    }))
    .filter((video) => /^https?:\/\//i.test(video.url));
  const videoPosters = new Set(videos.map((video) => video.poster).filter(Boolean));
  const images = Array.from(container.querySelectorAll("img"))
    .map((image) => ({
      kind: "image",
      url: bestImageUrl(image, document.baseURI),
      displayUrl: absoluteUrl(image.currentSrc || image.src),
      title: image.alt.trim() || socialPostTitle(container),
      sourceLinkUrl: targetUrl,
      area: (image.naturalWidth || image.clientWidth) * (image.naturalHeight || image.clientHeight),
    }))
    .filter((image) => /^https?:\/\//i.test(image.url) && image.area >= 24_000)
    .filter((image) => !/profile_images|profile_pic|avatar|emoji|icon/i.test(`${image.url} ${image.displayUrl}`))
    .filter((image) => !videoPosters.has(image.url) && !videoPosters.has(image.displayUrl));
  const media = [...videos, ...images]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 20);
  const base = pageMetadata();
  const title = socialPostTitle(container) || base.title;
  return {
    page: {
      ...base,
      pageUrl: targetUrl,
      canonicalUrl: targetUrl,
      title,
      siteName: base.siteName || socialPlatform(targetUrl),
      articleMarkdown: "",
      hasArticleSchema: false,
      hasArticleContainer: false,
      images: [],
      videos: [],
    },
    media,
  };
}

function findSocialPostContainer(targetUrl) {
  const matchingAnchor = Array.from(document.querySelectorAll("a[href]")).find((anchor) => (
    sameSocialPost(absoluteUrl(anchor.getAttribute("href")), targetUrl)
  ));
  const fromAnchor = matchingAnchor?.closest("article, [role='article'], [data-testid='tweet'], [data-e2e*='feed-item']");
  if (fromAnchor) return fromAnchor;
  if (!sameSocialPost(location.href, targetUrl)) return undefined;
  return document.querySelector("article, [role='article'], [data-testid='tweet'], main") || document.body;
}

function socialPostTitle(container) {
  return container.querySelector('[data-testid="tweetText"], h1, [data-e2e="browse-video-desc"]')
    ?.textContent?.replace(/\s+/g, " ").trim().slice(0, 180) || document.title;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "KOI_GET_PAGE") {
    sendResponse(pageMetadata());
    return false;
  }
  if (message?.type === "KOI_RESOLVE_VIDEO") {
    const videos = Array.from(document.querySelectorAll("video"));
    const requested = videos.find((video) => [video.currentSrc, video.src].includes(message.videoUrl)) || videos[0];
    sendResponse({
      videoUrl: bestVideoUrl(requested, document.baseURI, performance.getEntriesByType("resource")),
      isGif: looksLikeGifVideo(requested),
    });
    return false;
  }
  if (message?.type === "KOI_RESOLVE_SOCIAL_MEDIA") {
    sendResponse(socialMediaFor(message.targetUrl));
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

installXCaptureControls(async ({ article, video }) => {
  const allEntries = performance.getEntriesByType("resource");
  const startedAt = Number(video.dataset.koiCaptureStartedAt) || 0;
  const recentEntries = startedAt
    ? allEntries.filter((entry) => Number(entry.startTime) >= startedAt - 1200)
    : [];
  const videoUrl = bestVideoUrl(video, document.baseURI, recentEntries.length ? recentEntries : allEntries);
  const postUrl = statusUrlFromArticle(article, document.baseURI) || location.href;
  const postTitle = article.querySelector('[data-testid="tweetText"]')?.textContent?.replace(/\s+/g, " ").trim()
    || document.title;
  const settings = await chrome.storage.local.get("quickSaveFolderId");
  return chrome.runtime.sendMessage({
    type: "KOI_CAPTURE_VIDEO",
    videoUrl,
    videoTitle: postTitle,
    isGif: looksLikeGifVideo(video),
    destinationFolderId: settings.quickSaveFolderId || "",
    page: {
      ...pageMetadata(),
      pageUrl: postUrl,
      canonicalUrl: postUrl,
      title: postTitle,
      articleMarkdown: "",
      hasArticleSchema: false,
      hasArticleContainer: false,
      images: [],
      videos: [],
    },
  });
});
})();

function hasArticleSchema() {
  if (document.querySelector('meta[property="og:type"][content="article" i], meta[property^="article:"]')) return true;
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .some((script) => /"@type"\s*:\s*"(?:Article|NewsArticle|BlogPosting)"/i.test(script.textContent || ""));
}
