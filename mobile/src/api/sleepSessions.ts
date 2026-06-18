import { apiGet, apiPost } from './client';

export interface SleepSession {
  id: number;
  familyId: string;
  childId?: number;
  createdBy: string;
  startedAt: string;
  endedAt?: string;
  durationMin?: number;
}

export function getActiveSleepSession(familyId: number | string): Promise<SleepSession | null> {
  return apiGet<SleepSession | null>(`/api/sleep-sessions/${familyId}/active`).catch(() => null);
}

export function startSleepSession(data: {
  familyId: number | string;
  createdBy: string;
  childId?: number;
}): Promise<SleepSession> {
  return apiPost('/api/sleep-sessions/start', data);
}

export function endSleepSession(id: number): Promise<SleepSession> {
  return apiPost(`/api/sleep-sessions/${id}/end`, {});
}

export function manualSleepEntry(data: {
  familyId: number | string;
  createdBy: string;
  childId?: number;
  durationMin: number;
  startedAt: string;
}): Promise<SleepSession> {
  return apiPost('/api/sleep-sessions/manual', data);
}
