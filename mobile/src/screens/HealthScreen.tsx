import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  TrendingUp, Thermometer, Stethoscope, Plus, Ruler, Weight,
  Activity, Syringe, Check, FileDown, AlertTriangle, ClipboardList,
  Trash2, ChevronUp, ChevronDown, Salad, Heart, Calendar,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { apiGet, apiPost, apiDelete } from '../api/client';
import type { RootStackParamList } from '../navigation';
import { useTheme } from '../contexts/ThemeContext';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Card, Button, Text, Title, Muted } from '../theme/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Web Health.tsx tailwind palette (verbatim hex) ───────────────────────────
//  red-50 #FEF2F2 red-500 #EF4444 red-600 #DC2626
//  blue-50 #EFF6FF blue-100 #DBEAFE blue-500 #3B82F6 blue-600 #2563EB
//  green-50 #F0FDF4 green-100 #DCFCE7 green-500 #22C55E green-600 #16A34A
//  teal-50 #F0FDFA teal-100 #CCFBF1 teal-500 #14B8A6 teal-600 #0D9488 teal-700 #0F766E teal-900 #134E4A
//  cyan-50 #ECFEFF cyan-600 #0891B2
//  orange-50 #FFF7ED orange-500 #F97316
//  rose-50 #FFF1F2 rose-100 #FFE4E6 rose-400 #FB7185 rose-500 #F43F5E rose-800 #9F1239
//  indigo-100 #E0E7FF indigo-600 #4F46E5
//  purple-100 #F3E8FF purple-500 #A855F7 purple-600 #9333EA
//  gray-50 #F9FAFB gray-100 #F3F4F6 gray-300 #D1D5DB gray-400 #9CA3AF gray-500 #6B7280 gray-700 #374151 gray-800 #1F2937

const RED = palette.destructive;
const RED_50 = '#FEF2F2';
const RED_500 = '#EF4444';
const BLUE = '#3B82F6';
const BLUE_50 = '#EFF6FF';
const BLUE_100 = '#DBEAFE';
const BLUE_600 = '#2563EB';
const GREEN = '#16A34A';
const GREEN_50 = '#F0FDF4';
const GREEN_100 = '#DCFCE7';
const GREEN_500 = '#22C55E';
const TEAL = '#0D9488';
const TEAL_50 = '#F0FDFA';
const TEAL_100 = '#CCFBF1';
const TEAL_500 = '#14B8A6';
const TEAL_700 = '#0F766E';
const TEAL_900 = '#134E4A';
const CYAN_50 = '#ECFEFF';
const CYAN_600 = '#0891B2';
const ORANGE_50 = '#FFF7ED';
const ORANGE_500 = '#F97316';
const ROSE_50 = '#FFF1F2';
const ROSE_100 = '#FFE4E6';
const ROSE_400 = '#FB7185';
const ROSE_500 = '#F43F5E';
const ROSE_800 = '#9F1239';
const INDIGO_100 = '#E0E7FF';
const INDIGO_600 = '#4F46E5';
const PURPLE_100 = '#F3E8FF';
const PURPLE_500 = '#A855F7';
const PURPLE_600 = '#9333EA';
const GRAY_50 = '#F9FAFB';
const GRAY_100 = '#F3F4F6';
const GRAY_300 = '#D1D5DB';
const GRAY_400 = '#9CA3AF';
const GRAY_500 = '#6B7280';
const GRAY_700 = '#374151';
const GRAY_800 = '#1F2937';
const AMBER_50 = '#FFFBEB';
const AMBER_500 = '#F59E0B';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrowthRecord {
  id: number;
  familyId: string;
  childId: number;
  weightGrams?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  measuredAt: string;
}

interface VaccinationRecord {
  id: number;
  familyId: string;
  childId: number;
  vaccineId: string;
  administeredDate: string;
  note?: string;
}

interface Log {
  id: number;
  type: string;
  createdAt: string;
  bodyTemperature?: number;
  symptoms?: string;
  memo?: string;
}

interface Child {
  id: number;
  name: string;
  birthday: string;
  gender: string;
}

interface JpVaccineDose {
  label: string;
  ageMin: number;
  ageMax: number;
}

interface JpVaccine {
  id: string;
  name: string;
  doses: JpVaccineDose[];
  category: 'required' | 'optional';
}

// ─── JP Standard Vaccine Schedule ────────────────────────────────────────────

const JP_VACCINES: JpVaccine[] = [
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function monthsDiff(birthday: string, now: Date): number {
  const birth = new Date(birthday);
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  return years * 12 + months;
}

function formatJpDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatSlashDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatLogTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const yest = new Date(Date.now() - 86400000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  let prefix: string;
  if (now.toDateString() === d.toDateString()) prefix = '今日';
  else if (yest.toDateString() === d.toDateString()) prefix = '昨日';
  else prefix = `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${prefix} ${hh}:${mm}`;
}

function formatJpDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

function buildHealthPdf(
  growthRecords: GrowthRecord[],
  vaccineRecords: VaccinationRecord[],
  symptomLogs: Log[],
  child: Child | null,
): string {
  const childName = child?.name ?? '—';
  const childBirthday = child ? formatJpDate(child.birthday) : '—';
  const today = new Date().toLocaleDateString('ja-JP');

  const growthRows = [...growthRecords]
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
    .map(
      (r) =>
        `<tr>
          <td>${formatJpDate(r.measuredAt)}</td>
          <td>${r.weightGrams != null ? (r.weightGrams / 1000).toFixed(2) + ' kg' : '—'}</td>
          <td>${r.heightCm != null ? r.heightCm + ' cm' : '—'}</td>
          <td>${r.headCircumferenceCm != null ? r.headCircumferenceCm + ' cm' : '—'}</td>
        </tr>`,
    )
    .join('');

  const vaccineRows = [...vaccineRecords]
    .sort((a, b) => new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime())
    .map(
      (v) =>
        `<tr>
          <td>${v.vaccineId}</td>
          <td>${formatJpDate(v.administeredDate)}</td>
          <td>${v.note ?? '—'}</td>
        </tr>`,
    )
    .join('');

  const logRows = [...symptomLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((log) => {
      const icon = log.type === 'temperature' ? '🌡' : '🤒';
      const value =
        log.type === 'temperature'
          ? `${log.bodyTemperature ?? '—'}°C`
          : log.symptoms ?? log.memo ?? '—';
      return `<tr>
        <td>${formatJpDateTime(log.createdAt)}</td>
        <td>${icon} ${log.type === 'temperature' ? '体温' : '症状'}</td>
        <td>${value}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"/>
<title>健康記録 - ${childName}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Hiragino Sans', sans-serif; font-size: 12px; color: #333; }
  h1 { color: #8C5EBA; font-size: 20px; }
  h2 { color: #8C5EBA; font-size: 15px; border-bottom: 2px solid #8C5EBA; padding-bottom: 4px; margin-top: 24px; }
  .cover { text-align: center; padding: 40px 0 60px; }
  .cover p { font-size: 14px; margin: 4px 0; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #8C5EBA; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) td { background: #F9F5FF; }
</style>
</head>
<body>
  <div class="cover">
    <h1>健康記録</h1>
    <p>お名前: ${childName}</p>
    <p>生年月日: ${childBirthday}</p>
    <p>作成日: ${today}</p>
  </div>

  <h2>成長記録</h2>
  <table>
    <thead><tr><th>日付</th><th>体重</th><th>身長</th><th>頭囲</th></tr></thead>
    <tbody>${growthRows || '<tr><td colspan="4">記録なし</td></tr>'}</tbody>
  </table>

  <h2>予防接種記録</h2>
  <table>
    <thead><tr><th>ワクチン名</th><th>接種日</th><th>メモ</th></tr></thead>
    <tbody>${vaccineRows || '<tr><td colspan="3">記録なし</td></tr>'}</tbody>
  </table>

  <h2>症状・体温ログ</h2>
  <table>
    <thead><tr><th>日時</th><th>種別</th><th>内容</th></tr></thead>
    <tbody>${logRows || '<tr><td colspan="3">記録なし</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

// ─── Growth chart (mobile-only feature, View-based, no SVG) ───────────────────
// Web uses recharts ComposedChart with a standard-range band + percentile lines;
// this is the RN equivalent that keeps the same visual idea (band + line + dots).

const CHART_HEIGHT = 180; // inner area height

interface GrowthChartProps {
  records: GrowthRecord[];
  chartMode: 'weight' | 'height';
}

function GrowthChart({ records, chartMode }: GrowthChartProps) {
  const chartRecords = useMemo(
    () =>
      [...records]
        .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
        .slice(-8),
    [records],
  );

  const values = useMemo(
    () =>
      chartRecords.map((r) =>
        chartMode === 'weight'
          ? r.weightGrams != null
            ? r.weightGrams / 1000
            : null
          : r.heightCm ?? null,
      ),
    [chartRecords, chartMode],
  );

  const validValues = values.filter((v): v is number => v !== null);

  if (validValues.length === 0) {
    return (
      <View style={chartStyles.container}>
        <Text style={chartStyles.empty}>データなし</Text>
      </View>
    );
  }

  const refMin = chartMode === 'weight' ? 5 : 45;
  const refMax = chartMode === 'weight' ? 15 : 100;

  const dataMin = Math.min(...validValues, refMin);
  const dataMax = Math.max(...validValues, refMax);
  const range = dataMax - dataMin || 1;

  const n = chartRecords.length;
  const getLeft = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const getBottom = (v: number) => ((v - dataMin) / range) * 100;

  const bandBottomPct = ((refMin - dataMin) / range) * 100;
  const bandTopPct = ((refMax - dataMin) / range) * 100;
  const bandHeightPct = bandTopPct - bandBottomPct;

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < chartRecords.length - 1; i++) {
    const v1 = values[i];
    const v2 = values[i + 1];
    if (v1 !== null && v2 !== null) {
      lines.push({
        x1: getLeft(i),
        y1: getBottom(v1),
        x2: getLeft(i + 1),
        y2: getBottom(v2),
      });
    }
  }

  const lineColor = chartMode === 'weight' ? GREEN : BLUE_600;
  const bandColor = chartMode === 'weight' ? 'rgba(134,239,172,0.30)' : 'rgba(147,197,253,0.30)';

  return (
    <View style={chartStyles.container}>
      <View
        style={[
          chartStyles.band,
          {
            bottom: `${Math.max(0, bandBottomPct)}%` as unknown as number,
            height: `${Math.min(100, bandHeightPct)}%` as unknown as number,
            backgroundColor: bandColor,
          },
        ]}
      />
      {lines.map((line, idx) => {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const dxPx = (dx / 100) * 300;
        const dyPx = (dy / 100) * CHART_HEIGHT;
        const length = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
        const angle = -Math.atan2(dyPx, dxPx) * (180 / Math.PI);
        return (
          <View
            key={idx}
            style={{
              position: 'absolute',
              left: `${line.x1}%` as unknown as number,
              bottom: `${line.y1}%` as unknown as number,
              width: length,
              height: 2.5,
              backgroundColor: lineColor,
              transformOrigin: '0 50%',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {chartRecords.map((r, i) => {
        const v = values[i];
        if (v === null) return null;
        return (
          <View
            key={r.id}
            style={[
              chartStyles.dot,
              {
                left: `${getLeft(i)}%` as unknown as number,
                bottom: `${getBottom(v)}%` as unknown as number,
                backgroundColor: lineColor,
              },
            ]}
          />
        );
      })}
      <View style={chartStyles.xAxis}>
        {chartRecords.map((r) => {
          const d = new Date(r.measuredAt);
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return (
            <Text key={r.id} style={chartStyles.xLabel} numberOfLines={1}>
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT + 28,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    padding: 14,
    paddingBottom: 28,
    marginBottom: 8,
    overflow: 'hidden',
  },
  empty: { textAlign: 'center', color: GRAY_400, marginTop: 70, fontFamily: fonts.bodySemibold },
  band: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 4,
  },
  dot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: -4.5,
    marginBottom: -4.5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  xAxis: {
    position: 'absolute',
    bottom: 6,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xLabel: { fontSize: 9, color: GRAY_400, flex: 1, textAlign: 'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HealthScreen() {
  const { user } = useAuthStore();
  const { activeChildId } = useChildStore();
  const familyId = user?.familyId ?? '';
  const queryClient = useQueryClient();
  const navigation = useNavigation<Nav>();
  const { isDark } = useTheme();

  // Chart mode
  const [chartMode, setChartMode] = useState<'weight' | 'height'>('weight');

  // Expandable sections
  const [showSymptomHistory, setShowSymptomHistory] = useState(false);

  // Growth modal
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [gWeight, setGWeight] = useState('');
  const [gHeight, setGHeight] = useState('');
  const [gHead, setGHead] = useState('');
  const [gDate, setGDate] = useState(todayStr());

  // Vaccine quick-record modal
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [vName, setVName] = useState('');
  const [vDate, setVDate] = useState(todayStr());
  const [vNote, setVNote] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: growthRecords = [] } = useQuery({
    queryKey: ['growth', familyId],
    queryFn: () => apiGet<GrowthRecord[]>(`/api/growth/${familyId}`),
    enabled: !!familyId,
  });

  const { data: vaccineRecords = [] } = useQuery({
    queryKey: ['vaccines', familyId],
    queryFn: () => apiGet<VaccinationRecord[]>(`/api/vaccination-records/${familyId}`),
    enabled: !!familyId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', familyId],
    queryFn: () => apiGet<Log[]>(`/api/logs/${familyId}`),
    enabled: !!familyId,
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children', familyId],
    queryFn: () => apiGet<Child[]>(`/api/children/${familyId}`),
    enabled: !!familyId,
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const activeChild = useMemo(
    () => children.find((c) => c.id === activeChildId) ?? children[0] ?? null,
    [children, activeChildId],
  );

  const childAgeMonths = useMemo(() => {
    if (!activeChild) return 0;
    return monthsDiff(activeChild.birthday, new Date());
  }, [activeChild]);

  const sortedGrowth = useMemo(
    () =>
      [...growthRecords].sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
      ),
    [growthRecords],
  );

  const sortedGrowthAsc = useMemo(
    () =>
      [...growthRecords].sort(
        (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
      ),
    [growthRecords],
  );

  const latestGrowth = sortedGrowth[0] ?? null;

  // temp / symptom logs (mobile data model: type 'temperature' | 'symptoms')
  const tempLogs = useMemo(
    () =>
      [...logs]
        .filter((l) => l.type === 'temperature')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [logs],
  );

  const allSymptomLogs = useMemo(
    () =>
      [...logs]
        .filter((l) => l.type === 'symptoms')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [logs],
  );

  const latestTemp = tempLogs[0] ?? null;

  // clinic-support items: all symptoms + high temps (web: 受診サポート)
  const clinicItems = useMemo(() => {
    const items = [
      ...allSymptomLogs.map((l) => ({
        id: l.id,
        date: new Date(l.createdAt),
        kind: 'symptom' as const,
        text: l.symptoms ?? l.memo ?? '',
        note: l.memo && l.symptoms ? l.memo : '',
      })),
      ...tempLogs
        .filter((l) => (l.bodyTemperature ?? 0) >= 37.5)
        .map((l) => ({
          id: l.id,
          date: new Date(l.createdAt),
          kind: 'temp' as const,
          text: `体温 ${l.bodyTemperature}°C`,
          note: '',
        })),
    ];
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allSymptomLogs, tempLogs]);

  // PDF needs symptom/high-temp logs (preserve mobile PDF logic)
  const symptomLogsForPdf = useMemo(
    () =>
      [...logs]
        .filter(
          (l) =>
            l.type === 'symptoms' ||
            (l.type === 'temperature' && (l.bodyTemperature ?? 0) >= 37.5),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [logs],
  );

  // health-log list (web: 健康の記録 — temp + symptom, newest first)
  const healthLogs = useMemo(
    () =>
      [...logs]
        .filter((l) => l.type === 'temperature' || l.type === 'symptoms')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20),
    [logs],
  );

  // Health tip text (web: HealthLogTab healthTip)
  const healthTip = useMemo(() => {
    if (childAgeMonths <= 3) {
      if (latestTemp && (latestTemp.bodyTemperature ?? 0) >= 37.5) {
        return '体温が少し高めです。母乳やミルクをこまめにあげて、様子を見ましょう。';
      }
      return '体温や症状の記録が赤ちゃんの健康管理に役立ちます。';
    }
    if (latestTemp && (latestTemp.bodyTemperature ?? 0) >= 38.0) {
      return '熱が高めです。水分補給をしっかりして、元気がなければお医者さんに相談しましょう。';
    }
    return '毎日の健康チェックで、お子さまの変化を見逃さないようにしましょう。';
  }, [childAgeMonths, latestTemp]);

  // Vaccine grouping (preserve existing mobile logic)
  const { currentDoses, upcomingDoses, doneDoses } = useMemo(() => {
    const current: Array<{ vaccine: JpVaccine; dose: JpVaccineDose }> = [];
    const upcoming: Array<{ vaccine: JpVaccine; dose: JpVaccineDose; overdue: boolean }> = [];
    const done: Array<{ vaccine: JpVaccine; dose: JpVaccineDose; record: VaccinationRecord }> = [];

    for (const vaccine of JP_VACCINES) {
      for (const dose of vaccine.doses) {
        const record = vaccineRecords.find((r) => r.vaccineId.includes(vaccine.name));
        if (record) {
          done.push({ vaccine, dose, record });
        } else if (childAgeMonths >= dose.ageMin && childAgeMonths <= dose.ageMax) {
          current.push({ vaccine, dose });
        } else if (childAgeMonths < dose.ageMin) {
          upcoming.push({ vaccine, dose, overdue: false });
        } else {
          upcoming.push({ vaccine, dose, overdue: true });
        }
      }
    }

    return { currentDoses: current, upcomingDoses: upcoming, doneDoses: done };
  }, [vaccineRecords, childAgeMonths]);

  const completedVaccineCount = doneDoses.length;
  const nextVaccines = useMemo(
    () => [...currentDoses.map((d) => ({ ...d, overdue: false })), ...upcomingDoses].slice(0, 5),
    [currentDoses, upcomingDoses],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createGrowthMutation = useMutation({
    mutationFn: (data: object) => apiPost('/api/growth', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth', familyId] });
      setShowGrowthModal(false);
      setGWeight(''); setGHeight(''); setGHead(''); setGDate(todayStr());
    },
    onError: () => Alert.alert('エラー', '保存に失敗しました。'),
  });

  const deleteGrowthMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/growth/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['growth', familyId] }),
    onError: () => Alert.alert('エラー', '削除に失敗しました。'),
  });

  const createVaccineMutation = useMutation({
    mutationFn: (data: object) => apiPost('/api/vaccination-records', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccines', familyId] });
      setShowVaccineModal(false);
      setVName(''); setVDate(todayStr()); setVNote('');
    },
    onError: () => Alert.alert('エラー', '保存に失敗しました。'),
  });

  const deleteVaccineMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/vaccination-records/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vaccines', familyId] }),
    onError: () => Alert.alert('エラー', '削除に失敗しました。'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveGrowth = useCallback(() => {
    if (!activeChildId) { Alert.alert('子どもを選択してください'); return; }
    if (!gWeight && !gHeight && !gHead) {
      Alert.alert('入力エラー', '少なくとも1つの値を入力してください。');
      return;
    }
    createGrowthMutation.mutate({
      childId: activeChildId,
      familyId,
      // growth_records.user_id is NOT NULL — server rejected with 400 "Required"
      // when this was omitted, which the UI surfaced as a "freeze" (modal stuck
      // pending a mutation whose error alert competes with the open modal).
      userId: user?.role ?? 'papa',
      weightGrams: gWeight ? Math.round(parseFloat(gWeight) * 1000) : undefined,
      heightCm: gHeight ? parseFloat(gHeight) : undefined,
      headCircumferenceCm: gHead ? parseFloat(gHead) : undefined,
      measuredAt: gDate || todayStr(),
    });
  }, [activeChildId, familyId, user?.role, gWeight, gHeight, gHead, gDate, createGrowthMutation]);

  const handleSaveVaccine = useCallback(() => {
    if (!activeChildId) { Alert.alert('子どもを選択してください'); return; }
    if (!vName.trim()) { Alert.alert('ワクチン名を入力してください'); return; }
    createVaccineMutation.mutate({
      familyId,
      childId: activeChildId,
      vaccineId: vName.trim(),
      administeredDate: vDate,
      note: vNote.trim() || undefined,
    });
  }, [activeChildId, familyId, vName, vDate, vNote, createVaccineMutation]);

  const openVaccineModal = useCallback((name: string) => {
    setVName(name);
    setVDate(todayStr());
    setVNote('');
    setShowVaccineModal(true);
  }, []);

  const confirmDeleteGrowth = useCallback((id: number) => {
    Alert.alert('削除', 'この測定記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deleteGrowthMutation.mutate(id) },
    ]);
  }, [deleteGrowthMutation]);

  const confirmDeleteVaccine = useCallback((id: number) => {
    Alert.alert('削除', 'この接種記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deleteVaccineMutation.mutate(id) },
    ]);
  }, [deleteVaccineMutation]);

  const handleExportPdf = useCallback(() => {
    if (Platform.OS !== 'web') {
      Alert.alert('Web版のみ', 'PDF書き出しはブラウザ版でのみご利用いただけます。');
      return;
    }
    const html = buildHealthPdf(growthRecords, vaccineRecords, symptomLogsForPdf, activeChild);
    const win = (window as Window).open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  }, [growthRecords, vaccineRecords, symptomLogsForPdf, activeChild]);

  function ageAtRecord(record: GrowthRecord): string {
    if (!activeChild) return '';
    const age = monthsDiff(activeChild.birthday, new Date(record.measuredAt));
    if (age < 12) return `${age}ヶ月`;
    return `${Math.floor(age / 12)}歳${age % 12}ヶ月`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 健康メモ (web: teal advice card) ─────────────────────────────── */}
        <Card style={styles.tealCard}>
          <View style={styles.adviceRow}>
            <View style={styles.tealIconWrap}>
              <Stethoscope size={20} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tealTitle}>健康メモ</Text>
              <Text style={styles.tealBody}>{healthTip}</Text>
            </View>
          </View>
        </Card>

        {/* ── Stat tiles (体温 / 症状 / 予防接種) ──────────────────────────── */}
        <View style={styles.statGrid}>
          <Card style={styles.statTile}>
            <Thermometer size={20} color={RED_500} />
            <Text style={styles.statValue}>
              {latestTemp ? `${latestTemp.bodyTemperature}°` : '--'}
            </Text>
            <Text style={styles.statLabel}>最新体温</Text>
          </Card>
          <Card style={styles.statTile}>
            <Stethoscope size={20} color={TEAL_500} />
            <Text style={styles.statValue}>{allSymptomLogs.length}</Text>
            <Text style={styles.statLabel}>症状メモ</Text>
          </Card>
          <Card style={styles.statTile}>
            <Syringe size={20} color={CYAN_600} />
            <Text style={styles.statValue}>{completedVaccineCount}</Text>
            <Text style={styles.statLabel}>予防接種</Text>
          </Card>
        </View>

        {/* ── 受診サポート (web: rose expandable card) ──────────────────────── */}
        {clinicItems.length > 0 && (
          <Card style={styles.roseCard}>
            <TouchableOpacity
              style={styles.roseHeader}
              onPress={() => setShowSymptomHistory((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={styles.roseIconWrap}>
                <Stethoscope size={16} color={ROSE_500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roseTitle}>受診サポート</Text>
                <Text style={styles.roseSub}>症状の経過を病院で説明するために</Text>
              </View>
              <View style={styles.roseBadge}>
                <Text style={styles.roseBadgeText}>{clinicItems.length}件</Text>
              </View>
              {showSymptomHistory ? (
                <ChevronUp size={16} color={ROSE_400} />
              ) : (
                <ChevronDown size={16} color={ROSE_400} />
              )}
            </TouchableOpacity>
            {showSymptomHistory && (
              <View>
                {clinicItems.map((item) => (
                  <View key={`${item.kind}-${item.id}`} style={styles.clinicItem}>
                    <View
                      style={[
                        styles.clinicItemIcon,
                        { backgroundColor: item.kind === 'symptom' ? ROSE_50 : AMBER_50 },
                      ]}
                    >
                      {item.kind === 'symptom' ? (
                        <Stethoscope size={14} color={ROSE_500} />
                      ) : (
                        <Thermometer size={14} color={AMBER_500} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clinicItemDate}>{formatJpDateTime(item.date.toISOString())}</Text>
                      <Text style={styles.clinicItemText}>{item.text}</Text>
                      {item.note ? <Text style={styles.clinicItemNote}>{item.note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* ── 予防接種を記録 (always visible — client feedback: previous
             build hid vaccine input entirely when there were no upcoming
             doses, users had no way to record). ─────────────────────────── */}
        <Card style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listHeaderLeft}>
              <View style={styles.cyanIconWrap}>
                <Syringe size={16} color={CYAN_600} />
              </View>
              <Text style={styles.listCardTitle}>予防接種</Text>
            </View>
          </View>
          <Button onPress={() => openVaccineModal('')} style={styles.greenBtn}>
            <Plus size={16} color={palette.primaryForeground} />
            <Text style={styles.greenBtnText}>予防接種を記録する</Text>
          </Button>
        </Card>

        {/* ── 次の予防接種 (web: VaccineScheduleOverview) ──────────────────── */}
        {nextVaccines.length > 0 && (
          <Card style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={styles.listHeaderLeft}>
                <View style={styles.cyanIconWrap}>
                  <Syringe size={16} color={CYAN_600} />
                </View>
                <Text style={styles.listCardTitle}>次の予防接種</Text>
              </View>
            </View>
            {nextVaccines.map(({ vaccine, dose, overdue }, idx) => (
              <TouchableOpacity
                key={`next-${vaccine.id}-${idx}`}
                style={styles.scheduleItem}
                onPress={() => openVaccineModal(`${vaccine.name} ${dose.label}`)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.scheduleIcon,
                    { backgroundColor: overdue ? ORANGE_50 : CYAN_50 },
                  ]}
                >
                  <Syringe size={16} color={overdue ? ORANGE_500 : CYAN_600} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.scheduleNameRow}>
                    <Text style={styles.scheduleName}>{vaccine.name}</Text>
                    {overdue && (
                      <View style={styles.overdueBadge}>
                        <Text style={styles.overdueBadgeText}>要確認</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.scheduleSub}>
                    {dose.label} · {dose.ageMin}〜{dose.ageMax}ヶ月
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* ── 完了した予防接種 ─────────────────────────────────────────────── */}
        {doneDoses.length > 0 && (
          <Card style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={styles.listHeaderLeft}>
                <View style={styles.cyanIconWrap}>
                  <Check size={16} color={CYAN_600} />
                </View>
                <Text style={styles.listCardTitle}>接種済み（{doneDoses.length}）</Text>
              </View>
            </View>
            {doneDoses.map(({ vaccine, dose, record }, idx) => (
              <View key={`done-${record.id}-${idx}`} style={styles.scheduleItem}>
                <View style={[styles.scheduleIcon, { backgroundColor: GREEN_50 }]}>
                  <Check size={16} color={GREEN} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleName}>{vaccine.name}</Text>
                  <Text style={styles.scheduleSub}>
                    {dose.label} · {formatJpDate(record.administeredDate)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDeleteVaccine(record.id)}
                  style={styles.iconBtn}
                >
                  <Trash2 size={16} color={GRAY_400} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* ── 健康の記録 (web: health log list) ─────────────────────────────── */}
        <Card style={styles.listCard}>
          <View style={styles.listCardHeaderPlain}>
            <Text style={styles.listCardTitle}>健康の記録</Text>
          </View>
          {healthLogs.length === 0 ? (
            <View style={styles.emptyLogBox}>
              <Activity size={28} color={GRAY_300} />
              <Text style={styles.emptyLogText}>まだ記録がありません</Text>
            </View>
          ) : (
            healthLogs.map((log) => {
              const isTemp = log.type === 'temperature';
              const isHigh = isTemp && (log.bodyTemperature ?? 0) >= 37.5;
              return (
                <View key={log.id} style={styles.healthLogItem}>
                  <View
                    style={[
                      styles.healthLogIcon,
                      { backgroundColor: isTemp ? (isHigh ? RED_50 : BLUE_50) : TEAL_50 },
                    ]}
                  >
                    {isTemp ? (
                      <Thermometer size={16} color={isHigh ? RED_500 : BLUE} />
                    ) : (
                      <Stethoscope size={16} color={TEAL_500} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    {isTemp ? (
                      <Text style={styles.healthLogText}>
                        体温 {log.bodyTemperature}°C
                        {isHigh ? <Text style={styles.highTag}>  (高め)</Text> : null}
                      </Text>
                    ) : (
                      <Text style={styles.healthLogText}>
                        {log.symptoms ?? log.memo ?? '症状'}
                      </Text>
                    )}
                    {!isTemp && log.memo && log.symptoms ? (
                      <Text style={styles.healthLogSub}>{log.memo}</Text>
                    ) : null}
                    <Text style={styles.healthLogTime}>{formatLogTime(log.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ── 身体測定 (web: green Ruler measurement card) ──────────────────── */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.greenIconWrap}>
              <Ruler size={20} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>身体測定</Text>
              <Text style={styles.sectionSub}>体重・身長の記録</Text>
            </View>
          </View>

          {latestGrowth ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.measuredAtText}>
                {formatSlashDate(latestGrowth.measuredAt)} 測定
                {activeChild ? ` (${ageAtRecord(latestGrowth)})` : ''}
              </Text>
              <View style={styles.measureTiles}>
                <View style={[styles.measureTile, { backgroundColor: GREEN_50, borderColor: GREEN_100 }]}>
                  <Weight size={16} color={GREEN_500} />
                  <Text style={styles.measureValue}>
                    {latestGrowth.weightGrams != null
                      ? (latestGrowth.weightGrams / 1000).toFixed(1)
                      : '--'}
                  </Text>
                  <Text style={styles.measureUnit}>体重(kg)</Text>
                </View>
                <View style={[styles.measureTile, { backgroundColor: BLUE_50, borderColor: BLUE_100 }]}>
                  <Ruler size={16} color={BLUE} />
                  <Text style={styles.measureValue}>
                    {latestGrowth.heightCm != null ? latestGrowth.heightCm.toFixed(1) : '--'}
                  </Text>
                  <Text style={styles.measureUnit}>身長(cm)</Text>
                </View>
                {latestGrowth.headCircumferenceCm != null && (
                  <View style={[styles.measureTile, { backgroundColor: PURPLE_100, borderColor: PURPLE_100 }]}>
                    <Activity size={16} color={PURPLE_500} />
                    <Text style={styles.measureValue}>
                      {latestGrowth.headCircumferenceCm.toFixed(1)}
                    </Text>
                    <Text style={styles.measureUnit}>頭囲(cm)</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.noDataText}>まだ測定データがありません</Text>
          )}

          <Button onPress={() => setShowGrowthModal(true)} style={styles.greenBtn}>
            <Plus size={16} color={palette.primaryForeground} />
            <Text style={styles.greenBtnText}>身体測定を記録する</Text>
          </Button>

          {sortedGrowthAsc.length > 0 && (
            <View style={styles.historyBlock}>
              <Text style={styles.historyLabel}>測定履歴</Text>
              {[...sortedGrowthAsc].reverse().map((r) => (
                <View key={r.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{formatSlashDate(r.measuredAt)}</Text>
                  <Text style={styles.historyValue}>
                    {r.weightGrams != null ? `${(r.weightGrams / 1000).toFixed(1)}kg` : ''}
                    {r.weightGrams != null && r.heightCm != null ? ' / ' : ''}
                    {r.heightCm != null ? `${r.heightCm.toFixed(1)}cm` : ''}
                    {r.headCircumferenceCm != null ? ` / 頭${r.headCircumferenceCm}cm` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => confirmDeleteGrowth(r.id)} style={styles.iconBtnSm}>
                    <Trash2 size={14} color={GRAY_400} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ── 成長曲線 (web: indigo TrendingUp chart card) ──────────────────── */}
        {sortedGrowthAsc.length >= 1 && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.indigoIconWrap}>
                <TrendingUp size={20} color={INDIGO_600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>成長曲線</Text>
                <Text style={styles.sectionSub}>
                  {activeChild?.gender === 'female' ? '女の子' : '男の子'}の標準範囲と比較
                </Text>
              </View>
            </View>

            <View style={styles.chartToggleRow}>
              <TouchableOpacity
                style={[styles.chartToggleBtn, chartMode === 'weight' && { backgroundColor: GREEN_500 }]}
                onPress={() => setChartMode('weight')}
              >
                <Text style={[styles.chartToggleText, chartMode === 'weight' && styles.chartToggleTextActive]}>
                  体重
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chartToggleBtn, chartMode === 'height' && { backgroundColor: BLUE }]}
                onPress={() => setChartMode('height')}
              >
                <Text style={[styles.chartToggleText, chartMode === 'height' && styles.chartToggleTextActive]}>
                  身長
                </Text>
              </TouchableOpacity>
            </View>

            <GrowthChart records={growthRecords} chartMode={chartMode} />

            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendLine,
                    { backgroundColor: chartMode === 'weight' ? GREEN : BLUE_600 },
                  ]}
                />
                <Text style={styles.legendText}>実測値</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendBand,
                    { backgroundColor: chartMode === 'weight' ? GREEN_100 : BLUE_100 },
                  ]}
                />
                <Text style={styles.legendText}>標準範囲 (3〜97%)</Text>
              </View>
            </View>
          </Card>
        )}

        {/* ── 園提出用データ (web: purple health summary card) ──────────────── */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.purpleIconWrap}>
              <ClipboardList size={20} color={PURPLE_600} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>園提出用データ</Text>
              <Text style={styles.sectionSub}>アレルギー・既往歴・体質メモ</Text>
            </View>
          </View>

          {/* 食材チェックリスト was previously here — moved into the 離乳食
              LogDialog (matches web layout) per client feedback. */}

          <Button variant="outline" onPress={handleExportPdf} style={styles.purpleBtn}>
            <FileDown size={16} color={palette.primaryForeground} />
            <Text style={styles.purpleBtnText}>提出用データの書き出し</Text>
          </Button>
        </Card>

        {/* ── ママのからだ記録 (mobile-only nav) ────────────────────────────── */}
        <Card style={styles.mamaCard}>
          <View style={styles.mamaTitleRow}>
            <View style={styles.pinkIconWrap}>
              <Heart size={16} color={ROSE_500} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mamaCardTitle}>ママのからだ記録</Text>
              <Text style={styles.mamaCardDesc}>産後のママ自身の体調・お薬を記録できます</Text>
            </View>
          </View>
          <Button onPress={() => navigation.navigate('MamaHealth')} style={styles.mamaNavButton}>
            <Text style={styles.mamaNavButtonText}>体調を記録する →</Text>
          </Button>
          {/* Direct shortcut labelled for meds — client feedback: "ママの薬
              というボタンがない" (users couldn't discover the medicine log
              from Health without tapping the generic 記録する button first).
              Lands on the same screen; the お薬 section is inside it. */}
          <Button
            variant="outline"
            onPress={() => navigation.navigate('MamaHealth')}
            style={styles.mamaMedicineButton}
          >
            <Text style={styles.mamaMedicineButtonText}>💊 ママの薬を記録する →</Text>
          </Button>
        </Card>
      </ScrollView>

      {/* ── Add Growth Modal ──────────────────────────────────────────────── */}
      <Modal visible={showGrowthModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.sheetHandle} />
            <Title style={styles.modalTitle}>身体測定を記録</Title>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Weight size={14} color={GRAY_500} />
                <Text style={styles.fieldLabel}>体重 (kg)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="例: 6.5"
                placeholderTextColor={GRAY_400}
                value={gWeight}
                onChangeText={setGWeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Ruler size={14} color={GRAY_500} />
                <Text style={styles.fieldLabel}>身長 (cm)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="例: 65.0"
                placeholderTextColor={GRAY_400}
                value={gHeight}
                onChangeText={setGHeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Activity size={14} color={GRAY_500} />
                <Text style={styles.fieldLabel}>頭囲 (cm)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="例: 42.0"
                placeholderTextColor={GRAY_400}
                value={gHead}
                onChangeText={setGHead}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>測定日</Text>
              <TextInput
                style={styles.input}
                placeholder="例: 2026-07-27"
                placeholderTextColor={GRAY_400}
                value={gDate}
                onChangeText={setGDate}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={styles.modalButtons}>
              <Button
                variant="outline"
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowGrowthModal(false);
                  setGWeight(''); setGHeight(''); setGHead(''); setGDate(todayStr());
                }}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Button>
              <Button
                style={styles.modalSaveBtnGreen}
                onPress={handleSaveGrowth}
                disabled={createGrowthMutation.isPending}
              >
                <Text style={styles.modalSaveText}>
                  {createGrowthMutation.isPending ? '保存中...' : '記録する'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Vaccine Modal ─────────────────────────────────────────────── */}
      <Modal visible={showVaccineModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.sheetHandle} />
            <View style={styles.vaccineModalTitleWrap}>
              <Syringe size={20} color={CYAN_600} />
              <Title style={styles.modalTitleInline}>予防接種の記録</Title>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ワクチン名</Text>
              <TextInput
                style={styles.input}
                placeholder="ワクチン名"
                placeholderTextColor={GRAY_400}
                value={vName}
                onChangeText={setVName}
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Calendar size={14} color={GRAY_500} />
                <Text style={styles.fieldLabel}>接種日</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={GRAY_400}
                value={vDate}
                onChangeText={setVDate}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>メモ（任意）</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="メモ（任意）"
                placeholderTextColor={GRAY_400}
                value={vNote}
                onChangeText={setVNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.modalButtons}>
              <Button
                variant="outline"
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowVaccineModal(false);
                  setVName(''); setVDate(todayStr()); setVNote('');
                }}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Button>
              <Button
                style={styles.modalSaveBtnCyan}
                onPress={handleSaveVaccine}
                disabled={createVaccineMutation.isPending}
              >
                <Text style={styles.modalSaveText}>
                  {createVaccineMutation.isPending ? '保存中...' : '記録する'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 16 },

  // 健康メモ teal card
  tealCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(240,253,250,0.6)',
    borderColor: TEAL_100,
    borderWidth: 1,
  },
  adviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tealIconWrap: { backgroundColor: TEAL_100, padding: 8, borderRadius: radius.lg },
  tealTitle: { fontSize: 14, fontFamily: fonts.bodyBold, color: TEAL_900 },
  tealBody: { fontSize: 12, color: TEAL_700, marginTop: 4, lineHeight: 18, fontFamily: fonts.body },

  // Stat tiles
  statGrid: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 0,
    gap: 4,
  },
  statValue: { fontSize: 18, fontFamily: fonts.sans, color: GRAY_800 },
  statLabel: { fontSize: 10, fontFamily: fonts.bodyBold, color: GRAY_400 },

  // 受診サポート rose card
  roseCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ROSE_100,
    overflow: 'hidden',
    padding: 0,
  },
  roseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  roseIconWrap: { backgroundColor: ROSE_100, padding: 8, borderRadius: radius.lg },
  roseTitle: { fontSize: 14, fontFamily: fonts.bodyBold, color: ROSE_800 },
  roseSub: { fontSize: 10, color: ROSE_400, marginTop: 2, fontFamily: fonts.body },
  roseBadge: { backgroundColor: ROSE_100, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  roseBadgeText: { fontSize: 10, fontFamily: fonts.bodyBold, color: ROSE_500 },
  clinicItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ROSE_50,
  },
  clinicItemIcon: { padding: 6, borderRadius: radius.md, marginTop: 2 },
  clinicItemDate: { fontSize: 11, fontFamily: fonts.bodyBold, color: GRAY_500 },
  clinicItemText: { fontSize: 14, fontFamily: fonts.bodyBold, color: GRAY_800, marginTop: 2 },
  clinicItemNote: { fontSize: 11, color: GRAY_400, marginTop: 2, lineHeight: 16, fontFamily: fonts.body },

  // Generic list card (vaccine schedule / health log)
  listCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 0,
    borderWidth: 0,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  listCardHeaderPlain: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  listHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listCardTitle: { fontSize: 14, fontFamily: fonts.bodyBold, color: GRAY_700 },
  cyanIconWrap: { backgroundColor: CYAN_50, padding: 6, borderRadius: radius.md },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: GRAY_50,
  },
  scheduleIcon: { padding: 8, borderRadius: radius.md },
  scheduleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduleName: { fontSize: 14, fontFamily: fonts.bodyBold, color: GRAY_700 },
  scheduleSub: { fontSize: 10, color: GRAY_400, marginTop: 2, fontFamily: fonts.body },
  overdueBadge: { backgroundColor: ORANGE_500, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  overdueBadgeText: { fontSize: 8, fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  iconBtn: { padding: 6 },
  iconBtnSm: { padding: 4 },

  // Health log list
  emptyLogBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyLogText: { fontSize: 12, fontFamily: fonts.bodyBold, color: GRAY_400 },
  healthLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: GRAY_50,
  },
  healthLogIcon: { padding: 8, borderRadius: radius.md },
  healthLogText: { fontSize: 14, fontFamily: fonts.bodyBold, color: GRAY_700 },
  healthLogSub: { fontSize: 10, color: GRAY_500, marginTop: 2, fontFamily: fonts.body },
  healthLogTime: { fontSize: 10, color: GRAY_400, marginTop: 2, fontFamily: fonts.body },
  highTag: { fontSize: 12, color: RED_500, fontFamily: fonts.bodyBold },

  // Section cards (身体測定 / 成長曲線 / 園提出)
  sectionCard: { padding: 16, borderRadius: 24, borderWidth: 0 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontFamily: fonts.bodyBold, color: GRAY_700 },
  sectionSub: { fontSize: 10, color: GRAY_400, marginTop: 2, fontFamily: fonts.body },
  greenIconWrap: { backgroundColor: GREEN_100, padding: 8, borderRadius: radius.lg },
  indigoIconWrap: { backgroundColor: INDIGO_100, padding: 8, borderRadius: radius.lg },
  purpleIconWrap: { backgroundColor: PURPLE_100, padding: 8, borderRadius: radius.lg },
  pinkIconWrap: { backgroundColor: ROSE_100, padding: 8, borderRadius: radius.lg },

  measuredAtText: { fontSize: 10, color: GRAY_400, textAlign: 'right', marginBottom: 6, fontFamily: fonts.body },
  measureTiles: { flexDirection: 'row', gap: 8 },
  measureTile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 8,
    gap: 2,
  },
  measureValue: { fontSize: 14, fontFamily: fonts.sans, color: GRAY_800 },
  measureUnit: { fontSize: 9, fontFamily: fonts.bodyBold, color: GRAY_400 },
  noDataText: { fontSize: 12, color: GRAY_400, marginBottom: 12, fontFamily: fonts.body },

  greenBtn: {
    backgroundColor: GREEN_500,
    borderColor: GREEN_500,
    borderRadius: radius.lg,
    minHeight: 48,
  },
  greenBtnText: { color: palette.primaryForeground, fontSize: 14, fontFamily: fonts.bodyBold },

  historyBlock: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: GRAY_100,
    paddingTop: 12,
  },
  historyLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: GRAY_500, marginBottom: 8 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GRAY_50,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  historyDate: { fontSize: 12, fontFamily: fonts.bodyBold, color: GRAY_500, minWidth: 56 },
  historyValue: { fontSize: 12, color: GRAY_700, flex: 1, fontFamily: fonts.body },

  // Chart toggle
  chartToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chartToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: GRAY_100,
    alignItems: 'center',
  },
  chartToggleText: { fontSize: 12, color: GRAY_500, fontFamily: fonts.bodyBold },
  chartToggleTextActive: { color: '#FFFFFF' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 12, height: 2 },
  legendBand: { width: 24, height: 12, borderRadius: 2, opacity: 0.6 },
  legendText: { fontSize: 10, color: GRAY_500, fontFamily: fonts.body },

  // 食材チェックリスト link
  foodLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GRAY_50,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 12,
  },
  foodLinkText: { flex: 1, fontSize: 13, fontFamily: fonts.bodyBold, color: GRAY_700 },
  foodLinkArrow: { fontSize: 14, color: PURPLE_600, fontFamily: fonts.bodyBold },

  purpleBtn: {
    backgroundColor: PURPLE_500,
    borderColor: PURPLE_500,
    borderRadius: radius.lg,
    minHeight: 48,
  },
  purpleBtnText: { color: palette.primaryForeground, fontSize: 14, fontFamily: fonts.bodyBold },

  // ママ card
  mamaCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ROSE_100,
    backgroundColor: 'rgba(255,241,242,0.5)',
  },
  mamaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  mamaCardTitle: { fontSize: 14, fontFamily: fonts.bodyBold, color: ROSE_800 },
  mamaCardDesc: { fontSize: 10, color: ROSE_400, marginTop: 2, fontFamily: fonts.body },
  mamaNavButton: {
    backgroundColor: ROSE_500,
    borderColor: ROSE_500,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  mamaNavButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bodyBold },
  mamaMedicineButton: {
    marginTop: 8,
    borderRadius: radius.lg,
    borderColor: ROSE_500,
    borderWidth: 2,
    backgroundColor: palette.card,
    minHeight: 44,
  },
  mamaMedicineButtonText: { color: ROSE_500, fontSize: 14, fontFamily: fonts.bodyBold },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: GRAY_100,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, color: palette.foreground, textAlign: 'center', marginBottom: 4 },
  vaccineModalTitleWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 },
  modalTitleInline: { fontSize: 18, color: palette.foreground },
  fieldGroup: { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: GRAY_500 },
  input: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: GRAY_100,
    color: palette.foreground,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, borderRadius: radius.lg, minHeight: 48, borderColor: GRAY_100 },
  modalCancelText: { color: palette.foreground, fontSize: 15, fontFamily: fonts.bodySemibold },
  modalSaveBtnGreen: {
    flex: 1,
    backgroundColor: GREEN_500,
    borderColor: GREEN_500,
    borderRadius: radius.lg,
    minHeight: 48,
  },
  modalSaveBtnCyan: {
    flex: 1,
    backgroundColor: CYAN_600,
    borderColor: CYAN_600,
    borderRadius: radius.lg,
    minHeight: 48,
  },
  modalSaveText: { color: palette.primaryForeground, fontSize: 15, fontFamily: fonts.bodyBold },
});
