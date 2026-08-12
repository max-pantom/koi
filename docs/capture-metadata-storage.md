# Capture metadata storage options

Koi currently saves one JSON sidecar beside each captured image. That is portable and easy to inspect, but it adds a second visible file for every capture.

## Recommended: Koi database with optional export

Store capture source, page URL, image URL, title, timestamps, tags, and checksums in Koi's existing SQLite database. Keep the original image as the only visible file. Add an explicit “Export with metadata” action that produces sidecars only when portability is needed.

- Best day-to-day file experience
- Fast search and metadata updates
- Needs a database backup/export path so metadata can travel with the library

## Embedded XMP metadata

Write source fields into the image itself using XMP/IPTC fields.

- One portable file
- Works well for JPEG and TIFF
- Browser-oriented formats have uneven metadata support, and rewriting may alter the file or animation

## One manifest per folder

Store all capture records in a single hidden `.koi-library.json` file per managed folder, keyed by checksum or filename.

- Far less clutter than one sidecar per image
- Portable with the folder and easy to inspect
- Requires careful merging and atomic writes; renames still need checksum-based matching

## Extended file attributes

Store source data in macOS extended attributes.

- No visible companion files
- Metadata is commonly stripped by ZIP tools, cloud drives, copies, and non-macOS filesystems

## Suggested direction

Use SQLite as the source of truth, identify media by content checksum rather than path, and offer optional XMP or JSON export. This gives Koi a clean library now without locking metadata inside the app.
