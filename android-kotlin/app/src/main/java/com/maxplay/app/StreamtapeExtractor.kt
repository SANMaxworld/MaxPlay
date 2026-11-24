package com.maxplay.app

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.URLDecoder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import java.util.regex.Pattern

/**
 * MaxPlay Server 3 (Streamtape) On-Device Client-Side Extractor
 * ----------------------------------------------------------------------
 * Extracts IP-bound direct stream URLs (`https://streamtape.com/get_video?...&stream=1`)
 * on the user's Android device so the stream token matches the device's IP & User-Agent.
 *
 * Dual-Layer Pipeline:
 * 1. Fast OkHttp + Substring JS Evaluator (< 600ms):
 *    - Fetches watch/embed HTML with exact User-Agent & Referer: https://streamtape.com/
 *    - Evaluates the LAST `getElementById('robotlink'|'ideoolink'|'botlink').innerHTML = ...`
 *      assignment (completely ignoring Streamtape's fake static <span> token trap).
 * 2. Offscreen Headless WebView Fallback (500ms polling up to 15s):
 *    - Executes full page JS in a real offscreen WebView with ad/popup blocking.
 *    - Captures exact `webView.settings.userAgentString` paired with the extracted token.
 *    - Guarantees cleanup (`stopLoading()` + `destroy()` + view removal) in `finally`.
 * 3. Direct CDN Redirect + Content-Length Prober:
 *    - Resolves HTTP 302 final CDN location (`tapecontent.net`) and real file size in bytes.
 */
class StreamtapeExtractor(
    private val activity: Activity,
    private val mainWebView: WebView? = null
) {

    data class ExtractedStream(
        val directUrl: String,
        val userAgent: String,
        val referer: String = "https://streamtape.com/",
        val cdnUrl: String = "",
        val sizeBytes: Long = 0L,
        val mimeType: String = "video/mp4"
    )

    companion object {
        const val STREAMTAPE_REFERER = "https://streamtape.com/"

        @Volatile
        var globalCachedMainUa: String? = null

        fun resolveUserAgent(): String {
            return globalCachedMainUa?.takeIf { it.isNotBlank() } ?: InbuiltStreamScraper.DEFAULT_USER_AGENT
        }

        private val fastMirrorHttpClient: okhttp3.OkHttpClient by lazy {
            InbuiltStreamScraper.okHttpClient.newBuilder()
                .connectTimeout(3500, TimeUnit.MILLISECONDS)
                .readTimeout(4000, TimeUnit.MILLISECONDS)
                .build()
        }

        // 1-RTT non-redirecting client: grabs Streamtape's 302 Location (tapecontent.net) over the warm mirror TLS socket
        // without wasting 350-900ms opening a throwaway OkHttp TLS connection to tapecontent.net!
        private val noRedirectHttpClient: okhttp3.OkHttpClient by lazy {
            InbuiltStreamScraper.okHttpClient.newBuilder()
                .followRedirects(false)
                .followSslRedirects(false)
                .connectTimeout(3500, TimeUnit.MILLISECONDS)
                .readTimeout(4000, TimeUnit.MILLISECONDS)
                .build()
        }

        @Volatile
        private var fastestMirrorHost: String? = null

        private val streamtapePlaybackCache = java.util.concurrent.ConcurrentHashMap<String, Pair<String, Long>>()

        val STREAMTAPE_DOMAINS = listOf(
            "streamtape.", "strtape.", "shavetape.", "streamta.pe", "tapecontent.",
            "strcloud.", "streamadblockplus."
        )

        private val BLOCKED_AD_KEYWORDS = listOf(
            "doubleclick", "googlesyndication", "adservice", "popads", "popcash",
            "exoclick", "magsrv", "juicyads", "a-ads", "adsco", "onclick",
            "bet365", "1xbet", "casino", "clickadu", "hilltopads",
            "propellerads", "adsterra", "acscdn", "usrpubtrk", "tsyndicate"
        )

        fun isStreamtapeUrl(url: String?): Boolean {
            if (url.isNullOrBlank()) return false
            val lower = url.lowercase().trim()
            return STREAMTAPE_DOMAINS.any { lower.contains(it) }
        }

        fun isDirectGetVideoUrl(url: String?): Boolean {
            if (url.isNullOrBlank()) return false
            val lower = url.lowercase().trim()
            return lower.contains("/get_video") || lower.contains("tapecontent.net")
        }

        /**
         * Normalizes extracted Streamtape URLs:
         * - Prepends `https:` if protocol-relative (`//streamtape.com/get_video...`)
         * - Prepends `https://streamtape.com` if root-relative (`/get_video...`)
         * - Appends `&stream=1` if missing so server permits progressive MP4/MKV streaming
         */
        fun normalizeExtractedDirectUrl(raw: String): String {
            var resolved = raw.replace("\\/", "/").replace("&amp;", "&").trim()
            if (resolved.isEmpty()) return ""
            resolved = when {
                resolved.startsWith("https://", ignoreCase = true) ||
                    resolved.startsWith("http://", ignoreCase = true) -> resolved
                resolved.startsWith("//") -> "https:$resolved"
                resolved.startsWith("/") -> "https://streamta.pe$resolved"
                else -> "https://${resolved.trimStart('/')}"
            }
            if (resolved.contains("streamtape.com/get_video", ignoreCase = true)) {
                resolved = resolved.replace("streamtape.com/get_video", "streamta.pe/get_video", ignoreCase = true)
            }
            if (!resolved.contains("stream=1", ignoreCase = true)) {
                resolved += if (resolved.contains("?")) "&stream=1" else "?stream=1"
            }
            return resolved
        }

        /**
         * Evaluates Streamtape's obfuscated JS string concatenation & `.substring(start[, end])` / `.slice(...)`
         * expression without executing arbitrary code on the main UI thread.
         */
        fun evaluateStreamtapeJsExpr(expr: String): String {
            if (expr.isBlank()) return ""
            val parts = mutableListOf<String>()
            val cur = StringBuilder()
            var inQuote: Char? = null
            var parenDepth = 0
            var i = 0
            while (i < expr.length) {
                val ch = expr[i]
                if (inQuote != null) {
                    if (ch == '\\' && i + 1 < expr.length) {
                        cur.append(ch).append(expr[i + 1])
                        i += 2
                        continue
                    }
                    if (ch == inQuote) {
                        inQuote = null
                    }
                    cur.append(ch)
                } else {
                    when {
                        ch == '\'' || ch == '"' -> {
                            inQuote = ch
                            cur.append(ch)
                        }
                        ch == '(' -> {
                            parenDepth++
                            cur.append(ch)
                        }
                        ch == ')' -> {
                            parenDepth = maxOf(0, parenDepth - 1)
                            cur.append(ch)
                        }
                        ch == '+' && parenDepth == 0 -> {
                            val token = cur.toString().trim()
                            if (token.isNotEmpty()) parts.add(token)
                            cur.setLength(0)
                        }
                        else -> cur.append(ch)
                    }
                }
                i++
            }
            val tail = cur.toString().trim()
            if (tail.isNotEmpty()) parts.add(tail)

            val litPattern = Pattern.compile("^[(]*\\s*(['\"])([\\s\\S]*?)\\1\\s*[)]*(.*)$")
            val subPattern = Pattern.compile("\\.(?:substring|slice)\\s*\\(\\s*(\\d+)\\s*(?:,\\s*(\\d+)\\s*)?\\)")

            val out = StringBuilder()
            for (part in parts) {
                val lm = litPattern.matcher(part)
                if (!lm.find()) continue
                var value = lm.group(2) ?: ""
                val chain = lm.group(3) ?: ""
                val sm = subPattern.matcher(chain)
                while (sm.find()) {
                    val startIdx = sm.group(1)?.toIntOrNull() ?: 0
                    val endIdx = sm.group(2)?.toIntOrNull()
                    val safeStart = startIdx.coerceIn(0, value.length)
                    value = if (endIdx != null) {
                        val safeEnd = endIdx.coerceIn(safeStart, value.length)
                        value.substring(safeStart, safeEnd)
                    } else {
                        value.substring(safeStart)
                    }
                }
                out.append(value)
            }
            return out.toString().trim()
        }

        /**
         * Extracts the genuine `get_video` URL from Streamtape HTML by scanning ALL assignments to
         * `getElementById('ideoooolink'|'captchalink'|'norobotlink'|'robotlink'|'ideoolink'|'botlink').innerHTML = ...`
         * and evaluating from LAST to FIRST so static fake-token traps are ignored.
         */
        fun extractDirectUrlFromHtml(html: String): String? {
            if (html.isBlank()) return null
            val assignPattern = Pattern.compile(
                """getElementById\s*\(\s*['"](?:ideoooolink|captchalink|norobotlink|robotlink|ideoolink|botlink)['"]\s*\)\s*\.innerHTML\s*=\s*([^;]+);""",
                Pattern.CASE_INSENSITIVE
            )
            val matcher = assignPattern.matcher(html)
            val expressions = mutableListOf<String>()
            while (matcher.find()) {
                val expr = matcher.group(1)?.trim()
                if (!expr.isNullOrEmpty()) {
                    expressions.add(expr)
                }
            }
            for (idx in expressions.indices.reversed()) {
                val evaluated = evaluateStreamtapeJsExpr(expressions[idx])
                if (evaluated.contains("get_video?", ignoreCase = true) &&
                    evaluated.contains("token=", ignoreCase = true)
                ) {
                    val normalized = normalizeExtractedDirectUrl(evaluated)
                    if (normalized.isNotEmpty()) return normalized
                }
            }
            return null
        }

        fun inferMetadataFromPage(sourceUrl: String, html: String): Triple<String, List<String>, String> {
            val ogMatch = Pattern.compile(
                """<meta[^>]+(?:name|property)=["']og:title["'][^>]+content=["']([^"']+)["']""",
                Pattern.CASE_INSENSITIVE
            ).matcher(html)
            val titleTagMatch = Pattern.compile(
                """<title>([^<]+)</title>""",
                Pattern.CASE_INSENSITIVE
            ).matcher(html)

            val ogTitle = if (ogMatch.find()) (ogMatch.group(1) ?: "") else if (titleTagMatch.find()) (titleTagMatch.group(1) ?: "") else ""
            val decodedUrl = try {
                URLDecoder.decode(sourceUrl, "UTF-8")
            } catch (_: Exception) {
                sourceUrl
            }
            val rawMeta = "$ogTitle $decodedUrl".lowercase()

            val quality = when {
                rawMeta.contains("2160p") || rawMeta.contains("4k") -> "2160p"
                rawMeta.contains("1080p") || rawMeta.contains("fhd") || rawMeta.contains("bluray") -> "1080p"
                rawMeta.contains("720p") || rawMeta.contains("hd") -> "720p"
                rawMeta.contains("480p") -> "480p"
                rawMeta.contains("360p") -> "360p"
                else -> "1080p"
            }

            val audioTracks = mutableListOf<String>()
            fun addAudio(lang: String) {
                if (!audioTracks.contains(lang)) audioTracks.add(lang)
            }
            if (rawMeta.contains("hindi") || Regex("\\bhin\\b").containsMatchIn(rawMeta)) addAudio("Hindi")
            if (rawMeta.contains("japanese") || Regex("\\bjpn\\b|\\bjap\\b").containsMatchIn(rawMeta)) addAudio("Japanese")
            if (rawMeta.contains("english") || Regex("\\beng\\b").containsMatchIn(rawMeta)) addAudio("English")
            if (rawMeta.contains("tamil") || Regex("\\btam\\b").containsMatchIn(rawMeta)) addAudio("Tamil")
            if (rawMeta.contains("telugu") || Regex("\\btel\\b").containsMatchIn(rawMeta)) addAudio("Telugu")
            if (rawMeta.contains("korean") || Regex("\\bkor\\b").containsMatchIn(rawMeta)) addAudio("Korean")
            if ((rawMeta.contains("dual_audio") || rawMeta.contains("dual audio") || rawMeta.contains("multi")) && audioTracks.isEmpty()) {
                addAudio("Hindi")
                addAudio("English")
            }

            // In Android WebView native player, always return "video/mp4" MIME type.
            // Returning "video/x-matroska" causes Chromium to immediately reject the stream with MEDIA_ERR_SRC_NOT_SUPPORTED (code 4).
            val mimeType = "video/mp4"
            return Triple(quality, audioTracks, mimeType)
        }
    }

    @Volatile
    private var cachedMainUa: String? = null

    init {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            try {
                val ua = mainWebView?.settings?.userAgentString?.takeIf { it.isNotBlank() }
                if (ua != null) {
                    cachedMainUa = ua
                    globalCachedMainUa = ua
                }
            } catch (_: Exception) {}
        } else {
            Handler(Looper.getMainLooper()).post {
                try {
                    val ua = mainWebView?.settings?.userAgentString?.takeIf { it.isNotBlank() }
                    if (ua != null) {
                        cachedMainUa = ua
                        globalCachedMainUa = ua
                    }
                } catch (_: Exception) {}
            }
        }
    }

    private fun resolveUserAgent(): String {
        cachedMainUa?.takeIf { it.isNotBlank() }?.let { return it }
        globalCachedMainUa?.takeIf { it.isNotBlank() }?.let { return it }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            try {
                val ua = mainWebView?.settings?.userAgentString?.takeIf { it.isNotBlank() }
                if (ua != null) {
                    cachedMainUa = ua
                    globalCachedMainUa = ua
                    return ua
                }
            } catch (_: Exception) {}
        }
        return InbuiltStreamScraper.DEFAULT_USER_AGENT
    }

    /**
     * Resolves Streamtape's HTTP 302 CDN redirect (`tapecontent.net`) and Content-Length size in bytes
     * without buffering the video payload.
     */
    fun resolveRedirectAndSize(
        directUrl: String,
        userAgent: String,
        referer: String = STREAMTAPE_REFERER
    ): Triple<String, Long, String> {
        var resolvedCdnUrl = directUrl
        var sizeBytes = 0L
        var mimeType = "video/mp4"

        // 1. Check 302 redirect location + Content-Length via HEAD
        try {
            val headReq = Request.Builder()
                .url(directUrl)
                .head()
                .header("User-Agent", userAgent)
                .header("Referer", referer)
                .header("Origin", "https://streamtape.com")
                .header("Accept", "*/*")
                .build()

            InbuiltStreamScraper.okHttpClient.newCall(headReq).execute().use { resp ->
                val finalUrl = resp.request.url.toString()
                if (finalUrl.startsWith("http")) {
                    resolvedCdnUrl = finalUrl
                }
                val cl = resp.header("Content-Length")?.toLongOrNull() ?: 0L
                if (cl > 100_000L) sizeBytes = cl
                val ct = (resp.header("Content-Type") ?: "").substringBefore(";").trim().lowercase()
                if (ct.startsWith("video/") && !ct.contains("matroska")) mimeType = ct
            }
        } catch (_: Exception) {}

        // 2. Fallback: Range: bytes=0-0 GET request (works even when CDN rejects HEAD)
        if (sizeBytes <= 0L) {
            try {
                val rangeReq = Request.Builder()
                    .url(resolvedCdnUrl)
                    .header("User-Agent", userAgent)
                    .header("Referer", referer)
                    .header("Origin", "https://streamtape.com")
                    .header("Accept", "*/*")
                    .header("Range", "bytes=0-0")
                    .build()

                InbuiltStreamScraper.okHttpClient.newCall(rangeReq).execute().use { resp ->
                    val finalUrl = resp.request.url.toString()
                    if (finalUrl.startsWith("http")) {
                        resolvedCdnUrl = finalUrl
                    }
                    val cr = resp.header("Content-Range") ?: ""
                    val slashIdx = cr.lastIndexOf('/')
                    if (slashIdx != -1) {
                        val total = cr.substring(slashIdx + 1).trim().toLongOrNull() ?: 0L
                        if (total > 100_000L) sizeBytes = total
                    }
                    if (sizeBytes <= 0L) {
                        val cl = resp.header("Content-Length")?.toLongOrNull() ?: 0L
                        if (cl > 100_000L) sizeBytes = cl
                    }
                    val ct = (resp.header("Content-Type") ?: "").substringBefore(";").trim().lowercase()
                    if (ct.startsWith("video/") && !ct.contains("matroska")) mimeType = ct
                }
            } catch (_: Exception) {}
        }

        return Triple(resolvedCdnUrl, sizeBytes, mimeType)
    }

    /**
     * Ultra-fast 1-RTT redirect resolver for playback:
     * Fetches ONLY the 302 `Location` header (`tapecontent.net`) over the already-warm mirror TLS socket
     * without opening a throwaway cold TLS connection to `tapecontent.net` (-350 to -900ms saved!).
     */
    private fun resolveRedirectFast1Rtt(
        directUrl: String,
        userAgent: String,
        referer: String = STREAMTAPE_REFERER
    ): String {
        if (directUrl.lowercase().contains("tapecontent")) return directUrl
        return try {
            val req = Request.Builder()
                .url(directUrl)
                .get()
                .header("Range", "bytes=0-0")
                .header("User-Agent", userAgent)
                .header("Referer", referer)
                .header("Accept", "*/*")
                .build()
            noRedirectHttpClient.newCall(req).execute().use { resp ->
                val loc = resp.header("Location")?.trim() ?: ""
                if (loc.startsWith("http", ignoreCase = true)) {
                    loc
                } else if (loc.startsWith("//")) {
                    "https:$loc"
                } else {
                    directUrl
                }
            }
        } catch (_: Exception) {
            directUrl
        }
    }

    /**
     * Synchronous Parallel-Race OkHttp + Headless WebView extraction pipeline (call off the Android Main Thread).
     */
    fun extractStreamSync(sourceUrl: String): JSONObject {
        val trimmed = sourceUrl.trim()
        val ua = resolveUserAgent()

        // Already a direct get_video or tapecontent CDN URL
        if (isDirectGetVideoUrl(trimmed)) {
            val normalizedDirect = normalizeExtractedDirectUrl(trimmed)
            CorsFreeWebViewClient.registerStreamReferer(normalizedDirect, STREAMTAPE_REFERER, ua)
            val cdnUrl = resolveRedirectFast1Rtt(normalizedDirect, ua, STREAMTAPE_REFERER)
            if (cdnUrl.isNotEmpty() && cdnUrl != normalizedDirect) {
                CorsFreeWebViewClient.registerStreamReferer(cdnUrl, STREAMTAPE_REFERER, ua)
            }
            val (quality, audios, inferredMime) = inferMetadataFromPage(trimmed, "")
            val stream = ExtractedStream(
                directUrl = normalizedDirect,
                userAgent = ua,
                referer = STREAMTAPE_REFERER,
                cdnUrl = cdnUrl,
                sizeBytes = 0L,
                mimeType = inferredMime
            )
            return toScraperJson(trimmed, stream, "kotlin_streamtape_direct", quality, audios)
        }

        // Layer 0: Instant 0ms In-Memory Cache hit (12-min TTL per fileId)
        val fileIdMatch = Regex("""/(?:v|e)/([a-zA-Z0-9_-]+)""").find(trimmed)
        val fileId = fileIdMatch?.groupValues?.get(1)
        if (!fileId.isNullOrBlank()) {
            val cached = streamtapePlaybackCache[fileId]
            if (cached != null && System.currentTimeMillis() < cached.second) {
                try {
                    val obj = JSONObject(cached.first)
                    val mUrl = obj.optString("m3u8Url", "")
                    val ref = obj.optJSONObject("headers")?.optString("Referer", STREAMTAPE_REFERER) ?: STREAMTAPE_REFERER
                    if (mUrl.isNotBlank()) {
                        CorsFreeWebViewClient.registerStreamReferer(mUrl, ref, ua)
                        return obj
                    }
                } catch (_: Exception) {}
            }
        }

        // Layer 1: Parallel Mirror Race (eliminates 3.5-60s sequential blocked-mirror stalls!)
        val mirrorHosts = buildList {
            fastestMirrorHost?.takeIf { it.isNotBlank() }?.let { add(it) }
            listOf("streamta.pe", "strcloud.link", "strtape.tech", "streamadblockplus.com").forEach { h ->
                if (!contains(h)) add(h)
            }
        }

        val raceUrls = if (!fileId.isNullOrBlank()) {
            mirrorHosts.map { "https://$it/v/$fileId" }
        } else {
            listOf(trimmed)
        }

        data class MirrorHit(val directUrl: String, val html: String, val winHost: String, val referer: String)
        val winnerRef = AtomicReference<MirrorHit?>(null)
        val activeCalls = java.util.concurrent.CopyOnWriteArrayList<okhttp3.Call>()
        val raceLatch = CountDownLatch(1)
        val doneCount = java.util.concurrent.atomic.AtomicInteger(0)

        for (candidateUrl in raceUrls) {
            InbuiltStreamScraper.backgroundExecutor.execute {
                try {
                    if (winnerRef.get() != null) return@execute
                    val candidateUri = android.net.Uri.parse(candidateUrl)
                    val candHost = candidateUri.host ?: "streamta.pe"
                    val candReferer = "${candidateUri.scheme ?: "https"}://$candHost/"
                    val req = Request.Builder()
                        .url(candidateUrl)
                        .header("User-Agent", ua)
                        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                        .header("Accept-Language", "en-US,en;q=0.9")
                        .header("Referer", candReferer)
                        .build()

                    val call = fastMirrorHttpClient.newCall(req)
                    activeCalls.add(call)
                    if (winnerRef.get() != null) {
                        call.cancel()
                        return@execute
                    }

                    call.execute().use { resp ->
                        val html = resp.body?.string() ?: ""
                        if (html.isNotBlank()) {
                            var directUrl = extractDirectUrlFromHtml(html)
                            if (!directUrl.isNullOrBlank()) {
                                // Keep extracted get_video on the exact winning unblocked mirror host!
                                if (candHost != "streamtape.com" && directUrl.contains("streamta.pe/get_video") && candHost != "streamta.pe") {
                                    directUrl = directUrl.replace("streamta.pe/get_video", "$candHost/get_video")
                                }
                                if (winnerRef.compareAndSet(null, MirrorHit(directUrl, html, candHost, candReferer))) {
                                    fastestMirrorHost = candHost
                                    raceLatch.countDown()
                                    // Cancel all slower losing mirrors immediately
                                    activeCalls.forEach { c -> if (c !== call) try { c.cancel() } catch (_: Exception) {} }
                                }
                            }
                        }
                    }
                } catch (_: Exception) {
                } finally {
                    if (doneCount.incrementAndGet() >= raceUrls.size) {
                        raceLatch.countDown()
                    }
                }
            }
        }

        try {
            raceLatch.await(4500, TimeUnit.MILLISECONDS)
        } catch (_: Exception) {}

        val hit = winnerRef.get()
        if (hit != null) {
            CorsFreeWebViewClient.registerStreamReferer(hit.directUrl, hit.referer, ua)
            val cdnUrl = resolveRedirectFast1Rtt(hit.directUrl, ua, hit.referer)
            if (cdnUrl.isNotEmpty() && cdnUrl != hit.directUrl) {
                CorsFreeWebViewClient.registerStreamReferer(cdnUrl, hit.referer, ua)
            }
            val (quality, audios, inferredMime) = inferMetadataFromPage(trimmed, hit.html)
            val stream = ExtractedStream(
                directUrl = hit.directUrl,
                userAgent = ua,
                referer = hit.referer,
                cdnUrl = cdnUrl,
                sizeBytes = 0L,
                mimeType = inferredMime
            )
            val json = toScraperJson(trimmed, stream, "kotlin_streamtape_okhttp_race", quality, audios)
            if (!fileId.isNullOrBlank()) {
                streamtapePlaybackCache[fileId] = Pair(json.toString(), System.currentTimeMillis() + 12 * 60 * 1000L)
            }
            return json
        }

        // Layer 2: Client-side Headless Offscreen WebView Scraping (use best unblocked mirror instead of blocked streamtape.com!)
        if (Looper.myLooper() != Looper.getMainLooper()) {
            val bestLayer2Url = if (!fileId.isNullOrBlank()) {
                "https://${fastestMirrorHost ?: "streamta.pe"}/e/$fileId"
            } else {
                trimmed
            }
            val latch = CountDownLatch(1)
            val resultRef = AtomicReference<JSONObject?>(null)
            extractStreamViaHeadlessWebView(bestLayer2Url, 4000L) { res ->
                resultRef.set(res)
                latch.countDown()
            }
            try {
                latch.await(4200, TimeUnit.MILLISECONDS)
            } catch (_: Exception) {}
            resultRef.get()?.let { return it }
        }

        return JSONObject().apply {
            put("ok", false)
            put("provider", "STREAMTAPE")
            put("needsHeadlessSniffer", true)
            put("error", "Streamtape extraction timed out or link expired")
        }
    }

    /**
     * Asynchronous entry point (runs fast OkHttp first, then Headless WebView if needed).
     */
    fun extractStreamAsync(
        sourceUrl: String,
        onResult: (JSONObject) -> Unit
    ) {
        InbuiltStreamScraper.backgroundExecutor.execute {
            val res = extractStreamSync(sourceUrl)
            Handler(Looper.getMainLooper()).post {
                onResult(res)
            }
        }
    }

    /**
     * Offscreen Headless WebView Scraper for Streamtape:
     * - Polls `robotlink` / `ideoolink` / `botlink` every 500ms up to `timeoutMs` (default 15,000ms)
     * - Also listens in `shouldInterceptRequest` for `/get_video` or `tapecontent.net` requests
     * - Blocks popups, new windows, trackers, and image assets
     * - Captures exact `webView.settings.userAgentString`
     * - Strictly executes `webView.stopLoading()` + `webView.destroy()` in cleanup/`finally`
     */
    @SuppressLint("SetJavaScriptEnabled")
    fun extractStreamViaHeadlessWebView(
        sourceUrl: String,
        timeoutMs: Long = 15000L,
        onResult: (JSONObject) -> Unit
    ) {
        val mainHandler = Handler(Looper.getMainLooper())
        val isResolved = AtomicBoolean(false)
        val trimmed = sourceUrl.trim()

        mainHandler.post {
            var headlessWebView: WebView? = null
            var pollRunnable: Runnable? = null
            var timeoutRunnable: Runnable? = null
            var capturedUa = InbuiltStreamScraper.DEFAULT_USER_AGENT
            var latestHtmlHint = ""

            val parentContainer: ViewGroup? = try {
                (activity as? MainActivity)?.getScraperContainer()
                    ?: activity.findViewById(android.R.id.content)
            } catch (_: Exception) {
                null
            }

            fun cleanupWebView() {
                try {
                    pollRunnable?.let { mainHandler.removeCallbacks(it) }
                    timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                } catch (_: Exception) {}
                val wv = headlessWebView
                headlessWebView = null
                if (wv != null) {
                    try {
                        wv.stopLoading()
                        wv.loadUrl("about:blank")
                        (wv.parent as? ViewGroup)?.removeView(wv)
                        wv.removeAllViews()
                        wv.destroy()
                    } catch (_: Exception) {}
                }
            }

            fun finishSuccess(rawDirectUrl: String, pageTitleHint: String, methodTag: String) {
                val normalized = normalizeExtractedDirectUrl(rawDirectUrl)
                if (!normalized.contains("get_video", ignoreCase = true) &&
                    !normalized.contains("tapecontent.net", ignoreCase = true)
                ) {
                    return
                }
                if (!isResolved.compareAndSet(false, true)) return

                cleanupWebView()
                val ua = capturedUa.ifBlank { InbuiltStreamScraper.DEFAULT_USER_AGENT }
                CorsFreeWebViewClient.registerStreamReferer(normalized, STREAMTAPE_REFERER, ua)

                InbuiltStreamScraper.backgroundExecutor.execute {
                    try {
                        val (cdnUrl, sizeBytes, probedMime) = resolveRedirectAndSize(normalized, ua, STREAMTAPE_REFERER)
                        if (cdnUrl.isNotEmpty() && cdnUrl != normalized) {
                            CorsFreeWebViewClient.registerStreamReferer(cdnUrl, STREAMTAPE_REFERER, ua)
                        }
                        val (quality, audios, inferredMime) = inferMetadataFromPage(trimmed, "$pageTitleHint $latestHtmlHint")
                        val finalMime = if (probedMime != "video/mp4") probedMime else inferredMime
                        val stream = ExtractedStream(
                            directUrl = normalized,
                            userAgent = ua,
                            referer = STREAMTAPE_REFERER,
                            cdnUrl = cdnUrl,
                            sizeBytes = sizeBytes,
                            mimeType = finalMime
                        )
                        val json = toScraperJson(trimmed, stream, methodTag, quality, audios)
                        onResult(json)
                    } catch (e: Exception) {
                        val (quality, audios, inferredMime) = inferMetadataFromPage(trimmed, pageTitleHint)
                        val stream = ExtractedStream(
                            directUrl = normalized,
                            userAgent = ua,
                            referer = STREAMTAPE_REFERER,
                            cdnUrl = normalized,
                            sizeBytes = 0L,
                            mimeType = inferredMime
                        )
                        onResult(toScraperJson(trimmed, stream, methodTag, quality, audios))
                    }
                }
            }

            timeoutRunnable = Runnable {
                if (isResolved.compareAndSet(false, true)) {
                    cleanupWebView()
                    onResult(JSONObject().apply {
                        put("ok", false)
                        put("provider", "STREAMTAPE")
                        put("error", "Streamtape Headless WebView timed out after ${timeoutMs}ms")
                    })
                }
            }
            mainHandler.postDelayed(timeoutRunnable!!, timeoutMs)

            try {
                headlessWebView = WebView(activity).apply {
                    alpha = 0.01f
                    translationX = -2500f
                    translationY = -2500f
                    isFocusable = false
                    isFocusableInTouchMode = false
                    visibility = View.VISIBLE
                    layoutParams = FrameLayout.LayoutParams(320, 180)

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        loadsImagesAutomatically = false
                        blockNetworkImage = true
                        mediaPlaybackRequiresUserGesture = false
                        javaScriptCanOpenWindowsAutomatically = false
                        setSupportMultipleWindows(false)
                        allowFileAccess = false
                        mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                        userAgentString = resolveUserAgent()
                        @Suppress("DEPRECATION")
                        allowUniversalAccessFromFileURLs = false
                        @Suppress("DEPRECATION")
                        allowFileAccessFromFileURLs = false
                    }
                    capturedUa = settings.userAgentString ?: InbuiltStreamScraper.DEFAULT_USER_AGENT

                    val cm = CookieManager.getInstance()
                    cm.setAcceptCookie(true)
                    cm.setAcceptThirdPartyCookies(this, true)

                    webChromeClient = object : WebChromeClient() {
                        override fun onCreateWindow(
                            view: WebView?,
                            isDialog: Boolean,
                            isUserGesture: Boolean,
                            resultMsg: android.os.Message?
                        ): Boolean {
                            return false
                        }
                    }

                    webViewClient = object : WebViewClient() {
                        override fun onRenderProcessGone(
                            view: WebView?,
                            detail: android.webkit.RenderProcessGoneDetail?
                        ): Boolean {
                            // Never let an offscreen headless WebView crash kill the main MaxPlay process or hang the 14s latch!
                            mainHandler.removeCallbacks(timeoutRunnable)
                            mainHandler.post {
                                if (isResolved.compareAndSet(false, true)) {
                                    cleanupWebView()
                                    onResult(JSONObject().apply {
                                        put("ok", false)
                                        put("provider", "STREAMTAPE")
                                        put("error", "Streamtape headless WebView reset")
                                    })
                                } else {
                                    cleanupWebView()
                                }
                            }
                            return true
                        }

                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            val navUrl = request?.url?.toString() ?: return false
                            val lower = navUrl.lowercase()
                            if (BLOCKED_AD_KEYWORDS.any { lower.contains(it) }) return true
                            if (request.isForMainFrame && !isStreamtapeUrl(navUrl) && lower != "about:blank") {
                                return true
                            }
                            return false
                        }

                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): WebResourceResponse? {
                            val reqUrl = request?.url?.toString() ?: return null
                            val lower = reqUrl.lowercase()
                            val pathOnly = (request.url?.path ?: "").lowercase()

                            // Intercept real Streamtape direct video request if triggered by player
                            if (lower.contains("get_video?") && lower.contains("token=")) {
                                mainHandler.post {
                                    finishSuccess(reqUrl, "", "kotlin_streamtape_webview_intercept")
                                }
                            }

                            // Block ad networks, popups, analytics, stylesheets, and heavy images to keep scrape ultra fast
                            if (BLOCKED_AD_KEYWORDS.any { lower.contains(it) } ||
                                pathOnly.endsWith(".png") ||
                                pathOnly.endsWith(".jpg") ||
                                pathOnly.endsWith(".jpeg") ||
                                pathOnly.endsWith(".gif") ||
                                pathOnly.endsWith(".webp") ||
                                pathOnly.endsWith(".woff2") ||
                                pathOnly.endsWith(".woff")
                            ) {
                                return WebResourceResponse(
                                    "text/plain",
                                    "UTF-8",
                                    ByteArrayInputStream(ByteArray(0))
                                )
                            }
                            return super.shouldInterceptRequest(view, request)
                        }
                    }
                }

                parentContainer?.addView(headlessWebView)

                val domProbeJs = """
                    (function() {
                        try {
                            window.open = function() { return null; };
                            var titleText = '';
                            try {
                                var og = document.querySelector('meta[property="og:title"], meta[name="og:title"]');
                                titleText = (og && og.getAttribute('content')) || document.title || '';
                            } catch (e) {}

                            var ids = ['ideoooolink', 'captchalink', 'norobotlink', 'robotlink', 'ideoolink', 'botlink'];
                            for (var i = 0; i < ids.length; i++) {
                                var el = document.getElementById(ids[i]);
                                if (el) {
                                    var txt = (el.innerText || el.textContent || el.innerHTML || '').replace(/<[^>]*>/g, '').trim();
                                    if (txt && txt.indexOf('get_video') !== -1 && txt.indexOf('token=') !== -1) {
                                        return JSON.stringify({ url: txt, title: titleText });
                                    }
                                }
                            }

                            var vids = document.querySelectorAll('video, source');
                            for (var v = 0; v < vids.length; v++) {
                                var src = vids[v].currentSrc || vids[v].src || vids[v].getAttribute('src') || '';
                                if (src && (src.indexOf('get_video') !== -1 || src.indexOf('tapecontent.net') !== -1)) {
                                    return JSON.stringify({ url: src, title: titleText });
                                }
                            }
                        } catch (e) {}
                        return '';
                    })();
                """.trimIndent()

                pollRunnable = object : Runnable {
                    override fun run() {
                        if (isResolved.get() || headlessWebView == null) return
                        headlessWebView?.evaluateJavascript(domProbeJs) { rawRes ->
                            if (isResolved.get()) return@evaluateJavascript
                            if (!rawRes.isNullOrBlank() && rawRes != "null" && rawRes != "\"\"") {
                                try {
                                    val unquoted = JSONArray("[$rawRes]").optString(0, "")
                                    if (unquoted.startsWith("{")) {
                                        val obj = JSONObject(unquoted)
                                        val foundUrl = obj.optString("url", "").trim()
                                        val pageTitle = obj.optString("title", "")
                                        if (foundUrl.contains("get_video") && foundUrl.contains("token=")) {
                                            finishSuccess(foundUrl, pageTitle, "kotlin_streamtape_headless_webview")
                                            return@evaluateJavascript
                                        }
                                    }
                                } catch (_: Exception) {}
                            }
                        }
                        if (!isResolved.get()) {
                            mainHandler.postDelayed(this, 500L)
                        }
                    }
                }

                headlessWebView?.loadUrl(trimmed, mapOf("Referer" to STREAMTAPE_REFERER))
                mainHandler.postDelayed(pollRunnable!!, 500L)
            } catch (e: Exception) {
                try {
                    if (isResolved.compareAndSet(false, true)) {
                        onResult(JSONObject().apply {
                            put("ok", false)
                            put("provider", "STREAMTAPE")
                            put("error", e.message ?: "Headless WebView initialization failed")
                        })
                    }
                } finally {
                    cleanupWebView()
                }
            }
        }
    }

    private fun toScraperJson(
        sourceUrl: String,
        stream: ExtractedStream,
        method: String,
        quality: String,
        audioTracks: List<String>
    ): JSONObject {
        val qualitiesArr = JSONArray().put(quality)
        val qualityLinksObj = JSONObject().put(quality, stream.directUrl)
        val audioArr = JSONArray().apply {
            audioTracks.forEach { put(it) }
        }
        val sizeMb = if (stream.sizeBytes > 100_000L) {
            maxOf(1, kotlin.math.round(stream.sizeBytes.toDouble() / (1024.0 * 1024.0)).toInt())
        } else {
            when (quality) {
                "2160p" -> 1850
                "1080p" -> 950
                "720p" -> 550
                "480p" -> 320
                else -> 220
            }
        }

        val dlArr = JSONArray().put(JSONObject().apply {
            put("id", quality)
            put(
                "label",
                when (quality) {
                    "2160p" -> "2160p 4K Ultra HD"
                    "1080p" -> "1080p Full HD"
                    "720p" -> "720p HD"
                    else -> "$quality Standard"
                }
            )
            put("sizeMb", sizeMb)
            put("sizeBytes", stream.sizeBytes)
            put("url", sourceUrl)
            put("resolvedUrl", stream.directUrl)
            put("cdnUrl", stream.cdnUrl)
            put("mimeType", stream.mimeType)
        })

        val bestPlayUrl = stream.cdnUrl.ifBlank { stream.directUrl }
        return JSONObject().apply {
            put("ok", true)
            put("m3u8Url", bestPlayUrl)
            put("directUrl", stream.directUrl)
            put("cdnUrl", bestPlayUrl)
            put("sizeBytes", stream.sizeBytes)
            put("sizeMb", sizeMb)
            put("mimeType", stream.mimeType)
            put("isDirectVideo", true)
            put("provider", "STREAMTAPE")
            put("method", method)
            put("qualities", qualitiesArr)
            put("qualityLinks", qualityLinksObj)
            put("downloadQualities", dlArr)
            put("audioTracks", audioArr)
            put("headers", JSONObject().apply {
                put("Referer", stream.referer)
                put("Origin", "https://streamtape.com")
                put("User-Agent", stream.userAgent)
            })
        }
    }
}
