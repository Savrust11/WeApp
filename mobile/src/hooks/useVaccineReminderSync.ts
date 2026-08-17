/**
 * useVaccineReminderSync — mobile port of the web hook
 * (originwebapp/client/src/hooks/use-vaccine-reminder.ts).
 *
 * Ported per client request 2026-08-17 ("予防接種リマインド機能をアプリに
 * 移行してほしい"). Same computation logic (computeVaccineReminders) and
 * server sync endpoint (POST /api/vaccine-reminders/sync) as web — only the
 * storage layer differs:
 *   web:    localStorage (synchronous)
 *   mobile: AsyncStorage (async) — settings are loaded once on mount and
 *           re-read whenever the screen re-focuses, since there's no mobile
 *           equivalent of a live storage-change event.
 *
 * There's no mobile equivalent of the browser Notification API here — the
 * in-app 通知 (Bell icon / notifications list) that the server creates is
 * the only surface for reminders on mobile. A native push notification could
 * be layered on later using the existing expo-notifications wiring in
 * server/push.ts if desired.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiPost } from '../api/client';
import { computeVaccineReminders, type VaccineReminder } from '../lib/vaccine-reminder';
import type { RotavirusType } from '../lib/vaccine-schedule';

const KEY_ENABLED = '@weyu_vaccineNotifyEnabled';
const KEY_LEAD_DAYS = '@weyu_vaccineNotifyDays';

interface UseVaccineReminderParams {
  familyId: string;
  childId: number | null;
  birthday: string | null | undefined;
  rotaType: RotavirusType;
  /** 旧logsテーブル由来の接種済みvaccineId(subType)一覧(Health画面と同じ互換扱い) */
  legacyVaccinationLogs?: Array<{ subType?: string | null; createdAt?: string | null }>;
}

/** Read/write helpers so screens (Settings) and this hook share one storage shape. */
export async function getVaccineNotifyEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY_ENABLED)) === 'true';
}
export async function setVaccineNotifyEnabled(val: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_ENABLED, val ? 'true' : 'false');
}
export async function getVaccineNotifyDays(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY_LEAD_DAYS);
  const n = parseInt(raw ?? '7', 10);
  return Number.isFinite(n) ? n : 7;
}
export async function setVaccineNotifyDays(val: number): Promise<void> {
  await AsyncStorage.setItem(KEY_LEAD_DAYS, String(val));
}

export function useVaccineReminderSync(params: UseVaccineReminderParams): {
  reminders: VaccineReminder[];
  enabled: boolean;
} {
  const { familyId, childId, birthday, rotaType, legacyVaccinationLogs } = params;
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const [enabled, setEnabledState] = useState(false);
  const [leadDays, setLeadDaysState] = useState(7);

  const loadSettings = useCallback(async () => {
    const [e, d] = await Promise.all([getVaccineNotifyEnabled(), getVaccineNotifyDays()]);
    setEnabledState(e);
    setLeadDaysState(d);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Vaccination records: fetched by the caller (HomeScreen already has
  // access via HealthScreen-style query) — pass in as legacyVaccinationLogs
  // plus administeredVaccineIds/administeredDates below via a light query.
  // To keep this hook self-contained like the web version, we fetch here.
  const [administeredVaccineIds, setAdministeredVaccineIds] = useState<Set<string>>(new Set());
  const [administeredDates, setAdministeredDates] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    if (!familyId) return;
    (async () => {
      try {
        const { apiGet } = await import('../api/client');
        const records = await apiGet<Array<{ vaccineId: string; administeredDate: string; childId?: number | null }>>(
          `/api/vaccination-records/${familyId}`,
        );
        if (cancelled) return;
        const ids = new Set<string>();
        const dates = new Map<string, string>();
        for (const r of records) {
          if (childId && r.childId && r.childId !== childId) continue;
          ids.add(r.vaccineId);
          const prev = dates.get(r.vaccineId);
          if (!prev || r.administeredDate > prev) dates.set(r.vaccineId, r.administeredDate);
        }
        for (const l of legacyVaccinationLogs || []) {
          if (!l.subType) continue;
          ids.add(l.subType);
          if (l.createdAt) {
            const d = l.createdAt.slice(0, 10);
            const prev = dates.get(l.subType);
            if (!prev || d > prev) dates.set(l.subType, d);
          }
        }
        setAdministeredVaccineIds(ids);
        setAdministeredDates(dates);
      } catch {
        // Non-fatal — reminders simply won't compute this pass.
      }
    })();
    return () => { cancelled = true; };
  }, [familyId, childId, legacyVaccinationLogs]);

  const reminders = useMemo(() => {
    if (!birthday) return [];
    return computeVaccineReminders({
      birthday,
      rotaType,
      administeredVaccineIds,
      administeredDates,
      leadDays,
    });
  }, [birthday, rotaType, administeredVaccineIds, administeredDates, leadDays]);

  useEffect(() => {
    if (!enabled || reminders.length === 0 || !familyId) return;

    (async () => {
      const guardKey = `@weyu_vaccineReminderLastSync:${familyId}:${childId ?? 'none'}`;
      const todayStamp = `${format(new Date(), 'yyyy-MM-dd')}:${leadDays}`;
      const lastSync = await AsyncStorage.getItem(guardKey);
      if (lastSync === todayStamp) return;
      if (syncingRef.current) return;
      syncingRef.current = true;

      try {
        await apiPost('/api/vaccine-reminders/sync', {
          familyId,
          childId,
          reminders: reminders.map((r) => ({
            vaccineId: r.vaccineId,
            stage: r.stage,
            message: r.message,
          })),
        });
        await AsyncStorage.setItem(guardKey, todayStamp);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch {
        // Sync failed — guard not updated, will retry next mount/focus.
      } finally {
        syncingRef.current = false;
      }
    })();
  }, [enabled, reminders, familyId, childId, leadDays, queryClient]);

  return { reminders, enabled };
}
