# Koi performance audit

Audit date: 23 August 2026

## Scope and baseline

This audit covers the React render path, masonry virtualization, search, media decoding and color extraction, the Tauri IPC boundary, SQLite access, folder scanning, and filesystem watching. It is a code audit with a local build baseline—not a substitute for Instruments traces on representative 10,000- and 50,000-item libraries.

Current local baseline:

- 3,723 media items across 9 folders
- 2.2 MB SQLite database
- 17 saved articles containing about 17,000 characters of stored article text
- 316.8 KB production JavaScript (98.1 KB gzip)
- 30.5 KB production CSS (6.9 KB gzip)
- 18 MB macOS application bundle
- 14.7-second clean frontend build command in this environment; Vite's bundle phase took 5.3 seconds

The frontend bundle is already modest. The largest opportunities are runtime I/O, repeated whole-library work, and original-media decoding—not JavaScript download size.

## What is already efficient

- The grid renders only an overscanned visible window rather than thousands of DOM tiles.
- Scroll updates are coalesced with `requestAnimationFrame`, and resize work is throttled during sidebar motion.
- Visibility lookup uses binary search over monotonic positions.
- Images use lazy loading and asynchronous decoding.
- Natural-size measurements are batched once per animation frame.
- Folder scans read image dimensions from headers and defer full color decoding until an image becomes visible.
- Search preprocessing is cached by `MediaItem` identity.
- Folder database synchronization is wrapped in a transaction.

These are good foundations and should be retained while the bottlenecks below are removed.

## Priority findings

### P0 — remove repeated whole-library work

#### 1. Database migrations run on every database operation

`src-tauri/src/db.rs::connect` opens a new connection and calls `migrate`. That migration executes the table setup and attempts every historical `ALTER TABLE` statement, handling “duplicate column” errors, each time Koi reads a library, saves one color index, saves tags, copies an image, or deletes an item.

This is especially costly during first-time color indexing because every visible image creates another IPC call and database connection.

**Change:** initialize one managed SQLite connection (or a small pool) at application startup, run versioned migrations once using `PRAGMA user_version`, enable a sensible busy timeout, and reuse prepared statements for frequent writes.

**Acceptance target:** after startup, saving one color index should execute one update without schema queries or new connection setup.

#### 2. A single-item lookup reads and checks every item

`src-tauri/src/db.rs::read_item` calls `read_items`, deserializes the full library, performs `Path::is_file()` for every record, and then finds one ID. Copy, delete, and backend color extraction all pay that whole-library cost.

**Change:** query `where id = ?1 limit 1` and map that row directly. Keep missing-file verification separate from ordinary item lookup.

**Acceptance target:** item lookup time remains approximately constant as the library grows from 3,000 to 50,000 items.

#### 3. Folder synchronization is quadratic

`src-tauri/src/db.rs::sync_folder_media` linearly searches the existing vector for every scanned item, with another possible filename search. A folder of `n` items can therefore perform roughly `n²` comparisons.

**Change:** build hash maps keyed by ID and path, plus a filename-to-candidates map for moved-file recovery. Each scanned item should use constant-time lookups.

**Acceptance target:** synchronization scales close to linearly and a 50,000-item no-change rescan does not freeze the UI.

#### 4. File watcher bursts create threads and rescan entire folders

Every filesystem event calls `handle_change`, records a timestamp, and spawns a sleeping OS thread. A large copy can create many short-lived threads. After the debounce, the surviving event recursively rescans the entire folder and re-reads every image header.

**Change:** use one debounce worker/timer per watched folder. Coalesce event paths, then incrementally upsert or remove only changed files. Fall back to a full reconciliation only for ambiguous rename/overflow events.

**Acceptance target:** importing 1,000 files creates bounded background work, keeps idle CPU near zero, and emits at most one UI refresh batch every 100–250 ms.

### P1 — keep scrolling and indexing proportional to visible work

#### 5. Scrolling rebuilds a map for every library item

`MediaGrid` correctly virtualizes visible tiles, but its layout effect depends on `visible`. Every scroll update reconstructs `previousPositionsRef` from every layout position even when thumbnail columns have not changed. This reintroduces O(n) allocation into the scroll path.

**Change:** update the previous-position map only when the layout itself changes for an animation-relevant reason. Keep ordinary scroll changes out of the FLIP bookkeeping effect.

**Acceptance target:** scrolling performs no work proportional to total library size and has no main-thread tasks above 50 ms.

#### 6. Color indexing causes repeated array copies, renders, layouts, IPC calls, and writes

Each newly visible unindexed image independently updates the full React `items` array and persists through a separate IPC/database call. Since the `items` reference changes, the full masonry layout is rebuilt even though colors do not affect geometry.

**Change:** queue color results and apply them in batches. Add a backend `save_media_indexes` transaction. Separate geometry-changing media data from searchable metadata so a color update does not recompute positions.

**Acceptance target:** indexing 100 visible/overscanned images produces a small bounded number of React commits and one or a few database transactions.

#### 7. The grid decodes original full-resolution media

Virtualization limits DOM count, but each visible image still loads the original file. A few camera images can consume hundreds of megabytes after decode. Visible videos autoplay and the current two-viewport overscan can keep several decoders active.

**Change:** generate a disk thumbnail cache keyed by file identity, modification time, and requested size/DPR. Use originals only in focus view. Give videos poster thumbnails; play only the actually visible or focused video, and pause under reduced motion.

**Acceptance target:** grid memory is driven by thumbnail dimensions rather than source dimensions; scrolling through 4K/8K files has stable memory and no decode spikes.

#### 8. Every library response includes full article content

`get_library` selects and serializes `source_content_markdown` for every item although the grid rarely needs it. This increases SQLite work, IPC serialization, frontend memory, and first-search preprocessing as article collections grow.

**Change:** return a lightweight `MediaSummary` for the grid and load full article/source details by ID only when focus/reader view opens. Keep an indexed plain-text search projection separately if article-body search is required.

**Acceptance target:** startup IPC payload grows with compact metadata, not the total size of saved article bodies.

### P2 — make search and startup scale beyond the current library

#### 9. Search scans and sorts the full candidate set on every keystroke

The WeakMap cache avoids repeated normalization, but each query still scores every scoped item, can run edit-distance checks, and sorts all matches. Source fields can contain full article Markdown.

**Change:** first add `useDeferredValue` or a small input debounce so typing remains responsive. Then move large-library search to a worker or SQLite FTS5, retain deterministic field filters, cap fuzzy matching to sensible token lengths, and avoid indexing duplicate long fields.

**Acceptance target:** result updates under 50 ms for 10,000 items and under 100 ms for 50,000 items on the oldest supported Mac.

#### 10. Startup always rescans the capture folder

`loadLibrary` calls `ensure_capture_folder`, which recursively scans and synchronizes Koi Captures before `get_library`. Startup cost therefore grows with capture history even if nothing changed.

**Change:** ensure/create/register the directory without scanning it synchronously. Let the watcher reconcile changes, or scan in a background task using stored directory/file modification markers.

**Acceptance target:** warm startup does no recursive folder traversal before the first grid is visible.

#### 11. Capture manifests are rewritten as one pretty JSON document

Every metadata upsert reads the whole folder manifest and rewrites it. This is simple and portable but becomes increasingly expensive for a large capture folder.

**Change:** keep portability, but write compactly and batch consecutive changes. At larger scale, use one sidecar per asset or an append-only journal with periodic compaction and an exportable manifest snapshot.

#### 12. Unstable callback props defeat tile memoization

`App` creates several `MediaGrid` callbacks inline. They change on unrelated app renders, which changes `MediaGrid`'s memoized callbacks and causes all visible `MediaTile` components to fail their custom equality check.

**Change:** wrap grid handlers in `useCallback`, or pass stable store actions and move item-specific behavior into a memoized controller. Use React Profiler to verify only the previously and newly selected tiles render during selection changes.

## Recommended implementation order

### Phase 1 — low-risk wins

1. Add performance marks for startup, scan, DB read, search, layout, and first thumbnail.
2. Stop rebuilding the full FLIP position map on scroll.
3. Replace `read_item` with a direct SQL query.
4. Run migrations once and reuse a managed connection.
5. Stabilize grid callbacks and verify renders with React Profiler.

### Phase 2 — large-library correctness

1. Replace quadratic sync lookups with hash maps.
2. Replace watcher thread bursts/full rescans with incremental event batching.
3. Batch color-index state and database writes.
4. Split summary and detail IPC models.

### Phase 3 — media and search architecture

1. Add a persistent thumbnail/poster cache.
2. Move large-library search off the synchronous render path and evaluate SQLite FTS5.
3. Make capture manifest writes incremental or batched.

## Performance budgets

Measure on the oldest supported Mac and use p95 values after one warm-up run:

| Scenario | 10,000 items | 50,000 items |
| --- | ---: | ---: |
| Warm launch to usable grid | < 800 ms | < 2 s |
| Search response after input settles | < 50 ms | < 100 ms |
| Scroll frame time | < 16.7 ms | < 16.7 ms |
| Long main-thread tasks while scrolling | none > 50 ms | none > 50 ms |
| Capture visible after file completes | < 500 ms | < 750 ms |
| Idle CPU after indexing | < 1% | < 1% |

Memory budgets should be established after the thumbnail cache exists; without thumbnails, original image dimensions dominate memory too heavily for a meaningful library-size budget.

## Measurement plan

- Add a generated 10k/50k mixed-media fixture library that contains small, 4K, portrait, landscape, GIF, video, and saved-article cases.
- Record cold and warm startup with macOS Instruments Time Profiler and File Activity.
- Record React commits with React Profiler while scrolling, selecting, searching, and indexing first-seen items.
- Log scan counts, changed paths, DB query duration, IPC payload bytes, and thumbnail cache hit rate in development builds.
- Add repeatable Rust benchmarks for sync lookup and database mapping, plus JavaScript benchmarks for layout and search.
- Treat regressions beyond 10% as review failures once the baseline is stable.
