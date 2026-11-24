package com.maxplay.app

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.util.HashSet

/**
 * Background JobService that wakes up even when MaxPlay is closed or phone is idle,
 * checks Firestore for admin broadcast messages, and posts native status bar notifications.
 */
class MaxPlayNotificationJobService : JobService() {

    companion object {
        const val JOB_ID = 202611
        private const val PERIOD_MS = 15 * 60 * 1000L // 15 minutes (Android standard minimum periodic interval)

        fun schedule(context: Context) {
            try {
                val js = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return
                val isScheduled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    js.getPendingJob(JOB_ID) != null
                } else {
                    js.allPendingJobs.any { it.id == JOB_ID }
                }
                if (isScheduled) return

                val component = ComponentName(context, MaxPlayNotificationJobService::class.java)
                val builder = JobInfo.Builder(JOB_ID, component)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPeriodic(PERIOD_MS)
                    .setPersisted(true)

                js.schedule(builder.build())
            } catch (_: Throwable) {}
        }

        fun checkAndDispatchNewMessages(context: Context) {
            InbuiltStreamScraper.backgroundExecutor.execute {
                try {
                    val prefs = context.getSharedPreferences("maxplay_native_notifs", Context.MODE_PRIVATE)
                    val isInitialized = prefs.getBoolean("initialized", false)
                    val seenSet = HashSet(prefs.getStringSet("seen_doc_ids", emptySet()) ?: emptySet())

                    val req = okhttp3.Request.Builder()
                        .url(MainActivity.FIRESTORE_MESSAGES_REST_URL)
                        .header("User-Agent", InbuiltStreamScraper.DEFAULT_USER_AGENT)
                        .build()

                    InbuiltStreamScraper.okHttpClient.newCall(req).execute().use { resp ->
                        if (!resp.isSuccessful) return@use
                        val bodyStr = resp.body?.string() ?: return@use
                        val root = JSONObject(bodyStr)
                        val docs = root.optJSONArray("documents") ?: return@use

                        var newestNewTitle = ""
                        var newestNewBody = ""
                        var newestNewImg = ""
                        var newestTimestamp = ""

                        for (i in 0 until docs.length()) {
                            val doc = docs.optJSONObject(i) ?: continue
                            val fullName = doc.optString("name", "")
                            val docId = fullName.substringAfterLast("/")
                            if (docId.isBlank()) continue

                            val fields = doc.optJSONObject("fields") ?: continue
                            val targetType = fields.optJSONObject("targetType")?.optString("stringValue", "all") ?: "all"
                            if (targetType == "user") continue

                            if (!seenSet.contains(docId)) {
                                seenSet.add(docId)
                                val createdAt = fields.optJSONObject("createdAt")?.optString("stringValue", "")
                                    ?: doc.optString("createTime", "")
                                if (newestNewTitle.isBlank() || createdAt >= newestTimestamp) {
                                    newestTimestamp = createdAt
                                    newestNewTitle = fields.optJSONObject("title")?.optString("stringValue", "") ?: ""
                                    newestNewBody = fields.optJSONObject("body")?.optString("stringValue", "") ?: "New update in MaxPlay"
                                    val bannerUrl = fields.optJSONObject("bannerUrl")?.optString("stringValue", "") ?: ""
                                    val imageUrl = fields.optJSONObject("imageUrl")?.optString("stringValue", "") ?: ""
                                    val attachedFields = fields.optJSONObject("attachedContent")
                                        ?.optJSONObject("mapValue")
                                        ?.optJSONObject("fields")
                                    val backdropUrl = attachedFields?.optJSONObject("backdropUrl")?.optString("stringValue", "") ?: ""
                                    val posterUrl = attachedFields?.optJSONObject("posterUrl")?.optString("stringValue", "") ?: ""
                                    newestNewImg = listOf(bannerUrl, imageUrl, backdropUrl, posterUrl).firstOrNull { it.isNotBlank() } ?: ""
                                }
                            }
                        }

                        prefs.edit()
                            .putBoolean("initialized", true)
                            .putStringSet("seen_doc_ids", seenSet)
                            .apply()

                        if (isInitialized && newestNewTitle.isNotBlank()) {
                            sendNativeNotification(context, newestNewTitle, newestNewBody, newestNewImg)
                        }
                    }
                } catch (_: Throwable) {}
            }
        }

        fun sendNativeNotification(context: Context, title: String, body: String, imageUrl: String = "") {
            InbuiltStreamScraper.backgroundExecutor.execute {
                val bitmap: android.graphics.Bitmap? = if (imageUrl.startsWith("http", ignoreCase = true)) {
                    try {
                        val req = okhttp3.Request.Builder()
                            .url(imageUrl)
                            .header("User-Agent", InbuiltStreamScraper.DEFAULT_USER_AGENT)
                            .build()
                        InbuiltStreamScraper.okHttpClient.newCall(req).execute().use { resp ->
                            if (resp.isSuccessful) {
                                val cl = resp.header("Content-Length")?.toLongOrNull() ?: 0L
                                if (cl <= 2 * 1024 * 1024L) {
                                    val bytes = resp.body?.bytes()
                                    if (bytes != null && bytes.isNotEmpty() && bytes.size <= 2 * 1024 * 1024) {
                                        val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                                        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                                        var sample = 1
                                        while (bounds.outWidth / sample > 512 || bounds.outHeight / sample > 512) {
                                            sample *= 2
                                        }
                                        val decodeOpts = android.graphics.BitmapFactory.Options().apply { inSampleSize = sample }
                                        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOpts)
                                    } else null
                                } else null
                            } else null
                        }
                    } catch (_: Throwable) {
                        null
                    }
                } else null

                val appLogoBitmap: android.graphics.Bitmap? = try {
                    android.graphics.BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)
                } catch (_: Throwable) {
                    null
                }

                try {
                    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager ?: return@execute

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val ch = android.app.NotificationChannel(
                            "maxplay_inbox_alerts",
                            "Announcements & Inbox Messages",
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        ).apply {
                            description = "Real-time notifications for MaxPlay inbox messages and updates"
                            enableLights(true)
                            enableVibration(true)
                        }
                        nm.createNotificationChannel(ch)
                    }

                    val intent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra("open_messages", true)
                    }
                    val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = android.app.PendingIntent.getActivity(context, 2001, intent, pendingFlags)

                    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        android.app.Notification.Builder(context, "maxplay_inbox_alerts")
                    } else {
                        @Suppress("DEPRECATION")
                        android.app.Notification.Builder(context)
                    }

                    builder.setSmallIcon(R.drawable.ic_stat_maxplay)
                        .setColor(0xFF8B5CF6.toInt())
                        .setContentTitle(title.ifBlank { "MaxPlay" })
                        .setContentText(body)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)

                    if (bitmap != null) {
                        builder.setLargeIcon(bitmap)
                        builder.setStyle(
                            android.app.Notification.BigPictureStyle()
                                .bigPicture(bitmap)
                                .setBigContentTitle(title.ifBlank { "MaxPlay" })
                                .setSummaryText(body)
                        )
                    } else {
                        if (appLogoBitmap != null) {
                            builder.setLargeIcon(appLogoBitmap)
                        }
                        builder.setStyle(
                            android.app.Notification.BigTextStyle()
                                .setBigContentTitle(title.ifBlank { "MaxPlay" })
                                .bigText(body)
                        )
                    }

                    val notifId = ((title + "|" + body).hashCode() and 0x7FFFFFFF).coerceAtLeast(1000)
                    nm.notify(notifId, builder.build())
                } catch (_: Throwable) {}
            }
        }
    }

    override fun onStartJob(params: JobParameters?): Boolean {
        InbuiltStreamScraper.backgroundExecutor.execute {
            try {
                checkAndDispatchNewMessages(applicationContext)
            } finally {
                jobFinished(params, false)
            }
        }
        return true
    }

    override fun onStopJob(params: JobParameters?): Boolean {
        return true
    }
}
