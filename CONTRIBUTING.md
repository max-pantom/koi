# Contributing to Koi

Thanks for helping make Koi better. Bug reports, ideas, documentation fixes, and code are all welcome.

## Before you start

- Check the [open issues](https://github.com/max-pantom/koi/issues) before creating a new one.
- For a larger change, open an issue first so we can agree on the direction.
- Keep each pull request focused on one change.

## Set up the project

You’ll need Node.js 22+, stable Rust, and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/max-pantom/koi.git
cd koi
npm ci
npm run tauri dev
```

To work on Koi Capture, load the `chrome-extension` folder as an unpacked extension from `chrome://extensions`.

## Check your work

Before opening a pull request, run:

```bash
npm test
npm run build
```

Please include tests for behavior changes, update relevant docs, and describe how you tested the change. Screenshots or short recordings are helpful for visual updates.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are licensed under the [MIT License](LICENSE).
