/**
 * ウィジェットデータキャッシュ
 *
 * AsyncStorage にウィジェット用のスナップショットを保存する。
 * iOS の App Groups / Android の SharedPreferences を利用するネイティブウィジェットが
 * このキーを読み込んでホーム画面を更新する（ネイティブウィジェット実装時に接続）。
 *
 * ── ウィジェットサイズ別の表示項目 ────────────────────────────────────────
 *  Small  : 最終授乳（経過時間）
 *  Medium : 最終授乳 + おむつ交換 + 睡眠状態
 *  Large  : Medium + 今日の回数一覧
 *  Lock   : 最終授乳（経過時間）のみ
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const WIDGET_STORAGE_KEY = '@weyu_widget_snapshot';

export interface WidgetSnapshot {
  // 最終授乳
  lastFeedingTime: string | null;   // ISO string
  lastFeedingType: 'breastfeed' | 'formula' | 'expressed' | null;
  lastFeedingFormulaMl: number | null;
  lastFeedingBreastMin: number | null; // 左+右の合計

  // おむつ交換
  lastDiaperTime: string | null;
  lastDiaperType: 'diaper_wet' | 'diaper_poop' | null;

  // 睡眠
  sleepStatus: 'sleeping' | 'awake' | 'unknown';
  lastSleepTime: string | null;

  // 今日の集計
  todayFeedings: number;
  todayDiapers: number;
  todaySleeps: number;

  // メタ
  childName: string | null;
  updatedAt: string;
}

function defaultSnapshot(): WidgetSnapshot {
  return {
    lastFeedingTime: null,
    lastFeedingType: null,
    lastFeedingFormulaMl: null,
    lastFeedingBreastMin: null,
    lastDiaperTime: null,
    lastDiaperType: null,
    sleepStatus: 'unknown',
    lastSleepTime: null,
    todayFeedings: 0,
    todayDiapers: 0,
    todaySleeps: 0,
    childName: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getWidgetSnapshot(): Promise<WidgetSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return defaultSnapshot();
    return { ...defaultSnapshot(), ...JSON.parse(raw) };
  } catch {
    return defaultSnapshot();
  }
}

export async function updateWidgetSnapshot(patch: Partial<WidgetSnapshot>): Promise<void> {
  try {
    const current = await getWidgetSnapshot();
    const updated: WidgetSnapshot = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ベストエフォート — ウィジェット更新の失敗はメイン機能に影響させない
  }
}

/**
 * ログ配列からウィジェットスナップショットを再計算して保存する。
 * HomeScreen の onSuccess コールバックから呼ぶ。
 */
export async function rebuildWidgetSnapshot(
  allLogs: Array<{
    type: string;
    createdAt: string | Date;
    formulaMl?: number | null;
    breastLeftMin?: number | null;
    breastRightMin?: number | null;
    subType?: string | null;
  }>,
  childName?: string | null,
): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayLogs = allLogs.filter(
    (l) => new Date(l.createdAt) >= todayStart,
  );

  const feedingTypes = new Set(['breastfeed', 'formula', 'expressed']);
  const diaperTypes = new Set(['diaper_wet', 'diaper_poop']);

  const feedings = todayLogs
    .filter((l) => feedingTypes.has(l.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const diapers = todayLogs
    .filter((l) => diaperTypes.has(l.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const sleepLogs = todayLogs
    .filter((l) => l.type === 'sleep')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const lastF = feedings[0];
  const lastD = diapers[0];
  const lastS = sleepLogs[0];

  await updateWidgetSnapshot({
    lastFeedingTime: lastF ? new Date(lastF.createdAt).toISOString() : null,
    lastFeedingType: lastF ? (lastF.type as any) : null,
    lastFeedingFormulaMl: lastF?.formulaMl ?? null,
    lastFeedingBreastMin: lastF
      ? ((lastF.breastLeftMin ?? 0) + (lastF.breastRightMin ?? 0)) || null
      : null,
    lastDiaperTime: lastD ? new Date(lastD.createdAt).toISOString() : null,
    lastDiaperType: lastD ? (lastD.type as any) : null,
    sleepStatus: lastS
      ? lastS.subType === 'wake'
        ? 'awake'
        : 'sleeping'
      : 'unknown',
    lastSleepTime: lastS ? new Date(lastS.createdAt).toISOString() : null,
    todayFeedings: feedings.length,
    todayDiapers: diapers.length,
    todaySleeps: sleepLogs.filter((l) => l.subType !== 'wake').length,
    childName: childName ?? null,
  });
}
