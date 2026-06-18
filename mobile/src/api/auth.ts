import { apiGet, apiPost } from './client';
import type { User } from '../store/authStore';
export type { User } from '../store/authStore';

export async function getMe(): Promise<(User & { authenticated: boolean }) | null> {
  try {
    return await apiGet<User & { authenticated: boolean }>('/api/auth/me');
  } catch {
    return null;
  }
}

export async function verifyCode(code: string) {
  return apiPost('/api/auth/verify-code', { code });
}

export async function updateRole(role: 'papa' | 'mama') {
  return apiPost('/api/auth/update-role', { role });
}

export async function joinFamily(familyId: string) {
  return apiPost('/api/auth/join-family', { familyId });
}

export async function logout() {
  return apiPost('/api/auth/mobile/logout');
}

/** Returns the URL to open in a browser for LINE OAuth (mobile deep-link flow). */
export function getLineLoginUrl(baseUrl: string): string {
  return `${baseUrl}/api/auth/line?mobile=true`;
}

/** Exchange a Google OAuth token for a We育 session token. */
export async function loginWithGoogle(payload: {
  accessToken?: string;
  idToken?: string;
}): Promise<{ token: string; user: User }> {
  return apiPost<{ token: string; user: User }>('/api/auth/google', payload);
}

/** Exchange an Apple identityToken for a We育 session token. */
export async function loginWithApple(payload: {
  identityToken: string;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
  email?: string | null;
}): Promise<{ token: string; user: User }> {
  return apiPost<{ token: string; user: User }>('/api/auth/apple', payload);
}
