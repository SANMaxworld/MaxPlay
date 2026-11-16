import test from "node:test";
import assert from "node:assert/strict";
import { SmartStreamService } from "./smartStreamService";

const TEST_STREAMTAPE_URL =
  "https://streamtape.com/v/6kjz8WP38qT9AKg/Crayon_Shin-chan_the_Movie_Super_Hot%21_The_Spicy_Kasukabe_Dancers_%282025%29_1080p_BluRay_x264_Dual_Audio_Hindi_Japanese_-_MoviesMod.Blue.mkv";

test("isExtractableSource detects Streamtape watch/embed URLs even with .mkv slug, while treating direct CDN/proxy URLs as playable", () => {
  assert.equal(SmartStreamService.isExtractableSource(TEST_STREAMTAPE_URL), true);
  assert.equal(
    SmartStreamService.isExtractableSource("https://streamtape.com/e/6kjz8WP38qT9AKg/video.mp4"),
    true
  );
  assert.equal(
    SmartStreamService.isExtractableSource("https://strtape.cloud/v/abc123def/episode.mkv"),
    true
  );
  assert.equal(
    SmartStreamService.isExtractableSource(
      "https://streamtape.com/get_video?id=6kjz8WP38qT9AKg&expires=1799999999&ip=1.2.3.4&token=REALTOKEN&stream=1"
    ),
    false
  );
  assert.equal(
    SmartStreamService.isExtractableSource(
      "https://cdn1.tapecontent.net/get_video?id=6kjz8WP38qT9AKg&stream=1"
    ),
    false
  );
  assert.equal(
    SmartStreamService.isExtractableSource(
      "/api/stream-proxy?url=https%3A%2F%2Fstreamtape.com%2Fget_video%3Fid%3D123&referer=https%3A%2F%2Fstreamtape.com%2F"
    ),
    false
  );
});

test("getEmbedUrl converts Streamtape /v/ watch URL to /e/ embed URL", () => {
  const embed = SmartStreamService.getEmbedUrl(TEST_STREAMTAPE_URL);
  assert.ok(embed);
  assert.ok(embed.startsWith("https://streamtape.com/e/6kjz8WP38qT9AKg/"));
});

test("resolveEmbedReferer resolves https://streamtape.com/ for Streamtape and tapecontent.net URLs", () => {
  assert.equal(SmartStreamService.resolveEmbedReferer(TEST_STREAMTAPE_URL), "https://streamtape.com/");
  assert.equal(
    SmartStreamService.resolveEmbedReferer("https://streamtape.com/get_video?id=6kjz8WP38qT9AKg&stream=1"),
    "https://streamtape.com/"
  );
  assert.equal(
    SmartStreamService.resolveEmbedReferer("https://edge12.tapecontent.net/get_video?id=abc"),
    "https://streamtape.com/"
  );
});

test("evaluateStreamtapeJsExpr accurately evaluates Streamtape JS obfuscation with substring, slice, parentheses, and fake-token avoidance", () => {
  // Multi-part concatenation + substring offset
  const expr1 =
    "('//streamtape.com/get_video?id=6kjz8WP38qT9AKg&expires=1800000&ip=1.1.1.1&token=' + 'FAKE_PREFIX_REAL_9988'.substring(12))";
  assert.equal(
    SmartStreamService.evaluateStreamtapeJsExpr(expr1),
    "//streamtape.com/get_video?id=6kjz8WP38qT9AKg&expires=1800000&ip=1.1.1.1&token=REAL_9988"
  );

  // Outer substring stripping junk prefix inside parentheses
  const expr2 =
    "('xxyy//streamtape.com/get_' + 'abcdvideo?id=6kjz8WP38qT9AKg&token=FINAL777'.substring(4)).substring(4)";
  assert.equal(
    SmartStreamService.evaluateStreamtapeJsExpr(expr2),
    "//streamtape.com/get_video?id=6kjz8WP38qT9AKg&token=FINAL777"
  );

  // Simulated DOM trap where last robotlink/ideoolink assignment wins over earlier trap assignment
  const simulatedHtml = `
    <div id="robotlink" style="display:none;">/streamtape.com/get_video?id=TRAP&token=FAKE_STATIC</div>
    <script>
      document.getElementById('robotlink').innerHTML = '/streamtape.com/get_video?id=TRAP2&token=' + 'BAD000'.substring(2);
      document.getElementById('ideoolink').innerHTML = ('//streamtape.com/' + 'zzzget_video?id=6kjz8WP38qT9AKg&token=TRUE_LIVE_TOKEN'.substring(3));
    </script>
  `;
  const regex = /getElementById\s*\(\s*['"](?:robotlink|ideoolink|botlink)['"]\s*\)\.innerHTML\s*=\s*([^;]+);/gi;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(simulatedHtml)) !== null) {
    matches.push(m[1]);
  }
  assert.equal(matches.length, 2);
  const lastEvaluated = SmartStreamService.evaluateStreamtapeJsExpr(matches[matches.length - 1]);
  assert.equal(lastEvaluated, "//streamtape.com/get_video?id=6kjz8WP38qT9AKg&token=TRUE_LIVE_TOKEN");
});

test("sanitizeStreamUrl preserves /api/stream-proxy even when running inside Android Kotlin APK so IP-bound Streamtape tokens never fail with 403", () => {
  const proxiedStreamtape =
    "/api/stream-proxy?url=https%3A%2F%2Ftapecontent.net%2Fget_video%3Fid%3D6kjz8WP38qT9AKg%26ip%3DSERVER_IP%26token%3DREAL&referer=https%3A%2F%2Fstreamtape.com%2F";
  assert.equal(SmartStreamService.sanitizeStreamUrl(proxiedStreamtape), proxiedStreamtape);

  const g = globalThis as any;
  const prevWin = g.window;
  try {
    g.window = { MaxPlayNative: { isNativeApp: () => true } };
    assert.equal(SmartStreamService.sanitizeStreamUrl(proxiedStreamtape), proxiedStreamtape);
    assert.equal(
      SmartStreamService.sanitizeStreamUrl(`https://app.example.com${proxiedStreamtape}`),
      proxiedStreamtape
    );
  } finally {
    g.window = prevWin;
  }
});

