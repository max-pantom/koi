export const CAPTURE_MANIFEST_FILENAME = "koi-manifest.json";

export function upsertCaptureManifest(existing, metadata) {
  const captures = existing?.captures && typeof existing.captures === "object" && !Array.isArray(existing.captures)
    ? { ...existing.captures }
    : {};
  captures[metadata.imageFilename] = metadata;
  return { schemaVersion: 1, captures };
}

export function removeCaptureFromManifest(existing, imageFilename) {
  const captures = existing?.captures && typeof existing.captures === "object" && !Array.isArray(existing.captures)
    ? { ...existing.captures }
    : {};
  delete captures[imageFilename];
  return { schemaVersion: 1, captures };
}
