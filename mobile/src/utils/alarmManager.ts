/**
 * 授乳アラームマネージャー
 * expo-notifications を使ってローカルの「次回授乳アラーム」をスケジュール管理する。
 * PWAのバックグラウンド制限を回避し、OS レベルの通知で確実に届ける。
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SETTINGS_KEY = '@weyu_alarm_settings';
const ALARM_ID_KEY = '@weyu_alarm_id';

export interface AlarmSettings {
  enabled: boolean;
  intervalMinutes: number; // デフォルト 180 (3時間)
  sound: boolean;
}

const DEFAULT_SETTINGS: AlarmSettings = {
  enabled: true,
  intervalMinutes: 180,
  sound: true,
};

export async function getAlarmSettings(): Promise<AlarmSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAlarmSettings(settings: AlarmSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * 前回授乳時刻を元に次回アラームをスケジュールする。
 * 既存のアラームはキャンセルしてから再設定する。
 */
export async function scheduleNextFeedingAlarm(lastFeedingTime: Date): Promise<void> {
  if (Platform.OS === 'web') return; // web は expo-notifications 非対応

  await cancelNextFeedingAlarm();

  const settings = await getAlarmSettings();
  if (!settings.enabled) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const nextTime = new Date(lastFeedingTime.getTime() + settings.intervalMinutes * 60 * 1000);
  const now = new Date();
  if (nextTime <= now) return; // 過去の時刻はスキップ

  const secondsUntil = Math.floor((nextTime.getTime() - now.getTime()) / 1000);
  // const secondsUntil = 10;
  const nextTimeStr = nextTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🍼 We育 - 授乳の時間です',
      body: `前回の授乳から${Math.floor(settings.intervalMinutes / 60)}時間が経ちました（${nextTimeStr}）`,
      sound: settings.sound ? 'default' : undefined,
      data: { type: 'feeding_alarm' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntil,
    },
  });

  await AsyncStorage.setItem(ALARM_ID_KEY, id);
}

/** スケジュール済みのアラームをキャンセルする */
export async function cancelNextFeedingAlarm(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const id = await AsyncStorage.getItem(ALARM_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(ALARM_ID_KEY);
    }
  } catch {
    // ベストエフォート
  }
}

/** 次回アラームの予定時刻を返す（設定中の場合）*/
export async function getNextAlarmTime(): Promise<Date | null> {
  if (Platform.OS === 'web') return null;
  try {
    const id = await AsyncStorage.getItem(ALARM_ID_KEY);
    if (!id) return null;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const found = scheduled.find((n) => n.identifier === id);
    if (!found) return null;
    const trigger = found.trigger as any;
    if (trigger?.value) return new Date(trigger.value);
    return null;
  } catch {
    return null;
  }
}
