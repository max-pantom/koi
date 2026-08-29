// Builds the koi-mcp stdio bridge and places it where Tauri's externalBin
// bundling expects it: src-tauri/binaries/koi-mcp-<target-triple>.
// Runs as part of `beforeBuildCommand`, before cargo bundles the app.
//
// Set KOI_SIDECAR_TARGET to cross-compile (e.g. CI passes the same triple
// as tauri's --target argument); it defaults to the host triple.

import { copyFile, mkdir, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcTauri = path.join(root, "src-tauri");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function hostTriple() {
  const line = execFileSync("rustc", ["-vV"], { encoding: "utf8" })
    .split("\n")
    .find((line) => line.startsWith("host:"));
  const triple = line?.slice("host:".length).trim();
  if (!triple) throw new Error("Could not determine the Rust target triple.");
  return triple;
}

const triple = process.env.KOI_SIDECAR_TARGET || hostTriple();
const isWindows = triple.includes("windows");
const binaryName = isWindows ? "koi-mcp.exe" : "koi-mcp";

const cargoArgs = ["build", "--release", "--bin", "koi-mcp"];
if (triple !== hostTriple()) cargoArgs.push("--target", triple);
execFileSync("cargo", cargoArgs, { cwd: srcTauri, stdio: "inherit" });

const built = path.join(srcTauri, "target", ...(triple !== hostTriple() ? [triple] : []), "release", binaryName);
if (!(await exists(built))) {
  throw new Error(`cargo did not produce ${path.relative(root, built)}`);
}

const binariesDir = path.join(srcTauri, "binaries");
await mkdir(binariesDir, { recursive: true });
await copyFile(built, path.join(binariesDir, `koi-mcp-${triple}${isWindows ? ".exe" : ""}`));

console.log(`Sidecar placed at binaries/koi-mcp-${triple}${isWindows ? ".exe" : ""}`);
