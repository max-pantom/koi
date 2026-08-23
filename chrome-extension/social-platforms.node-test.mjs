import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./social-platforms.js", import.meta.url), "utf8");
const context = vm.createContext({ URL });
vm.runInContext(source, context);
const social = context.KoiSocialPlatforms;

test("recognises supported social post links without matching home pages", () => {
  assert.equal(social.socialPlatform("https://x.com/koi/status/123?s=20"), "x");
  assert.equal(social.socialPlatform("https://www.instagram.com/reel/ABC123/"), "instagram");
  assert.equal(social.socialPlatform("https://www.tiktok.com/@koi/video/723456"), "tiktok");
  assert.equal(social.socialPlatform("https://www.facebook.com/reel/123456"), "facebook");
  assert.equal(social.socialPlatform("https://www.threads.net/@koi/post/ABC"), "threads");
  assert.equal(social.socialPlatform("https://bsky.app/profile/koi.social/post/3abc"), "bluesky");
  assert.equal(social.socialPlatform("https://www.pinterest.com/pin/123456/"), "pinterest");
  assert.equal(social.isSocialPostUrl("https://x.com/home"), false);
  assert.equal(social.isSocialPostUrl("https://www.pinterest.com/ideas/"), false);
});

test("matches equivalent X and Twitter post URLs", () => {
  assert.equal(
    social.sameSocialPost("https://x.com/koi/status/123/photo/1", "https://twitter.com/koi/status/123?s=20"),
    true,
  );
});
