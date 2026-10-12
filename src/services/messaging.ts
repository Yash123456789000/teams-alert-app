import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import type {AlertPayload} from '../types';
import {emitAppEvent} from './appBus';
import {displayAlertCall} from './callkeep';
import {generateUuid} from './ids';

/** Value of data.type that marks a push as a Teams alert (set by the backend). */
const ALERT_TYPE = 'teams_alert';

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;
export type MessageSource = 'foreground' | 'background';

function asText(value: string | object | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// FCM can redeliver; ignore a messageId we have just handled.
const recentMessageIds: string[] = [];
function isDuplicate(messageId: string | undefined): boolean {
  if (!messageId) {
    return false;
  }
  if (recentMessageIds.includes(messageId)) {
    return true;
  }
  recentMessageIds.push(messageId);
  if (recentMessageIds.length > 20) {
    recentMessageIds.shift();
  }
  return false;
}

/**
 * Shared by messaging().onMessage (foreground) and setBackgroundMessageHandler (background/killed).
 * Never throws: a rejected headless task would be retried/crash-looped by the OS.
 */
export async function handleRemoteMessage(
  message: RemoteMessage,
  source: MessageSource,
): Promise<void> {
  try {
    const data = message.data ?? {};
    if (asText(data.type) !== ALERT_TYPE) {
      return;
    }
    if (isDuplicate(message.messageId)) {
      return;
    }

    const alert: AlertPayload = {
      uuid: generateUuid(),
      sender: asText(data.sender).trim() || 'Unknown sender',
      message: asText(data.message),
      receivedAt: Date.now(),
    };

    // Rings: posts the incoming-call notification and creates the Telecom session.
    await displayAlertCall(alert);

    if (source === 'foreground') {
      // App is on screen: the full-screen intent will not pop up over it, so show the in-app
      // Incoming screen directly.
      emitAppEvent({type: 'incoming', alert});
    }
  } catch (error) {
    console.warn(`[messaging] failed handling ${source} message`, error);
  }
}

/**
 * Must be called at module load (index.js), NOT from a React component, so that the handler exists
 * when Android starts the app headless to deliver a push while the process is dead.
 */
export function registerBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(async message => {
    await handleRemoteMessage(message, 'background');
  });
}
