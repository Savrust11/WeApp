import { apiGet, apiPost, apiDelete } from './client';

export interface Child {
  id: number;
  familyId: number;
  name: string;
  birthday: string;
  gender: 'male' | 'female' | 'other';
  bloodType?: string;
  color: string;
  /** ロタウイルスワクチンの種類 — 予防接種リマインドのロタ回数判定に使用 */
  rotavirusVaccineType?: 'rotarix' | 'rotateq' | null;
}

export async function getChildren(familyId: string | number): Promise<Child[]> {
  return apiGet(`/api/children/${familyId}`);
}

export async function createChild(data: Partial<Child>): Promise<Child> {
  return apiPost('/api/children', data);
}

export async function updateChild(id: number, data: Partial<Child>): Promise<Child> {
  return apiPost(`/api/children/${id}`, data);
}

export async function deleteChild(id: number): Promise<void> {
  return apiDelete(`/api/children/${id}`);
}
