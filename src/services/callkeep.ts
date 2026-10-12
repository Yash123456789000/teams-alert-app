import RNCallKeep from 'react-native-callkeep';
import type {AlertPayload} from '../types';
import {
  getAlert,
  removeAlert,
  saveAlert,
  setAnswered,
} from '../storage/alertStore';
import {emitAppEvent} from './appBus';
import {
  cancelRingingNotification,
  showRingingNotification,
} from './incomingCallUi';

/**
 * react-native-callkeep wiring (Android, self-managed Telecom account).
 *
 * Self-managed means Android draws NO incoming-call UI for us. The flow is:
 *   FCM data push -> displayAlertCall() -> RNCallKeep.displayIncomingCall()
 *     -> Telecom creates a ringing Connection -> CallKeep emits `showIncomingCallUi`
 *     -> we post the ringing full-screen-intent notification (TeamsAlertCall native module)
 *   user taps Answer (notification button / in-app button / system) -> handleAnswered()
 *     -> store the alert, end the call session, bring the app forward, navigate to Alert screen.
 *
 * Everything here must work inside a headless JS context (app killed), so listeners are registered
 * at module level by registerCallKeepHandlers(), called from index.js.
 */

/**
 * CallKeep passes this to Telecom as a `tel:` URI. The real caller name is passed separately as
 * the display name, so the number itself is irrelevant; keep it numeric to be safe with Telecom.
 */
const CALL_HANDLE = '0000';

/** If CallKeep's `showIncomingCallUi` event has not arrived by then, post the notification anyway. */
const UI_FALLBACK_DELAY_MS = 1500;

const CALLKEEP_OPTIONS = {
  ios: {
    // Required by the typings; this app is Android-only.
    appName: 'Teams Alert',
  },
  android: {
    // The alert/permission strings are only used by the non-self-managed flow; they are required
    // by the typings, not displayed in self-managed mode.
    alertTitle: 'Permissions required',
    alertDescription: 'Teams Alert needs permission to show incoming alerts.',
    cancelButton: 'Cancel',
    okButton: 'OK',
    additionalPermissions: [] as string[],
    // Register a self-managed PhoneAccount (PhoneAccount.CAPABILITY_SELF_MANAGED).
    selfManaged: true,
    // No `foregroundService` block on purpose: Telecom already keeps the process alive for a
    // self-managed call, and CallKeep's own foreground service would add a sticky notification.
  },
};

let setupPromise: Promise<void> | null = null;

/** Idempotent: registers the self-managed phone account once per JS context. */
export function setupCallKeep(): Promise<void> {
  if (!setupPromise) {
    setupPromise = RNCallKeep.setup(CALLKEEP_OPTIONS)
      .then(() => undefined)
      .catch(error => {
        setupPromise = null; // allow a retry on the next alert
        throw error;
      });
  }
  return setupPromise;
}

// ---- ringing UI ------------------------------------------------------------------------------

const uiShown = new Set<string>();
const uiWaiters = new Map<string, () => void>();

async function showRingingUi(uuid: string, callerName?: string): Promise<void> {
  if (uiShown.has(uuid)) {
    return;
  }
  uiShown.add(uuid);

  try {
    const alert = await getAlert(uuid);
    const caller = callerName || alert?.sender || 'Teams alert';
    const posted = await showRingingNotification(uuid, caller);
    if (!posted) {
      console.warn(
        '[callkeep] ringing notification was not posted (notifications blocked?)',
      );
    }
  } catch (error) {
    console.warn('[callkeep] could not show ringing notification', error);
  } finally {
    const waiter = uiWaiters.get(uuid);
    if (waiter) {
      uiWaiters.delete(uuid);
      waiter();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- incoming alert ----------------------------------------------------------------------------

/**
 * Rings the "incoming call" for an alert. Resolves once the ringing notification has been posted
 * (or the fallback delay elapsed), so a headless FCM task stays alive until the UI is up.
 */
export async function displayAlertCall(alert: AlertPayload): Promise<void> {
  // Persist first: the Answer/Incoming screens read it back by uuid, possibly in another context.
  await saveAlert(alert);
  await setupCallKeep();

  // Telecom sessions of earlier, unanswered alerts would otherwise linger invisibly.
  try {
    RNCallKeep.endAllCalls();
  } catch (error) {
    console.warn('[callkeep] endAllCalls failed', error);
  }

  const uiPosted = new Promise<void>(resolve => {
    uiWaiters.set(alert.uuid, resolve);
  });

  RNCallKeep.displayIncomingCall(
    alert.uuid,
    CALL_HANDLE,
    alert.sender,
    'generic',
    false,
  );

  await Promise.race([uiPosted, delay(UI_FALLBACK_DELAY_MS)]);
  // No-op when the `showIncomingCallUi` event already did it.
  await showRingingUi(alert.uuid, alert.sender);
}

// ---- answer / end ------------------------------------------------------------------------------

const answeredUuids = new Set<string>();

/** Answer flow, shared by the CallKeep event and the notification/in-app buttons. Idempotent. */
export async function handleAnswered(uuid: string): Promise<void> {
  // Synchronous check-and-set so concurrent triggers cannot both proceed.
  if (answeredUuids.has(uuid)) {
    return;
  }
  answeredUuids.add(uuid);

  try {
    const alert: AlertPayload = (await getAlert(uuid)) ?? {
      uuid,
      sender: 'Unknown sender',
      message: '(The message text was not available.)',
      receivedAt: Date.now(),
    };

    await setAnswered(alert);

    cancelRingingNotification(uuid);
    try {
      RNCallKeep.endCall(uuid); // end the Telecom session cleanly
    } catch (error) {
      console.warn('[callkeep] endCall after answer failed', error);
    }
    try {
      RNCallKeep.backToForeground(); // bring the app forward if backgrounded/killed
    } catch (error) {
      console.warn('[callkeep] backToForeground failed', error);
    }

    emitAppEvent({type: 'answered', alert});
  } catch (error) {
    console.warn('[callkeep] handleAnswered failed', error);
  }
}

/** Decline / hang-up / Telecom ended the call: just tear the session down. */
async function handleEnded(uuid: string): Promise<void> {
  cancelRingingNotification(uuid);
  uiShown.delete(uuid);
  uiWaiters.delete(uuid);
  try {
    RNCallKeep.endCall(uuid); // harmless if the connection is already gone
  } catch (error) {
    console.warn('[callkeep] endCall failed', error);
  }
  if (!answeredUuids.has(uuid)) {
    // Declined or timed out. (After an answer the alert is kept in the "answered" slot instead.)
    await removeAlert(uuid).catch(() => undefined);
  }
  emitAppEvent({type: 'ended', uuid});
}

/** User pressed Answer (notification action or in-app button). */
export async function answerAlert(uuid: string): Promise<void> {
  try {
    RNCallKeep.answerIncomingCall(uuid);
  } catch (error) {
    console.warn('[callkeep] answerIncomingCall failed', error);
  }
  // Do not depend on the native `answerCall` event arriving: handleAnswered is idempotent.
  await handleAnswered(uuid);
}

/** User pressed Decline in the in-app Incoming screen. */
export async function declineAlert(uuid: string): Promise<void> {
  try {
    RNCallKeep.rejectCall(uuid);
  } catch (error) {
    console.warn('[callkeep] rejectCall failed', error);
  }
  await handleEnded(uuid);
}

// ---- listener registration ---------------------------------------------------------------------

let handlersRegistered = false;

/** Call once at module load (index.js) so listeners also exist in a headless JS context. */
export function registerCallKeepHandlers(): void {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  RNCallKeep.addEventListener('showIncomingCallUi', ({callUUID, name}) => {
    showRingingUi(callUUID, name);
  });

  // Android refused to create the call (e.g. another call in progress). Still alert the user.
  RNCallKeep.addEventListener(
    'createIncomingConnectionFailed',
    ({callUUID, name}) => {
      console.warn('[callkeep] incoming connection failed; showing alert anyway');
      showRingingUi(callUUID, name);
    },
  );

  RNCallKeep.addEventListener('answerCall', ({callUUID}) => {
    handleAnswered(callUUID);
  });

  RNCallKeep.addEventListener('endCall', ({callUUID}) => {
    handleEnded(callUUID);
  });
}
