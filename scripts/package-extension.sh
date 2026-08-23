#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "$0")/.." && pwd)"
extension_version="$(node -p "require('${repository_root}/chrome-extension/manifest.json').version")"
archive_name="Koi-Capture-${extension_version}"
staging_root="$(mktemp -d)"
archive_root="${staging_root}/${archive_name}"

cleanup() {
  rm -rf "${staging_root}"
}
trap cleanup EXIT

mkdir -p "${archive_root}" "${repository_root}/releases"
cp -R \
  "${repository_root}/chrome-extension/article-content.js" \
  "${repository_root}/chrome-extension/article-html.js" \
  "${repository_root}/chrome-extension/brand-mark.svg" \
  "${repository_root}/chrome-extension/capture-metadata.js" \
  "${repository_root}/chrome-extension/capture-kind.js" \
  "${repository_root}/chrome-extension/content-script.js" \
  "${repository_root}/chrome-extension/context-capture.js" \
  "${repository_root}/chrome-extension/downloads.js" \
  "${repository_root}/chrome-extension/fonts" \
  "${repository_root}/chrome-extension/icons" \
  "${repository_root}/chrome-extension/image-candidates.js" \
  "${repository_root}/chrome-extension/koi-bridge.js" \
  "${repository_root}/chrome-extension/manifest.json" \
  "${repository_root}/chrome-extension/popup.css" \
  "${repository_root}/chrome-extension/popup.html" \
  "${repository_root}/chrome-extension/popup.js" \
  "${repository_root}/chrome-extension/service-worker.js" \
  "${repository_root}/chrome-extension/social-platforms.js" \
  "${repository_root}/chrome-extension/video-candidates.js" \
  "${repository_root}/chrome-extension/x-capture-controls.js" \
  "${archive_root}/"

(
  cd "${staging_root}"
  COPYFILE_DISABLE=1 zip -qr "${repository_root}/releases/${archive_name}.zip" "${archive_name}"
)

printf '%s\n' "${repository_root}/releases/${archive_name}.zip"
