const pagePreview = document.querySelector("#page-preview");
const previewPlaceholder = document.querySelector("#preview-placeholder");
const pageTitle = document.querySelector("#page-title");
const siteName = document.querySelector("#site-name");
const savePageButton = document.querySelector("#save-page");
const imageGrid = document.querySelector("#image-grid");
const imageCount = document.querySelector("#image-count");
const emptyImages = document.querySelector("#empty-images");
const status = document.querySelector("#status");

let page;

void initialise();

async function initialise() {
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
  await runCapture(savePageButton, { type: "KOI_CAPTURE_PAGE", page });
});

async function saveImage(image, button) {
  await runCapture(button, {
    type: "KOI_CAPTURE_IMAGE",
    imageUrl: image.url,
    imageTitle: image.alt || page.title,
    page,
  });
}

async function runCapture(button, message) {
  const previousLabel = button.textContent;
  button.disabled = true;
  if (button === savePageButton) button.textContent = "Saving…";
  setStatus("Saving to Downloads/Koi Captures…");

  try {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "Unable to save this capture.");
    setStatus(result.usedFallback
      ? "Saved image and source info. Koi retried a blocked download."
      : "Saved image and source info to Downloads/Koi Captures.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
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
