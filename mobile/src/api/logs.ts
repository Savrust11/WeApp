import { apiGet, apiPost, apiDelete } from './client';
import { refreshWidgets } from '../utils/sharedData';

export interface Log {
  id: number;
  familyId: string;
  childId: number;
  userId: string;
  type: string;
  points: number;
  createdAt: string;
  bodyTemperature?: number;
  symptoms?: string;
  breastLeftMin?: number;
  breastRightMin?: number;
  formulaMl?: number;
  expressedMl?: number;
  spitUp?: boolean;
  poopColor?: string;
  poopConsistency?: string;
  memo?: string;
  amount?: string;
}

export async function getLogs(familyId: number | string): Promise<Log[]> {
  return apiGet(`/api/logs/${familyId}`);
}

export async function createLog(data: Partial<Log>): Promise<Log> {
  const result = await apiPost<Log>('/api/logs', data);
  refreshWidgets();
  return result;
}

export async function updateLog(id: number, data: Partial<Log>): Promise<Log> {
  return apiPost(`/api/logs/${id}/update`, data);
}

export async function deleteLog(id: number): Promise<void> {
  return apiDelete(`/api/logs/${id}`);
}
