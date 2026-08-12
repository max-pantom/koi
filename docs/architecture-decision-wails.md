# ADR 0001: Keep Koi on Tauri

- Status: accepted
- Date: 2026-08-12
- Decision owner: Koi

## Decision

Keep the React frontend and Tauri 2/Rust backend. Do not rewrite Koi in Wails/Go during the redesign.

## Why

Koi already has working Tauri implementations for its highest-risk desktop concerns:

- SQLite migrations and local persistence
- recursive folder scanning and image metadata extraction
- live filesystem watchers
- native macOS menus, dialogs, drag/drop, Finder reveal, and window overlay configuration
- signed/bundled macOS application metadata and entitlements

Wails and Tauri both render the React interface in the operating system webview. Moving to Wails would therefore not make the toolbar, search, layout, or Open Graph cards inherently more native. It would replace the backend bridge and require the existing Rust functionality to be rewritten in Go before product work could continue.

The current `titleBarStyle: "Overlay"` and `trafficLightPosition` configuration already uses the native macOS window controls. The redesign only needs a correctly reserved toolbar area and drag/no-drag regions around those controls.

## Costs of changing now

The migration would need parity work for the database schema and existing user data, scanner/image decoding, watcher debouncing, native menus and shortcuts, Tauri commands/events, file dialogs, asset URLs, entitlements, packaging, and release validation. It would also introduce a second source of regressions while Koi is changing its interaction model.

## When to reconsider

Revisit Wails only if at least one of these becomes true:

1. Koi adopts a substantial Go-only library or service that cannot be cleanly integrated as a sidecar.
2. The maintainers are materially faster and safer in Go than Rust, and a time-boxed parity prototype demonstrates that advantage.
3. A measured Tauri limitation blocks a required platform feature after a minimal reproduction and upstream review.

Any future prototype must open the existing Koi database in place, scan the same large reference folder, preserve menus and shortcuts, reproduce native window behavior on each target OS, and compare signed bundle size, cold start, idle memory, and scan time before a migration is approved.

## References

- [Tauri process model](https://v2.tauri.app/concept/process-model/)
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri window configuration](https://v2.tauri.app/reference/config/)
- [Wails runtime](https://wails.io/docs/reference/runtime/intro/)
- [Wails architecture](https://v3.wails.io/concepts/architecture/)
