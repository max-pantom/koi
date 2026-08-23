---
name: project-mockup-studio
description: Turn authentic project materials into polished presentation mockups for software, websites, physical products, packaging, icons, and brand work. Use when someone wants launch visuals, portfolio mockups, contextual product scenes, device presentations, or marketing imagery for something they are building. Do not use to invent finished work when no source material exists.
---

# Project Mockup Studio

Create convincing presentation imagery while keeping the underlying work accurate and recognizable.

## Workflow

1. Inspect the project and identify its source-of-truth material: a running interface, screenshot, design export, product photograph, render, package artwork, icon, logo, or other supplied asset.
2. Classify the subject before choosing a scene: software interface, website, physical product, packaging, identity/graphic work, or icon.
3. Build, render, or capture the real project only when the user authorized it. Do not change versions, publish releases, or alter product content merely to create a mockup.
4. Inspect every source image. Reject loading states, permission dialogs, clipped content, private information, broken assets, and accidental desktop clutter.
5. Choose a context that supports the subject and the user's intended use. When the user did not specify a setting, create a restrained hero treatment and one contrasting contextual treatment.
6. Read [references/prompt-recipes.md](references/prompt-recipes.md) and adapt only the recipe matching the subject.
7. Generate or composite the mockup with the available image tool. Label each input image by role and state exactly what must remain unchanged.
8. Inspect the result at full size. Reject misspelled UI, altered logos, invented controls, distorted packaging, implausible perspective, unrelated props, and watermarks.
9. Make at most one focused correction per iteration. If fidelity remains poor, deliver the authentic source image instead of misrepresenting the project.
10. Save final assets in the project's established image/output folder, using descriptive filenames and an appropriate format. Keep an untouched PNG for source screenshots and use optimized JPEG or WebP for photographic mockups.

## Source Integrity

- Treat screenshots, artwork, labels, logos, product geometry, colors, and typography as invariants unless the user explicitly asks to redesign them.
- A mockup may change context, surface, lighting, camera angle, or surrounding environment; it may not silently change the work being presented.
- Use a real capture or export as evidence of the product. Clearly treat generated scenes as presentation art.
- For multiple source assets, say which is the base scene, which is inserted, and which are style references.
- Capture only project data the user placed in scope.

## Composition

- Match the canvas to its destination: repository gallery, portfolio, launch post, store listing, presentation, or social crop.
- Keep the subject legible and optically dominant. Use negative space only when copy or layout needs it.
- Prefer believable materials, reflections, contact shadows, scale, and perspective over decorative spectacle.
- Avoid arbitrary studio props, fake brand copy, extra logos, and visual effects that compete with the project.
- Provide different compositions through setting, framing, or material—not by redesigning the source.

## Delivery

- Report which outputs are authentic captures and which are generated mockups.
- Provide final file paths and the prompt used for each generated deliverable.
- Add assets to a README, site, deck, or release page only when the user asks or the requested deliverable clearly includes that destination.
- Run relevant project checks when capturing required a build, and validate this skill whenever its instructions change.

## Failure Handling

- If capture permissions are blocked, report the exact permission needed and preserve any usable source assets already available.
- If the project cannot be built, use supplied exports or ask for the missing source rather than fabricating a finished product.
- If image generation is unavailable, finish with polished authentic captures, clean crops, and an organized handoff.
