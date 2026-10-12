import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AlertPayload} from '../types';

/**
 * Hand-off between the code that *receives* an alert (FCM handler, possibly running headless in a
 * killed app) and the Alert/Incoming screens that *show* it.
 *
 * Alerts live in an in-memory map (the headless JS context and the Activity share one JS runtime in
 * the same process) and are mirrored to AsyncStorage as a safety net.
 */

const ALERTS_KEY = 'teamsalert.alerts.v1';
const ANSWERED_KEY = 'teamsalert.answered.v1';
const MAX_STORED_ALERTS = 10;
/** An "answered" marker older than this is considered stale and ignored. */
const ANSWERED_MAX_AGE_MS = 2 * 60 * 1000;

type AnsweredAlert = {alert: AlertPayload; answeredAt: number};

const memory = new Map<string, AlertPayload>();
let answeredMemory: AnsweredAlert | null = null;

// Serialise read-modify-write cycles on the stored list.
let writeChain: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  const run = writeChain.then(() => task());
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readStored(): Promise<AlertPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(ALERTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AlertPayload[]) : [];
  } catch {
    return [];
  }
}

export async function saveAlert(alert: AlertPayload): Promise<void> {
  memory.set(alert.uuid, alert);
  await enqueue(async () => {
    const all = (await readStored()).filter(a => a.uuid !== alert.uuid);
    all.push(alert);
    await AsyncStorage.setItem(
      ALERTS_KEY,
      JSON.stringify(all.slice(-MAX_STORED_ALERTS)),
    );
  });
}

export async function getAlert(uuid: string): Promise<AlertPayload | null> {
  const cached = memory.get(uuid);
  if (cached) {
    return cached;
  }
  const stored = (await readStored()).find(a => a.uuid === uuid);
  return stored ?? null;
}

export async function removeAlert(uuid: string): Promise<void> {
  memory.delete(uuid);
  await enqueue(async () => {
    const all = (await readStored()).filter(a => a.uuid !== uuid);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(all));
  });
}

/** Remember that this alert was answered, so the UI can open the Alert screen for it. */
export async function setAnswered(alert: AlertPayload): Promise<void> {
  const entry: AnsweredAlert = {alert, answeredAt: Date.now()};
  answeredMemory = entry;
  try {
    await AsyncStorage.setItem(ANSWERED_KEY, JSON.stringify(entry));
  } catch {
    // The in-memory copy is enough while the process is alive.
  }
}

/** Returns (and clears) the answered alert that has not been shown yet, if any and still fresh. */
export async function takeAnswered(): Promise<AlertPayload | null> {
  let entry = answeredMemory;
  answeredMemory = null;
  try {
    if (!entry) {
      const raw = await AsyncStorage.getItem(ANSWERED_KEY);
      entry = raw ? (JSON.parse(raw) as AnsweredAlert) : null;
    }
    await AsyncStorage.removeItem(ANSWERED_KEY);
  } catch {
    // ignore storage errors; fall through with whatever we have
  }
  if (!entry || Date.now() - entry.answeredAt > ANSWERED_MAX_AGE_MS) {
    return null;
  }
  return entry.alert;
}

export async function clearAnswered(): Promise<void> {
  answeredMemory = null;
  try {
    await AsyncStorage.removeItem(ANSWERED_KEY);
  } catch {
    // ignore
  }
}
