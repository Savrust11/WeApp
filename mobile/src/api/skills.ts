/**
 * Team skill completions API — wraps the same endpoints the web uses
 * (server/routes.ts:724-749, GET /api/skills/:familyId,
 *  POST /api/skills/complete, POST /api/skills/uncomplete).
 */
import { apiGet, apiPost } from './client';

export interface SkillCompletion {
  id: number;
  familyId: string;
  userId: string;
  skillId: string;
  createdAt: string;
}

export function listSkillCompletions(familyId: string): Promise<SkillCompletion[]> {
  return apiGet<SkillCompletion[]>(`/api/skills/${familyId}`);
}

export function completeSkill(data: {
  familyId: string;
  userId: string;
  skillId: string;
}): Promise<SkillCompletion> {
  return apiPost<SkillCompletion>('/api/skills/complete', data);
}

export function uncompleteSkill(data: {
  familyId: string;
  userId: string;
  skillId: string;
}): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>('/api/skills/uncomplete', data);
}
