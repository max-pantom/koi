import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function candidates() {
  const source = await readFile(new URL("./video-candidates.js", import.meta.url), "utf8");
  const context = vm.createContext({
    URL,
    chrome: { runtime: { getManifest: () => ({ version: "0.3.0" }) } },
  });
  vm.runInContext(source, context);
  return context.KoiVideoCandidates;
}

test("resolves an X blob video to the largest requested MP4 variant", async () => {
  const { bestVideoUrl } = await candidates();
  const video = {
    currentSrc: "blob:https://x.com/example",
    src: "",
    getAttribute: () => "",
    querySelectorAll: () => [],
  };
  const entries = [
    { name: "https://video.twimg.com/ext_tw_video/1/vid/avc1/320x180/a.mp4", initiatorType: "video", startTime: 20 },
    { name: "https://video.twimg.com/ext_tw_video/1/vid/avc1/1280x720/a.mp4", initiatorType: "video", startTime: 10 },
  ];
  assert.equal(bestVideoUrl(video, "https://x.com/post", entries), entries[1].name);
});

test("prefers an AVC file over an AV1 file for desktop playback", async () => {
  const { bestVideoUrl } = await candidates();
  const video = {
    currentSrc: "blob:https://x.com/player",
    src: "",
    getAttribute: () => "",
    querySelectorAll: () => [],
  };
  const av1 = "https://video.twimg.com/ext_tw_video/1/vid/av01/1280x720/clip.mp4";
  const avc = "https://video.twimg.com/ext_tw_video/1/vid/avc1/1280x720/clip.mp4";
  assert.equal(bestVideoUrl(video, "https://x.com/post", [
    { name: av1, initiatorType: "video", startTime: 20 },
    { name: avc, initiatorType: "video", startTime: 10 },
  ]), avc);
});

test("prefers Instagram video resources over unrelated page MP4s", async () => {
  const { videoResourceUrls } = await candidates();
  const urls = videoResourceUrls([
    { name: "https://ads.example/trailer.mp4", initiatorType: "fetch", startTime: 50 },
    { name: "https://scontent.cdninstagram.com/o1/v/t16/video.mp4", initiatorType: "video", contentType: "video/mp4", startTime: 10 },
  ], "www.instagram.com");
  assert.equal(urls[0], "https://scontent.cdninstagram.com/o1/v/t16/video.mp4");
});

test("recognises looping muted social GIF players", async () => {
  const { looksLikeGifVideo } = await candidates();
  assert.equal(looksLikeGifVideo({ loop: true, muted: true, controls: false, getAttribute: () => "", closest: () => null }), true);
});
