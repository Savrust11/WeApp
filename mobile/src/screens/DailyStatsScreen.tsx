/**
 * DailyStatsScreen — 毎日の記録分析
 *
 * React Native port of the canonical web page WeYu/client/src/pages/DailyStats.tsx.
 * Visual/logic parity: 4 summary stat cards, 7-day bar charts (sleep / milk /
 * formula-ml / pee / poop), a 14-day hourly sleep heatmap with night/day
 * breakdown, a collapsible 母乳量サポート分析 panel, and a 1-week comparison.
 *
 * Data: same endpoints the web page's hooks call.
 *   • logs            → GET /api/logs/:familyId          (useLogs)
 *   • sleep sessions  → GET /api/sleep-sessions/:familyId (useSleepSessions)
 * Fetched with @tanstack/react-query + the shared mobile `apiGet`, exactly the
 * pattern used by DashboardScreen / ShopScreen. Excluded-date selection is
 * persisted in AsyncStorage (mobile has no localStorage) under the same key
 * the web app uses: `we_iku_excluded_dates`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  isSameDay,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Moon,
  Milk,
  Droplets,
  TrendingUp,
  TrendingDown,
  Minus,
  Sunrise,
  Stars,
  UserX,
  X,
  ChevronDown,
  ChevronUp,
  Timer,
  Zap,
} from 'lucide-react-native';
import { apiGet } from '../api/client';
import type { Log } from '../api/logs';
import type { SleepSession } from '../api/sleepSessions';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Screen, Card, Text, Title, Muted } from '../theme/ui';

// ─── Helpers (verbatim from web DailyStats.tsx) ──────────────────────────────

const EXCLUDED_KEY = 'we_iku_excluded_dates';

function minutesToHM(mins: number) {
  if (mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 && m > 0 ? `${h}h${m}m` : h > 0 ? `${h}h` : `${m}m`;
}

function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function calcSleepMinutesForDay(sessions: any[], date: Date): number {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = endOfDay(date).getTime();
  let total = 0;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const sStart = new Date(s.startedAt).getTime();
    const sEnd = new Date(s.endedAt).getTime();
    const overlap = Math.max(0, Math.min(sEnd, dayEnd) - Math.max(sStart, dayStart));
    total += Math.round(overlap / 60000);
  }
  return total;
}

function calcHourlyHeatmap(sessions: any[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const s of sessions) {
    if (!s.endedAt) continue;
    let cur = new Date(s.startedAt).getTime();
    const end = new Date(s.endedAt).getTime();
    while (cur < end) {
      const hour = new Date(cur).getHours();
      const nextHour = new Date(cur);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(hour + 1);
      const segEnd = Math.min(end, nextHour.getTime());
      buckets[hour] += Math.round((segEnd - cur) / 60000);
      cur = segEnd;
    }
  }
  return buckets;
}

const isNightHour = (h: number) => h >= 18 || h < 6;

// ─── Tailwind colour map (web bar-chart `bg-*` classes → hex) ────────────────

const C = {
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  blue300: '#93C5FD',
  blue400: '#60A5FA',
  blue700: '#1D4ED8',
  sky300: '#7DD3FC',
  sky400: '#38BDF8',
  amber300: '#FCD34D',
  amber400: '#FBBF24',
  orange300: '#FDBA74',
  orange400: '#FB923C',
  teal300: '#5EEAD4',
  teal500: '#14B8A6',
  teal600: '#0D9488',
  teal700: '#0F766E',
  purple300: '#D8B4FE',
  purple500: '#A855F7',
  purple600: '#9333EA',
  purple700: '#7E22CE',
  green300: '#86EFAC',
  green500: '#22C55E',
  green700: '#15803D',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray800: '#1F2937',
};

// ─── Delta badges ─────────────────────────────────────────────────────────────

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  const diff = current - previous;
  if (diff === 0)
    return (
      <View style={styles.deltaRow}>
        <Minus size={11} color={C.gray400} />
        <Text style={[styles.deltaText, { color: C.gray400 }]}>同じ</Text>
      </View>
    );
  const up = diff > 0;
  return (
    <View style={styles.deltaRow}>
      {up ? (
        <TrendingUp size={11} color={C.green500} />
      ) : (
        <TrendingDown size={11} color="#F87171" />
      )}
      <Text style={[styles.deltaText, { color: up ? C.green500 : '#F87171' }]}>
        {up ? '+' : ''}
        {diff}
      </Text>
    </View>
  );
}

function SleepDeltaBadge({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (Math.abs(diff) < 1) return null;
  const up = diff > 0;
  return (
    <View style={styles.deltaRow}>
      {up ? (
        <TrendingUp size={11} color={C.green500} />
      ) : (
        <TrendingDown size={11} color="#F87171" />
      )}
      <Text style={[styles.deltaText, { color: up ? C.green500 : '#F87171' }]}>
        {up ? '+' : ''}
        {minutesToHM(Math.abs(diff))}
      </Text>
    </View>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

interface BarDatum {
  label: string;
  value: number;
  isToday?: boolean;
  excluded?: boolean;
}

function BarChart({
  data,
  maxVal,
  color,
  isTime,
}: {
  data: BarDatum[];
  maxVal: number;
  color: string;
  isTime?: boolean;
}) {
  return (
    <View style={styles.barChart}>
      {data.map((d) => {
        const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
        return (
          <View key={d.label} style={styles.barCol}>
            <Text
              style={[
                styles.barTopLabel,
                d.excluded
                  ? { color: C.gray300, textDecorationLine: 'line-through' }
                  : { color: C.gray500 },
              ]}
            >
              {d.excluded
                ? '—'
                : isTime
                ? d.value > 0
                  ? minutesToHM(d.value)
                  : '-'
                : d.value > 0
                ? d.value
                : '-'}
            </Text>
            <View style={styles.barTrack}>
              {d.excluded ? (
                <View style={styles.barExcluded}>
                  <X size={12} color={C.gray300} />
                </View>
              ) : (
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${pct}%`,
                      backgroundColor: color,
                      opacity: d.isToday ? 1 : 0.6,
                    },
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.barBottomLabel,
                d.excluded
                  ? { color: C.gray300, textDecorationLine: 'line-through' }
                  : d.isToday
                  ? { color: C.purple700 }
                  : { color: C.gray400 },
              ]}
            >
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function HeatmapRow({ buckets }: { buckets: number[] }) {
  const maxVal = Math.max(...buckets, 1);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.heatRow}>
        {buckets.map((val, h) => {
          const intensity = val / maxVal;
          const opacity = Math.round(intensity * 9) / 9;
          const night = isNightHour(h);
          const isSelected = selectedHour === h;
          const baseColor = night
            ? `rgba(79, 60, 180, ${0.08 + opacity * 0.82})`
            : `rgba(56, 160, 100, ${0.08 + opacity * 0.82})`;
          return (
            <TouchableOpacity
              key={h}
              activeOpacity={0.7}
              style={[
                styles.heatCell,
                { backgroundColor: val === 0 ? '#F3F4F6' : baseColor },
                isSelected && styles.heatCellSelected,
              ]}
              onPress={() => setSelectedHour(isSelected ? null : h)}
            />
          );
        })}
      </View>
      <View style={styles.heatAxis}>
        {['0', '3', '6', '9', '12', '15', '18', '21', '23'].map((t) => (
          <Text key={t} style={styles.heatAxisText}>
            {t}
          </Text>
        ))}
      </View>
      <View style={styles.heatLegendRow}>
        <View style={styles.heatLegendItem}>
          <View style={[styles.heatLegendSwatch, { backgroundColor: 'rgba(79,60,180,0.5)' }]} />
          <Text style={styles.heatLegendText}>夜間（18〜6時）</Text>
        </View>
        <View style={styles.heatLegendItem}>
          <View style={[styles.heatLegendSwatch, { backgroundColor: 'rgba(56,160,100,0.5)' }]} />
          <Text style={styles.heatLegendText}>昼間（6〜18時）</Text>
        </View>
      </View>
      {selectedHour !== null && (
        <View style={styles.heatDetail}>
          <View
            style={[
              styles.heatDetailIcon,
              { backgroundColor: isNightHour(selectedHour) ? '#E0E7FF' : '#DCFCE7' },
            ]}
          >
            {isNightHour(selectedHour) ? (
              <Moon size={14} color={C.indigo500} />
            ) : (
              <Sunrise size={14} color={C.green500} />
            )}
          </View>
          <View>
            <Text style={styles.heatDetailTitle}>
              {selectedHour}時台〜{selectedHour + 1}時台{' '}
              <Text style={styles.heatDetailSub}>
                （{isNightHour(selectedHour) ? '夜間' : '昼間'}）
              </Text>
            </Text>
            <Text style={styles.heatDetailValue}>
              {buckets[selectedHour] > 0 ? minutesToHM(buckets[selectedHour]) : 'データなし'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DailyStatsScreen(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';
  const activeChildId = useChildStore((s) => s.activeChildId);
  const children = useChildStore((s) => s.children);
  const activeChild = children.find((c) => c.id === activeChildId) ?? null;

  const { data: logs = [] } = useQuery<Log[]>({
    queryKey: ['logs', familyId],
    queryFn: () => apiGet<Log[]>(`/api/logs/${familyId}`),
    enabled: !!familyId,
  });

  const { data: sessions = [] } = useQuery<SleepSession[]>({
    queryKey: ['sleepSessions', familyId],
    queryFn: () => apiGet<SleepSession[]>(`/api/sleep-sessions/${familyId}`),
    enabled: !!familyId,
  });

  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [showExcludePanel, setShowExcludePanel] = useState(false);
  const [showStimulationPanel, setShowStimulationPanel] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(EXCLUDED_KEY).then((raw) => {
      if (raw) {
        try {
          setExcludedDates(JSON.parse(raw));
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  const persistExcluded = (next: string[]) => {
    setExcludedDates(next);
    AsyncStorage.setItem(EXCLUDED_KEY, JSON.stringify(next));
  };

  const handleToggleDate = (dateStr: string) => {
    const next = excludedDates.includes(dateStr)
      ? excludedDates.filter((d) => d !== dateStr)
      : [...excludedDates, dateStr];
    persistExcluded(next);
  };

  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i)),
    [today],
  );
  const last14Days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => subDays(today, 13 - i)),
    [today],
  );

  const childLogs = useMemo(() => {
    const childId = activeChild?.id;
    if (!childId) return logs as any[];
    return (logs as any[]).filter((l: any) => l.childId === childId);
  }, [logs, activeChild]);

  const childSessions = useMemo(() => {
    const childId = activeChild?.id;
    if (!childId) return sessions as any[];
    return (sessions as any[]).filter((s: any) => s.childId === childId);
  }, [sessions, activeChild]);

  const filteredSessions = useMemo(() => {
    if (excludedDates.length === 0) return childSessions;
    return childSessions.filter((s: any) => {
      const dateStr = format(new Date(s.startedAt), 'yyyy-MM-dd');
      return !excludedDates.includes(dateStr);
    });
  }, [childSessions, excludedDates]);

  const filteredLogs = useMemo(() => {
    if (excludedDates.length === 0) return childLogs;
    return childLogs.filter((l: any) => {
      const dateStr = format(new Date(l.createdAt), 'yyyy-MM-dd');
      return !excludedDates.includes(dateStr);
    });
  }, [childLogs, excludedDates]);

  const dailyStats = useMemo(() => {
    return days.map((date) => {
      const dateStr = toDateStr(date);
      const excluded = excludedDates.includes(dateStr);
      const dayLogs = filteredLogs.filter((l: any) => isSameDay(new Date(l.createdAt), date));
      const sleepMins = excluded ? 0 : calcSleepMinutesForDay(filteredSessions, date);
      const milkLogs = dayLogs.filter((l: any) => l.type === 'milk');
      const milkCount = milkLogs.length;
      const breastCount = milkLogs.filter(
        (l: any) => l.subType === 'breast' || l.subType === 'mixed',
      ).length;
      const formulaTotalMl = milkLogs.reduce(
        (sum: number, l: any) => sum + (l.formulaMl || 0),
        0,
      );
      const peeCount = dayLogs.filter(
        (l: any) => l.type === 'diaper' && (l.subType === 'pee' || l.subType === 'both'),
      ).length;
      const poopCount = dayLogs.filter(
        (l: any) => l.type === 'diaper' && (l.subType === 'poop' || l.subType === 'both'),
      ).length;
      const expressCount = dayLogs.filter((l: any) => l.type === 'express').length;
      const stimulationCount = breastCount + expressCount;
      return {
        date,
        dateStr,
        excluded,
        sleepMins,
        milkCount,
        breastCount,
        formulaTotalMl,
        peeCount,
        poopCount,
        expressCount,
        stimulationCount,
      };
    });
  }, [filteredLogs, filteredSessions, days, excludedDates]);

  const last14Sessions = useMemo(() => {
    const cutoff = subDays(today, 13).getTime();
    return filteredSessions.filter(
      (s: any) => s.endedAt && new Date(s.startedAt).getTime() >= cutoff,
    );
  }, [filteredSessions, today]);

  const heatmap = useMemo(() => calcHourlyHeatmap(last14Sessions), [last14Sessions]);

  const todayStat = dailyStats[6];
  const yesterdayStat = dailyStats[5];
  const weekAgoStat = dailyStats[0];

  const dayLabels = days.map((d, i) => {
    if (i === 6) return '今日';
    if (i === 5) return '昨日';
    return format(d, 'M/d');
  });

  const mkBar = (pick: (s: typeof dailyStats[number]) => number): BarDatum[] =>
    dailyStats.map((s, i) => ({
      label: dayLabels[i],
      value: pick(s),
      isToday: i === 6,
      excluded: s.excluded,
    }));

  const sleepBarData = mkBar((s) => s.sleepMins);
  const milkBarData = mkBar((s) => s.milkCount);
  const formulaMlBarData = mkBar((s) => s.formulaTotalMl);
  const peeBarData = mkBar((s) => s.peeCount);
  const poopBarData = mkBar((s) => s.poopCount);
  const breastBarData = mkBar((s) => s.breastCount);
  const expressBarData = mkBar((s) => s.expressCount);
  const stimulationBarData = mkBar((s) => s.stimulationCount);

  const maxOf = (d: BarDatum[]) =>
    Math.max(...d.filter((x) => !x.excluded).map((x) => x.value), 1);

  const maxSleep = maxOf(sleepBarData);
  const maxMilk = maxOf(milkBarData);
  const maxFormulaMl = maxOf(formulaMlBarData);
  const maxPee = maxOf(peeBarData);
  const maxPoop = maxOf(poopBarData);
  const maxBreast = maxOf(breastBarData);
  const maxExpress = maxOf(expressBarData);
  const maxStimulation = maxOf(stimulationBarData);

  const nightSleepMins = useMemo(
    () => heatmap.reduce((sum, v, h) => sum + (isNightHour(h) ? v : 0), 0),
    [heatmap],
  );
  const daySleepMins = useMemo(
    () => heatmap.reduce((sum, v, h) => sum + (!isNightHour(h) ? v : 0), 0),
    [heatmap],
  );
  const heatmapDayCount = Math.max(1, 14 - excludedDates.length);
  const nightSleepAvgMins = Math.round(nightSleepMins / heatmapDayCount);
  const daySleepAvgMins = Math.round(daySleepMins / heatmapDayCount);

  const topNightHours = useMemo(
    () =>
      heatmap
        .map((v, h) => ({ hour: h, mins: v }))
        .filter((x) => isNightHour(x.hour) && x.mins > 0)
        .sort((a, b) => b.mins - a.mins)
        .slice(0, 3),
    [heatmap],
  );
  const topDayHours = useMemo(
    () =>
      heatmap
        .map((v, h) => ({ hour: h, mins: v }))
        .filter((x) => !isNightHour(x.hour) && x.mins > 0)
        .sort((a, b) => b.mins - a.mins)
        .slice(0, 3),
    [heatmap],
  );

  const summaryCards = [
    {
      label: '今日の睡眠',
      value: todayStat.excluded ? '除外中' : minutesToHM(todayStat.sleepMins),
      icon: <Moon size={16} color={C.indigo500} />,
      delta: todayStat.excluded ? null : (
        <SleepDeltaBadge current={todayStat.sleepMins} previous={yesterdayStat.sleepMins} />
      ),
      sub: `昨日 ${yesterdayStat.excluded ? '—' : minutesToHM(yesterdayStat.sleepMins)}`,
      sub2: null as string | null,
      bg: '#EEF2FF',
      border: '#E0E7FF',
    },
    {
      label: '今日の授乳',
      value: todayStat.excluded ? '除外中' : `${todayStat.milkCount}回`,
      icon: <Milk size={16} color={C.blue400} />,
      delta: todayStat.excluded ? null : (
        <DeltaBadge current={todayStat.milkCount} previous={yesterdayStat.milkCount} />
      ),
      sub: `昨日 ${yesterdayStat.excluded ? '—' : `${yesterdayStat.milkCount}回`}`,
      sub2:
        !todayStat.excluded && todayStat.formulaTotalMl > 0
          ? `ミルク計 ${todayStat.formulaTotalMl}ml`
          : null,
      bg: '#EFF6FF',
      border: '#DBEAFE',
    },
    {
      label: 'おしっこ',
      value: todayStat.excluded ? '除外中' : `${todayStat.peeCount}回`,
      icon: <Droplets size={16} color={C.amber400} />,
      delta: todayStat.excluded ? null : (
        <DeltaBadge current={todayStat.peeCount} previous={yesterdayStat.peeCount} />
      ),
      sub: `昨日 ${yesterdayStat.excluded ? '—' : `${yesterdayStat.peeCount}回`}`,
      sub2: null as string | null,
      bg: '#FFFBEB',
      border: '#FEF3C7',
    },
    {
      label: 'うんち',
      value: todayStat.excluded ? '除外中' : `${todayStat.poopCount}回`,
      icon: <Droplets size={16} color={C.orange400} />,
      delta: todayStat.excluded ? null : (
        <DeltaBadge current={todayStat.poopCount} previous={yesterdayStat.poopCount} />
      ),
      sub: `昨日 ${yesterdayStat.excluded ? '—' : `${yesterdayStat.poopCount}回`}`,
      sub2: null as string | null,
      bg: '#FFF7ED',
      border: '#FFEDD5',
    },
  ];

  const comparisonRows = [
    {
      label: '睡眠時間',
      cur: todayStat.excluded ? '—' : minutesToHM(todayStat.sleepMins),
      prev: weekAgoStat.excluded ? '—' : minutesToHM(weekAgoStat.sleepMins),
      delta:
        todayStat.excluded || weekAgoStat.excluded ? null : (
          <SleepDeltaBadge current={todayStat.sleepMins} previous={weekAgoStat.sleepMins} />
        ),
      icon: <Moon size={14} color={C.indigo400} />,
    },
    {
      label: '授乳',
      cur: todayStat.excluded ? '—' : `${todayStat.milkCount}回`,
      prev: weekAgoStat.excluded ? '—' : `${weekAgoStat.milkCount}回`,
      delta:
        todayStat.excluded || weekAgoStat.excluded ? null : (
          <DeltaBadge current={todayStat.milkCount} previous={weekAgoStat.milkCount} />
        ),
      icon: <Milk size={14} color={C.blue400} />,
    },
    {
      label: 'ミルク量',
      cur: todayStat.excluded ? '—' : `${todayStat.formulaTotalMl}ml`,
      prev: weekAgoStat.excluded ? '—' : `${weekAgoStat.formulaTotalMl}ml`,
      delta:
        todayStat.excluded || weekAgoStat.excluded ? null : (
          <DeltaBadge current={todayStat.formulaTotalMl} previous={weekAgoStat.formulaTotalMl} />
        ),
      icon: <Milk size={14} color={C.sky400} />,
    },
    {
      label: 'おしっこ',
      cur: todayStat.excluded ? '—' : `${todayStat.peeCount}回`,
      prev: weekAgoStat.excluded ? '—' : `${weekAgoStat.peeCount}回`,
      delta:
        todayStat.excluded || weekAgoStat.excluded ? null : (
          <DeltaBadge current={todayStat.peeCount} previous={weekAgoStat.peeCount} />
        ),
      icon: <Droplets size={14} color={C.amber400} />,
    },
    {
      label: 'うんち',
      cur: todayStat.excluded ? '—' : `${todayStat.poopCount}回`,
      prev: weekAgoStat.excluded ? '—' : `${weekAgoStat.poopCount}回`,
      delta:
        todayStat.excluded || weekAgoStat.excluded ? null : (
          <DeltaBadge current={todayStat.poopCount} previous={weekAgoStat.poopCount} />
        ),
      icon: <Droplets size={14} color={C.orange400} />,
    },
  ];

  const stimulationCards = [
    {
      label: '直接授乳',
      value: todayStat.excluded ? '—' : `${todayStat.breastCount}回`,
      icon: <Milk size={16} color={C.blue400} />,
      bg: '#EFF6FF',
      border: '#DBEAFE',
      sub: `昨日 ${yesterdayStat.excluded ? '—' : `${yesterdayStat.breastCount}回`}`,
      textColor: C.blue700,
    },
    {
      label: '搾乳',
      value: todayStat.excluded ? '—' : `${todayStat.expressCount}回`,
      icon: <Timer size={16} color={C.teal500} />,
      bg: '#F0FDFA',
      border: '#CCFBF1',
      sub: `昨日 ${yesterdayStat.excluded ? '—' : `${yesterdayStat.expressCount}回`}`,
      textColor: C.teal700,
    },
    {
      label: '合計刺激',
      value: todayStat.excluded ? '—' : `${todayStat.stimulationCount}回`,
      icon: <Zap size={16} color={C.purple500} />,
      bg: '#FAF5FF',
      border: '#F3E8FF',
      sub: `昨日 ${yesterdayStat.excluded ? '—' : `${yesterdayStat.stimulationCount}回`}`,
      textColor: C.purple700,
    },
  ];

  return (
    <Screen contentStyle={styles.content}>
      {/* Header — web: 毎日の記録分析 + child / 過去7日間 */}
      <View style={styles.header}>
        <Title style={styles.headerTitle}>毎日の記録分析</Title>
        {activeChild && (
          <Muted style={styles.headerSub}>
            {activeChild.name}ちゃん · 過去7日間
          </Muted>
        )}
      </View>

      {/* 除外日管理パネル */}
      <Card style={styles.panelCard}>
        <TouchableOpacity
          style={styles.panelHeader}
          activeOpacity={0.7}
          onPress={() => setShowExcludePanel((v) => !v)}
        >
          <View style={styles.panelHeaderLeft}>
            <UserX size={16} color={C.purple500} />
            <Text style={styles.panelTitle}>分析から除外する日</Text>
            {excludedDates.length > 0 && (
              <View style={styles.panelBadge}>
                <Text style={styles.panelBadgeText}>{excludedDates.length}日除外中</Text>
              </View>
            )}
          </View>
          {showExcludePanel ? (
            <ChevronUp size={16} color={C.gray400} />
          ) : (
            <ChevronDown size={16} color={C.gray400} />
          )}
        </TouchableOpacity>

        {showExcludePanel && (
          <View style={styles.panelBody}>
            <Muted style={styles.panelNote}>
              祖父母に預けた日など記録が不完全だった日をタップして除外できます。除外した日はグラフ・アラーム予測に反映されません。
            </Muted>
            <View style={styles.excludeGrid}>
              {last14Days.map((date) => {
                const dateStr = toDateStr(date);
                const isExcluded = excludedDates.includes(dateStr);
                const isToday = isSameDay(date, new Date());
                return (
                  <TouchableOpacity
                    key={dateStr}
                    activeOpacity={0.7}
                    onPress={() => handleToggleDate(dateStr)}
                    style={[
                      styles.excludeCell,
                      isExcluded
                        ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }
                        : isToday
                        ? { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }
                        : { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.excludeCellText,
                        {
                          color: isExcluded
                            ? '#EF4444'
                            : isToday
                            ? C.purple700
                            : C.gray500,
                        },
                      ]}
                    >
                      {format(date, 'M/d')}
                    </Text>
                    <Text
                      style={[
                        styles.excludeCellText,
                        {
                          color: isExcluded
                            ? '#EF4444'
                            : isToday
                            ? C.purple700
                            : C.gray500,
                        },
                      ]}
                    >
                      {format(date, 'E', { locale: ja })}
                    </Text>
                    {isExcluded && <X size={10} color="#EF4444" />}
                  </TouchableOpacity>
                );
              })}
            </View>
            {excludedDates.length > 0 && (
              <TouchableOpacity onPress={() => persistExcluded([])}>
                <Text style={styles.resetLink}>除外をすべてリセット</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>

      {/* Summary cards */}
      <View style={styles.summaryGrid}>
        {summaryCards.map((item) => (
          <View
            key={item.label}
            style={[styles.summaryCard, { backgroundColor: item.bg, borderColor: item.border }]}
          >
            <View style={styles.summaryTop}>
              <View style={styles.summaryLabelRow}>
                {item.icon}
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
              {item.delta}
            </View>
            <Text
              style={[
                styles.summaryValue,
                todayStat.excluded
                  ? { color: C.gray300, fontSize: 16 }
                  : { color: C.gray800 },
              ]}
            >
              {item.value}
            </Text>
            {item.sub2 && <Text style={styles.summarySub2}>{item.sub2}</Text>}
            <Text style={styles.summarySub}>{item.sub}</Text>
          </View>
        ))}
      </View>

      {/* 睡眠時間（7日間） */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Moon size={16} color={C.indigo500} />
          <Text style={styles.chartTitle}>睡眠時間（7日間）</Text>
        </View>
        <BarChart data={sleepBarData} maxVal={maxSleep} color={C.indigo400} isTime />
      </Card>

      {/* 睡眠時間帯ヒートマップ（14日間） */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Moon size={16} color={C.indigo500} />
          <Text style={styles.chartTitle}>睡眠時間帯ヒートマップ（14日間）</Text>
        </View>
        <Muted style={styles.chartNote}>
          セルをタップすると時間が表示されます。色は夜間（紫）・昼間（緑）で分けています
        </Muted>
        {excludedDates.length > 0 && (
          <Text style={styles.excludedNote}>{excludedDates.length}日間除外済み</Text>
        )}
        <HeatmapRow buckets={heatmap} />

        <View style={styles.heatSummaryGrid}>
          <View style={[styles.heatSummaryCard, { backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' }]}>
            <View style={styles.heatSummaryHead}>
              <Stars size={14} color={C.indigo500} />
              <Text style={[styles.heatSummaryTitle, { color: C.indigo600 }]}>夜間睡眠</Text>
              <Text style={[styles.heatSummaryMini, { color: C.indigo400 }]}>18〜6時</Text>
            </View>
            <Text style={[styles.heatSummaryValue, { color: C.indigo700 }]}>
              {nightSleepAvgMins > 0 ? minutesToHM(nightSleepAvgMins) : '—'}
              <Text style={[styles.heatSummaryPerDay, { color: C.indigo400 }]}> /日</Text>
            </Text>
            {topNightHours.length > 0 ? (
              <View style={{ gap: 4 }}>
                {topNightHours.map((x, i) => (
                  <View key={x.hour} style={styles.rankRow}>
                    <Text style={[styles.rankText, { color: C.indigo600 }]}>
                      {i + 1}位 {x.hour}時台
                    </Text>
                    <Text style={[styles.rankText, { color: C.indigo400 }]}>
                      {minutesToHM(x.mins)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.noDataText, { color: '#A5B4FC' }]}>データなし</Text>
            )}
          </View>

          <View style={[styles.heatSummaryCard, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
            <View style={styles.heatSummaryHead}>
              <Sunrise size={14} color={C.green500} />
              <Text style={[styles.heatSummaryTitle, { color: C.green700 }]}>昼寝</Text>
              <Text style={[styles.heatSummaryMini, { color: C.green500 }]}>6〜18時</Text>
            </View>
            <Text style={[styles.heatSummaryValue, { color: C.green700 }]}>
              {daySleepAvgMins > 0 ? minutesToHM(daySleepAvgMins) : '—'}
              <Text style={[styles.heatSummaryPerDay, { color: C.green500 }]}> /日</Text>
            </Text>
            {topDayHours.length > 0 ? (
              <View style={{ gap: 4 }}>
                {topDayHours.map((x, i) => (
                  <View key={x.hour} style={styles.rankRow}>
                    <Text style={[styles.rankText, { color: C.green700 }]}>
                      {i + 1}位 {x.hour}時台
                    </Text>
                    <Text style={[styles.rankText, { color: C.green500 }]}>
                      {minutesToHM(x.mins)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.noDataText, { color: '#86EFAC' }]}>データなし</Text>
            )}
          </View>
        </View>
      </Card>

      {/* 授乳回数（7日間） */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Milk size={16} color={C.blue400} />
          <Text style={styles.chartTitle}>授乳回数（7日間）</Text>
        </View>
        <BarChart data={milkBarData} maxVal={maxMilk} color={C.blue300} />
      </Card>

      {/* ミルク量・ml（7日間） */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Milk size={16} color={C.sky400} />
          <Text style={styles.chartTitle}>ミルク量・ml（7日間）</Text>
        </View>
        <BarChart data={formulaMlBarData} maxVal={maxFormulaMl} color={C.sky300} />
      </Card>

      {/* おしっこ回数（7日間） */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Droplets size={16} color={C.amber400} />
          <Text style={styles.chartTitle}>おしっこ回数（7日間）</Text>
        </View>
        <BarChart data={peeBarData} maxVal={maxPee} color={C.amber300} />
      </Card>

      {/* うんち回数（7日間） */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Droplets size={16} color={C.orange400} />
          <Text style={styles.chartTitle}>うんち回数（7日間）</Text>
        </View>
        <BarChart data={poopBarData} maxVal={maxPoop} color={C.orange300} />
      </Card>

      {/* 母乳量サポート分析（トグル） */}
      <Card style={styles.panelCard}>
        <TouchableOpacity
          style={styles.panelHeader}
          activeOpacity={0.7}
          onPress={() => setShowStimulationPanel((v) => !v)}
        >
          <View style={styles.panelHeaderLeft}>
            <Zap size={16} color={C.teal500} />
            <Text style={styles.panelTitle}>母乳量サポート分析</Text>
            <View style={[styles.panelBadge, { backgroundColor: '#CCFBF1' }]}>
              <Text style={[styles.panelBadgeText, { color: C.teal600 }]}>
                今日 {todayStat.excluded ? '—' : `${todayStat.stimulationCount}回`}
              </Text>
            </View>
          </View>
          {showStimulationPanel ? (
            <ChevronUp size={16} color={C.gray400} />
          ) : (
            <ChevronDown size={16} color={C.gray400} />
          )}
        </TouchableOpacity>

        {showStimulationPanel && (
          <View style={styles.panelBody}>
            <Muted style={styles.panelNote}>
              直接授乳（母乳・混合）と搾乳を合わせた乳頭刺激の回数です。回数が多いほど母乳分泌を促す効果が期待できます。
            </Muted>

            <View style={styles.stimGrid}>
              {stimulationCards.map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.stimCard,
                    { backgroundColor: item.bg, borderColor: item.border },
                  ]}
                >
                  <View style={styles.stimLabelRow}>
                    {item.icon}
                    <Text style={styles.stimLabel}>{item.label}</Text>
                  </View>
                  <Text
                    style={[
                      styles.stimValue,
                      todayStat.excluded
                        ? { color: C.gray300, fontSize: 14 }
                        : { color: item.textColor },
                    ]}
                  >
                    {item.value}
                  </Text>
                  <Text style={styles.stimSub}>{item.sub}</Text>
                </View>
              ))}
            </View>

            <View style={styles.stimChartBlock}>
              <View style={styles.chartHeaderSm}>
                <Milk size={14} color={C.blue400} />
                <Text style={styles.chartTitleSm}>直接授乳回数（7日間）</Text>
              </View>
              <BarChart data={breastBarData} maxVal={maxBreast} color={C.blue300} />
            </View>

            <View style={styles.stimChartBlock}>
              <View style={styles.chartHeaderSm}>
                <Timer size={14} color={C.teal500} />
                <Text style={styles.chartTitleSm}>搾乳回数（7日間）</Text>
              </View>
              <BarChart data={expressBarData} maxVal={maxExpress} color={C.teal300} />
            </View>

            <View style={styles.stimChartBlock}>
              <View style={styles.chartHeaderSm}>
                <Zap size={14} color={C.purple500} />
                <Text style={styles.chartTitleSm}>合計刺激回数（7日間）</Text>
              </View>
              <BarChart data={stimulationBarData} maxVal={maxStimulation} color={C.purple300} />
            </View>
          </View>
        )}
      </Card>

      {/* 1週間前と比較 */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>1週間前と比較</Text>
        <View style={{ marginTop: 4 }}>
          {comparisonRows.map((row, idx) => (
            <View
              key={row.label}
              style={[
                styles.compareRow,
                idx < comparisonRows.length - 1 && styles.compareRowBorder,
              ]}
            >
              {row.icon}
              <Text style={styles.compareLabel}>{row.label}</Text>
              <Text style={styles.compareCur}>{row.cur}</Text>
              <Text style={styles.comparePrev}>7日前 {row.prev}</Text>
              {row.delta}
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 16 },

  header: { gap: 2 },
  headerTitle: { fontSize: 18, color: C.gray800 },
  headerSub: { fontSize: 12, color: C.gray400 },

  // Collapsible panels (除外日 / 母乳量サポート)
  panelCard: { borderRadius: radius.lg, borderColor: palette.border, overflow: 'hidden' },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  panelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  panelTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: C.gray700 },
  panelBadge: {
    backgroundColor: '#F3E8FF',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  panelBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.purple600 },
  panelBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  panelNote: { fontSize: 11, color: C.gray400, lineHeight: 17, paddingTop: 8 },

  excludeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  excludeCell: {
    width: '13%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  excludeCellText: { fontFamily: fonts.bodyBold, fontSize: 9 },
  resetLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: C.gray400,
    textDecorationLine: 'underline',
  },

  // Summary cards
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.gray500 },
  summaryValue: { fontFamily: fonts.sans, fontSize: 24, fontWeight: '700' },
  summarySub2: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#3B82F6' },
  summarySub: { fontFamily: fonts.bodySemibold, fontSize: 10, color: C.gray400 },

  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  deltaText: { fontFamily: fonts.bodyBold, fontSize: 10 },

  // Chart cards
  chartCard: { borderRadius: radius.lg, borderColor: palette.border, padding: 16, gap: 12 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: C.gray700 },
  chartNote: { fontSize: 11, color: C.gray400, lineHeight: 16 },
  excludedNote: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.purple500 },
  chartHeaderSm: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartTitleSm: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.gray700 },

  // Bar chart
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 96 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTopLabel: { fontFamily: fonts.bodyBold, fontSize: 10 },
  barTrack: {
    width: '100%',
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  barExcluded: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barBottomLabel: { fontFamily: fonts.bodyBold, fontSize: 10 },

  // Heatmap
  heatRow: { flexDirection: 'row', gap: 2 },
  heatCell: { flex: 1, height: 32, borderRadius: 3 },
  heatCellSelected: { borderWidth: 2, borderColor: '#805AAA' },
  heatAxis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 1 },
  heatAxisText: { fontFamily: fonts.bodyBold, fontSize: 9, color: C.gray400 },
  heatLegendRow: { flexDirection: 'row', gap: 12 },
  heatLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heatLegendSwatch: { width: 12, height: 12, borderRadius: 3 },
  heatLegendText: { fontFamily: fonts.bodySemibold, fontSize: 10, color: C.gray400 },
  heatDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#F3E8FF',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heatDetailIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatDetailTitle: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.gray700 },
  heatDetailSub: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.gray400 },
  heatDetailValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: C.purple700 },

  // Heatmap night/day summary
  heatSummaryGrid: { flexDirection: 'row', gap: 8 },
  heatSummaryCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  heatSummaryHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  heatSummaryTitle: { fontFamily: fonts.bodyBold, fontSize: 11 },
  heatSummaryMini: { fontFamily: fonts.bodySemibold, fontSize: 9 },
  heatSummaryValue: { fontFamily: fonts.sans, fontSize: 18, fontWeight: '700' },
  heatSummaryPerDay: { fontFamily: fonts.bodyBold, fontSize: 10 },
  rankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  noDataText: { fontFamily: fonts.bodySemibold, fontSize: 10 },

  // Stimulation panel cards
  stimGrid: { flexDirection: 'row', gap: 8 },
  stimCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  stimLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stimLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.gray500 },
  stimValue: { fontFamily: fonts.sans, fontSize: 20, fontWeight: '700' },
  stimSub: { fontFamily: fonts.bodySemibold, fontSize: 9, color: C.gray400 },
  stimChartBlock: { gap: 8 },

  // Comparison rows
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  compareRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  compareLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.gray500, width: 56 },
  compareCur: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.gray800, flex: 1 },
  comparePrev: { fontFamily: fonts.bodySemibold, fontSize: 11, color: C.gray400 },
});
