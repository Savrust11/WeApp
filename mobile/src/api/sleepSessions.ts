import { apiGet, apiPost } from './client';

export interface SleepSession {
  id: number;
  familyId: string;
  childId?: number;
  createdBy: string;
  startedAt: string;
  endedAt?: string;
  durationMin?: number;
  settlingMethod?: string | null;
  settlingMinutes?: number | null;
  sleepLocation?: string | null;
}

export interface SettlingDetails {
  settlingMethod?: string;
  settlingMinutes?: number;
  sleepLocation?: string;
}

export function getActiveSleepSession(familyId: number | string): Promise<SleepSession | null> {
  return apiGet<SleepSession | null>(`/api/sleep-sessions/${familyId}/active`).catch(() => null);
}

export function getSleepSessions(familyId: number | string): Promise<SleepSession[]> {
  return apiGet<SleepSession[]>(`/api/sleep-sessions/${familyId}`).catch(() => []);
}

export function startSleepSession(data: {
  familyId: number | string;
  createdBy: string;
  childId?: number;
  /** 指定入眠時刻（ISO）。未指定ならサーバー側で「今」。 */
  startedAt?: string;
} & SettlingDetails): Promise<SleepSession> {
  return apiPost('/api/sleep-sessions/start', data);
}

export function endSleepSession(id: number, details?: SettlingDetails): Promise<SleepSession> {
  return apiPost(`/api/sleep-sessions/${id}/end`, details ?? {});
}

export function manualSleepEntry(data: {
  familyId: number | string;
  createdBy: string;
  childId?: number;
  durationMin: number;
  startedAt: string;
} & SettlingDetails): Promise<SleepSession> {
  return apiPost('/api/sleep-sessions/manual', data);
}
