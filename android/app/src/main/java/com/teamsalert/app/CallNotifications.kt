package com.teamsalert.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Builds and cancels the ringing "incoming call" notification.
 *
 * In Telecom *self-managed* mode (which react-native-callkeep is configured for) the system draws NO
 * incoming-call UI: the app must post its own high-priority notification with a full-screen intent.
 * That is what this does. Tapping the notification / the full-screen intent opens MainActivity with
 * a `teamsalert://incoming/<uuid>` URL, "Answer" opens it with `teamsalert://answer/<uuid>`, and
 * "Decline" goes to [CallActionReceiver].
 */
object CallNotifications {
  private const val TAG = "TeamsAlertCall"

  // Bump the suffix if you ever change the channel's sound/vibration: Android caches channel settings.
  const val CHANNEL_ID = "teams_alert_incoming_call_v1"
  const val NOTIFICATION_ID = 4242
  const val ACTION_DECLINE = "com.teamsalert.app.action.DECLINE_CALL"
  const val EXTRA_CALL_UUID = "callUuid"

  /** Stop ringing by itself after this long if nobody answers. */
  private const val RING_TIMEOUT_MS = 45_000L

  private val VIBRATION_PATTERN = longArrayOf(0, 800, 600, 800, 600, 800, 600)

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
        CHANNEL_ID, "Incoming Teams alerts", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Rings like an incoming call when a watched person messages you on Teams."
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      enableVibration(true)
      vibrationPattern = VIBRATION_PATTERN
      setSound(
          RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
          AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIC)
              .build())
    }
    manager.createNotificationChannel(channel)
  }

  /** @return true if a notification was posted, false if notifications are blocked. */
  fun show(context: Context, uuid: String, caller: String): Boolean {
    ensureChannel(context)

    val notifications = NotificationManagerCompat.from(context)
    if (!notifications.areNotificationsEnabled()) {
      Log.w(TAG, "Notifications are disabled for this app; the incoming-call alert cannot be shown.")
      return false
    }

    val incomingPi = activityIntent(context, "incoming", uuid)
    val answerPi = activityIntent(context, "answer", uuid)
    val declinePi = PendingIntent.getBroadcast(
        context,
        requestCode("decline", uuid),
        Intent(context, CallActionReceiver::class.java).apply {
          action = ACTION_DECLINE
          putExtra(EXTRA_CALL_UUID, uuid)
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_call)
        .setContentTitle(caller)
        .setContentText("Incoming Teams alert")
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setAutoCancel(false)
        .setTimeoutAfter(RING_TIMEOUT_MS)
        .setContentIntent(incomingPi)
        .setFullScreenIntent(incomingPi, true)
        // Pre-Android-8 devices ignore the channel, so repeat the sound/vibration here.
        .setSound(ringtone)
        .setVibrate(VIBRATION_PATTERN)
        .addAction(0, "Decline", declinePi)
        .addAction(0, "Answer", answerPi)
        .build()

    // Keep ringing (repeat the channel sound) until answered, declined or timed out.
    notification.flags = notification.flags or Notification.FLAG_INSISTENT

    notifications.notify(uuid, NOTIFICATION_ID, notification)
    return true
  }

  fun cancel(context: Context, uuid: String) {
    NotificationManagerCompat.from(context).cancel(uuid, NOTIFICATION_ID)
  }

  private fun activityIntent(context: Context, kind: String, uuid: String): PendingIntent {
    // ACTION_VIEW + data is required so React Native's Linking module reports it
    // (getInitialURL on a cold start, the 'url' event via onNewIntent otherwise).
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("teamsalert://$kind/$uuid")).apply {
      setClass(context, MainActivity::class.java)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
        context,
        requestCode(kind, uuid),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun requestCode(kind: String, uuid: String): Int = (kind + uuid).hashCode()
}
