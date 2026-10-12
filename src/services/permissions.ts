import {PermissionsAndroid, Platform} from 'react-native';
import {canUseFullScreenIntent} from './incomingCallUi';

/**
 * POST_NOTIFICATIONS is a runtime permission only on Android 13 (API 33)+. On older versions it
 * does not exist as a runtime permission, so we skip the prompt and report "granted".
 *
 * NOTE: READ_PHONE_STATE is declared in the manifest but intentionally NOT requested here. If it were
 * granted, react-native-callkeep would start listening to telephony state, and on Android <= 11 it
 * does so with a blocking Looper.loop() on the calling thread.
 */
function needsRuntimeNotificationPermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!needsRuntimeNotificationPermission()) {
    return true;
  }
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('[permissions] POST_NOTIFICATIONS request failed', error);
    return false;
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (!needsRuntimeNotificationPermission()) {
    return true;
  }
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  } catch {
    return false;
  }
}

export type Readiness = {
  notifications: boolean;
  fullScreenIntent: boolean;
};

export async function checkReadiness(): Promise<Readiness> {
  const [notifications, fullScreenIntent] = await Promise.all([
    hasNotificationPermission(),
    canUseFullScreenIntent(),
  ]);
  return {notifications, fullScreenIntent};
}
