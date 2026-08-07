import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In production, point to your deployed backend URL
// In dev, point to your local machine (use your LAN IP, not localhost)
export function getBaseUrl(): string {
  // Explicit env var wins on every platform — set EXPO_PUBLIC_API_URL to the
  // backend (e.g. http://localhost:3000 for local dev, or your public URL).
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Fallback: same-origin (requires dev-proxy on the served port).
    return window.location.origin;
  }

  return 'http://localhost:3000';
}

const BASE_URL = getBaseUrl();

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const familyId = await AsyncStorage.getItem('familyId');
  const sessionToken = await AsyncStorage.getItem('sessionToken');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  if (familyId) headers['X-Family-Id'] = familyId;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    // Server errors are JSON ({ message }) — surface the clean message instead
    // of a raw "status: {...}" blob so failures read like normal app errors.
    let message = `リクエストに失敗しました (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) message = parsed.message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiRequest('GET', path);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiRequest('POST', path, body);
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  await apiRequest('DELETE', path);
}
