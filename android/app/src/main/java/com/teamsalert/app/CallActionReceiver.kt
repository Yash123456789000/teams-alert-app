package com.teamsalert.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import io.wazo.callkeep.VoiceConnectionService

/**
 * Handles the "Decline" button of the ringing notification. Runs natively so it works even
 * when no JavaScript is running: it stops the ringing and rejects the Telecom connection that
 * react-native-callkeep created for this alert.
 */
class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != CallNotifications.ACTION_DECLINE) return
    val uuid = intent.getStringExtra(CallNotifications.EXTRA_CALL_UUID) ?: return

    CallNotifications.cancel(context, uuid)

    try {
      // Same effect as RNCallKeep.rejectCall(uuid) from JS.
      VoiceConnectionService.getConnection(uuid)?.onReject()
    } catch (t: Throwable) {
      Log.w("TeamsAlertCall", "Could not reject call $uuid", t)
    }
  }
}
