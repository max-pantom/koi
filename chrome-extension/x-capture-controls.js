(() => {
const SCRIPT_VERSION = chrome.runtime.getManifest().version;
if (globalThis.KoiXCaptureControlsVersion === SCRIPT_VERSION) return;

function isXHost(value) {
  const host = String(value || "").replace(/^www\./, "").toLowerCase();
  return host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");
}

function statusUrlFromHrefs(hrefs, base) {
  for (const value of hrefs) {
    try {
      const url = new URL(value, base);
      if (isXHost(url.hostname) && /\/[^/]+\/status\/\d+/.test(url.pathname)) {
        url.search = "";
        url.hash = "";
        return url.href;
      }
    } catch {
      // Ignore malformed links rendered by the host page.
    }
  }
  return "";
}

function statusUrlFromArticle(article, base) {
  return statusUrlFromHrefs(
    Array.from(article?.querySelectorAll?.('a[href*="/status/"]') || []).map((link) => link.getAttribute("href")),
    base,
  );
}

function installXCaptureControls(onCapture) {
  if (!isXHost(location.hostname) || typeof MutationObserver === "undefined") return () => undefined;
  installStyles();
  let frame;
  const scan = () => {
    frame = undefined;
    for (const article of document.querySelectorAll("article")) addControl(article, onCapture);
  };
  const queueScan = () => {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(scan);
  };
  const observer = new MutationObserver(queueScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueScan();
  return () => {
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}

function addControl(article, onCapture) {
  const video = article.querySelector("video");
  if (!video || article.querySelector("[data-koi-x-capture]")) return;
  if (!video.dataset.koiCaptureObserved) {
    video.dataset.koiCaptureObserved = "true";
    video.addEventListener("play", () => {
      video.dataset.koiCaptureStartedAt = String(performance.now());
    }, { passive: true });
  }
  const bookmark = article.querySelector('[data-testid="bookmark"], [data-testid="removeBookmark"]');
  const group = bookmark?.closest('[role="group"]') || actionGroup(article);
  if (!group) return;
  const slot = document.createElement("div");
  slot.className = "koi-x-capture-slot";
  slot.dataset.koiXCapture = "true";
  const button = document.createElement("button");
  button.className = "koi-x-capture-button";
  button.type = "button";
  button.title = "Save video to Koi";
  button.setAttribute("aria-label", "Save video to Koi");
  button.textContent = "K";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    setButtonState(button, "saving", "Saving video to Koi");
    try {
      const response = await onCapture({ article, video: article.querySelector("video") || video });
      if (!response?.ok) throw new Error(response?.error || "Koi could not save this video.");
      setButtonState(button, "saved", "Saved video to Koi");
      window.setTimeout(() => setButtonState(button, "idle", "Save video to Koi"), 2200);
    } catch (error) {
      setButtonState(button, "error", error instanceof Error ? error.message : String(error));
      window.setTimeout(() => setButtonState(button, "idle", "Save video to Koi"), 3600);
    }
  });
  slot.append(button);
  let anchor = bookmark;
  while (anchor?.parentElement && anchor.parentElement !== group) anchor = anchor.parentElement;
  if (anchor?.parentElement === group) group.insertBefore(slot, anchor);
  else group.append(slot);
}

function actionGroup(article) {
  return Array.from(article.querySelectorAll('[role="group"]'))
    .find((group) => group.querySelector('button[data-testid], [role="button"][data-testid]'));
}

function setButtonState(button, state, label) {
  button.dataset.state = state;
  button.disabled = state === "saving";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.textContent = state === "saved" ? "✓" : state === "error" ? "!" : "K";
}

function installStyles() {
  if (document.querySelector("#koi-x-capture-styles")) return;
  const style = document.createElement("style");
  style.id = "koi-x-capture-styles";
  style.textContent = `
    .koi-x-capture-slot { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; }
    .koi-x-capture-button { display: inline-grid; width: 34px; height: 34px; place-items: center; padding: 0; border: 0; border-radius: 999px; color: rgb(83, 100, 113); background: transparent; font: 600 12px/1 system-ui, sans-serif; cursor: pointer; transition: color 120ms ease-out, background-color 120ms ease-out, transform 120ms ease-out; }
    .koi-x-capture-button:hover, .koi-x-capture-button:focus-visible { color: rgb(39, 116, 90); background: rgba(39, 116, 90, 0.1); outline: none; }
    .koi-x-capture-button:focus-visible { box-shadow: 0 0 0 2px currentColor; }
    .koi-x-capture-button:active { transform: scale(0.96); }
    .koi-x-capture-button[data-state="saving"] { opacity: 0.62; }
    .koi-x-capture-button[data-state="saved"] { color: rgb(39, 116, 90); background: rgba(39, 116, 90, 0.12); }
    .koi-x-capture-button[data-state="error"] { color: rgb(198, 64, 64); background: rgba(198, 64, 64, 0.12); }
    @media (prefers-reduced-motion: reduce) { .koi-x-capture-button { transition: color 100ms linear, background-color 100ms linear; } }
  `;
  document.documentElement.append(style);
}

globalThis.KoiXCaptureControls = { installXCaptureControls, isXHost, statusUrlFromArticle, statusUrlFromHrefs };
globalThis.KoiXCaptureControlsVersion = SCRIPT_VERSION;
})();
