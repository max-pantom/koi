# X bookmark sync exploration

## Recommendation

Build X bookmark import as an explicit, one-way sync into a dedicated Koi folder. Use X's official API rather than scraping the bookmarks page. Keep X credentials out of the Chrome extension and store refresh tokens in the operating system credential store when implementation begins.

## Why this route

- X exposes `GET /2/users/:id/bookmarks`, bookmark folders, pagination, and media expansions for the authenticated user.
- OAuth 2.0 PKCE requires `bookmark.read`, `tweet.read`, and `users.read`; no write permission is needed for one-way import.
- Bookmark reads are currently pay-per-use. Koi must show the expected scope and cost before the user connects an account.
- A local sync cursor should store only post IDs, update timestamps, and Koi media IDs. The source post remains the authority; deleting an item in Koi must not delete the X bookmark.

Official references: [X Bookmarks API](https://docs.x.com/x-api/posts/bookmarks/introduction), [Get Bookmarks](https://docs.x.com/x-api/users/get-bookmarks), [X API pricing](https://docs.x.com/x-api/getting-started/pricing).

## Agent-ready implementation slices

1. Add OAuth 2.0 PKCE in the desktop app and secure token storage.
2. Add a paginated bookmark client requesting post attachments, media URLs, authors, and bookmark folders.
3. Map every X bookmark folder to an optional Koi folder, with a default `X Bookmarks` inbox.
4. Reuse Koi's capture manifest for source URL, post text, author, media type, and original post ID.
5. Add manual `Sync now` first. Add background sync only after retry, rate-limit, cost, and disconnect controls are visible.

## Product gates

- Human approval before creating an X developer app or incurring API charges.
- A clear connect screen listing scopes and one-way behavior.
- No bookmark deletion or write-back in the first version.
- A disconnect action that removes tokens without deleting local captures.
