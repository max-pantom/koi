---
name: app-showcase-studio
description: Capture authentic screenshots from a locally built desktop or web app, turn selected captures into tasteful studio-style product mockups, optimize the assets, and add a concise visual gallery to the project's README. Use when a user asks for app screenshots, README images, product mockups, launch visuals, studio mockups, or an aesthetic presentation of a real build.
---

# App Showcase Studio

Create launch-quality visuals without redesigning or misrepresenting the product.

## Workflow

1. Inspect the repository's build and launch scripts, README, existing image folders, and current working-tree changes.
2. Confirm whether the user authorized a build. Do not change versions unless explicitly requested.
3. Build the app in proportion to the requested fidelity. Use the production build for final screenshots when practical.
4. Create an image destination such as `docs/images/` or reuse the repository's established documentation asset folder.
5. Launch the real app and capture at least the primary library/home view and one distinguishing interaction such as search, command palette, detail view, or settings.
6. Inspect every capture visually before using it. Reject captures with permission dialogs, clipped windows, empty loading states, exposed private data, or unrelated desktop content.
7. Optimize real screenshots without making UI content less legible. Preserve an untouched PNG when future editing may be useful.
8. Generate one or two studio mockups using the selected screenshot as the reference image and the recipes in `references/prompt-recipes.md`.
9. Require the mockup to preserve the supplied UI, layout, proportions, colors, and text. The generated scene may change; the app interface may not.
10. Inspect generated mockups. If the UI is visibly fabricated or text is corrupted, iterate once with stricter preservation constraints or use the authentic screenshot only.
11. Add a compact README gallery near the introduction. Use descriptive alt text and repository-relative paths.
12. Run the project's relevant tests/build plus the skill validator when the skill itself changed.

## Capture Rules

- Prefer native screenshot utilities or the browser tooling already used by the project.
- On macOS, use `scripts/capture-macos-window.sh` when a fixed crop is sufficient.
- Set a deterministic window position and size before capturing.
- Capture only project data the user already put in scope.
- Never replace a real product screenshot with an invented UI mockup.
- Keep visible focus, menus, or overlays intentional. Close transient toasts unless they demonstrate the feature.
- Use PNG for authentic UI captures. Use optimized JPEG or WebP for photographic mockups when the repository supports them.

## README Rules

- Lead with one strong authentic screenshot.
- Put studio mockups after the real interface image so readers can distinguish product evidence from presentation art.
- Keep the gallery small: usually two to four images total.
- Do not add claims that the screenshots do not demonstrate.
- Record generated asset provenance in the commit or handoff, not as visible watermarks.

## Failure Handling

- If OS screenshot permission blocks capture, report the exact permission needed and leave the app running for the user to approve it.
- If automation cannot position the window, use an interactive/native capture or a browser screenshot rather than fabricating the UI.
- If image generation is unavailable, finish with polished real screenshots and a clean README gallery.
