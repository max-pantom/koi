import { describe, expect, it } from "vitest";
import { updaterProgress } from "../src/lib/updater";

describe("updater progress", () => {
  it("calculates bounded download progress", () => {
    const started = updaterProgress({ event: "Started", data: { contentLength: 1_000 } }, 0);
    const halfway = updaterProgress({ event: "Progress", data: { chunkLength: 500 } }, started.downloaded, started.contentLength);
    const finished = updaterProgress({ event: "Progress", data: { chunkLength: 800 } }, halfway.downloaded, halfway.contentLength);

    expect(started.value.percent).toBe(0);
    expect(halfway.value.percent).toBe(50);
    expect(finished.value.percent).toBe(100);
  });

  it("moves to installing when the download finishes", () => {
    expect(updaterProgress({ event: "Finished" }, 200, 200).value).toEqual({ phase: "installing", percent: 100 });
  });
});
