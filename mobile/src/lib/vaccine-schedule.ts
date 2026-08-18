/**
 * JP Standard Vaccine Schedule — single source of truth for mobile.
 *
 * Extracted from HealthScreen.tsx (2026-08-18) so the 予防接種リマインド
 * (vaccine reminder) feature and the Health screen's own "次の予防接種"
 * list share IDENTICAL vaccine definitions and matching logic. Previously
 * the reminder feature was ported verbatim from originwebapp using a
 * DIFFERENT vaccine catalog (coded ids like "hepB_1"/"5mix_1", with a
 * rotarix/rotateq split) that doesn't match what this app actually stores
 * when a user records a vaccination via HealthScreen (vaccineId is a
 * compound Japanese string like "B型肝炎 1回目") — so no reminder ever
 * correctly detected an administered dose. This file fixes that by being
 * the one true source both screens read from.
 */

export interface JpVaccineDose {
  label: string;
  ageMin: number;
  ageMax: number;
}

export interface JpVaccine {
  id: string;
  name: string;
  doses: JpVaccineDose[];
  category: 'required' | 'optional';
}

export const JP_VACCINES: JpVaccine[] = [
  {
    id: 'hep_b',
    name: 'B型肝炎',
    doses: [
      { label: '1回目', ageMin: 0, ageMax: 2 },
      { label: '2回目', ageMin: 1, ageMax: 3 },
      { label: '3回目', ageMin: 6, ageMax: 9 },
    ],
    category: 'required',
  },
  {
    id: 'rota',
    name: 'ロタウイルス',
    doses: [
      { label: '1回目', ageMin: 2, ageMax: 3 },
      { label: '2回目', ageMin: 3, ageMax: 4 },
    ],
    category: 'required',
  },
  {
    id: 'hib',
    name: 'ヒブ(Hib)',
    doses: [
      { label: '1回目', ageMin: 2, ageMax: 3 },
      { label: '2回目', ageMin: 3, ageMax: 4 },
      { label: '3回目', ageMin: 4, ageMax: 5 },
      { label: '追加', ageMin: 12, ageMax: 17 },
    ],
    category: 'required',
  },
  {
    id: 'pcv',
    name: '小児用肺炎球菌(PCV)',
    doses: [
      { label: '1回目', ageMin: 2, ageMax: 3 },
      { label: '2回目', ageMin: 3, ageMax: 4 },
      { label: '3回目', ageMin: 4, ageMax: 5 },
      { label: '追加', ageMin: 12, ageMax: 17 },
    ],
    category: 'required',
  },
  {
    id: 'dpt_ipv',
    name: '四種混合(DPT-IPV)',
    doses: [
      { label: '1回目', ageMin: 3, ageMax: 4 },
      { label: '2回目', ageMin: 4, ageMax: 5 },
      { label: '3回目', ageMin: 5, ageMax: 6 },
      { label: '追加', ageMin: 18, ageMax: 24 },
    ],
    category: 'required',
  },
  {
    id: 'bcg',
    name: 'BCG',
    doses: [{ label: '1回目', ageMin: 5, ageMax: 8 }],
    category: 'required',
  },
  {
    id: 'mr',
    name: '麻疹・風疹(MR)',
    doses: [
      { label: '1期', ageMin: 12, ageMax: 24 },
      { label: '2期', ageMin: 60, ageMax: 84 },
    ],
    category: 'required',
  },
  {
    id: 'varicella',
    name: '水痘',
    doses: [
      { label: '1回目', ageMin: 12, ageMax: 15 },
      { label: '2回目', ageMin: 18, ageMax: 23 },
    ],
    category: 'required',
  },
  {
    id: 'je',
    name: '日本脳炎',
    doses: [
      { label: '1回目', ageMin: 36, ageMax: 48 },
      { label: '2回目', ageMin: 37, ageMax: 49 },
    ],
    category: 'required',
  },
];

export function monthsDiff(birthday: string, now: Date): number {
  const birth = new Date(birthday);
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  return years * 12 + months;
}

/**
 * Same matching HealthScreen already uses: a vaccine group counts as
 * "administered" if ANY record's vaccineId contains the vaccine's name
 * (records are saved as "{vaccine.name} {dose.label}", e.g. "B型肝炎 1回目").
 * Note this is group-level, not per-dose — recording any one dose marks
 * the whole vaccine as done for display purposes. Kept faithful to the
 * existing behavior rather than "fixed", to stay consistent with what
 * HealthScreen's 次の予防接種 list already shows users.
 */
export function isVaccineGroupDone(
  vaccine: JpVaccine,
  vaccineRecords: Array<{ vaccineId: string }>,
): boolean {
  return vaccineRecords.some((r) => r.vaccineId.includes(vaccine.name));
}
