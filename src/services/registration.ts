import {useSyncExternalStore} from 'react';
import messaging from '@react-native-firebase/messaging';
import type {RegistrationState, Settings} from '../types';
import {hasCompleteSettings, loadSettings} from '../storage/settingsStorage';
import {registerDevice} from './backend';

// ---- observable registration status (read by the Home screen) -------------------------------

let state: RegistrationState = {
  status: 'unregistered',
  message: 'Save a Backend URL and shared secret in Settings first.',
};
const listeners = new Set<() => void>();

function setState(next: RegistrationState): void {
  state = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRegistrationState(): RegistrationState {
  return useSyncExternalStore(subscribe, () => state);
}

// ---- registration ----------------------------------------------------------------------------

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Registers this device's FCM token with the backend using the saved Backend URL + secret.
 *
 * @param knownToken pass the token when it is already known (e.g. from onTokenRefresh); otherwise it
 *                   is fetched from Firebase.
 */
export async function registerWithBackend(knownToken?: string): Promise<void> {
  let settings: Settings;
  try {
    settings = await loadSettings();
  } catch (error) {
    setState({status: 'error', message: `Could not read settings: ${describeError(error)}`});
    return;
  }

  const configured = hasCompleteSettings(settings);
  if (configured) {
    setState({status: 'registering'});
  }

  // Always obtain the FCM token (even before Settings are filled in) so a Firebase
  // misconfiguration shows up immediately instead of at the first alert.
  let token = knownToken;
  if (!token) {
    try {
      token = await messaging().getToken();
    } catch (error) {
      setState({
        status: 'error',
        message: `Could not get an FCM token: ${describeError(error)}`,
      });
      return;
    }
  }

  if (!configured) {
    setState({
      status: 'unregistered',
      message: 'Save a Backend URL and shared secret in Settings first.',
    });
    return;
  }

  try {
    await registerDevice(settings.backendUrl, settings.secret, token);
    setState({status: 'registered'});
  } catch (error) {
    setState({status: 'error', message: describeError(error)});
  }
}
