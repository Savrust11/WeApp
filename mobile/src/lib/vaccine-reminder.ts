import { addMonths, differenceInCalendarDays } from 'date-fns';
import { JP_VACCINES, isVaccineGroupDone, type JpVaccine, type JpVaccineDose } from './vaccine-schedule';

export type VaccineReminderStage = 'pre' | 'due' | 'overdue';

export interface VaccineReminder {
  vaccineId: string;
  vaccineName: string;
  stage: VaccineReminderStage;
  targetDate: string; // yyyy-MM-dd
  message: string;
}

function buildMessage(vaccine: JpVaccine, dose: JpVaccineDose, stage: VaccineReminderStage): string {
  const label = `${vaccine.name}(${dose.label})`;
  if (stage === 'pre') return `もうすぐ${label}の接種時期です`;
  if (stage === 'due') return `${label}が接種時期です`;
  return `${label}の接種時期を過ぎています。かかりつけ医にご相談ください`;
}

/**
 * リマインド対象ワクチンを算出する。HealthScreenの「次の予防接種」判定と
 * 同じ基準(dose.ageMin〜ageMax の月齢レンジ、vaccineId.includes(vaccine.name)
 * によるワクチングループ単位の接種済み判定)を用いる。
 * - 接種済みグループは対象外
 * - 段階判定:
 *   due:     今の月齢が dose.ageMin〜ageMax の範囲内
 *   overdue: 今の月齢が dose.ageMax を超過
 *   pre:     dose.ageMin到達日(誕生日+ageMinヶ月)が leadDays 以内に迫っている
 * - 1ワクチングループにつき最も早い(直近の)回のみ通知する
 */
export function computeVaccineReminders(params: {
  birthday: string;
  vaccineRecords: Array<{ vaccineId: string }>;
  leadDays: number;
  today?: Date;
}): VaccineReminder[] {
  const { birthday, vaccineRecords, leadDays } = params;
  if (!birthday) return [];
  const today = params.today ?? new Date();
  const birth = new Date(birthday);

  const reminders: VaccineReminder[] = [];
  for (const vaccine of JP_VACCINES) {
    if (isVaccineGroupDone(vaccine, vaccineRecords)) continue;

    // 最も早い(次に打つべき)回のみを対象にする
    const dose = vaccine.doses[0];
    if (!dose) continue;

    const targetDate = addMonths(birth, dose.ageMin);
    const daysUntil = differenceInCalendarDays(targetDate, today);
    const maxDate = addMonths(birth, dose.ageMax);
    const daysPastMax = differenceInCalendarDays(today, maxDate);

    let stage: VaccineReminderStage | null = null;
    if (daysPastMax > 0) stage = 'overdue';
    else if (daysUntil <= 0) stage = 'due';
    else if (daysUntil <= leadDays) stage = 'pre';

    if (!stage) continue;
    reminders.push({
      vaccineId: vaccine.id,
      vaccineName: vaccine.name,
      stage,
      targetDate: targetDate.toISOString().slice(0, 10),
      message: buildMessage(vaccine, dose, stage),
    });
  }
  return reminders;
}
