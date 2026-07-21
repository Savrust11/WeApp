/**
 * Shared label + toast payload builder for "log recorded" notifications.
 * Matches web behavior at client/src/hooks/use-app-data.ts:138-144:
 *   title       = `ナイス連携！${points}pt獲得！`
 *   description = `${typeLabel}を記録しました。お疲れ様です！`
 */

// Kept in this shared module so every screen shows the same label for a given
// log type. Extend here rather than duplicating maps in each screen.
export const LOG_TYPE_LABELS: Record<string, string> = {
  milk: 'ミルク',
  breastfeed: '母乳',
  formula: 'ミルク',
  expressed: '搾乳',
  food: '離乳食',
  meal: 'ごはん',
  snack: 'おやつ',
  drink: '水分',
  diaper: 'おむつ',
  diaper_wet: 'おむつ (おしっこ)',
  diaper_poop: 'おむつ (うんち)',
  sleep: 'ねんね',
  bath: 'おふろ',
  play: 'あそび',
  walk: 'おさんぽ',
  hold: 'だっこ',
  chore: '名もなき育児',
  sos: 'レスキュー',
  thanks: 'ありがとう',
  temp: '体温',
  temperature: '体温',
  symptom: '症状メモ',
  medicine: 'おくすり',
  vaccination: '予防接種',
  event_done: '予定完了',
  routine_complete: 'ルーティン',
  milestone: 'マイルストーン',
  achievement: 'できた!',
  toothbrush: 'はみがき',
  toilet: 'トイレ',
  words: 'ことば',
  growth_note: '成長メモ',
  clinic: '通院',
  nail_care: '爪ケア',
  skincare: 'スキンケア',
  hobby: 'きょうみ',
  discipline: 'しつけ',
  school_report: '園の記録',
  school_prep: '入学準備',
  schedule: 'よてい',
};

export function labelForLogType(type: string | undefined | null): string {
  if (!type) return '記録';
  return LOG_TYPE_LABELS[type] ?? '記録';
}

export function logRecordedToast(type: string, points: number) {
  return {
    title: `ナイス連携！${points}pt獲得！`,
    description: `${labelForLogType(type)}を記録しました。お疲れ様です！`,
    duration: 2000,
  };
}
