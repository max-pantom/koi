# Koi automatic updates

Koi uses Tauri's signed updater and the latest GitHub Release as its update source.
macOS packages use an ad-hoc code-signing identity in addition to the updater signature, which prevents unsigned-bundle corruption warnings until an Apple Developer ID and notarization workflow are added.

## Current status

The application-side updater is implemented: Koi checks after launch, supports a manual check in Settings and Command K, downloads with progress, verifies the updater signature, installs, and relaunches. The repository also contains `.github/workflows/build-macos.yml`, which builds macOS, Windows, and Linux packages and asks `tauri-action` to create the signed updater files and `latest.json`.

Two GitHub Actions secrets are still required. A real end-to-end update test also requires publishing a version newer than the installed 0.2.0 build.

## One-time GitHub setup

The updater public key is committed in `src-tauri/tauri.conf.json`. The matching private key was created outside the repository at `/Users/macbook/.tauri/koi.key`; its password is stored in the macOS Keychain under `Koi Tauri updater signing`. Back up both securely. Losing the private key prevents existing installs from accepting future updates.

Add these Actions secrets in **GitHub → max-pantom/koi → Settings → Secrets and variables → Actions**:

- `TAURI_SIGNING_PRIVATE_KEY`: the complete contents of `/Users/macbook/.tauri/koi.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the value returned by `security find-generic-password -a macbook -s 'Koi Tauri updater signing' -w`

Never commit either value or paste them into an issue, log, or release note.

In **GitHub → Settings → Actions → General**, also ensure Actions are enabled and **Workflow permissions** allows read and write access. The workflow declares `contents: write`, which it needs to create a draft release and upload assets.

The GitHub website is the simplest setup on this Mac because the `gh` CLI is not currently installed. If you later install and authenticate it (`brew install gh`, then `gh auth login`), the equivalent secret commands are:

```sh
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo max-pantom/koi < /Users/macbook/.tauri/koi.key
security find-generic-password -a macbook -s 'Koi Tauri updater signing' -w \
  | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo max-pantom/koi
```

These commands send the values directly to GitHub and do not print them.

## Publishing an update

1. Choose a version greater than the currently published version, for example `0.2.1`.
2. Bump the same semantic version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
3. Run `npm run check:versions` and `npm test`.
4. Add `docs/release-notes/v0.2.1.md` (replace the example version as needed).
5. Commit the release, then create and push its tag:

   ```sh
   git push origin main
   git tag -a v0.2.1 -m "Koi 0.2.1"
   git push origin v0.2.1
   ```

6. Open **GitHub → Actions → Build desktop release** and watch all platform jobs. The tag push triggers it automatically.
7. Open the draft release and verify it contains installers, updater archives, `.sig` files, and `latest.json`.
8. Inspect `latest.json`: its version must match the tag, every platform URL must point to an uploaded asset, and every updater entry must contain a signature.
9. Publish the draft release. Draft assets are not served by the `/releases/latest/download/latest.json` endpoint, so installed copies cannot see the update until publication.

Installed copies check the HTTPS endpoint automatically after launch. Users can also choose **Settings → Check for updates** or run the same action from the command menu. Koi only installs a bundle after its signature matches the public key embedded in the app.

If a build job needs to be rerun without making another tag, use **Run workflow** and enter the existing tag (for example `v0.2.1`) in `release_tag`. Do not reuse a published version for different application code; updater versions should move forward monotonically.

## First end-to-end test

1. Keep the installed `/Applications/Koi.app` at version 0.2.0.
2. Complete the two-secret GitHub setup.
3. Publish a signed 0.2.1 draft using the steps above.
4. In Koi 0.2.0, open **Settings → Check for updates**.
5. Confirm the update is offered, the download reaches 100%, Koi relaunches, and Settings reports 0.2.1.
6. Confirm the library, folders, theme, sidebar preference, and capture settings remain intact.

The updater signature and macOS application signature solve different problems. Tauri's updater signature is already configured and is mandatory for accepting update archives. For a frictionless public macOS release, Koi still needs an Apple Developer Program **Developer ID Application** certificate and Apple notarization; ad-hoc signing is suitable for local testing but does not replace notarization.

Back up the private updater key and its password in two secure locations. If the private key is lost, existing installations that trust its public key cannot accept newly signed updates.

Official references: [Tauri updater](https://v2.tauri.app/plugin/updater/), [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action), and [macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/).

## Local signed build

On this Mac, load the key and its Keychain password for a release build:

```sh
export TAURI_SIGNING_PRIVATE_KEY="$(cat /Users/macbook/.tauri/koi.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(security find-generic-password -a macbook -s 'Koi Tauri updater signing' -w)"
npm run build:mac
unset TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```
