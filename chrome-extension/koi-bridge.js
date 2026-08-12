export const KOI_BRIDGE_URL = "http://127.0.0.1:48371/v1";

export async function getKoiFolders(fetchImpl = fetch) {
  const response = await fetchImpl(`${KOI_BRIDGE_URL}/folders`, {
    method: "GET",
    cache: "no-store",
    headers: { "X-Koi-Client": "chrome-extension" },
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(payload.error || "Koi could not share its folders.");
  return Array.isArray(payload.folders) ? payload.folders : [];
}

export async function routeCaptureToKoi({
  destinationFolderId,
  imageFilename,
  sidecarFilename,
  fetchImpl = fetch,
}) {
  if (!destinationFolderId) return { routed: false, folderName: "Koi Captures" };
  const response = await fetchImpl(`${KOI_BRIDGE_URL}/captures/route`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Koi-Client": "chrome-extension",
    },
    body: JSON.stringify({ destinationFolderId, imageFilename, sidecarFilename }),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(payload.error || "Koi could not route this capture.");
  return payload;
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
