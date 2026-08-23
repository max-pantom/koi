# Koi feature opportunities

Research date: 23 August 2026

This is a product-direction document, not a promise that every idea will ship. The research is qualitative: it looks for repeated workflow failures in artist, designer, Pinterest, PureRef, and image-library communities. Reddit and forum posts are useful evidence of pain, but they are not market-size estimates. Validate the highest-ranked ideas with Koi users before building the expensive ones.

## What people are struggling with

### 1. References are scattered across apps and devices

Artists describe years of ideas split between Pinterest, Instagram, Twitter/X, screenshots, notebooks, and hard drives. The problem is not merely storage; it is remembering where something was saved and recovering the context around it. ([ArtistLounge discussion](https://www.reddit.com/r/ArtistLounge/comments/1sftmxj/how_do_you_organise_references_and_prepare_for/), [cross-platform clipping discussion](https://www.reddit.com/r/ProductivityApps/comments/1u9fvgi/app_for_orgnizing_clipped_or_shared_content_fom/))

**Koi opportunity:** become the one local inbox for files, clipboard content, and social/web captures. Every capture should retain the original asset, source URL, creator/handle when available, capture date, and the page it came from.

### 2. Saving and organizing interrupt the creative flow

One artist described repeatedly switching from the creative app to a browser, finding an image, dragging it into PureRef, resizing it, and returning to work—sometimes losing time in the browser along the way. ([LearnConceptArt discussion](https://www.reddit.com/r/LearnConceptArt/comments/1u00xni/i_wanted_pureref_eagle_and_chrome_to_be_one_thing/))

**Koi opportunity:** make capture a one-action background operation. Add a compact capture inbox, reliable progress/retry states, automatic duplicate checks, and a quick “file later” path. Do not force folder/tag decisions at capture time.

### 3. Source and authorship disappear

People want the high-resolution source, artist name, notes, and usage context attached to an image. Editing metadata manually is described as tedious, while some reference tools cannot consistently recover the original browser URL. ([ArtistLounge request](https://www.reddit.com/r/ArtistLounge/comments/12wqurf/organization_tools_for_references/), [PureRef source-link discussion](https://www.pureref.com/forum/read.php?3%2C3665=), [DataHoarder source-backup request](https://www.reddit.com/r/DataHoarder/comments/16sunp5/downloading_pinterest_board_but_not_just_images_i/))

**Koi opportunity:** treat provenance as first-class data. Show “saved from,” creator, canonical link, and capture time in the inspector; preserve them in exports; warn when only a thumbnail was captured; and offer “find original / replace with higher quality.”

### 4. Users do not trust hosted collections to remain available

Pinterest users are backing up years of boards because pins, boards, or accounts may disappear. Existing download tools often save images without notes or source links, leaving an incomplete archive. ([Pinterest backup discussion](https://www.reddit.com/r/Pinterest/comments/1b9ipzv/how_to_back_up_boards/), [data export discussion](https://www.reddit.com/r/Pinterest/comments/1kwu1nc/how_do_you_back_up_pinterest_boards/), [mass-download discussion](https://www.reddit.com/r/Pinterest/comments/1kbqya3/best_way_to_mass_download_pins/))

**Koi opportunity:** provide a portable backup format containing original media, folders/collections, tags, notes, and provenance. A user should be able to restore the library without Koi and inspect the metadata as ordinary JSON/CSV files.

### 5. Search quality and synthetic-content noise are eroding inspiration tools

Artists report difficulty finding reliable real-world references amid generated images. Pinterest users repeatedly complain about irrelevant results, ads, dead-end links, and an inability to reliably filter AI-generated content. ([ArtistLounge reference-search discussion](https://www.reddit.com/r/ArtistLounge/comments/1m2kbf9/where_to_find_good_reference_images_these_days/), [Pinterest search discussion](https://www.reddit.com/r/Pinterest/comments/1jbzlsc/search_functionally_unusable/), [Pinterest quality discussion](https://www.reddit.com/r/Pinterest/comments/1j65jr9/this_app_is_becoming_a_mess_failure_frustrations/))

**Koi opportunity:** keep search deterministic and user-controlled. Combine filename, folder, tags, notes, source domain, creator, media type, color, dimensions, and capture date. Later, add optional “likely generated” and “verified source” labels, but never silently hide content or make an opaque model the only search path.

### 6. Large libraries become a tagging chore

People accumulate thousands of references and then face a large manual cleanup. Some resort to putting tags in filenames; others say one giant canvas becomes hard to navigate. ([reference-organization discussion](https://www.reddit.com/r/ArtistLounge/comments/yo05p0/how_do_you_organize_your_reference_images/), [reference-manager request](https://www.reddit.com/r/ArtistLounge/comments/1p77bik/a_good_software_to_keep_my_references/))

**Koi opportunity:** add an inbox and batch triage rather than asking for perfect taxonomy. Useful automation includes duplicate groups, recently added, untagged, missing source, low resolution, and “more like this.” Suggested tags should be optional, editable, and preferably computed on-device.

### 7. Desktop-only libraries are inaccessible at the moment of inspiration

An Eagle user praised its organization but called the lack of built-in cross-device access a deal-breaker because references were unavailable on iPad away from the computer. ([ArtistLounge discussion](https://www.reddit.com/r/ArtistLounge/comments/1athl47/what_do_you_use_to_store_your_art_inspiration/))

**Koi opportunity:** design a portable library before building a proprietary cloud. First support libraries in user-chosen sync folders and robust conflict handling. Later consider a read-only mobile companion or optional end-to-end encrypted sync.

### 8. Metadata lock-in makes switching tools risky

Users have noted that tags and comments created in some library apps are not written back to standard file metadata, and separate libraries cannot always be searched together. ([Outliner Software discussion](https://www.outlinersoftware.com/topics/viewt/9415))

**Koi opportunity:** use open sidecar metadata, predictable folders, and complete export/import. Koi should make leaving easy; that confidence makes adopting it easier too.

## Recommended roadmap

### P0 — trust and capture reliability

1. **Capture health center** — queued, downloading, completed, failed, retry, and the exact failure reason.
2. **Original-media guarantee** — distinguish an original image/video from a thumbnail or saved page; allow replacement with a better asset.
3. **Provenance inspector** — source page, direct asset URL, creator/handle, capture time, and one-click open/copy.
4. **Portable backup and restore** — media plus a readable metadata manifest; verify the backup before reporting success.
5. **Duplicate review** — exact hashes first, then perceptual “looks the same” groups with a safe keep/delete review.

These reinforce Koi's strongest position: the user owns a dependable local copy, not a fragile bookmark.

### P1 — retrieval without maintenance work

1. **Smart collections** — untagged, missing source, duplicates, low resolution, recent, videos, screenshots, and saved searches.
2. **Fast batch triage** — accept/reject, move, tag, and delete with keyboard actions; undo every destructive batch.
3. **Notes and annotations** — searchable notes attached to an item, plus lightweight visual callouts for composition or detail studies.
4. **Richer search** — dimensions, orientation, date, domain, creator, media kind, color, and boolean filters in the command-style search.
5. **OCR** — on-device text extraction for posters, UI screenshots, slides, and scanned references.

### P2 — creative workflows

1. **Temporary project boards** — place library items on a freeform canvas without duplicating the underlying files.
2. **Compare mode** — pin two to four references, zoom/pan together, sample colors, and inspect dimensions.
3. **Source-quality tools** — reverse-search handoff, broken-link checks, and “replace with higher resolution” while retaining metadata.
4. **Importers** — migrate Pinterest exports and common folder/sidecar formats while preserving board structure and source links where the export contains them.
5. **Session history** — recently viewed, recently copied, and “return to the references used for this project.”

### P3 — access and collaboration

1. **User-chosen sync folder support** with explicit conflict handling and repair tools.
2. **Read-only mobile companion** for browsing, searching, and sending new captures to the desktop inbox.
3. **Shareable project packages** with embedded assets or permission-aware source links.
4. **Optional encrypted Koi sync** only after local backup, restore, and conflict recovery are proven reliable.

## Suggested next release slice

For the release after 0.2, keep the scope coherent:

- Capture health center with retry
- Exact and perceptual duplicate review
- Provenance inspector with original/thumbnail status
- Portable library backup with a JSON manifest
- Smart collections for recent, untagged, missing-source, and low-resolution items

This slice solves one complete job: **capture a reference, trust that Koi kept the real thing and its origin, and find it again without hand-organizing everything.**

## Product rules to protect

- Local-first by default; accounts are never required for core use.
- Original files and metadata remain readable outside Koi.
- No ads or engagement feed.
- AI features are optional, labeled, and reversible; deterministic filters stay available.
- Capture is fast, but failures are visible and recoverable.
- Destructive cleanup always has preview and undo.
- Performance targets should include libraries of 10,000, 50,000, and 100,000 mixed-media items.

## Validation questions

Before committing to P2 or P3, interview at least five active reference-library users and test these questions:

1. What was the last reference you could not find, and where had you saved it?
2. What information besides the image would have made it useful again?
3. Which loss is worse: the media, its source, its organization, or your notes?
4. At capture time, what is the maximum organization work you will actually do?
5. Which device do you have when inspiration appears, and which device do you use during creation?
6. Would a user-chosen iCloud/Dropbox folder solve access, or do you need a dedicated mobile app?
7. Which library size first makes the current workflow slow or overwhelming?
