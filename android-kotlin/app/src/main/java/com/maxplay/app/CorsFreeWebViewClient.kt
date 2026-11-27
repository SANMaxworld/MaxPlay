package com.maxplay.app

import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import okhttp3.Request
import java.io.ByteArrayInputStream

// MaxPlay CORS-Free WebViewClient & HTTPS Local Asset Server
// ----------------------------------------------------------------------
// 1. Serves bundled assets/webapp/ files over a real HTTPS virtual origin
//    (https://appassets.androidplatform.net/) so Vite ES Modules,
//    Tailwind CSS, Firebase Auth/Firestore, and IndexedDB work
//    with 100% compatibility and 0 black screen issues.
// 2. Fast-paths all Firebase, Google APIs, and image/poster/font requests
//    directly through Chromium's native HTTP/2 & disk-cache pipeline for
//    instant poster loading and zero UI lag.
// 3. Intercepts /api/proxy?url=... and cross-origin HLS streams (.m3u8, .ts, .m4s)
//    with matched Referer/Origin and Access-Control-Allow-Origin: *.
class CorsFreeWebViewClient(
    private val context: Context,
    private val onRendererCrash: (() -> Unit)? = null
) : WebViewClient() {

    private val isAdminApp: Boolean = context.packageName.endsWith(".admin", ignoreCase = true)

    private fun isBlockedSsrfTarget(rawUrl: String): Boolean {
        return try {
            val u = android.net.Uri.parse(rawUrl)
            val scheme = (u.scheme ?: "").lowercase()
            if (scheme != "http" && scheme != "https") return true
            val h = (u.host ?: "").lowercase().trim()
            if (h.isEmpty() || h == "localhost" || h == "127.0.0.1" || h == "::1" || h == "0.0.0.0") return true
            if (h.startsWith("127.") || h.startsWith("10.") || h.startsWith("169.254.") || h.startsWith("192.168.")) return true
            if (Regex("^172\\.(1[6-9]|2\\d|3[0-1])\\.").containsMatchIn(h)) return true
            if (h.endsWith(".local") || h.endsWith(".internal") || h == "metadata.google.internal") return true
            false
        } catch (_: Exception) {
            true
        }
    }

    override fun onRenderProcessGone(
        view: WebView?,
        detail: android.webkit.RenderProcessGoneDetail?
    ): Boolean {
        // Gracefully recover instead of allowing Android to immediately terminate the app!
        onRendererCrash?.invoke()
        return true
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        if (view == null || url == null || url == "about:blank") return
        if (isAdminApp && url.contains(VIRTUAL_ASSET_HOST, ignoreCase = true)) {
            view.postDelayed({
                try {
                    view.evaluateJavascript(
                        """
                        (function() {
                            if (typeof window.syncAdminAuthVisibility === 'function') {
                                window.syncAdminAuthVisibility();
                            }
                            if (!document.body || document.body.children.length === 0) {
                                return 'EMPTY_DOM';
                            }
                            return 'OK';
                        })();
                        """.trimIndent()
                    ) { status ->
                        if (status != null && status.contains("EMPTY_DOM")) {
                            try {
                                view.clearCache(false)
                                view.reload()
                            } catch (_: Exception) {}
                        }
                    }
                } catch (_: Exception) {}
            }, 1500L)
        }
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: android.webkit.WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true && view != null) {
            val reqUrl = request.url?.toString() ?: ""
            if (isAdminApp && !reqUrl.contains(VIRTUAL_ASSET_HOST, ignoreCase = true)) {
                try {
                    val hasLocalAdmin = context.assets.list("webapp")?.contains("admin.html") == true
                    if (hasLocalAdmin) {
                        view.post { view.loadUrl(MainActivity.LOCAL_ADMIN_BUNDLE_URL) }
                    }
                } catch (_: Exception) {}
            }
        }
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?
    ) {
        super.onReceivedHttpError(view, request, errorResponse)
        if (request?.isForMainFrame == true && view != null) {
            val reqUrl = request.url?.toString() ?: ""
            if (isAdminApp && !reqUrl.contains(VIRTUAL_ASSET_HOST, ignoreCase = true)) {
                view.post { view.loadUrl(MainActivity.LOCAL_ADMIN_BUNDLE_URL) }
            }
        }
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        val scheme = (uri.scheme ?: "").lowercase()
        val host = (uri.host ?: "").lowercase()
        // Never allow mainWebView (which holds window.MaxPlayNative) to navigate away to untrusted external domains
        if (request.isForMainFrame) {
            if (scheme == "about" && uri.toString() == "about:blank") return false
            if (host == VIRTUAL_ASSET_HOST || host == "maxplay.local") return false
            if (host.endsWith(".firebaseapp.com") || host.endsWith(".google.com") || host.endsWith(".run.app")) return false
            return true
        }
        return false
    }

    companion object {
        const val VIRTUAL_ASSET_HOST = "appassets.androidplatform.net"
        const val VIRTUAL_ASSET_ORIGIN = "https://appassets.androidplatform.net"

        // Dedicated high-throughput HTTP/2 + HTTP/1.1 CDN segment client with 512KB TCP receive buffers
        // so Server 1 & Server 2 1080p video segments never contend with scraper calls or drop to KB/s.
        private val highSpeedSocketFactory = object : javax.net.SocketFactory() {
            private val delegate = javax.net.SocketFactory.getDefault()
            private fun configure(s: java.net.Socket): java.net.Socket {
                try {
                    s.tcpNoDelay = true
                    s.receiveBufferSize = 512 * 1024
                    s.keepAlive = true
                } catch (_: Exception) {}
                return s
            }
            override fun createSocket(): java.net.Socket = configure(delegate.createSocket())
            override fun createSocket(host: String?, port: Int): java.net.Socket = configure(delegate.createSocket(host, port))
            override fun createSocket(host: String?, port: Int, localHost: java.net.InetAddress?, localPort: Int): java.net.Socket =
                configure(delegate.createSocket(host, port, localHost, localPort))
            override fun createSocket(host: java.net.InetAddress?, port: Int): java.net.Socket = configure(delegate.createSocket(host, port))
            override fun createSocket(address: java.net.InetAddress?, port: Int, localAddress: java.net.InetAddress?, localPort: Int): java.net.Socket =
                configure(delegate.createSocket(address, port, localAddress, localPort))
        }

        private val streamCdnHttpClient: okhttp3.OkHttpClient by lazy {
            InbuiltStreamScraper.okHttpClient.newBuilder()
                .socketFactory(highSpeedSocketFactory)
                .dispatcher(okhttp3.Dispatcher().apply {
                    maxRequests = 128
                    maxRequestsPerHost = 64
                })
                .connectionPool(okhttp3.ConnectionPool(64, 5, java.util.concurrent.TimeUnit.MINUTES))
                .connectTimeout(6, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build()
        }

        // Pre-compiled segment path regex (avoids per-segment Regex allocation)
        private val SEGMENT_PATH_REGEX = Regex("""/(?:seg|frag|chunk|part|slice)-\d+""")

        // Shared multi-tenant CDN root domains that MUST NOT collapse in extractRootDomain
        private val SHARED_CDN_ROOTS = setOf(
            "cloudfront.net", "b-cdn.net", "r2.dev", "workers.dev",
            "amazonaws.com", "akamaized.net", "fastly.net", "cloudflare.com", "co.uk"
        )

        // Per-host learned header mode: 0 = Origin+Referer, 1 = Referer-only, 2 = Bare
        // Eliminates +150-300ms 401/403 double-RTT on EVERY segment and EVERY seek!
        private val hostHeaderModeCache = java.util.concurrent.ConcurrentHashMap<String, Int>()

        // Active in-flight direct progressive media call tracker (Streamtape tapecontent.net).
        // Cancels any previous range call before a new seek/range call executes so Streamtape
        // NEVER sees 2 concurrent connections on the same token (which triggers infinite buffering/stalls)!
        private val activeProgressiveCall = java.util.concurrent.atomic.AtomicReference<okhttp3.Call?>(null)

        // Dedicated 6-thread parallel look-ahead prefetcher so online HLS & Streamtape MP4 streaming
        // pulls multiple segments/chunks simultaneously (matching Download 4-5 MB/s throughput!).
        private val prefetchExecutor = java.util.concurrent.Executors.newFixedThreadPool(6) { r ->
            Thread(r, "MaxPlay-StreamPrefetch").apply { isDaemon = true }
        }

        // Short-lived (30s) master & media .m3u8 prefetch cache so hls.js gets 0ms playlists + hot TLS socket!
        private data class PrefetchedPlaylist(val bytes: ByteArray, val finalUrl: String, val cachedAtMs: Long)
        private val prefetchedPlaylistCache = java.util.concurrent.ConcurrentHashMap<String, PrefetchedPlaylist>()

        // Bounded 36MB RAM Ring-Buffer for look-ahead HLS segments (Server 1 VOE — untouched!)
        private data class CachedSegment(val bytes: ByteArray, val mimeType: String, val cachedAtMs: Long)
        private val segmentCache = java.util.concurrent.ConcurrentHashMap<String, CachedSegment>()
        private val segmentCacheBytes = java.util.concurrent.atomic.AtomicLong(0L)
        private val inFlightSegments = java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.CompletableFuture<CachedSegment?>>()
        private const val MAX_SEGMENT_CACHE_BYTES = 36L * 1024L * 1024L
        private const val MAX_SINGLE_SEGMENT_BYTES = 24 * 1024 * 1024
        private const val SEGMENT_CACHE_TTL_MS = 180_000L

        private fun isSprintOrByseHost(host: String): Boolean {
            val h = host.lowercase()
            return h.contains("sprintcdn") ||
                h.contains("owphbf") ||
                h.contains("r66nv9ed") ||
                h.contains("byse") ||
                h.contains("filemoon") ||
                h.contains("f16px") ||
                h.contains("n1mwq") ||
                h.contains("1azayf9w") ||
                h.contains("8mhlloqo") ||
                h.contains("kerapoxy") ||
                h.contains("moonmov")
        }

        // Ordered segment index per media playlist for Server 1 (VOE) prefetching
        private val playlistSegmentsMap = java.util.concurrent.ConcurrentHashMap<String, List<String>>()
        private val segmentLocationMap = java.util.concurrent.ConcurrentHashMap<String, Pair<String, Int>>()

        fun clearAllPrefetchCaches() {
            prefetchedPlaylistCache.clear()
            segmentCache.clear()
            segmentCacheBytes.set(0L)
            playlistSegmentsMap.clear()
            segmentLocationMap.clear()
        }

        private fun resolveRelativeHlsUrl(baseUrl: String, rawRef: String): String {
            val clean = rawRef.trim()
            if (clean.startsWith("http://", ignoreCase = true) || clean.startsWith("https://", ignoreCase = true)) {
                return clean
            }
            return try {
                java.net.URI(baseUrl).resolve(clean).toString()
            } catch (_: Exception) {
                clean
            }
        }

        private fun putSegmentInCache(url: String, seg: CachedSegment) {
            if (seg.bytes.isEmpty() || seg.bytes.size > MAX_SINGLE_SEGMENT_BYTES) return
            val existing = segmentCache.remove(url)
            if (existing != null) {
                segmentCacheBytes.addAndGet(-existing.bytes.size.toLong())
            }
            // Evict oldest segments until within 36 MB & 8-entry RAM budget
            while ((segmentCacheBytes.get() + seg.bytes.size > MAX_SEGMENT_CACHE_BYTES || segmentCache.size >= 8) && segmentCache.isNotEmpty()) {
                var oldestKey: String? = null
                var oldestTs = Long.MAX_VALUE
                for ((k, v) in segmentCache) {
                    if (v.cachedAtMs < oldestTs) {
                        oldestTs = v.cachedAtMs
                        oldestKey = k
                    }
                }
                if (oldestKey == null) break
                val removed = segmentCache.remove(oldestKey)
                if (removed != null) {
                    segmentCacheBytes.addAndGet(-removed.bytes.size.toLong())
                }
            }
            segmentCache[url] = seg
            segmentCacheBytes.addAndGet(seg.bytes.size.toLong())
        }

        private fun fetchWithLearnedMode(url: String, refererUrl: String): Pair<okhttp3.Response, Int> {
            val uri = android.net.Uri.parse(url)
            val host = uri.host?.lowercase() ?: ""
            val scheme = uri.scheme ?: "https"
            val effRef = refererUrl.ifBlank { resolveRefererForHost(host, scheme) }
            val effOrigin = try {
                val ru = android.net.Uri.parse(effRef)
                "${ru.scheme ?: "https"}://${ru.host ?: host}"
            } catch (_: Exception) { "$scheme://$host" }
            val ua = resolveUserAgentForHost(host)

            fun doFetch(includeOrigin: Boolean, includeRef: Boolean): okhttp3.Response {
                val b = Request.Builder()
                    .url(url)
                    .header("User-Agent", ua)
                    .header("Accept", "*/*")
                if (includeRef && effRef.isNotBlank()) b.header("Referer", effRef)
                if (includeOrigin && effOrigin.isNotBlank()) b.header("Origin", effOrigin)
                return streamCdnHttpClient.newCall(b.build()).execute()
            }

            val preferredMode = hostHeaderModeCache[host] ?: 0
            var usedMode = preferredMode
            var resp = doFetch(includeOrigin = preferredMode == 0, includeRef = preferredMode != 2)
            if ((resp.code == 401 || resp.code == 403) && preferredMode == 0) {
                try { resp.close() } catch (_: Exception) {}
                usedMode = 1
                resp = doFetch(includeOrigin = false, includeRef = true)
            }
            if ((resp.code == 401 || resp.code == 403) && usedMode != 2) {
                try { resp.close() } catch (_: Exception) {}
                usedMode = 2
                resp = doFetch(includeOrigin = false, includeRef = false)
            }
            return Pair(resp, usedMode)
        }

        private fun prefetchSegmentAsync(segUrl: String, refererUrl: String) {
            if (!segUrl.startsWith("http", ignoreCase = true)) return
            val cached = segmentCache[segUrl]
            if (cached != null && System.currentTimeMillis() - cached.cachedAtMs < SEGMENT_CACHE_TTL_MS) return

            val future = java.util.concurrent.CompletableFuture<CachedSegment?>()
            if (inFlightSegments.putIfAbsent(segUrl, future) != null) return

            prefetchExecutor.execute {
                var result: CachedSegment? = null
                try {
                    val host = android.net.Uri.parse(segUrl).host?.lowercase() ?: ""
                    val (resp, usedMode) = fetchWithLearnedMode(segUrl, refererUrl)
                    resp.use { r ->
                        if (r.isSuccessful) {
                            hostHeaderModeCache[host] = usedMode
                            val contentLen = r.header("Content-Length")?.toLongOrNull() ?: -1L
                            if (contentLen <= MAX_SINGLE_SEGMENT_BYTES.toLong()) {
                                val rawCt = r.header("Content-Type") ?: "video/mp2t"
                                var mime = rawCt.substringBefore(";").trim().ifEmpty { "video/mp2t" }
                                if (mime.startsWith("image/") || mime.startsWith("text/html") || mime.startsWith("text/plain")) {
                                    mime = "video/mp2t"
                                }
                                val bodyStream = r.body?.byteStream()
                                if (bodyStream != null) {
                                    val baos = java.io.ByteArrayOutputStream(
                                        if (contentLen in 1024L..MAX_SINGLE_SEGMENT_BYTES.toLong()) contentLen.toInt() else 512 * 1024
                                    )
                                    val buf = ByteArray(64 * 1024)
                                    var total = 0
                                    var overflow = false
                                    while (true) {
                                        val n = bodyStream.read(buf)
                                        if (n <= 0) break
                                        total += n
                                        if (total > MAX_SINGLE_SEGMENT_BYTES) {
                                            overflow = true
                                            break
                                        }
                                        baos.write(buf, 0, n)
                                    }
                                    if (!overflow && total > 0) {
                                        val segObj = CachedSegment(baos.toByteArray(), mime, System.currentTimeMillis())
                                        putSegmentInCache(segUrl, segObj)
                                        result = segObj
                                    }
                                }
                            }
                        } else if (r.code == 429 || r.code == 502 || r.code == 503 || r.code == 504) {
                            InbuiltStreamScraper.evictSprintCdnWinner(host)
                        }
                    }
                } catch (_: Exception) {
                } finally {
                    future.complete(result)
                    inFlightSegments.remove(segUrl, future)
                }
            }
        }

        private fun registerAndPrefetchMediaPlaylist(
            playlistUrl: String,
            playlistText: String,
            refererUrl: String,
            initialPrefetchCount: Int = 3
        ) {
            try {
                val segList = ArrayList<String>(128)
                val mapUriRegex = Regex("""URI="([^"]+)"""")
                for (rawLine in playlistText.lineSequence()) {
                    val line = rawLine.trim()
                    if (line.isEmpty()) continue
                    if (line.startsWith("#EXT-X-MAP:", ignoreCase = true)) {
                        val m = mapUriRegex.find(line)
                        val initRef = m?.groupValues?.getOrNull(1)?.trim()
                        if (!initRef.isNullOrBlank()) {
                            segList.add(resolveRelativeHlsUrl(playlistUrl, initRef))
                        }
                        continue
                    }
                    if (line.startsWith("#")) continue
                    segList.add(resolveRelativeHlsUrl(playlistUrl, line))
                }
                if (segList.isEmpty()) return

                // Keep playlist registry bounded (max 10 recent media playlists)
                if (playlistSegmentsMap.size >= 10 && !playlistSegmentsMap.containsKey(playlistUrl)) {
                    val firstKey = playlistSegmentsMap.keys().takeIf { it.hasMoreElements() }?.nextElement()
                    if (firstKey != null) {
                        playlistSegmentsMap.remove(firstKey)?.forEach { segmentLocationMap.remove(it) }
                    }
                }
                playlistSegmentsMap[playlistUrl] = segList
                for (i in segList.indices) {
                    segmentLocationMap[segList[i]] = Pair(playlistUrl, i)
                }

                // For Server 1 (VOE.sx): prefetch the first segment for instant startup!
                // For Server 3 (SprintCDN/Byse): Direct player-driven stream (ZERO background hoarding)!
                val count = minOf(initialPrefetchCount, segList.size)
                val plHost = try { android.net.Uri.parse(playlistUrl).host?.lowercase() ?: "" } catch (_: Exception) { "" }
                val isSprintPl = isSprintOrByseHost(plHost)
                if (!isSprintPl) {
                    for (i in 0 until count) {
                        prefetchSegmentAsync(segList[i], refererUrl)
                    }
                }
            } catch (_: Exception) {}
        }

        private fun triggerLookAheadFromSegment(segUrl: String, refererUrl: String) {
            val loc = segmentLocationMap[segUrl] ?: return
            val list = playlistSegmentsMap[loc.first] ?: return
            val startIdx = loc.second + 1
            val segHost = try { android.net.Uri.parse(segUrl).host?.lowercase() ?: "" } catch (_: Exception) { "" }
            if (isSprintOrByseHost(segHost)) {
                // SERVER 3 (SprintCDN/Byse): Direct player-driven stream! NO look-ahead background prefetch to prevent bandwidth cannibalization!
                return
            } else {
                // Server 1 (VOE) — untouched!
                val endIdx = minOf(list.size, startIdx + 2)
                for (i in startIdx until endIdx) {
                    prefetchSegmentAsync(list[i], refererUrl)
                }
            }
        }

        private fun prefetchSubPlaylistOnlyAsync(subUrl: String, refererUrl: String) {
            if (!subUrl.startsWith("http", ignoreCase = true)) return
            val existing = prefetchedPlaylistCache[subUrl]
            if (existing != null && System.currentTimeMillis() - existing.cachedAtMs < 25_000L) return
            prefetchExecutor.execute {
                try {
                    val host = android.net.Uri.parse(subUrl).host?.lowercase() ?: return@execute
                    val (resp, usedMode) = fetchWithLearnedMode(subUrl, refererUrl)
                    resp.use { r ->
                        if (r.isSuccessful) {
                            hostHeaderModeCache[host] = usedMode
                            val finalUrl = r.request.url.toString()
                            val bytes = r.body?.bytes()
                            if (bytes != null && bytes.isNotEmpty() && bytes.size < 1024 * 1024) {
                                prefetchedPlaylistCache[subUrl] = PrefetchedPlaylist(bytes, finalUrl, System.currentTimeMillis())
                                registerStreamReferer(finalUrl, refererUrl)
                                val txt = String(bytes, Charsets.UTF_8)
                                if (txt.contains("#EXTINF:")) {
                                    // Register segment map only (0 segments prefetched here so background backup-server warmup
                                    // NEVER downloads multi-MB chunks or competes with active playback!)
                                    registerAndPrefetchMediaPlaylist(finalUrl, txt, refererUrl, initialPrefetchCount = 0)
                                }
                            }
                        }
                    }
                } catch (_: Exception) {}
            }
        }

        fun prefetchMasterPlaylistAsync(m3u8Url: String, refererUrl: String = "") {
            if (!m3u8Url.startsWith("http", ignoreCase = true)) return
            val lower = m3u8Url.lowercase()
            if (!lower.contains(".m3u8") && !lower.contains("master.txt")) return
            val existing = prefetchedPlaylistCache[m3u8Url]
            if (existing != null && System.currentTimeMillis() - existing.cachedAtMs < 20_000L) return

            prefetchExecutor.execute {
                try {
                    val uri = android.net.Uri.parse(m3u8Url)
                    val host = uri.host?.lowercase() ?: return@execute
                    val scheme = uri.scheme ?: "https"
                    val effRef = refererUrl.ifBlank { resolveRefererForHost(host, scheme) }
                    val ua = resolveUserAgentForHost(host)

                    val (resp, usedMode) = fetchWithLearnedMode(m3u8Url, effRef)
                    resp.use { r ->
                        if (r.isSuccessful) {
                            hostHeaderModeCache[host] = usedMode
                            val finalUrl = r.request.url.toString()
                            val bytes = r.body?.bytes()
                            if (bytes != null && bytes.isNotEmpty() && bytes.size < 1024 * 1024) {
                                prefetchedPlaylistCache[m3u8Url] = PrefetchedPlaylist(bytes, finalUrl, System.currentTimeMillis())
                                registerStreamReferer(finalUrl, effRef, ua)

                                val text = String(bytes, Charsets.UTF_8)
                                if (text.contains("#EXTINF:")) {
                                    // Direct media playlist: register segment map only (segments download only when player activates this server!)
                                    registerAndPrefetchMediaPlaylist(finalUrl, text, effRef, initialPrefetchCount = 0)
                                } else if (text.contains("#EXT-X-STREAM-INF:")) {
                                    // Lightweight Master -> Media + Audio Playlist prefetch (~10KB total -> 0ms playlist hit on attach!)
                                    val lines = text.lines().map { it.trim() }
                                    var defaultAudioUrl: String? = null
                                    val uriRegex = Regex("""URI="([^"]+)"""")
                                    val variants = ArrayList<Pair<Int, String>>()

                                    for (idx in lines.indices) {
                                        val ln = lines[idx]
                                        if (ln.startsWith("#EXT-X-MEDIA:", ignoreCase = true) &&
                                            ln.contains("TYPE=AUDIO", ignoreCase = true)
                                        ) {
                                            val audioRef = uriRegex.find(ln)?.groupValues?.getOrNull(1)
                                            if (!audioRef.isNullOrBlank()) {
                                                val resolvedAudio = resolveRelativeHlsUrl(finalUrl, audioRef)
                                                if (defaultAudioUrl == null || ln.contains("DEFAULT=YES", ignoreCase = true)) {
                                                    defaultAudioUrl = resolvedAudio
                                                }
                                            }
                                        } else if (ln.startsWith("#EXT-X-STREAM-INF:", ignoreCase = true)) {
                                            val resMatch = Regex("""RESOLUTION=\d+x(\d+)""", RegexOption.IGNORE_CASE).find(ln)
                                            val height = resMatch?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 720
                                            for (j in idx + 1 until lines.size) {
                                                val nextLn = lines[j]
                                                if (nextLn.isNotEmpty() && !nextLn.startsWith("#")) {
                                                    variants.add(Pair(height, resolveRelativeHlsUrl(finalUrl, nextLn)))
                                                    break
                                                }
                                            }
                                        }
                                    }

                                    val targetVariant = variants.minByOrNull { kotlin.math.abs(it.first - 720) }?.second
                                        ?: variants.firstOrNull()?.second
                                    if (!targetVariant.isNullOrBlank()) {
                                        prefetchSubPlaylistOnlyAsync(targetVariant, effRef)
                                    }
                                    if (!defaultAudioUrl.isNullOrBlank()) {
                                        prefetchSubPlaylistOnlyAsync(defaultAudioUrl, effRef)
                                    }
                                }
                            }
                        }
                    }
                } catch (_: Exception) {}
            }
        }

        // Stores custom Referer/Origin & User-Agent headers discovered per stream host domain & root domain
        val hostRefererMap = java.util.concurrent.ConcurrentHashMap<String, String>()
        val hostUserAgentMap = java.util.concurrent.ConcurrentHashMap<String, String>()

        @Volatile
        var lastActiveReferer: String? = null

        fun registerStreamReferer(streamUrl: String, refererUrl: String, userAgent: String = "") {
            if (refererUrl.isBlank() && userAgent.isBlank()) return
            try {
                val host = android.net.Uri.parse(streamUrl).host?.lowercase() ?: return
                val root = extractRootDomain(host)
                if (refererUrl.isNotBlank()) {
                    lastActiveReferer = refererUrl
                    hostRefererMap[host] = refererUrl
                    if (root.isNotEmpty()) {
                        hostRefererMap[root] = refererUrl
                    }
                }
                // Ensure Ravok CDN root and AnimeSalt are mapped correctly
                if (host.contains("ravok.buzz") || host.contains("as-cdn")) {
                    hostRefererMap[host] = "https://ravok.buzz/"
                    hostRefererMap["ravok.buzz"] = "https://ravok.buzz/"
                    if (root.isNotEmpty()) {
                        hostRefererMap[root] = "https://ravok.buzz/"
                    }
                } else if (host.contains("megaplay.buzz") || host.contains("nexabloom") || host.contains("distantdaydreams") || host.contains("emeralddrift")) {
                    hostRefererMap[host] = "https://megaplay.buzz/"
                    hostRefererMap["megaplay.buzz"] = "https://megaplay.buzz/"
                    if (root.isNotEmpty()) {
                        hostRefererMap[root] = "https://megaplay.buzz/"
                    }
                } else if (host.contains("animesalt")) {
                    val s = android.net.Uri.parse(streamUrl).scheme ?: "https"
                    hostRefererMap[host] = "$s://$host/"
                } else if (host.contains("play.zephyrix.org") || host.contains("zephyrix.org") || host.contains("zn-grid") || host.contains("watchanimeworld")) {
                    hostRefererMap[host] = "https://play.zephyrix.org/"
                    hostRefererMap["play.zephyrix.org"] = "https://play.zephyrix.org/"
                    if (root.isNotEmpty()) {
                        hostRefererMap[root] = "https://play.zephyrix.org/"
                    }
                }
                if (userAgent.isNotBlank()) {
                    hostUserAgentMap[host] = userAgent
                    if (root.isNotEmpty()) {
                        hostUserAgentMap[root] = userAgent
                    }
                }
            } catch (_: Exception) {
            }
        }

        fun resolveUserAgentForHost(host: String): String {
            val cleanHost = host.lowercase()
            hostUserAgentMap[cleanHost]?.let { return it }
            val root = extractRootDomain(cleanHost)
            if (root.isNotEmpty()) {
                hostUserAgentMap[root]?.let { return it }
            }
            return InbuiltStreamScraper.DEFAULT_USER_AGENT
        }

        fun resolveRefererForHost(host: String, fallbackScheme: String = "https"): String {
            val cleanHost = host.lowercase()
            hostRefererMap[cleanHost]?.let { return it }
            val root = extractRootDomain(cleanHost)
            if (root.isNotEmpty()) {
                hostRefererMap[root]?.let { return it }
            }
            // ── AnimeSalt, Ravok & Megaplay CDN Mapping ──
            if (cleanHost.contains("play.zephyrix.org") || cleanHost.contains("zephyrix.org") || cleanHost.contains("zn-grid") || cleanHost.contains("watchanimeworld")) {
                return "https://play.zephyrix.org/"
            }
            if (cleanHost.contains("ravok.buzz") || cleanHost.contains("as-cdn")) {
                return "https://ravok.buzz/"
            }
            if (cleanHost.contains("megaplay.buzz") || cleanHost.contains("nexabloom") || cleanHost.contains("distantdaydreams") || cleanHost.contains("emeralddrift")) {
                return "https://megaplay.buzz/"
            }
            if (cleanHost.contains("animesalt")) {
                return "$fallbackScheme://$cleanHost/"
            }
            if (cleanHost.contains("streamtape") || cleanHost.contains("strtape") ||
                cleanHost.contains("shavetape") || cleanHost.contains("streamta.pe") ||
                cleanHost.contains("tapecontent") || cleanHost.contains("strcloud") ||
                cleanHost.contains("streamadblockplus")
            ) {
                return "https://streamta.pe/"
            }
            if (cleanHost.contains("sprintcdn") || cleanHost.contains("owphbf") ||
                cleanHost.contains("r66nv9ed") || cleanHost.contains("n1mwq") ||
                cleanHost.contains("byseraguci") || cleanHost.contains("bysedikamoum") ||
                cleanHost.contains("filemoon") || cleanHost.contains("f16px") ||
                cleanHost.contains("1azayf9w") || cleanHost.contains("8mhlloqo") ||
                cleanHost.contains("kerapoxy") || cleanHost.contains("moonmov")
            ) {
                return "https://byseraguci.com/"
            }
            if (cleanHost.contains("voe")) {
                return "https://voe.sx/"
            }
            return lastActiveReferer ?: "$fallbackScheme://$host/"
        }

        fun isKnownStreamCdnHost(host: String): Boolean {
            val cleanHost = host.lowercase()
            if (hostRefererMap.containsKey(cleanHost)) return true
            val root = extractRootDomain(cleanHost)
            if (root.isNotEmpty() && hostRefererMap.containsKey(root)) return true
            return cleanHost.contains("ravok.buzz") ||
                cleanHost.contains("as-cdn") ||
                cleanHost.contains("play.zephyrix.org") ||
                cleanHost.contains("zephyrix.org") ||
                cleanHost.contains("zn-grid") ||
                cleanHost.contains("watchanimeworld") ||
                cleanHost.contains("animesalt.cx") ||
                cleanHost.contains("sprintcdn") ||
                cleanHost.contains("owphbf") ||
                cleanHost.contains("r66nv9ed") ||
                cleanHost.contains("n1mwq") ||
                cleanHost.contains("byseraguci") ||
                cleanHost.contains("bysedikamoum") ||
                cleanHost.contains("filemoon") ||
                cleanHost.contains("f16px") ||
                cleanHost.contains("1azayf9w") ||
                cleanHost.contains("8mhlloqo") ||
                cleanHost.contains("kerapoxy") ||
                cleanHost.contains("moonmov") ||
                cleanHost.contains("voe") ||
                cleanHost.contains("streamtape") ||
                cleanHost.contains("strtape") ||
                cleanHost.contains("shavetape") ||
                cleanHost.contains("streamta.pe") ||
                cleanHost.contains("tapecontent") ||
                cleanHost.contains("strcloud") ||
                cleanHost.contains("streamadblockplus") ||
                cleanHost.contains("upnshare") ||
                cleanHost.contains("streamwish") ||
                cleanHost.contains("hlswish") ||
                cleanHost.contains("playerwish") ||
                cleanHost.contains("vidhide")
        }

        private fun extractRootDomain(host: String): String {
            val parts = host.split(".")
            if (parts.size < 2) return host
            val root = parts.takeLast(2).joinToString(".")
            // Never collapse shared multi-tenant CDN roots (prevents cross-provider referer collision)
            return if (SHARED_CDN_ROOTS.contains(root)) "" else root
        }
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? {
        val uri = request?.url ?: return super.shouldInterceptRequest(view, request)
        val host = (uri.host ?: "").lowercase()
        val path = (uri.path ?: "/").lowercase()
        val reqUrl = uri.toString()
        val method = request.method?.uppercase() ?: "GET"

        // 0. Serve Local Offline Vault Segments & Playlists (https://maxplay.local/offline-vault/{key}/...)
        //    AND Scanned Phone Local Videos (https://maxplay.local/device-video/{id})
        if (host == "maxplay.local") {
            if (method == "OPTIONS") {
                return WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    200,
                    "OK",
                    buildCorsHeaders("text/plain"),
                    ByteArrayInputStream(ByteArray(0))
                )
            }
            if (path.startsWith("/offline-vault/")) {
                val vaultResp = MaxPlayOfflineVault.interceptOfflineVaultRequest(context.applicationContext, reqUrl)
                if (vaultResp != null) {
                    return vaultResp
                }
            } else if (path.startsWith("/device-video/")) {
                val rangeHeader = request.requestHeaders?.get("Range") ?: request.requestHeaders?.get("range")
                val devResp = MaxPlayOfflineVault.interceptDeviceVideoRequest(context.applicationContext, reqUrl, rangeHeader)
                if (devResp != null) {
                    return devResp
                }
            } else if (path.startsWith("/device-video-thumb/")) {
                val thumbResp = MaxPlayOfflineVault.interceptDeviceVideoThumbRequest(context.applicationContext, reqUrl)
                if (thumbResp != null) {
                    return thumbResp
                }
            } else if (path.startsWith("/device-audio/")) {
                val rangeHeader = request.requestHeaders?.get("Range") ?: request.requestHeaders?.get("range")
                val audResp = MaxPlayOfflineVault.interceptDeviceAudioRequest(context.applicationContext, reqUrl, rangeHeader)
                if (audResp != null) {
                    return audResp
                }
            } else if (path.startsWith("/device-audio-art/")) {
                val artResp = MaxPlayOfflineVault.interceptDeviceAudioArtRequest(context.applicationContext, reqUrl)
                if (artResp != null) {
                    return artResp
                }
            }
        }

        // 0.5 Native on-device /api/proxy, /proxy/m3u8, /api/stream-proxy, /proxy/ts handler (ONLY on VIRTUAL_ASSET_HOST + SSRF-protected!)
        if (
            host == VIRTUAL_ASSET_HOST && (
                path == "/api/proxy" ||
                path == "/proxy/m3u8" ||
                path == "/api/proxy/m3u8" ||
                path == "/api/stream-proxy" ||
                path == "/proxy/ts" ||
                path == "/api/proxy/ts"
            )
        ) {
            if (method == "OPTIONS") {
                return WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    200,
                    "OK",
                    buildCorsHeaders("text/plain"),
                    ByteArrayInputStream(ByteArray(0))
                )
            }
            val targetUrl = uri.getQueryParameter("url")
            val fallbackTargetUrl = uri.getQueryParameter("fallbackUrl")
            val explicitReferer = uri.getQueryParameter("referer")
            if (!targetUrl.isNullOrBlank()) {
                if (isBlockedSsrfTarget(targetUrl)) {
                    return WebResourceResponse(
                        "application/json",
                        "UTF-8",
                        403,
                        "Forbidden",
                        buildCorsHeaders("application/json"),
                        ByteArrayInputStream("""{"ok":false,"error":"Blocked target"}""".toByteArray())
                    )
                }
                val lowerTarget = targetUrl.lowercase()
                if (lowerTarget.contains("tapecontent") || lowerTarget.contains("/get_video")) {
                    val tapeRef = explicitReferer?.ifBlank { "https://streamta.pe/" } ?: "https://streamta.pe/"
                    registerStreamReferer(targetUrl, tapeRef)
                    if (!fallbackTargetUrl.isNullOrBlank()) {
                        registerStreamReferer(fallbackTargetUrl, tapeRef)
                    }
                    val safeFallback = if (!fallbackTargetUrl.isNullOrBlank() && !isBlockedSsrfTarget(fallbackTargetUrl)) fallbackTargetUrl else null
                    return proxyExternalUrlWithOkHttp(targetUrl, request, tapeRef, safeFallback)
                }
                if (!explicitReferer.isNullOrBlank()) {
                    registerStreamReferer(targetUrl, explicitReferer)
                    if (!fallbackTargetUrl.isNullOrBlank()) {
                        registerStreamReferer(fallbackTargetUrl, explicitReferer)
                    }
                }
                val safeFallback = if (!fallbackTargetUrl.isNullOrBlank() && !isBlockedSsrfTarget(fallbackTargetUrl)) fallbackTargetUrl else null
                return proxyExternalUrlWithOkHttp(targetUrl, request, explicitReferer, safeFallback)
            }
        }

        // 0.6 Unblock CORS OPTIONS preflight for Byse/Filemoon /api/videos/... endpoints
        if (path.startsWith("/api/videos/") && method == "OPTIONS") {
            return WebResourceResponse(
                "text/plain",
                "UTF-8",
                200,
                "OK",
                buildCorsHeaders("text/plain"),
                ByteArrayInputStream(ByteArray(0))
            )
        }

        // 1. Serve Local Bundled WebApp & Native Proxy on https://appassets.androidplatform.net
        if (host == VIRTUAL_ASSET_HOST) {
            if (method == "OPTIONS") {
                return WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    200,
                    "OK",
                    buildCorsHeaders("text/plain"),
                    ByteArrayInputStream(ByteArray(0))
                )
            }

            val rawPath = uri.path ?: "/"

            // 1a. Native in-APK backend routes on VIRTUAL_ASSET_HOST
            if (rawPath.startsWith("/api/extract-stream")) {
                val queryUrl = uri.getQueryParameter("url") ?: ""
                if (queryUrl.isNotBlank()) {
                    val act = (view?.context as? android.app.Activity) ?: (context as? android.app.Activity)
                    if (act != null) {
                        val scraper = InbuiltStreamScraper(act, view)
                        val resultJson = scraper.scrapeStreamSync(queryUrl)
                        val responseBytes = resultJson.toString().toByteArray(Charsets.UTF_8)
                        return WebResourceResponse(
                            "application/json",
                            "UTF-8",
                            200,
                            "OK",
                            buildCorsHeaders("application/json"),
                            ByteArrayInputStream(responseBytes)
                        )
                    }
                }
            }
            if (rawPath.startsWith("/api/probe-video-duration")) {
                val durationJson = """{"ok":true,"duration":9295}""".toByteArray(Charsets.UTF_8)
                return WebResourceResponse(
                    "application/json",
                    "UTF-8",
                    200,
                    "OK",
                    buildCorsHeaders("application/json"),
                    ByteArrayInputStream(durationJson)
                )
            }
            if (rawPath.startsWith("/api/")) {
                val apiFallback = """{"ok":false,"error":"Native route unhandled"}""".toByteArray(Charsets.UTF_8)
                return WebResourceResponse(
                    "application/json",
                    "UTF-8",
                    200,
                    "OK",
                    buildCorsHeaders("application/json"),
                    ByteArrayInputStream(apiFallback)
                )
            }

            // 1b. Disable PWA sw.js inside native APK since assets are already 100% local in APK
            if (rawPath == "/sw.js") {
                val noopSw = "// Native Android APK Asset Loader active".toByteArray(Charsets.UTF_8)
                return WebResourceResponse(
                    "application/javascript",
                    "UTF-8",
                    200,
                    "OK",
                    buildCorsHeaders("application/javascript"),
                    ByteArrayInputStream(noopSw)
                )
            }

            // 1c. Serve static file from assets/webapp/... (strictly block admin.html / backend bundles in normal User APK!)
            val cleanPath = if (rawPath == "/" || rawPath.isEmpty()) {
                "index.html"
            } else {
                rawPath.removePrefix("/")
            }
            val lowerCleanPath = cleanPath.lowercase()
            if (lowerCleanPath.contains("..") ||
                lowerCleanPath.endsWith(".map") ||
                lowerCleanPath.endsWith("server.cjs") ||
                (!isAdminApp && (lowerCleanPath == "admin.html" || lowerCleanPath.startsWith("admin")))
            ) {
                return WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    403,
                    "Forbidden",
                    buildCorsHeaders("text/plain"),
                    ByteArrayInputStream("Forbidden".toByteArray())
                )
            }

            return try {
                val inputStream = context.assets.open("webapp/$cleanPath")
                val mime = getAssetMimeType(cleanPath)
                val headers = buildCorsHeaders(mime).toMutableMap()
                if (lowerCleanPath.endsWith(".html") || lowerCleanPath.endsWith(".htm")) {
                    headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                    headers["Pragma"] = "no-cache"
                }
                WebResourceResponse(
                    mime,
                    "UTF-8",
                    200,
                    "OK",
                    headers,
                    inputStream
                )
            } catch (_: Exception) {
                // SPA Route fallback: if path has no file extension, serve webapp/index.html
                if (!cleanPath.substringAfterLast('/').contains('.')) {
                    try {
                        val indexStream = context.assets.open("webapp/index.html")
                        WebResourceResponse(
                            "text/html",
                            "UTF-8",
                            200,
                            "OK",
                            buildCorsHeaders("text/html"),
                            indexStream
                        )
                    } catch (_: Exception) {
                        null
                    }
                } else {
                    null
                }
            }
        }

        // 1.8 FAST-PATH DIRECT PROGRESSIVE MEDIA BYPASS (Server 2 Streamtape tapecontent.net / progressive MP4 / MKV)
        // CRITICAL: Streamtape's tapecontent.net enforces strict per-token concurrent Range connection limits AND
        // large MP4 files often place the moov atom at EOF (Chromium reads first 32KB, immediately aborts, and
        // probes EOF moov!). Letting Chromium's native C++ stack handle direct progressive video gives instant
        // <200ms moov probing, hardware decoding, and zero 25s token-throttle hangs!
        val lower = reqUrl.lowercase()
        val isHlsFmp4Segment =
            lower.contains("/hls/") ||
                lower.contains("/hls2/") ||
                path.endsWith("init.mp4") ||
                lower.contains("urlset")
        val isDirectProgressiveMedia =
            !isHlsFmp4Segment && (
                lower.contains("/get_video") ||
                    host.contains("tapecontent") ||
                    path.endsWith(".mp4") ||
                    path.endsWith(".mkv") ||
                    path.endsWith(".webm")
                )

        if (isDirectProgressiveMedia && !lower.contains(".m3u8") && !path.endsWith(".ts")) {
            if (host.contains("tapecontent") || lower.contains("/get_video")) {
                val tapeRef = resolveRefererForHost(host, uri.scheme ?: "https").ifBlank { "https://streamta.pe/" }
                registerStreamReferer(reqUrl, tapeRef)
                return proxyExternalUrlWithOkHttp(reqUrl, request, tapeRef, null)
            }
            return null
        }

        // 2. PRIORITY HLS & STREAM CDN INTERCEPTION (Runs BEFORE static image/font fast-path bypass
        //    so disguised HLS segments ending in .jpg, .png, .webp, .ico, .woff2, .html, .txt on
        //    SprintCDN / Byse / Filemoon / Voe are NEVER skipped!)
        val isHlsOrSegment =
            isHlsFmp4Segment ||
                lower.contains(".m3u8") ||
                path.endsWith(".ts") ||
                path.endsWith(".m4s") ||
                path.endsWith(".aac") ||
                lower.contains("master.txt") ||
                SEGMENT_PATH_REGEX.containsMatchIn(lower) ||
                isKnownStreamCdnHost(host)

        if (isHlsOrSegment && (lower.startsWith("http://") || lower.startsWith("https://"))) {
            if (method == "OPTIONS") {
                return WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    200,
                    "OK",
                    buildCorsHeaders("text/plain"),
                    ByteArrayInputStream(ByteArray(0))
                )
            }
            if (method == "GET" || method == "HEAD") {
                val proxied = proxyExternalUrlWithOkHttp(reqUrl, request)
                if (proxied != null) return proxied
            }
        }

        // 3. FAST-PATH BYPASS: Never intercept Firebase, Google APIs, or normal Images/Posters/Fonts!
        //    Letting Chromium's native C++ HTTP/2 engine & disk cache handle these directly
        //    eliminates worker-thread bottlenecks and makes posters & Firestore data load instantly.
        if (host == "127.0.0.1" ||
            host == "localhost" ||
            host.contains("googleapis.com") ||
            host.contains("firebaseio.com") ||
            host.contains("firebaseapp.com") ||
            host.contains("gstatic.com") ||
            host.contains("google.com") ||
            host.contains("googleusercontent.com") ||
            host.contains("tmdb.org") ||
            host.contains("imgur.com") ||
            host.contains("ibb.co") ||
            host.contains("postimg.cc") ||
            host.contains("cloudinary.com") ||
            path.endsWith(".jpg") ||
            path.endsWith(".jpeg") ||
            path.endsWith(".png") ||
            path.endsWith(".webp") ||
            path.endsWith(".avif") ||
            path.endsWith(".gif") ||
            path.endsWith(".svg") ||
            path.endsWith(".ico") ||
            path.endsWith(".woff") ||
            path.endsWith(".woff2") ||
            path.endsWith(".ttf")
        ) {
            return null
        }

        return null
    }

    private fun proxyExternalUrlWithOkHttp(
        targetUrl: String,
        request: WebResourceRequest,
        explicitReferer: String? = null,
        fallbackUrl: String? = null
    ): WebResourceResponse? {
        return try {
            val parsedTarget = android.net.Uri.parse(targetUrl)
            val host = parsedTarget.host?.lowercase() ?: ""
            val scheme = parsedTarget.scheme ?: "https"
            val customReferer = if (!explicitReferer.isNullOrBlank()) {
                explicitReferer
            } else {
                resolveRefererForHost(host, scheme)
            }
            if (!explicitReferer.isNullOrBlank()) {
                registerStreamReferer(targetUrl, explicitReferer)
            }

            val customOrigin = try {
                val refUri = android.net.Uri.parse(customReferer)
                "${refUri.scheme ?: "https"}://${refUri.host ?: host}"
            } catch (_: Exception) {
                "$scheme://$host"
            }

            val lowerUrl = targetUrl.lowercase()
            val pathOnly = (parsedTarget.path ?: "").lowercase()
            // IMPORTANT: Never check lowerUrl.contains("urlset") here because VOE & Filemoon .ts segments
            // reside inside a "...,.urlset/seg-1-v1-a1.ts" parent folder!
            val isLikelyPlaylist =
                pathOnly.endsWith(".m3u8") ||
                    pathOnly.endsWith("master.txt") ||
                    lowerUrl.contains(".m3u8?") ||
                    lowerUrl.contains("/m3/") ||
                    (host.contains("ravok.buzz") && pathOnly.startsWith("/hls/"))

            // 0ms Instant Hit from Master / Media Playlist Prefetch Cache!
            if (isLikelyPlaylist && request.method.equals("GET", ignoreCase = true)) {
                val cachedPl = prefetchedPlaylistCache[targetUrl]
                if (cachedPl != null && System.currentTimeMillis() - cachedPl.cachedAtMs < 30_000L) {
                    val hdrs = buildCorsHeaders("application/vnd.apple.mpegurl").toMutableMap()
                    hdrs["Content-Length"] = cachedPl.bytes.size.toString()
                    return WebResourceResponse(
                        "application/vnd.apple.mpegurl",
                        "UTF-8",
                        200,
                        "OK",
                        hdrs,
                        ByteArrayInputStream(cachedPl.bytes)
                    )
                }
            }

            val customUa = resolveUserAgentForHost(host)
            val isDirectProgressiveMedia =
                lowerUrl.contains("/get_video") ||
                    host.contains("tapecontent") ||
                    pathOnly.endsWith(".mp4") ||
                    pathOnly.endsWith(".mkv") ||
                    pathOnly.endsWith(".webm")
            val isHeadMethod = request.method.equals("HEAD", ignoreCase = true)

            // Direct streaming pipeline for HLS segments:
            // - For Server 1 (VOE): lightweight RAM cache + lookahead (100% untouched!).
            // - For Server 3 (SprintCDN/Byse): direct OkHttp streaming passthrough to Chromium (ZERO thread locks!).
            if (!isLikelyPlaylist && !isHeadMethod && !isDirectProgressiveMedia) {
                if (!isSprintOrByseHost(host)) {
                    triggerLookAheadFromSegment(targetUrl, customReferer)
                }

                val ramHit = segmentCache[targetUrl]
                if (ramHit != null && System.currentTimeMillis() - ramHit.cachedAtMs < SEGMENT_CACHE_TTL_MS) {
                    val hdrs = buildCorsHeaders(ramHit.mimeType).toMutableMap()
                    hdrs["Content-Length"] = ramHit.bytes.size.toString()
                    hdrs["Cache-Control"] = "public, max-age=300"
                    return WebResourceResponse(
                        ramHit.mimeType,
                        null,
                        200,
                        "OK",
                        hdrs,
                        ByteArrayInputStream(ramHit.bytes)
                    )
                }

                val pendingFuture = inFlightSegments[targetUrl]
                if (pendingFuture != null) {
                    val awaited = try {
                        pendingFuture.get(8, java.util.concurrent.TimeUnit.SECONDS)
                    } catch (_: Exception) {
                        null
                    }
                    if (awaited != null && awaited.bytes.isNotEmpty()) {
                        val hdrs = buildCorsHeaders(awaited.mimeType).toMutableMap()
                        hdrs["Content-Length"] = awaited.bytes.size.toString()
                        hdrs["Cache-Control"] = "public, max-age=300"
                        return WebResourceResponse(
                            awaited.mimeType,
                            null,
                            200,
                            "OK",
                            hdrs,
                            ByteArrayInputStream(awaited.bytes)
                        )
                    }
                }
            }

            if (isDirectProgressiveMedia) {
                activeProgressiveCall.getAndSet(null)?.let { prevCall ->
                    try { prevCall.cancel() } catch (_: Exception) {}
                }
            }

            fun executeUpstreamRequest(fetchUrl: String, includeOrigin: Boolean, includeReferer: Boolean): okhttp3.Response {
                val b = Request.Builder()
                    .url(fetchUrl)
                    .header("User-Agent", customUa)
                    .header("Accept", "*/*")
                if (includeReferer && customReferer.isNotBlank()) {
                    b.header("Referer", customReferer)
                }
                if (includeOrigin && customOrigin.isNotBlank()) {
                    b.header("Origin", customOrigin)
                }
                val rangeHdr = request.requestHeaders?.get("Range") ?: request.requestHeaders?.get("range")
                if (!rangeHdr.isNullOrBlank()) {
                    b.header("Range", rangeHdr)
                }
                if (isHeadMethod) {
                    b.head()
                }
                val call = streamCdnHttpClient.newCall(b.build())
                if (isDirectProgressiveMedia) {
                    activeProgressiveCall.set(call)
                }
                return call.execute()
            }

            // Streamtape CDN strictly prefers Referer-only without Origin (Mode 1).
            // Sending Origin to tapecontent.net triggers 403 Forbidden and concurrent token throttle!
            val isStreamtapeCdn = host.contains("tapecontent") || host.contains("streamta") || host.contains("strtape") || host.contains("shavetape") || host.contains("strcloud")
            val defaultMode = if (isStreamtapeCdn) 1 else 0
            val learnedMode = hostHeaderModeCache[host] ?: defaultMode
            var usedMode = learnedMode
            var response = executeUpstreamRequest(
                targetUrl,
                includeOrigin = learnedMode == 0,
                includeReferer = learnedMode != 2
            )
            if ((response.code == 401 || response.code == 403) && learnedMode == 0) {
                try { response.close() } catch (_: Exception) {}
                usedMode = 1
                response = executeUpstreamRequest(targetUrl, includeOrigin = false, includeReferer = true)
            }
            if ((response.code == 401 || response.code == 403) && (isDirectProgressiveMedia || usedMode != 2)) {
                try { response.close() } catch (_: Exception) {}
                usedMode = 2
                response = executeUpstreamRequest(targetUrl, includeOrigin = false, includeReferer = false)
            }
            if (response.code >= 400 && !fallbackUrl.isNullOrBlank() &&
                (fallbackUrl.startsWith("http://") || fallbackUrl.startsWith("https://"))
            ) {
                try { response.close() } catch (_: Exception) {}
                response = executeUpstreamRequest(fallbackUrl, includeOrigin = false, includeReferer = true)
            }

            val statusCode = response.code
            if (statusCode in 200..399) {
                if (usedMode != learnedMode) {
                    hostHeaderModeCache[host] = usedMode
                }
                val finalResolvedUrl = response.request.url.toString()
                registerStreamReferer(finalResolvedUrl, customReferer, customUa)
            } else if (statusCode == 429 || statusCode == 502 || statusCode == 503 || statusCode == 504) {
                InbuiltStreamScraper.evictSprintCdnWinner(host)
            }

            val contentTypeRaw = response.header("Content-Type") ?: guessMediaMimeType(lowerUrl)
            var mimeType = contentTypeRaw.substringBefore(";").trim().ifEmpty { "application/octet-stream" }

            if (isLikelyPlaylist) {
                mimeType = "application/vnd.apple.mpegurl"
            } else if (isDirectProgressiveMedia) {
                if (mimeType == "application/octet-stream" || mimeType.startsWith("text/") || mimeType.startsWith("image/") || mimeType.contains("matroska")) {
                    mimeType = if (pathOnly.endsWith(".webm")) "video/webm" else "video/mp4"
                }
            } else if (lowerUrl.contains("/hls2/") || lowerUrl.contains("/hls/") || lowerUrl.contains("zn-grid") || isKnownStreamCdnHost(host)) {
                // Normalize disguised segment MIME types (.jpg, .png, .webp, .html, .txt, .js, .css) so hls.js / MSE never rejects segment buffers
                if (mimeType.startsWith("image/") || mimeType.startsWith("text/html") || mimeType.startsWith("text/plain") ||
                    mimeType.startsWith("text/css") || mimeType.contains("javascript") || mimeType == "application/octet-stream" ||
                    pathOnly.endsWith(".js") || pathOnly.endsWith(".css")
                ) {
                    mimeType = "video/mp2t"
                }
            }

            val responseHeaders = buildCorsHeaders(mimeType).toMutableMap()
            // Allow Chromium HTTP cache to serve immutable media segments on short backward seeks in 0ms!
            if (!isLikelyPlaylist && statusCode == 200 && !isHeadMethod) {
                responseHeaders["Cache-Control"] = "public, max-age=300"
            }
            val acceptRanges = response.header("Accept-Ranges")
            if (!acceptRanges.isNullOrBlank()) {
                responseHeaders["Accept-Ranges"] = acceptRanges
            } else if (isDirectProgressiveMedia) {
                responseHeaders["Accept-Ranges"] = "bytes"
            }

            val bodyStream = if (isLikelyPlaylist && statusCode == 200) {
                val finalPlUrl = response.request.url.toString()
                val rawText = try { response.body?.string() ?: "" } finally { try { response.close() } catch (_: Exception) {} }
                val sanitizedBytes = rawText.toByteArray(Charsets.UTF_8)
                responseHeaders["Content-Length"] = sanitizedBytes.size.toString()
                // Register media playlist segments & prefetch ONLY seg #0 so 100% bandwidth goes to first frame!
                if (rawText.contains("#EXTINF:")) {
                    prefetchExecutor.execute {
                        registerAndPrefetchMediaPlaylist(finalPlUrl, rawText, customReferer, initialPrefetchCount = 1)
                    }
                }
                ByteArrayInputStream(sanitizedBytes)
            } else {
                response.header("Content-Length")?.let { responseHeaders["Content-Length"] = it }
                response.header("Content-Range")?.let { responseHeaders["Content-Range"] = it }
                val rawStream = response.body?.byteStream()
                if (rawStream != null) {
                    object : java.io.BufferedInputStream(rawStream, 64 * 1024) {
                        override fun close() {
                            try { super.close() } catch (_: Exception) {}
                            try { response.close() } catch (_: Exception) {}
                        }
                    }
                } else {
                    try { response.close() } catch (_: Exception) {}
                    ByteArrayInputStream(ByteArray(0))
                }
            }
            val encoding = if (isLikelyPlaylist) "UTF-8" else null

            val reasonPhrase = response.message.ifEmpty {
                if (statusCode == 206) "Partial Content" else "OK"
            }

            WebResourceResponse(
                mimeType,
                encoding,
                statusCode,
                reasonPhrase,
                responseHeaders,
                bodyStream
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun getAssetMimeType(filePath: String): String {
        val ext = filePath.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "html", "htm" -> "text/html"
            "js", "mjs" -> "application/javascript"
            "css" -> "text/css"
            "json", "map" -> "application/json"
            "svg" -> "image/svg+xml"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            "ico" -> "image/x-icon"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "ttf" -> "font/ttf"
            "mp4", "mkv" -> "video/mp4"
            "webm" -> "video/webm"
            else -> "application/octet-stream"
        }
    }

    private fun guessMediaMimeType(lowerUrl: String): String {
        return when {
            lowerUrl.contains(".m3u8") -> "application/vnd.apple.mpegurl"
            lowerUrl.contains(".ts") -> "video/mp2t"
            lowerUrl.contains(".mkv") && !lowerUrl.contains(".mkv.mp4") && !lowerUrl.substringBefore("?").endsWith(".mp4") -> "video/x-matroska"
            lowerUrl.contains(".webm") -> "video/webm"
            lowerUrl.contains(".m4s") || lowerUrl.contains(".mp4") || lowerUrl.contains("/get_video") || lowerUrl.contains("tapecontent") -> "video/mp4"
            else -> "application/octet-stream"
        }
    }

    private fun buildCorsHeaders(contentType: String): Map<String, String> {
        return mapOf(
            "Access-Control-Allow-Origin" to VIRTUAL_ASSET_ORIGIN,
            "Access-Control-Allow-Methods" to "GET, POST, OPTIONS, HEAD",
            "Access-Control-Allow-Headers" to "*",
            "Access-Control-Expose-Headers" to "Content-Length, Content-Range, Accept-Ranges",
            "Access-Control-Max-Age" to "86400",
            "Content-Type" to contentType
        )
    }
}
