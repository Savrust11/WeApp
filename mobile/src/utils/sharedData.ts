import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl } from '../api/client';

const { SharedDataBridge } = NativeModules;

/**
 * Sync authentication data to the iOS App Group so that
 * widgets and Siri can access the API.
 * Call this after login and whenever the active child changes.
 */
export async function syncSharedData(childName?: string): Promise<void> {
  if (Platform.OS !== 'ios' || !SharedDataBridge) return;

  try {
    const [familyId, sessionToken] = await AsyncStorage.multiGet([
      'familyId',
      'sessionToken',
    ]);

    const apiBaseURL = getBaseUrl();
    const fid = familyId[1] ?? '';
    const token = sessionToken[1] ?? '';
    const name = childName ?? (await AsyncStorage.getItem('childName')) ?? '赤ちゃん';

    SharedDataBridge.syncAuthData(apiBaseURL, fid, token, name);
  } catch {
    // Silently fail — widget sync is not critical
  }
}

/**
 * Clear shared data on logout.
 */
export function clearSharedData(): void {
  if (Platform.OS !== 'ios' || !SharedDataBridge) return;
  SharedDataBridge.clearAuthData();
}

/**
 * Force-refresh all widgets (e.g. after logging a new activity).
 */
export function refreshWidgets(): void {
  if (Platform.OS !== 'ios' || !SharedDataBridge) return;
  SharedDataBridge.refreshWidgets();
}
