const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_INLINE_FALLBACK_BYTES = 64 * 1024 * 1024;

const DOWNLOAD_ERRORS = {
  FILE_FAILED: "Chrome could not write the file.",
  FILE_ACCESS_DENIED: "Chrome does not have permission to write to Downloads.",
  FILE_NO_SPACE: "There is not enough free space for this image.",
  FILE_NAME_TOO_LONG: "The generated capture filename is too long.",
  FILE_TOO_LARGE: "The image is too large for Chrome to save.",
  FILE_VIRUS_INFECTED: "Chrome blocked the file as unsafe.",
  FILE_BLOCKED: "Chrome blocked the file.",
  FILE_SECURITY_CHECK_FAILED: "Chrome could not verify the file.",
  NETWORK_FAILED: "The image request failed.",
  NETWORK_TIMEOUT: "The image request timed out.",
  NETWORK_DISCONNECTED: "The network disconnected while saving the image.",
  NETWORK_SERVER_DOWN: "The image server is unavailable.",
  NETWORK_INVALID_REQUEST: "The image server rejected the request.",
  SERVER_FAILED: "The website could not provide the image.",
  SERVER_NO_RANGE: "The website interrupted the image transfer.",
  SERVER_BAD_CONTENT: "The website returned an invalid image.",
  SERVER_UNAUTHORIZED: "The website requires a signed-in session for this image.",
  SERVER_CERT_PROBLEM: "The image website has a certificate problem.",
  USER_CANCELED: "The download was canceled.",
  USER_SHUTDOWN: "Chrome closed before the image finished saving.",
};

export async function downloadImageWithFallback({
  downloads,
  fetchImpl,
  url,
  filename,
  sourcePageUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  let directError;
  try {
    const id = await startAndWait(downloads, {
      url,
      filename,
      conflictAction: "overwrite",
      saveAs: false,
    }, timeoutMs);
    return { id, usedFallback: false };
  } catch (error) {
    directError = readableError(error);
  }

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      ...(isHttpUrl(sourcePageUrl) ? {
        referrer: sourcePageUrl,
        referrerPolicy: "strict-origin-when-cross-origin",
      } : {}),
    });
    if (!response.ok) throw new Error(`website returned ${response.status}`);

    const contentType = response.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      throw new Error(`website returned ${contentType}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) throw new Error("website returned an empty file");
    if (bytes.byteLength > MAX_INLINE_FALLBACK_BYTES) {
      throw new Error("image is larger than the 64 MB retry limit");
    }

    const id = await startAndWait(downloads, {
      url: bytesToDataUrl(bytes, contentType),
      filename,
      conflictAction: "overwrite",
      saveAs: false,
    }, timeoutMs);
    return { id, usedFallback: true };
  } catch (error) {
    throw new Error(`Chrome could not save this image. Direct download: ${directError} Retry: ${readableError(error)}`);
  }
}

export async function waitForDownload(downloads, id, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      downloads.onChanged.removeListener(onChanged);
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(id);
    };

    const inspect = ({ state, error }) => {
      if (error) finish(downloadError(error));
      else if (state === "complete") finish();
      else if (state === "interrupted") finish(new Error("The download was interrupted."));
    };

    const onChanged = (delta) => {
      if (delta.id !== id) return;
      inspect({ state: delta.state?.current, error: delta.error?.current });
    };

    downloads.onChanged.addListener(onChanged);
    timer = setTimeout(() => finish(new Error("The download did not finish within one minute.")), timeoutMs);

    void downloads.search({ id })
      .then(([item]) => {
        if (item) inspect({ state: item.state, error: item.error });
      })
      .catch(() => undefined);
  });
}

async function startAndWait(downloads, options, timeoutMs) {
  const id = await downloads.download(options);
  if (!Number.isInteger(id)) throw new Error("Chrome did not start the download.");
  return waitForDownload(downloads, id, timeoutMs);
}

function downloadError(code) {
  return new Error(DOWNLOAD_ERRORS[code] || `Chrome stopped the download (${code}).`);
}

function bytesToDataUrl(bytes, contentType) {
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function readableError(error) {
  return error instanceof Error ? error.message : String(error);
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}
