import { getKoiFolders } from "./koi-bridge.js";

const pagePreview = document.querySelector("#page-preview");
const pageTitle = document.querySelector("#page-title");
const siteName = document.querySelector("#site-name");
const savePageButton = document.querySelector("#save-page");
const imagesTab = document.querySelector("#images-tab");
const pageTab = document.querySelector("#page-tab");
const imagesPanel = document.querySelector("#images-panel");
const pagePanel = document.querySelector("#page-panel");
const imageGrid = document.querySelector("#image-grid");
const imageCount = document.querySelector("#image-count");
const emptyImages = document.querySelector("#empty-images");
const captureUnavailable = document.querySelector("#capture-unavailable");
const retryCaptureButton = document.querySelector("#retry-capture");
const status = document.querySelector("#status");
const bridgeState = document.querySelector("#bridge-state");
const destinationFolder = document.querySelector("#destination-folder");
const askEveryTime = document.querySelector("#ask-every-time");
const quickSaveFolder = document.querySelector("#quick-save-folder");

let page;
let folders = [];
let pendingContextCapture;
let activeTabId;

void initialise();

async function initialise() {
  const destinationsReady = initialiseDestinations();
  const isContextWindow = new URLSearchParams(location.search).has("context");
  const pending = isContextWindow ? await chrome.storage.local.get("pendingContextCapture") : {};
  pendingContextCapture = pending.pendingContextCapture;
  if (pendingContextCapture) {
    renderPendingCapture(pendingContextCapture);
    await destinationsReady;
    return;
  }
  await loadActivePage();
  await destinationsReady;
}

async function loadActivePage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("Open a website to capture it with Koi.");
    }
    activeTabId = tab.id;
    page = await readPageFromTab(tab.id);
    renderPage(page);
    captureUnavailable.hidden = true;
    imageGrid.hidden = false;
    imageCount.hidden = false;
    pageTab.disabled = false;
    setStatus("");
  } catch (error) {
    captureUnavailable.hidden = false;
    imageGrid.hidden = true;
    imageCount.hidden = true;
    pageTab.disabled = true;
    setStatus(readableCaptureError(error), true);
  }
}

async function readPageFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "KOI_GET_PAGE" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/receiving end does not exist|could not establish connection/i.test(message)) throw error;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["image-candidates.js", "content-script.js"],
    });
    return chrome.tabs.sendMessage(tabId, { type: "KOI_GET_PAGE" });
  }
}

retryCaptureButton.addEventListener("click", () => {
  void loadActivePage();
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "r" || (!event.metaKey && !event.ctrlKey) || event.altKey || event.shiftKey) return;
  event.preventDefault();
  if (typeof activeTabId === "number") void loadActivePage();
});

function renderPendingCapture(capture) {
  page = capture.page;
  document.body.classList.add("is-context-capture");
  showTab("page");
  pageTitle.textContent = capture.type === "KOI_CAPTURE_IMAGE"
    ? capture.imageTitle || "Selected image"
    : capture.page?.title || "Selected page";
  siteName.textContent = capture.page?.siteName || hostname(capture.page?.pageUrl);
  if (capture.type === "KOI_CAPTURE_IMAGE" && capture.imageUrl) {
    pagePreview.src = capture.imageUrl;
    pagePreview.hidden = false;
  }
  savePageButton.disabled = false;
  savePageButton.textContent = capture.type === "KOI_CAPTURE_IMAGE" ? "Save selected image" : "Save page or article";
}

async function initialiseDestinations() {
  const settings = await chrome.storage.local.get(["askEveryTime", "quickSaveFolderId", "lastFolderId"]);
  askEveryTime.checked = settings.askEveryTime !== false;
  try {
    folders = await getKoiFolders();
    const options = folders.map((folder) => {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.isCaptureInbox ? `${folder.name} · Inbox` : folder.name;
      return option;
    });
    destinationFolder.replaceChildren(...options.map((option) => option.cloneNode(true)));
    quickSaveFolder.replaceChildren(...options.map((option) => option.cloneNode(true)));
    destinationFolder.disabled = folders.length === 0;
    quickSaveFolder.disabled = folders.length === 0;
    const fallbackId = folders.find((folder) => folder.isCaptureInbox)?.id || folders[0]?.id || "";
    destinationFolder.value = validFolderId(settings.lastFolderId) || fallbackId;
    quickSaveFolder.value = validFolderId(settings.quickSaveFolderId) || fallbackId;
    await chrome.storage.local.set({
      lastFolderId: destinationFolder.value,
      quickSaveFolderId: quickSaveFolder.value,
    });
    bridgeState.textContent = folders.length === 1 ? "1 folder" : `${folders.length} folders`;
    bridgeState.classList.add("is-connected");
  } catch {
    bridgeState.textContent = "Open Koi";
    bridgeState.classList.remove("is-connected");
    destinationFolder.disabled = true;
    quickSaveFolder.disabled = true;
  }
  syncCaptureMode();
}

askEveryTime.addEventListener("change", async () => {
  syncCaptureMode();
  await chrome.storage.local.set({ askEveryTime: askEveryTime.checked });
});

destinationFolder.addEventListener("change", async () => {
  await chrome.storage.local.set({ lastFolderId: destinationFolder.value });
});

quickSaveFolder.addEventListener("change", async () => {
  await chrome.storage.local.set({ quickSaveFolderId: quickSaveFolder.value });
});

function syncCaptureMode() {
  destinationFolder.closest(".field").hidden = !askEveryTime.checked;
  quickSaveFolder.disabled = !folders.length;
}

function validFolderId(value) {
  return folders.some((folder) => folder.id === value) ? value : "";
}

function selectedDestinationFolderId() {
  return askEveryTime.checked ? destinationFolder.value : quickSaveFolder.value;
}

function renderPage(metadata) {
  pageTitle.textContent = metadata.title || "Untitled page";
  siteName.textContent = metadata.siteName || hostname(metadata.pageUrl);
  const previewUrl = metadata.ogImage || metadata.images?.[0]?.url;
  savePageButton.disabled = !previewUrl;

  if (previewUrl) {
    pagePreview.src = previewUrl;
    pagePreview.hidden = false;
  }

  const images = metadata.images.slice(0, 12);
  imageCount.textContent = `${images.length}`;
  emptyImages.hidden = images.length > 0;
  imageGrid.replaceChildren(...images.map(imageButton));
}

imagesTab.addEventListener("click", () => showTab("images"));
pageTab.addEventListener("click", () => showTab("page"));

for (const tab of [imagesTab, pageTab]) {
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === imagesTab ? pageTab : imagesTab;
    if (next.disabled) return;
    showTab(next === imagesTab ? "images" : "page");
    next.focus();
  });
}

function showTab(name) {
  const showImages = name === "images";
  imagesTab.classList.toggle("is-active", showImages);
  imagesTab.setAttribute("aria-selected", String(showImages));
  imagesTab.tabIndex = showImages ? 0 : -1;
  pageTab.classList.toggle("is-active", !showImages);
  pageTab.setAttribute("aria-selected", String(!showImages));
  pageTab.tabIndex = showImages ? -1 : 0;
  imagesPanel.hidden = !showImages;
  pagePanel.hidden = showImages;
}

function imageButton(image, index) {
  const button = document.createElement("button");
  button.className = "image-button";
  button.type = "button";
  button.setAttribute("aria-label", `Save ${image.alt || `image ${index + 1}`} to Koi`);

  const preview = document.createElement("img");
  preview.src = image.url;
  preview.alt = image.alt;
  preview.loading = "lazy";
  button.append(preview);
  button.addEventListener("click", () => saveImage(image, button));
  return button;
}

savePageButton.addEventListener("click", async () => {
  const message = pendingContextCapture ? {
    ...pendingContextCapture,
    destinationFolderId: selectedDestinationFolderId(),
  } : {
    type: "KOI_CAPTURE_PAGE",
    page,
    destinationFolderId: selectedDestinationFolderId(),
  };
  const saved = await runCapture(savePageButton, message);
  if (saved && pendingContextCapture) {
    await chrome.storage.local.remove("pendingContextCapture");
    window.setTimeout(() => window.close(), 550);
  }
});

async function saveImage(image, button) {
  await runCapture(button, {
    type: "KOI_CAPTURE_IMAGE",
    imageUrl: image.url,
    imageTitle: image.alt || image.title || page.title,
    sourceLinkUrl: image.linkUrl || "",
    page,
    destinationFolderId: selectedDestinationFolderId(),
  });
}

async function runCapture(button, message) {
  const previousLabel = button.textContent;
  button.disabled = true;
  if (button === savePageButton) button.textContent = "Saving…";
  const selectedFolder = folders.find((folder) => folder.id === message.destinationFolderId);
  setStatus(`Saving to ${selectedFolder?.name || "Koi Captures"}…`);

  try {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "Unable to save this capture.");
    setStatus(result.usedFallback
      ? `Saved to ${result.destinationFolderName}. Koi retried a blocked download.`
      : `Saved image and source info to ${result.destinationFolderName}.`);
    return true;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
    return false;
  } finally {
    button.disabled = false;
    if (button === savePageButton) button.textContent = previousLabel;
  }
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function hostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function readableCaptureError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/cannot access|extensions gallery cannot be scripted|chrome:\/\//i.test(message)) {
    return "Chrome does not allow extensions on this page. Open a website and try again.";
  }
  if (/receiving end does not exist|could not establish connection/i.test(message)) {
    return "Unable to connect to this page. Try again.";
  }
  return message;
}
