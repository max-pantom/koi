import { getKoiFolders } from "./koi-bridge.js";

const pagePreview = document.querySelector("#page-preview");
const previewPlaceholder = document.querySelector("#preview-placeholder");
const pageTitle = document.querySelector("#page-title");
const siteName = document.querySelector("#site-name");
const savePageButton = document.querySelector("#save-page");
const imageGrid = document.querySelector("#image-grid");
const imageCount = document.querySelector("#image-count");
const emptyImages = document.querySelector("#empty-images");
const status = document.querySelector("#status");
const bridgeState = document.querySelector("#bridge-state");
const destinationFolder = document.querySelector("#destination-folder");
const askEveryTime = document.querySelector("#ask-every-time");
const quickSaveFolder = document.querySelector("#quick-save-folder");

let page;
let folders = [];
let pendingContextCapture;

void initialise();

async function initialise() {
  await initialiseDestinations();
  const isContextWindow = new URLSearchParams(location.search).has("context");
  const pending = isContextWindow ? await chrome.storage.local.get("pendingContextCapture") : {};
  pendingContextCapture = pending.pendingContextCapture;
  if (pendingContextCapture) {
    renderPendingCapture(pendingContextCapture);
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("Open a website to capture it with Koi.");
    }
    page = await chrome.tabs.sendMessage(tab.id, { type: "KOI_GET_PAGE" });
    renderPage(page);
  } catch (error) {
    pageTitle.textContent = "This page cannot be captured";
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

function renderPendingCapture(capture) {
  page = capture.page;
  document.body.classList.add("is-context-capture");
  pageTitle.textContent = capture.type === "KOI_CAPTURE_IMAGE"
    ? capture.imageTitle || "Selected image"
    : capture.page?.title || "Selected page";
  siteName.textContent = capture.page?.siteName || hostname(capture.page?.pageUrl) || "Current page";
  savePageButton.disabled = false;
  savePageButton.textContent = capture.type === "KOI_CAPTURE_IMAGE" ? "Save selected image" : "Save page preview";
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
  } catch {
    bridgeState.textContent = "Open Koi to choose";
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
  siteName.textContent = metadata.siteName || hostname(metadata.pageUrl) || "Current page";
  savePageButton.disabled = !metadata.ogImage;

  if (metadata.ogImage) {
    pagePreview.src = metadata.ogImage;
    pagePreview.hidden = false;
    previewPlaceholder.hidden = true;
  }

  const images = metadata.images.slice(0, 12);
  imageCount.textContent = `${images.length}`;
  emptyImages.hidden = images.length > 0;
  imageGrid.replaceChildren(...images.map(imageButton));
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
    imageTitle: image.alt || page.title,
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
