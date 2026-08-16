# Koi Capture for Chrome

Koi Capture is Koi’s local-first Manifest V3 browser extension. It saves images, GIFs, and page/article previews, then sends their source metadata directly to the Koi desktop app.

## Install from a release ZIP

1. Download and unzip the Koi Capture archive from the [Koi releases page](https://github.com/max-pantom/koi/releases).
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the unzipped `Koi-Capture-<version>` folder containing `manifest.json`.
6. Pin Koi Capture from Chrome’s Extensions menu.
7. Open Koi once. It creates and watches `Downloads/Koi Captures` automatically.

For development, choose this repository’s `chrome-extension` directory in step 5. After changing extension code, select **Reload** on its `chrome://extensions` card.

## Save a capture

- Select the toolbar button to browse the current page’s large images or save its page/article preview.
- Right-click an image, link, or page and choose **Save to Koi → Quick save** to use the default folder.
- Choose **Save to Koi → Choose folder…** to pick a Koi folder first.
- In the popup, keep **Ask every time** on to choose a destination for toolbar captures, or turn it off and select a default folder.

Koi preserves the original supported image format, including GIF, when the website exposes a downloadable media URL. If a CDN blocks the direct download, the extension retries through an authenticated fetch.

## How storage works

Downloaded media first lands in `Downloads/Koi Captures`. When Koi is open, its local bridge routes the capture into the selected managed folder. If Koi is closed or the selected folder is unavailable, the file remains safely in the capture inbox.

Each managed folder contains one `koi-manifest.json`. The manifest maps captured filenames to their metadata; the extension does not create a separate JSON sidecar for every image.

Stored provenance includes:

- Requested and final post-redirect media URLs
- Live page URL and canonical URL
- Destination link for a clickable image
- Page title, source title, site name, and description
- Capture type, capture time, and selected Koi folder

## Troubleshooting

- **Unable to read this page:** select **Reload page** in the popup or press `⌘R`/`Ctrl+R` while it is open.
- **Open Koi:** launch the desktop app, then reopen the extension popup.
- **Capture saved to the inbox:** add Chrome’s custom download location to Koi, or restore Chrome’s standard Downloads folder.
- **No downloadable images:** the page may use a canvas, protected media, a `blob:` URL, browser-internal content, or DRM.

## Test

From the repository root:

```bash
npm run test:extension
```
