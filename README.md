# Koi

Koi is a fast, local-first moodboard for image folders. It keeps your references on your computer, supports still images and GIFs, and adds search, tags, color palettes, saved-page provenance, and keyboard navigation without requiring an account or cloud sync.

The optional Koi Capture browser extension saves images, GIFs, pages, and articles from Chrome into Koi with their original source information.

## Install Koi

### macOS

1. Open the [Koi releases page](https://github.com/max-pantom/koi/releases).
2. Download the macOS `.dmg` for your Mac:
   - `aarch64` or `arm64` for Apple Silicon (M1 and newer).
   - `x64` or `x86_64` for an Intel Mac.
3. Open the DMG and drag Koi into **Applications**.
4. Open Koi and select **Add folder** to add your first image folder.

If macOS blocks an unsigned development build, open **System Settings → Privacy & Security** and select **Open Anyway** for Koi. Only bypass this warning for a build you downloaded from this repository.

### Windows and Linux

Download the installer for your operating system from the [Koi releases page](https://github.com/max-pantom/koi/releases):

- Windows: `.msi` or `.exe`
- Linux: `.AppImage` or `.deb`

Platform builds are produced independently, so a release may not contain every format yet.

## Install Koi Capture

Koi Capture is currently installed as an unpacked Chrome extension:

1. Download the extension ZIP from the [Koi releases page](https://github.com/max-pantom/koi/releases), then unzip it.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the unzipped `Koi-Capture-<version>` folder—the folder containing `manifest.json`.
6. Pin **Koi Capture** from Chrome’s Extensions menu.
7. Open the Koi desktop app once so it can create and watch `Downloads/Koi Captures`.

The extension and desktop app work together locally. The extension downloads the media, then sends its source details to Koi. If Koi is closed, the capture remains in `Downloads/Koi Captures` and appears after Koi opens and scans the folder.

## Capture from Chrome

- Select the Koi Capture toolbar button to browse large images on the current page or save the page/article preview.
- Right-click an image, link, or page and choose **Save to Koi → Quick save** to use your default folder.
- Choose **Save to Koi → Choose folder…** to select a destination before saving.
- Koi preserves GIF files when the website exposes the original GIF URL.

Some browser-internal pages, protected media, canvases, `blob:` URLs, and DRM content cannot be downloaded by an extension.

## What Koi supports

- Local folders as independent moodboards
- JPEG, PNG, GIF, WebP, AVIF, SVG, TIFF, BMP, HEIC, and HEIF references
- Packed and aligned virtualized grids for large libraries
- Tags and smart search across filenames, folders, colors, and source metadata
- Extracted color swatches with copyable hex values
- Saved pages and articles with a clear **Saved page** label and source link
- One `koi-manifest.json` per managed folder for capture metadata
- Quick Look, keyboard navigation, copy, reveal, and move-to-Trash actions

## Build from source

Requirements: Node.js 22+, Rust stable, and the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm ci
npm test
npm run tauri dev
```

Create a production bundle with:

```bash
npm run tauri -- build
```

Version numbers live in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. The installed version is also shown at the bottom of Koi’s Settings window.

Creating a tag such as `v0.1.10` runs the release workflow and prepares a draft GitHub release containing the desktop installers and the packaged Chrome extension.

## Project structure

```text
src/                 React desktop interface
src-tauri/           Rust/Tauri desktop backend
chrome-extension/    Manifest V3 browser extension
docs/                Architecture and release notes
```

See [chrome-extension/README.md](chrome-extension/README.md) for extension internals and troubleshooting.
