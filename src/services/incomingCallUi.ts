import {NativeModules} from 'react-native';

/**
 * Thin wrapper over the app-local Kotlin module (android/app/src/main/java/com/teamsalert/app/
 * TeamsAlertCallModule.kt). It posts / cancels the ringing, full-screen-intent notification that
 * react-native-callkeep does NOT draw itself in self-managed mode.
 */
type TeamsAlertCallNative = {
  show(uuid: string, caller: string): Promise<boolean>;
  cancel(uuid: string): void;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): void;
};

const native: TeamsAlertCallNative | undefined = NativeModules.TeamsAlertCall;

/** @returns true if the notification was posted. */
export async function showRingingNotification(
  uuid: string,
  caller: string,
): Promise<boolean> {
  if (!native) {
    console.warn('[incomingCallUi] TeamsAlertCall native module is missing');
    return false;
  }
  return native.show(uuid, caller);
}

export function cancelRingingNotification(uuid: string): void {
  native?.cancel(uuid);
}

export async function canUseFullScreenIntent(): Promise<boolean> {
  if (!native) {
    return true;
  }
  try {
    return await native.canUseFullScreenIntent();
  } catch {
    return true;
  }
}

export function openFullScreenIntentSettings(): void {
  native?.openFullScreenIntentSettings();
}
