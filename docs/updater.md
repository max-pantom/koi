# Koi automatic updates

Koi uses Tauri's signed updater and the latest GitHub Release as its update source.
macOS packages use an ad-hoc code-signing identity in addition to the updater signature, which prevents unsigned-bundle corruption warnings until an Apple Developer ID and notarization workflow are added.

## One-time GitHub setup

The updater public key is committed in `src-tauri/tauri.conf.json`. The matching private key was created outside the repository at `/Users/macbook/.tauri/koi.key`; its password is stored in the macOS Keychain under `Koi Tauri updater signing`. Back up both securely. Losing the private key prevents existing installs from accepting future updates.

Add these Actions secrets in **GitHub → max-pantom/koi → Settings → Secrets and variables → Actions**:

- `TAURI_SIGNING_PRIVATE_KEY`: the complete contents of `/Users/macbook/.tauri/koi.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the value returned by `security find-generic-password -a macbook -s 'Koi Tauri updater signing' -w`

Never commit either value or paste them into an issue, log, or release note.

## Publishing an update

1. Bump the same semantic version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Add `docs/release-notes/vX.Y.Z.md`.
3. Commit and push the change, then push the matching `vX.Y.Z` tag.
4. The release workflow builds each desktop target, signs updater artifacts, uploads them, and generates `latest.json`.
5. Publish the draft GitHub Release after checking its installers and `latest.json`.

Installed copies check the HTTPS endpoint automatically after launch. Users can also choose **Settings → Check for updates** or run the same action from the command menu. Koi only installs a bundle after its signature matches the public key embedded in the app.

## Local signed build

On this Mac, load the key and its Keychain password for a release build:

```sh
export TAURI_SIGNING_PRIVATE_KEY="$(cat /Users/macbook/.tauri/koi.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(security find-generic-password -a macbook -s 'Koi Tauri updater signing' -w)"
npm run build:mac
unset TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```
