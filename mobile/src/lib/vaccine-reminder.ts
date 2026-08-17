import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  getFilteredVaccineDefinitions,
  getStandardScheduleDate,
  type RotavirusType,
  type VaccineDefinition,
} from "./vaccine-schedule";

export type VaccineReminderStage = "pre" | "due" | "overdue";

export interface VaccineReminder {
  vaccineId: string;
  vaccineName: string;
  stage: VaccineReminderStage;
  targetDate: string; // yyyy-MM-dd
  message: string;
}

/**
 * ワクチンの「目標日」= 標準スケジュール日と、前回接種からの次回推奨日のうち遅い方。
 * 前回接種が未記録の場合は標準スケジュール日のみ。
 */
export function getVaccineTargetDate(
  vaccine: VaccineDefinition,
  birthday: string,
  administeredByVaccineId: Map<string, string>,
): string {
  const standard = getStandardScheduleDate(vaccine.id, birthday);
  // 最短間隔の起点は previousDoseId（直前の回とは限らない: 例 hepB_3 は hepB_1 起点）
  if (!vaccine.previousDoseId || !vaccine.minIntervalDays) return standard;

  const prevDate = administeredByVaccineId.get(vaccine.previousDoseId);
  if (!prevDate) return standard;

  const recommended = format(addDays(parseISO(prevDate), vaccine.minIntervalDays), "yyyy-MM-dd");
  return recommended > standard ? recommended : standard;
}

function buildMessage(vaccine: VaccineDefinition, stage: VaccineReminderStage): string {
  const label = vaccine.isOptional ? `${vaccine.name}（任意接種）` : vaccine.name;
  if (stage === "pre") return `もうすぐ${label}の接種時期です`;
  if (stage === "due") return `${label}が接種時期です`;
  return `${label}の接種時期を過ぎています。かかりつけ医にご相談ください`;
}

/**
 * リマインド対象ワクチンを算出する。
 * - 接種済みは対象外
 * - 前の回が未接種のワクチンは対象外（次に打つべき回のみ通知）
 * - ロタは種別未選択の間は対象外（getFilteredVaccineDefinitions が除外）
 * - 1ワクチンにつき最も進んだ段階(overdue > due > pre)のみ返す
 * - 段階判定は目標日基準:
 *   overdue: 目標日から90日超過(既存getVaccineStatusの「+3ヶ月で遅れ」と整合)
 *   due:     目標日当日〜90日後まで
 *   pre:     目標日の leadDays 前〜前日まで(設定した事前日数がそのまま効く)
 */
export function computeVaccineReminders(params: {
  birthday: string;
  rotaType: RotavirusType;
  administeredVaccineIds: Set<string>;
  administeredDates: Map<string, string>; // vaccineId -> administeredDate
  leadDays: number;
  today?: Date;
}): VaccineReminder[] {
  const { birthday, rotaType, administeredVaccineIds, administeredDates, leadDays } = params;
  if (!birthday) return [];
  const today = params.today ?? new Date();

  const reminders: VaccineReminder[] = [];
  for (const vaccine of getFilteredVaccineDefinitions(rotaType)) {
    if (administeredVaccineIds.has(vaccine.id)) continue;
    // 前の回が未接種ならまだ通知しない（次に打つべき回だけを通知する）
    if (vaccine.previousDoseId && !administeredVaccineIds.has(vaccine.previousDoseId)) continue;

    const targetDate = getVaccineTargetDate(vaccine, birthday, administeredDates);
    if (!targetDate) continue;

    const daysUntil = differenceInCalendarDays(parseISO(targetDate), today);

    let stage: VaccineReminderStage | null = null;
    if (daysUntil < -90) stage = "overdue";
    else if (daysUntil <= 0) stage = "due";
    else if (daysUntil <= leadDays) stage = "pre";

    if (!stage) continue;
    reminders.push({
      vaccineId: vaccine.id,
      vaccineName: vaccine.name,
      stage,
      targetDate,
      message: buildMessage(vaccine, stage),
    });
  }
  return reminders;
}
