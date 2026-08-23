import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageInfo = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const tauriConfig = JSON.parse(await readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"));
const cargoManifest = await readFile(new URL("src-tauri/Cargo.toml", root), "utf8");
const cargoVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const versions = {
  "package.json": packageInfo.version,
  "src-tauri/tauri.conf.json": tauriConfig.version,
  "src-tauri/Cargo.toml": cargoVersion,
};
const mismatched = Object.entries(versions).filter(([, version]) => version !== packageInfo.version);

if (mismatched.length) {
  const details = Object.entries(versions).map(([file, version]) => `${file}: ${version || "missing"}`).join("\n");
  throw new Error(`Koi version files are out of sync.\n${details}`);
}

console.log(`Koi ${packageInfo.version} version files are in sync.`);
