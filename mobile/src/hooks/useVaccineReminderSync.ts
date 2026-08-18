/**
 * useVaccineReminderSync — computes upcoming/overdue vaccine reminders and
 * pushes them to the notification bell (server-side dedup via dedupeKey).
 *
 * Uses the same JP_VACCINES catalog + matching convention as HealthScreen
 * (see lib/vaccine-schedule.ts) so a vaccine only stops reminding once it's
 * recorded exactly the way HealthScreen's own "次の予防接種" list expects.
 *
 * Settings (enabled / lead days) live in AsyncStorage, written by
 * SettingsScreen. HomeScreen stays mounted in the bottom-tab navigator, so
 * settings are re-read on every focus, not just on initial mount.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiGet, apiPost } from '../api/client';
import { computeVaccineReminders, type VaccineReminder } from '../lib/vaccine-reminder';

const KEY_ENABLED = '@weyu_vaccineNotifyEnabled';
const KEY_LEAD_DAYS = '@weyu_vaccineNotifyDays';

interface UseVaccineReminderParams {
  familyId: string;
  childId: number | null;
  birthday: string | null | undefined;
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
  const { familyId, childId, birthday } = params;
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

  // HomeScreen stays mounted in the bottom-tab navigator, so a plain
  // mount-only effect misses settings changed in the Settings screen
  // afterward. Re-read on every focus (client-reported bug 2026-08-18 —
  // toggle was ON, lead-days correct, but nothing synced because Home
  // had already mounted with enabled=false before the toggle flip).
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  const [vaccineRecords, setVaccineRecords] = useState<Array<{ vaccineId: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    if (!familyId) return;
    (async () => {
      try {
        const records = await apiGet<Array<{ vaccineId: string; childId?: number | null }>>(
          `/api/vaccination-records/${familyId}`,
        );
        if (cancelled) return;
        const filtered = childId
          ? records.filter((r) => !r.childId || r.childId === childId)
          : records;
        setVaccineRecords(filtered);
      } catch {
        // Non-fatal — reminders simply won't compute this pass.
      }
    })();
    return () => { cancelled = true; };
  }, [familyId, childId]);

  const reminders = useMemo(() => {
    if (!birthday) return [];
    return computeVaccineReminders({ birthday, vaccineRecords, leadDays });
  }, [birthday, vaccineRecords, leadDays]);

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
