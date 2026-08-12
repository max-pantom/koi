# Koi Capture for Chrome

Koi Capture is a local-first Manifest V3 extension. It saves each image or page preview to `Downloads/Koi Captures` and writes a matching `.koi.json` sidecar containing the original image URL, page URL, page title, site name, capture type, and capture time.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this `chrome-extension` directory.
4. Open Koi. It creates and watches the standard `Downloads/Koi Captures` folder automatically. If Chrome uses a custom downloads location, add that location's `Koi Captures` folder to Koi once.

Use the popup to save a page's Open Graph preview or one of its large images. You can also right-click an image or page and select the Koi action.

## Capture format

A capture is a pair with the same filename stem:

```text
20260812T120000Z-abc-example-page.jpg
20260812T120000Z-abc-example-page.koi.json
```

Koi reads the sidecar during its normal folder scan. Websites that do not publish an Open Graph image fall back to the largest usable page image. Browser-internal pages, protected media, `blob:` URLs, canvases, and DRM content may not be downloadable.
