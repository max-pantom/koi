import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

export type KoiUpdate = Update;

export type UpdateProgress = {
  phase: "downloading" | "installing";
  percent?: number;
};

export async function checkForKoiUpdate() {
  return check({ timeout: 12_000 });
}

export async function installKoiUpdate(
  update: KoiUpdate,
  onProgress: (progress: UpdateProgress) => void,
) {
  let downloaded = 0;
  let contentLength: number | undefined;
  await update.downloadAndInstall((event) => {
    const progress = updaterProgress(event, downloaded, contentLength);
    downloaded = progress.downloaded;
    contentLength = progress.contentLength;
    onProgress(progress.value);
  });
  onProgress({ phase: "installing", percent: 100 });
  await relaunch();
}

export function updaterProgress(event: DownloadEvent, downloaded: number, contentLength?: number) {
  if (event.event === "Started") {
    return {
      downloaded: 0,
      contentLength: event.data.contentLength,
      value: { phase: "downloading" as const, percent: event.data.contentLength ? 0 : undefined },
    };
  }
  if (event.event === "Progress") {
    const nextDownloaded = downloaded + event.data.chunkLength;
    return {
      downloaded: nextDownloaded,
      contentLength,
      value: {
        phase: "downloading" as const,
        percent: contentLength ? Math.min(100, Math.round((nextDownloaded / contentLength) * 100)) : undefined,
      },
    };
  }
  return {
    downloaded,
    contentLength,
    value: { phase: "installing" as const, percent: 100 },
  };
}
