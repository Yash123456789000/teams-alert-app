import type {AlertPayload} from '../types';

/**
 * Tiny in-process event bus so non-UI code (FCM / CallKeep handlers, which also run headless)
 * can tell the UI to navigate. If nothing is subscribed (app killed / UI not mounted) the event is
 * simply dropped; the UI recovers the state from alertStore when it mounts.
 */
export type AppEvent =
  | {type: 'incoming'; alert: AlertPayload}
  | {type: 'answered'; alert: AlertPayload}
  | {type: 'ended'; uuid: string};

type Listener = (event: AppEvent) => void;

const listeners = new Set<Listener>();

export function subscribeAppEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAppEvent(event: AppEvent): void {
  listeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.warn('[appBus] listener threw', error);
    }
  });
}
