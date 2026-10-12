import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Settings} from '../types';

const KEY_BACKEND_URL = 'teamsalert.settings.backendUrl';
const KEY_SECRET = 'teamsalert.settings.secret';

export async function loadSettings(): Promise<Settings> {
  const entries = await AsyncStorage.multiGet([KEY_BACKEND_URL, KEY_SECRET]);
  const values = Object.fromEntries(entries);
  return {
    backendUrl: values[KEY_BACKEND_URL] ?? '',
    secret: values[KEY_SECRET] ?? '',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.multiSet([
    [KEY_BACKEND_URL, settings.backendUrl.trim()],
    [KEY_SECRET, settings.secret.trim()],
  ]);
}

export function hasCompleteSettings(settings: Settings): boolean {
  return settings.backendUrl.trim().length > 0 && settings.secret.trim().length > 0;
}
