package com.maxplay.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * BroadcastReceiver triggered when device boots, app is updated, or AlarmManager fires.
 * Schedules and runs notification checks even if MainActivity is not active.
 */
class MaxPlayNotificationAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_CHECK = "com.maxplay.app.CHECK_NOTIFICATIONS"
        private const val ALARM_REQ_CODE = 202612

        fun scheduleAlarm(context: Context) {
            try {
                val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val intent = Intent(context, MaxPlayNotificationAlarmReceiver::class.java).apply {
                    action = ACTION_CHECK
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val pi = PendingIntent.getBroadcast(context, ALARM_REQ_CODE, intent, flags)
                val intervalMs = 15 * 60 * 1000L
                val triggerAtMs = System.currentTimeMillis() + intervalMs

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi)
                } else {
                    am.setInexactRepeating(AlarmManager.RTC_WAKEUP, triggerAtMs, intervalMs, pi)
                }
            } catch (_: Throwable) {}
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                MaxPlayNotificationJobService.schedule(context)
                scheduleAlarm(context)
                MaxPlayNotificationJobService.checkAndDispatchNewMessages(context)
            }
            ACTION_CHECK -> {
                MaxPlayNotificationJobService.checkAndDispatchNewMessages(context)
                scheduleAlarm(context)
            }
        }
    }
}
