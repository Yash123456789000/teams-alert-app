package com.teamsalert.app

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** JS-facing wrapper around [CallNotifications]. Exposed to JS as NativeModules.TeamsAlertCall. */
class TeamsAlertCallModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "TeamsAlertCall"

  private val appContext: Context
    get() = reactApplicationContext.applicationContext

  /** Post the ringing notification. Resolves true if it was posted, false if notifications are blocked. */
  @ReactMethod
  fun show(uuid: String, caller: String, promise: Promise) {
    try {
      promise.resolve(CallNotifications.show(appContext, uuid, caller))
    } catch (t: Throwable) {
      promise.reject("E_SHOW_FAILED", t)
    }
  }

  @ReactMethod
  fun cancel(uuid: String) {
    CallNotifications.cancel(appContext, uuid)
  }

  /** Android 14+ can revoke the full-screen-intent permission for non-Play-Store installs. */
  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        promise.resolve(manager.canUseFullScreenIntent())
      } else {
        promise.resolve(true)
      }
    } catch (t: Throwable) {
      promise.reject("E_FSI_CHECK_FAILED", t)
    }
  }

  @ReactMethod
  fun openFullScreenIntentSettings() {
    val pkg = appContext.packageName
    val intent =
        if (Build.VERSION.SDK_INT >= 34) {
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$pkg"))
        } else {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
              .putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
        }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    appContext.startActivity(intent)
  }

  // Required by NativeEventEmitter-style callers; harmless no-ops for a module that emits nothing.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}
}
