/**
 * TimelineScreen — re-ported to match the canonical web page
 * WeYu/client/src/pages/Timeline.tsx ("1週間タイムライン").
 *
 * Web-matched presentation:
 *  • Header: title + 分析 / 振り返り chip buttons + collapsible date picker toggle
 *  • Collapsible 7-day date-chip strip (weekday + day + today dot) w/ prev/next
 *  • Day sleep-total summary line
 *  • 24-hour vertical timeline grid (hour gridlines + gutter time labels),
 *    sleep blocks rendered as soft purple bands, log entries positioned by
 *    time with icon pill + detail, "now" line on today, empty state
 *
 * All existing mobile logic is preserved verbatim: queries, mutations,
 * EditLogDialog, AnalyticsPanel, contextual promotions, excluded dates +
 * AsyncStorage, day swipe navigation, dark-mode handling.
 */
import React, {
  useCallback, useState, useEffect, useRef, useMemo,
} from 'react';
import {
  View, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, Alert, Platform,
  SafeAreaView, PanResponder, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Moon, Droplets, Milk, Star, Thermometer, BarChart3, Trash2,
  ChevronLeft, ChevronRight, CalendarDays, Heart, Plus, FileDown, Loader2,
  X, GripVertical, Check,
  Sparkles, Smile, Sun, Gift, Music, BookOpen, Camera, Coffee, Footprints,
  Bike, Gamepad2, Baby, Bath, Cookie, Apple, Pencil, Flag, Bell as BellIcon,
  Cloud, Umbrella, Leaf as LeafIcon, Flower2, Palette, Puzzle, Car, Plane,
  TrainFront, Rocket, Crown, Trophy, Medal,
} from 'lucide-react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { getLogs, createLog, updateLog, deleteLog, type Log } from '../api/logs';
import { useToast } from '../components/Toast';
import { logRecordedToast } from '../utils/logToast';
import { apiGet, apiPost } from '../api/client';
import type { RootStackParamList } from '../navigation';
import { useTheme } from '../contexts/ThemeContext';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Text, Title } from '../theme/ui';
import { LogIcon, getLogVisual } from '../theme/logIcons';
import WeHeader from '../components/WeHeader';
import LogDialog, { type LogSaveData } from '../components/LogDialog';
import ScrollTimePicker from '../components/ScrollTimePicker';
import {
  PHASE_BUTTONS, PHASE_LABELS, getPhaseIndex, HIDDEN_BY_DEFAULT,
} from '../screens/HomeScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Constants ────────────────────────────────────────────────────────────────

const EXCLUDED_DATES_KEY = '@weyu_excluded_dates';

// Web Timeline grid metrics (client/src/pages/Timeline.tsx)
const HOUR_HEIGHT = 64;
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;
const LOG_ENTRY_HEIGHT = 44;
const GUTTER = 52; // time-label gutter width (web left-12 / left-14)

/**
 * Mobile log-type → logIcons key + display label, mirroring the web
 * `getLogIcon` mapping so the timeline renders with the canonical
 * WeYu iconography/palette while keeping mobile's own log-type ids.
 */
const TYPE_TO_VISUAL: Record<string, string> = {
  breastfeed: 'milk', formula: 'milk', milk: 'milk', expressed: 'express',
  diaper_wet: 'diaper', diaper_poop: 'diaper', sleep: 'sleep', bath: 'bath',
  medicine: 'medicine', temperature: 'temperature', food: 'food',
  symptoms: 'symptom', snack: 'snack', milestone: 'milestone', word: 'words',
  achievement: 'achievement', play: 'play', hold: 'hold', drink: 'drink',
  school: 'school_report', discipline: 'discipline', interest: 'hobby',
  appointment: 'clinic', thank_you: 'thanks', meal: 'meal', toilet: 'toilet',
  toothbrush: 'toothbrush', moisturize: 'skincare', nail_cut: 'nail_care',
};
const TYPE_LABEL: Record<string, string> = {
  breastfeed: '母乳', formula: 'ミルク', milk: 'ミルク', expressed: '搾乳',
  diaper_wet: 'おしっこ', diaper_poop: 'うんち', sleep: 'ねんね', bath: 'おふろ',
  medicine: 'おくすり', temperature: '体温', food: '離乳食', symptoms: '症状メモ',
  snack: 'おやつ', milestone: 'はじめて', word: 'ことば', achievement: 'できた!',
  play: 'あそび', hold: '抱っこ', drink: 'のみもの', school: '園の記録',
  discipline: 'しつけ', interest: 'きょうみ', appointment: '通院',
  thank_you: 'ありがとう', meal: 'ごはん', toilet: 'トイレ', toothbrush: 'はみがき',
  moisturize: '保湿', nail_cut: '爪切り',
};
function logVisual(type: string) {
  return getLogVisual(TYPE_TO_VISUAL[type] ?? type);
}
function logVisualType(type: string) {
  return TYPE_TO_VISUAL[type] ?? type;
}
function logLabel(type: string) {
  return TYPE_LABEL[type] ?? type;
}

/** 7-stage food scale (extended from 4) */
const FOOD_STAGES_7: Array<{ key: string; label: string; color: string }> = [
  { key: 'done',      label: '完食',    color: '#4CAF50' },
  { key: 'almost',    label: 'ほぼ完食', color: '#8BC34A' },
  { key: 'morehalf',  label: '半分↑',   color: '#CDDC39' },
  { key: 'half',      label: '半分',    color: '#FFC107' },
  { key: 'bit',       label: 'ひと口',  color: '#FF9800' },
  { key: 'little',    label: '少し',    color: '#FF7043' },
  { key: 'refuse',    label: '拒否',    color: '#EF5350' },
];
const stageColor = (key: string) => FOOD_STAGES_7.find(s => s.key === key)?.color ?? '#ccc';
const stageLabel = (key: string) => FOOD_STAGES_7.find(s => s.key === key)?.label ?? key;

/** Gentle display text for sleep methods */
const SLEEP_METHOD_DISPLAY: Record<string, string> = {
  '抱っこ':      'ぎゅっと抱っこ',
  '抱っこひも':  '抱っこひもで',
  '添い乳':      'おっぱいでふにゃり',
  '添い寝':      '一緒にねんね',
  'なし':        'すんなりねんね ✨',
};

const SLEEP_LOCATIONS = new Set(['布団', '抱っこ寝', '抱っこひも寝', 'ベビーカー', 'チャイルドシート']);
const SLEEP_DURATION_RE = /^\d+分$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function fmtHHmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toMMDD(ymd: string): string {
  const [, m, d] = ymd.split('-'); return `${m}/${d}`;
}
function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
function minutesToTopPx(minutes: number): number {
  return (minutes / (24 * 60)) * TOTAL_HEIGHT;
}
// Inverse of minutesToTopPx — used by drag-to-time to compute the new
// minutes-since-midnight from a pixel y position. Client feedback #3.
function topPxToMinutes(px: number): number {
  return Math.round((px / TOTAL_HEIGHT) * 24 * 60);
}
function mmToHHmm(min: number): string {
  const h = Math.max(0, Math.min(23, Math.floor(min / 60)));
  const m = Math.max(0, Math.min(59, min % 60));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

function parseFoodMemo(memo?: string) {
  if (!memo) return { items: [] as Array<{name: string; stage: string}>, foodMemo: '' };
  const newlineIdx = memo.indexOf('\n');
  const firstLine = newlineIdx >= 0 ? memo.slice(0, newlineIdx) : memo;
  const rest = newlineIdx >= 0 ? memo.slice(newlineIdx + 1) : '';
  if (!firstLine.includes(':')) return { items: [], foodMemo: memo };
  const items = firstLine.split(',').map(s => {
    const ci = s.indexOf(':');
    return ci < 0 ? null : { name: s.slice(0, ci).trim(), stage: s.slice(ci + 1).trim() };
  }).filter(Boolean) as Array<{name: string; stage: string}>;
  return { items, foodMemo: rest.replace(/__nw:\d+__/, '').trim() };
}

function parseNightWaking(memo?: string): number {
  if (!memo) return 0;
  const m = memo.match(/__nw:(\d+)__/);
  return m ? parseInt(m[1]) : 0;
}

function setNightWakingInMemo(memo: string | undefined, minutes: number): string {
  const base = (memo ?? '').replace(/\n?__nw:\d+__/, '');
  return minutes > 0 ? `${base}\n__nw:${minutes}__` : base;
}

function logDetailText(log: Log): string {
  switch (log.type) {
    case 'breastfeed':
      return (log.breastLeftMin || log.breastRightMin)
        ? `左 ${log.breastLeftMin ?? 0}分 ・ 右 ${log.breastRightMin ?? 0}分` : '';
    case 'formula':
    case 'milk':
      return log.formulaMl ? `${log.formulaMl} ml` : '';
    case 'expressed':
      return log.expressedMl ? `${log.expressedMl} ml` : '';
    case 'temperature':
      return log.bodyTemperature ? `${log.bodyTemperature}°C` : '';
    case 'symptoms':
      return log.symptoms ? log.symptoms.replace(/,/g, ' ・ ') : '';
    default:
      return '';
  }
}

function showAlert(msg: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
  else Alert.alert(msg);
}

// ─── Quick-add full grid (FAB sheet → mirrors web QuickActions / Home grid) ──
//
// The FAB sheet now shows the SAME full quick-log set Home renders for the
// active child's phase: PHASE_BUTTONS[phaseIndex] minus the hidden set, in the
// user's saved order, plus the custom buttons. All state is read from the same
// AsyncStorage keys Home owns (`@weyu_btn_hidden_*`, `@weyu_btn_order_*`,
// `@weyu_custom_buttons`) so the two screens stay in sync. We only READ here.

// Web grid: `grid grid-cols-3 gap-3 px-6 max-w-md` → 3 cols, gap 12, px 24,
// content capped at 448 (identical metrics to HomeScreen).
const GRID_MAX = 448;
const GRID_PAD = 24;
const GRID_GAP = 12;
const GRID_W = Math.min(
  // sheet has 0 horizontal padding; grid handles its own px-6 gutter
  448,
  GRID_MAX,
);
const TILE_W = (GRID_W - GRID_PAD * 2 - GRID_GAP * 2) / 3;

// Custom-button colour swatches — replicated 1:1 from HomeScreen
// (COLOR_SWATCHES is module-private there; we cannot edit HomeScreen).
type SwatchColor = { id: string; label: string; soft: string; tint: string; bord: string };
const COLOR_SWATCHES: SwatchColor[] = [
  { id: 'purple', label: '紫', soft: '#FAF5FF', tint: '#9333EA', bord: '#F3E8FF' },
  { id: 'blue',   label: '青', soft: '#EFF6FF', tint: '#3B82F6', bord: '#DBEAFE' },
  { id: 'green',  label: '緑', soft: '#F0FDF4', tint: '#16A34A', bord: '#DCFCE7' },
  { id: 'cyan',   label: '水', soft: '#ECFEFF', tint: '#0891B2', bord: '#CFFAFE' },
  { id: 'orange', label: '橙', soft: '#FFF7ED', tint: '#EA580C', bord: '#FFEDD5' },
  { id: 'pink',   label: '桃', soft: '#FDF2F8', tint: '#EC4899', bord: '#FCE7F3' },
  { id: 'brown',  label: '黄', soft: '#FEFCE8', tint: '#A16207', bord: '#FEF9C3' },
  { id: 'red',    label: '赤', soft: '#FEF2F2', tint: '#EF4444', bord: '#FEE2E2' },
];
const resolveSwatch = (color: string): SwatchColor =>
  COLOR_SWATCHES.find((s) => s.id === color || s.soft === color) ?? COLOR_SWATCHES[0];

type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
// lucide icon picker grid — name persisted on the custom button (1:1 w/ Home).
const ICON_MAP: Record<string, IconCmp> = {
  Sparkles, Star, Heart, Smile, Sun, Moon, Gift, Music, BookOpen, Camera,
  Coffee, Footprints, Bike, Gamepad2, Baby, Bath, Cookie, Apple, Milk,
  Pencil, Flag, Bell: BellIcon, Cloud, Umbrella, Leaf: LeafIcon, Flower2,
  Palette, Puzzle, Car, Plane, TrainFront, Rocket, Crown, Trophy, Medal,
};
function CustomButtonIcon({
  icon, emoji, size = 20, color, strokeWidth = 2.5,
}: { icon?: string; emoji?: string; size?: number; color?: string; strokeWidth?: number }) {
  if (icon && ICON_MAP[icon]) {
    const Cmp = ICON_MAP[icon];
    return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
  }
  return <Text style={{ fontSize: size }}>{emoji ?? '✨'}</Text>;
}

// ─── Drag-to-reorder quick-log grid (mirrors HomeScreen's; deps already used)─
type DragTile = { key: string; render: (dragging: boolean) => React.ReactNode };

function DraggableQuickGrid({
  tiles, order, tileWidth, gap, columns, onReorder,
}: {
  tiles: DragTile[];
  order: string[];
  tileWidth: number;
  gap: number;
  columns: number;
  onReorder: (keys: string[]) => void;
}) {
  const [liveOrder, setLiveOrder] = useState<string[]>(order);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [tileH, setTileH] = useState(96);

  useEffect(() => { if (!dragKey) setLiveOrder(order); }, [order, dragKey]);

  const slotW = tileWidth + gap;
  const slotH = tileH + gap;
  const rows = Math.max(1, Math.ceil(liveOrder.length / columns));
  const gridHeight = rows * slotH - gap;

  const slotOf = (idx: number) => {
    'worklet';
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    return { x: col * slotW, y: row * slotH };
  };

  const commit = (keys: string[]) => { setDragKey(null); onReorder(keys); };

  const moveLive = (key: string, toIdx: number) => {
    setLiveOrder((prev) => {
      const from = prev.indexOf(key);
      if (from === -1 || toIdx < 0 || toIdx >= prev.length || from === toIdx) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(toIdx, 0, key);
      return next;
    });
  };

  return (
    <View style={{ width: tileWidth * columns + gap * (columns - 1), height: gridHeight, alignSelf: 'center' }}>
      {tiles.map((tDef, renderIdx) => (
        <DraggableTile
          key={tDef.key}
          tile={tDef}
          measure={renderIdx === 0}
          onMeasure={setTileH}
          liveOrder={liveOrder}
          tileWidth={tileWidth}
          slotW={slotW}
          slotH={slotH}
          columns={columns}
          count={liveOrder.length}
          isDragging={dragKey === tDef.key}
          onPickUp={() => setDragKey(tDef.key)}
          onHover={(toIdx) => moveLive(tDef.key, toIdx)}
          onDrop={() => commit(liveOrder)}
          slotOf={slotOf}
        />
      ))}
    </View>
  );
}

function DraggableTile({
  tile, measure, onMeasure, liveOrder, tileWidth, slotW, slotH,
  columns, count, isDragging, onPickUp, onHover, onDrop, slotOf,
}: {
  tile: DragTile;
  measure: boolean;
  onMeasure: (h: number) => void;
  liveOrder: string[];
  tileWidth: number;
  slotW: number;
  slotH: number;
  columns: number;
  count: number;
  isDragging: boolean;
  onPickUp: () => void;
  onHover: (toIdx: number) => void;
  onDrop: () => void;
  slotOf: (idx: number) => { x: number; y: number };
}) {
  const idx = liveOrder.indexOf(tile.key);
  const slot = idx >= 0 ? slotOf(idx) : { x: 0, y: 0 };

  const baseX = useSharedValue(slot.x);
  const baseY = useSharedValue(slot.y);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const active = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (isDragging) return;
    baseX.value = withTiming(slot.x, { duration: 180 });
    baseY.value = withTiming(slot.y, { duration: 180 });
  }, [slot.x, slot.y, isDragging]);

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      active.value = 1;
      startX.value = baseX.value;
      startY.value = baseY.value;
      dragX.value = 0;
      dragY.value = 0;
      runOnJS(onPickUp)();
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      const cx = startX.value + e.translationX + tileWidth / 2;
      const cy = startY.value + e.translationY + slotH / 2;
      let col = Math.round((cx - tileWidth / 2) / slotW);
      let row = Math.round((cy - slotH / 2) / slotH);
      if (col < 0) col = 0;
      if (col > columns - 1) col = columns - 1;
      if (row < 0) row = 0;
      let to = row * columns + col;
      if (to < 0) to = 0;
      if (to > count - 1) to = count - 1;
      runOnJS(onHover)(to);
    })
    .onEnd(() => {
      active.value = 0;
      dragX.value = withTiming(0, { duration: 140 });
      dragY.value = withTiming(0, { duration: 140 });
      runOnJS(onDrop)();
    })
    .onFinalize(() => {
      if (active.value === 1) {
        active.value = 0;
        dragX.value = withTiming(0, { duration: 140 });
        dragY.value = withTiming(0, { duration: 140 });
        runOnJS(onDrop)();
      }
    });

  const aStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: tileWidth,
    left: baseX.value,
    top: baseY.value,
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: active.value ? 1.06 : 1 },
    ],
    zIndex: active.value ? 50 : 1,
    elevation: active.value ? 12 : 1,
    opacity: 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={aStyle}
        onLayout={measure ? (ev) => onMeasure(ev.nativeEvent.layout.height) : undefined}
      >
        {tile.render(isDragging)}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Build the same 7-day report the web PDF button generates
 * (WeYu/client/src/lib/pdf-export.ts → generateTimelinePdf), but as a
 * plain-text report shared through the native share sheet. Uses only the
 * already-loaded `logs` (incl. sleep-type logs) — no new backend endpoint.
 */
const PDF_TYPES = new Set([
  'breastfeed', 'formula', 'milk', 'expressed',
  'diaper_wet', 'diaper_poop', 'food', 'temperature',
  'toilet', 'meal', 'symptoms',
]);

function buildTimelineReport(logs: Log[], endDate: Date): string {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(endDate, -i));

  const userName = (uid: string) =>
    uid === 'papa' ? 'パパ' : uid === 'mama' ? 'ママ' : 'その他';

  const lines: string[] = [];
  lines.push('We育 1週間レポート');
  lines.push(`${toMMDD(toYMD(days[0]))} 〜 ${toMMDD(toYMD(days[6]))}`);
  lines.push('');

  for (const d of days) {
    const ymd = toYMD(d);
    lines.push(`■ ${d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}`);

    const dayLogs = logs
      .filter(l => toYMD(new Date(l.createdAt)) === ymd &&
        (l.type === 'sleep' || PDF_TYPES.has(l.type)))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (dayLogs.length === 0) {
      lines.push('  記録なし');
      lines.push('');
      continue;
    }

    for (const log of dayLogs) {
      const time = fmtHHmm(log.createdAt);
      if (log.type === 'sleep') {
        const parts = (log.memo ?? '').split('\n')[0].split('・').filter(Boolean);
        const tok = parts.find(p => SLEEP_DURATION_RE.test(p));
        const dur = tok ? ` ${formatDuration(parseInt(tok))}` : '';
        lines.push(`  ${time}  睡眠${dur}  (${userName(log.userId)})`);
      } else {
        const label = logLabel(log.type);
        const detail = logDetailText(log);
        lines.push(`  ${time}  ${label}${detail ? ` ${detail}` : ''}  (${userName(log.userId)})`);
      }
    }
    lines.push('');
  }

  const now = new Date();
  lines.push(`We育 (ぶどうの木) - ${toYMD(now)} ${fmtHHmm(now.toISOString())} 出力`);
  return lines.join('\n');
}

// ─── EditLogDialog ────────────────────────────────────────────────────────────

interface EditLogDialogProps {
  log: Log | null;
  onClose: () => void;
  onSaved: () => void;
}

// ── Options mirror the ORIGIN web (Timeline.tsx:1795, 1825) exactly.
// (Renamed to avoid shadowing the `SLEEP_LOCATIONS` Set at line 128 used
// by the sleep-badge renderer.)
const SLEEP_EDIT_METHOD_OPTIONS   = ['抱っこ', '抱っこひも', '添い乳', '添い寝', 'なし'];
const SLEEP_EDIT_LOCATION_OPTIONS = ['布団', '抱っこ寝', 'ベビーカー', '抱っこひも寝', 'チャイルドシート'];

function EditLogDialog({ log, onClose, onSaved }: EditLogDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const familyId = user?.familyId ?? 'default';

  const [timeStr, setTimeStr] = useState('');
  const [nightWaking, setNightWaking] = useState('');
  // Sleep-specific edit fields (client feedback 2026-07-30)
  const [settlingMethods, setSettlingMethods] = useState<string[]>([]);
  const [sleepLocation,   setSleepLocation]   = useState<string>('');
  const [sleepNote,       setSleepNote]       = useState<string>('');

  useEffect(() => {
    if (!log) return;
    setTimeStr(fmtHHmm(log.createdAt));
    setNightWaking(String(parseNightWaking(log.memo) || ''));
    // Hydrate sleep fields from the incoming log. settlingMethod is stored
    // as a "・"-joined string (or literal "なし" for the exclusive choice).
    if (log.type === 'sleep') {
      const rawMethod = (log as any).settlingMethod as string | null | undefined;
      if (rawMethod && rawMethod !== 'なし') setSettlingMethods(rawMethod.split('・').filter(Boolean));
      else if (rawMethod === 'なし') setSettlingMethods(['なし']);
      else setSettlingMethods([]);
      setSleepLocation((log as any).sleepLocation ?? '');
      setSleepNote((log as any).sleepNote ?? '');
    } else {
      setSettlingMethods([]);
      setSleepLocation('');
      setSleepNote('');
    }
  }, [log]);

  const toggleSettlingMethod = (m: string) => {
    if (m === 'なし') {
      setSettlingMethods(prev => prev.includes('なし') ? [] : ['なし']);
    } else {
      setSettlingMethods(prev =>
        prev.includes(m)
          ? prev.filter(x => x !== m)
          : [...prev.filter(x => x !== 'なし'), m],
      );
    }
  };

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Log> }) => updateLog(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', familyId] });
      onSaved();
    },
    onError: () => showAlert('保存に失敗しました。'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', familyId] });
      onSaved();
    },
    onError: () => showAlert('削除に失敗しました。'),
  });

  if (!log) return null;

  const vis = logVisual(log.type);
  const label = logLabel(log.type);
  const detail = logDetailText(log);

  const handleSave = () => {
    const [hh, mm] = timeStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) { showAlert('正しいHH:MM形式で入力してください'); return; }
    const newDate = new Date(log.createdAt);
    newDate.setHours(hh, mm, 0, 0);
    const nw = parseInt(nightWaking) || 0;
    const newMemo = log.type === 'sleep' ? setNightWakingInMemo(log.memo, nw) : log.memo;
    const payload: any = { createdAt: newDate.toISOString(), memo: newMemo };
    if (log.type === 'sleep') {
      // Persist the two "…がなかった" fields the client reported as
      // missing (feedback 2026-07-30). settlingMethod joins with "・"
      // when multiple chips are on; empty selection stores null.
      payload.settlingMethod = settlingMethods.length > 0 ? settlingMethods.join('・') : null;
      payload.sleepLocation  = sleepLocation || null;
      payload.sleepNote      = sleepNote.trim() || null;
    }
    updateMut.mutate({ id: log.id, data: payload as any });
  };

  const handleDelete = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!window.confirm('この記録を削除しますか？')) return;
      deleteMut.mutate(log.id);
    } else {
      Alert.alert('削除', 'この記録を削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => deleteMut.mutate(log.id) },
      ]);
    }
  };

  const isBusy = updateMut.isPending || deleteMut.isPending;

  return (
    <Modal visible={!!log} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ed.overlay}>
        <View style={ed.sheet}>
          <View style={ed.handle} />
          {/* Sleep-log edits added 3 new sections (寝かしつけ方法 / 場所 /
              メモ) — the sheet now overflows the screen on small phones
              and the top part gets clipped. Wrap the body in a ScrollView
              and cap sheet height so nothing is unreachable. Header was
              also chunky: shrank title/infoPill vertical padding. */}
          <ScrollView
            style={{ maxHeight: '100%' }}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
          <Title style={ed.title}>記録の詳細</Title>

          {/* Web: info pill — bg-*-50 border-*-100 rounded-2xl */}
          <View style={[ed.infoPill, { backgroundColor: vis.soft, borderColor: vis.bord }]}>
            <LogIcon type={logVisualType(log.type)} size={18} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={ed.infoLabel}>{label}</Text>
              {detail ? <Text style={ed.infoDetail}>{detail}</Text> : null}
            </View>
          </View>

          <Text style={ed.label}>記録時間</Text>
          {/* Wheel picker replaces the typed HH:MM input (client feedback
              2026-09-09 — web parity: select, don't type). */}
          <ScrollTimePicker value={timeStr} onChange={setTimeStr} />

          {log.type === 'sleep' && (
            <>
              <Text style={ed.label}>夜中に起きていた時間（分）</Text>
              <TextInput style={ed.input} value={nightWaking} onChangeText={setNightWaking}
                placeholder="例：30" keyboardType="numeric" />
              {parseInt(nightWaking) > 0 && (
                <Text style={ed.hint}>夜中起き −{nightWaking}分 として記録されます</Text>
              )}

              {/* 寝かしつけ方法 (multi-select; なし is exclusive) — web parity */}
              <Text style={[ed.label, { color: '#818CF8' /* indigo-400 */ }]}>寝かしつけ方法（任意）</Text>
              <View style={ed.chipRow}>
                {SLEEP_EDIT_METHOD_OPTIONS.map(m => {
                  const on = settlingMethods.includes(m);
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => toggleSettlingMethod(m)}
                      style={[ed.chip, on ? ed.chipOnIndigo : ed.chipOffIndigo]}
                    >
                      <Text style={[ed.chipText, on ? ed.chipTextOn : ed.chipTextIndigo]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ねんね場所 (single-select toggle) */}
              <Text style={[ed.label, { color: '#38BDF8' /* sky-400 */ }]}>ねんね場所（任意）</Text>
              <View style={ed.chipRow}>
                {SLEEP_EDIT_LOCATION_OPTIONS.map(loc => {
                  const on = sleepLocation === loc;
                  return (
                    <TouchableOpacity
                      key={loc}
                      onPress={() => setSleepLocation(on ? '' : loc)}
                      style={[ed.chip, on ? ed.chipOnSky : ed.chipOffSky]}
                    >
                      <Text style={[ed.chipText, on ? ed.chipTextOn : ed.chipTextSky]}>{loc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[ed.label, { color: '#A855F7' /* purple-500 */ }]}>ねんねメモ（任意）</Text>
              <TextInput
                style={[ed.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={sleepNote}
                onChangeText={setSleepNote}
                placeholder="例：スムーズに寝付いた、途中で起きて再入眠に時間がかかった…"
                multiline
              />
            </>
          )}

          <View style={ed.btnRow}>
            <TouchableOpacity style={ed.cancelBtn} onPress={onClose} disabled={isBusy}>
              <Text style={ed.cancelText}>戻る</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ed.saveBtn} onPress={handleSave} disabled={isBusy}>
              <Text style={ed.saveText}>{isBusy ? '...' : '変更を保存'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={ed.deleteBtn} onPress={handleDelete} disabled={isBusy}>
            <Trash2 size={15} color={palette.destructive} strokeWidth={2} />
            <Text style={ed.deleteText}>削除する</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sleep / log timeline rendering helpers ──────────────────────────────────

function SleepBlock({ log, onPress }: { log: Log; onPress: () => void }) {
  // Sleep "session" derived from the sleep log: start = createdAt, duration
  // taken from memo (first '分' token) when present, else a minimal band.
  const start = new Date(log.createdAt);
  const parts = (log.memo ?? '').split('\n')[0].split('・').filter(Boolean);
  const durToken = parts.find(p => SLEEP_DURATION_RE.test(p));
  const durMin = durToken ? parseInt(durToken) : 0;
  const startMin = minutesFromMidnight(start);
  const top = minutesToTopPx(startMin);
  const height = Math.max(22, minutesToTopPx(durMin || 30));
  const methodLoc = parts.filter(p => !SLEEP_DURATION_RE.test(p));

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[tl.sleepBlock, { top, height }]}
    >
      <View style={tl.sleepInner}>
        <View style={tl.sleepHeadRow}>
          <Moon size={14} color="#A78BC9" strokeWidth={2} />
          <Text style={tl.sleepTitle}>
            ねんね{durMin > 0 ? ` ${formatDuration(durMin)}` : ''}
          </Text>
        </View>
        {height >= 46 && methodLoc.length > 0 && (
          <View style={tl.sleepBadgeRow}>
            {methodLoc.map((p, i) => {
              const isLoc = SLEEP_LOCATIONS.has(p);
              const display = SLEEP_METHOD_DISPLAY[p] ?? p;
              return (
                <View key={i} style={[tl.sleepBadge, isLoc ? tl.sleepBadgeLoc : tl.sleepBadgeMethod]}>
                  <Text style={[tl.sleepBadgeText, isLoc ? tl.sleepBadgeTextLoc : tl.sleepBadgeTextMethod]}>
                    {display}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── AnalyticsPanel ───────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  logs: Log[];
  visible: boolean;
  onClose: () => void;
  excludedDates: string[];
  onToggleExclude: (ymd: string) => void;
}

const MAX_H = 80;

function AnalyticsPanel({ logs, visible, onClose, excludedDates, onToggleExclude }: AnalyticsPanelProps) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toYMD(today), [today]);
  const yesterdayStr = useMemo(() => toYMD(addDays(today, -1)), [today]);

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => toYMD(addDays(today, -(6 - i))), ), [today]);
  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => toYMD(addDays(today, -(13 - i)))), [today]);

  const activeLogs = useMemo(() => logs.filter(l => !excludedDates.includes(toYMD(new Date(l.createdAt)))), [logs, excludedDates]);

  // ── Summary cards: today vs yesterday ─────────────────────────────────────
  const countFor = (dateStr: string, types: string[]) =>
    logs.filter(l => toYMD(new Date(l.createdAt)) === dateStr && types.includes(l.type)).length;

  const todayCounts = {
    sleep:   countFor(todayStr, ['sleep']),
    feeding: countFor(todayStr, ['breastfeed', 'formula', 'milk', 'expressed']),
    wet:     countFor(todayStr, ['diaper_wet']),
    poop:    countFor(todayStr, ['diaper_poop']),
  };
  const yestCounts = {
    sleep:   countFor(yesterdayStr, ['sleep']),
    feeding: countFor(yesterdayStr, ['breastfeed', 'formula', 'milk', 'expressed']),
    wet:     countFor(yesterdayStr, ['diaper_wet']),
    poop:    countFor(yesterdayStr, ['diaper_poop']),
  };
  const trend = (t: number, y: number) => t > y ? '↑' : t < y ? '↓' : '—';
  const trendColor = (t: number, y: number) => t > y ? palette.secondary : t < y ? palette.destructive : palette.mutedForeground;

  const summaryCards = [
    { label: 'ねんね', Icon: Moon,     iconColor: '#8C5EBA', iconBg: '#F2EEF6', today: todayCounts.sleep,   yest: yestCounts.sleep },
    { label: '授乳',   Icon: Milk,     iconColor: '#3B82F6', iconBg: '#EFF6FF', today: todayCounts.feeding, yest: yestCounts.feeding },
    { label: 'おしっこ', Icon: Droplets, iconColor: '#F59E0B', iconBg: '#FFFBEB', today: todayCounts.wet,   yest: yestCounts.wet },
    { label: 'うんち', Icon: Droplets, iconColor: '#F59E0B', iconBg: '#FFFBEB', today: todayCounts.poop,    yest: yestCounts.poop },
  ];

  // ── 7-day bar chart helper ─────────────────────────────────────────────────
  const countsByDay = (types: string[]) => {
    const map: Record<string, number> = {};
    for (const d of last7) map[d] = 0;
    for (const l of activeLogs) {
      const d = toYMD(new Date(l.createdAt));
      if (map[d] !== undefined && types.includes(l.type)) map[d]++;
    }
    return last7.map(d => ({ ymd: d, count: map[d] }));
  };

  const sleepByDay   = countsByDay(['sleep']);
  const feedByDay    = countsByDay(['breastfeed', 'formula', 'milk', 'expressed']);
  const wetByDay     = countsByDay(['diaper_wet']);
  const poopByDay    = countsByDay(['diaper_poop']);

  const milkMlByDay: Record<string, number> = {};
  for (const d of last7) milkMlByDay[d] = 0;
  for (const l of activeLogs) {
    const d = toYMD(new Date(l.createdAt));
    if (milkMlByDay[d] === undefined) continue;
    milkMlByDay[d] += (l.formulaMl ?? 0) + (l.expressedMl ?? 0);
  }
  const maxMilk = Math.max(...Object.values(milkMlByDay), 1);

  // ── 14-day sleep heatmap (hour 0-23) ──────────────────────────────────────
  const heatmap: boolean[][] = Array.from({ length: 14 }, () => new Array(24).fill(false));
  for (const l of logs) {
    if (l.type !== 'sleep') continue;
    const d = new Date(l.createdAt);
    const dayIdx = last14.indexOf(toYMD(d));
    if (dayIdx < 0) continue;
    heatmap[dayIdx][d.getHours()] = true;
  }
  const hourFreq = Array.from({ length: 24 }, (_, h) =>
    ({ h, count: heatmap.reduce((s, row) => s + (row[h] ? 1 : 0), 0) })
  );
  const top3Hours = [...hourFreq].sort((a, b) => b.count - a.count).slice(0, 3).filter(x => x.count > 0);

  // ── Comparison table: today vs 7 days ago ─────────────────────────────────
  const sevenAgoStr = last7[0];
  const sevenAgo = {
    sleep:   countFor(sevenAgoStr, ['sleep']),
    feeding: countFor(sevenAgoStr, ['breastfeed', 'formula', 'milk', 'expressed']),
    wet:     countFor(sevenAgoStr, ['diaper_wet']),
    poop:    countFor(sevenAgoStr, ['diaper_poop']),
    milk:    Math.round(milkMlByDay[sevenAgoStr] ?? 0),
  };

  const SectionTitle = ({ Icon, color, children, style }: {
    Icon: any; color: string; children: React.ReactNode; style?: any;
  }) => (
    <View style={[a.sectionTitleRow, style]}>
      <Icon size={15} color={color} strokeWidth={2} />
      <Text style={a.sectionTitle}>{children}</Text>
    </View>
  );

  const renderBarChart = (data: Array<{ymd: string; count: number}>, color: string, unit = '回') => {
    const max = Math.max(...data.map(d => d.count), 1);
    return (
      <View style={a.barChart}>
        {data.map(({ ymd, count }) => {
          const excluded = excludedDates.includes(ymd);
          const barH = count > 0 ? Math.max(4, Math.round((count / max) * MAX_H)) : 0;
          return (
            <View key={ymd} style={a.barCol}>
              <Text style={a.barLabel}>{count > 0 ? count : ''}</Text>
              <View style={a.barTrack}>
                {count > 0
                  ? <View style={[a.bar, { height: barH, backgroundColor: excluded ? '#ddd' : color }]} />
                  : <View style={a.barDot} />}
              </View>
              <Text style={[a.barDateLabel, excluded && a.excludedText]}>{toMMDD(ymd)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={a.overlay}>
        <SafeAreaView style={a.sheet}>
          <View style={a.header}>
            <View style={a.headerLeft}>
              <BarChart3 size={20} color={palette.primary} strokeWidth={2} />
              <Title style={a.headerTitle}>分析</Title>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ fontSize: 22, color: palette.mutedForeground }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={a.body} showsVerticalScrollIndicator={false}>
            {/* ── 今日のサマリー ──────────────────────────────────────── */}
            <Text style={a.sectionTitle}>今日のサマリー</Text>
            <View style={a.summaryGrid}>
              {summaryCards.map(c => {
                const SumIcon = c.Icon;
                return (
                <View key={c.label} style={a.summaryCard}>
                  <View style={[a.summaryIcon, { backgroundColor: c.iconBg }]}>
                    <SumIcon size={18} color={c.iconColor} strokeWidth={2} />
                  </View>
                  <Text style={a.summaryLabel}>{c.label}</Text>
                  <Text style={a.summaryCount}>{c.today}<Text style={a.summaryUnit}>回</Text></Text>
                  <Text style={[a.summaryTrend, { color: trendColor(c.today, c.yest) }]}>
                    {trend(c.today, c.yest)} 昨日{c.yest}回
                  </Text>
                </View>
                );
              })}
            </View>

            {/* ── 睡眠分析 ────────────────────────────────────────────── */}
            <SectionTitle Icon={Moon} color="#8C5EBA" style={{ marginTop: 20 }}>睡眠分析（7日間）</SectionTitle>
            {renderBarChart(sleepByDay, '#8C5EBA')}

            <SectionTitle Icon={Moon} color="#8C5EBA" style={{ marginTop: 16 }}>睡眠ヒートマップ（14日間）</SectionTitle>
            <Text style={a.sectionNote}>よく眠れた時間帯を色で確認</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* Hour axis labels (top) */}
                <View style={{ flexDirection: 'row', marginLeft: 28 }}>
                  {[0,3,6,9,12,15,18,21].map(h => (
                    <View key={h} style={{ width: h === 0 ? 1 : 36 }}>
                      <Text style={{ fontSize: 8, color: '#aaa' }}>{h}時</Text>
                    </View>
                  ))}
                </View>
                {last14.map((ymd, di) => (
                  <View key={ymd} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1 }}>
                    <Text style={{ width: 26, fontSize: 8, color: '#aaa', textAlign: 'right', marginRight: 2 }}>{toMMDD(ymd)}</Text>
                    {heatmap[di].map((active, h) => (
                      <View key={h} style={[a.heatCell, active && a.heatCellActive]} />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
            {top3Hours.length > 0 && (
              <View style={a.top3Card}>
                <Text style={a.top3Title}>よく眠れている時間帯 TOP {top3Hours.length}</Text>
                {top3Hours.map((x, i) => (
                  <Text key={x.h} style={a.top3Row}>
                    {['🥇','🥈','🥉'][i]} {String(x.h).padStart(2,'0')}:00 〜 {String((x.h + 1) % 24).padStart(2,'0')}:00
                    {'  '}({x.count}日)
                  </Text>
                ))}
              </View>
            )}

            {/* ── 授乳分析 ────────────────────────────────────────────── */}
            <SectionTitle Icon={Milk} color="#3B82F6" style={{ marginTop: 20 }}>授乳回数（7日間）</SectionTitle>
            {renderBarChart(feedByDay, '#3B82F6')}

            {/* ── おしっこ・うんち ─────────────────────────────────────── */}
            <SectionTitle Icon={Droplets} color="#F59E0B" style={{ marginTop: 16 }}>おしっこ（7日間）</SectionTitle>
            {renderBarChart(wetByDay, '#F59E0B')}
            <SectionTitle Icon={Droplets} color="#F97316" style={{ marginTop: 16 }}>うんち（7日間）</SectionTitle>
            {renderBarChart(poopByDay, '#F97316')}

            {/* ── ミルク量 ─────────────────────────────────────────────── */}
            <SectionTitle Icon={Milk} color="#8C5EBA" style={{ marginTop: 16 }}>ミルク量（ml・7日間）</SectionTitle>
            <View style={a.barChart}>
              {last7.map(ymd => {
                const ml = milkMlByDay[ymd] ?? 0;
                const excl = excludedDates.includes(ymd);
                const barH = ml > 0 ? Math.max(4, Math.round((Math.min(ml, 500) / 500) * MAX_H)) : 0;
                return (
                  <View key={ymd} style={a.barCol}>
                    <Text style={a.barLabel}>{ml > 0 ? ml : ''}</Text>
                    <View style={a.barTrack}>
                      {ml > 0
                        ? <View style={[a.bar, { height: barH, backgroundColor: excl ? '#ddd' : '#8C5EBA' }]} />
                        : <View style={a.barDot} />}
                    </View>
                    <Text style={[a.barDateLabel, excl && a.excludedText]}>{toMMDD(ymd)}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={a.chartNote}>ミルク缶 + 搾乳の合計 ml</Text>

            {/* ── 比較表 ──────────────────────────────────────────────── */}
            <SectionTitle Icon={BarChart3} color="#8C5EBA" style={{ marginTop: 20 }}>今日 vs 7日前</SectionTitle>
            <View style={a.table}>
              <View style={a.tableHeader}>
                <Text style={[a.tableCell, a.tableCellLabel]}>項目</Text>
                <Text style={a.tableCell}>今日</Text>
                <Text style={a.tableCell}>7日前</Text>
              </View>
              {[
                { label: 'ねんね', today: todayCounts.sleep,   ago: sevenAgo.sleep,   unit: '回' },
                { label: '授乳',   today: todayCounts.feeding, ago: sevenAgo.feeding, unit: '回' },
                { label: 'おしっこ', today: todayCounts.wet,  ago: sevenAgo.wet,     unit: '回' },
                { label: 'うんち', today: todayCounts.poop,   ago: sevenAgo.poop,    unit: '回' },
                { label: 'ミルク', today: Math.round(milkMlByDay[todayStr] ?? 0), ago: sevenAgo.milk, unit: 'ml' },
              ].map(row => (
                <View key={row.label} style={a.tableRow}>
                  <Text style={[a.tableCell, a.tableCellLabel]}>{row.label}</Text>
                  <Text style={[a.tableCell, { color: palette.primary, fontFamily: fonts.bodyBold, fontWeight: '700' }]}>{row.today}{row.unit}</Text>
                  <Text style={[a.tableCell, { color: palette.mutedForeground }]}>{row.ago}{row.unit}</Text>
                </View>
              ))}
            </View>

            {/* ── あの日を除外 ─────────────────────────────────────────── */}
            <SectionTitle Icon={ChevronLeft} color="#8C5EBA" style={{ marginTop: 20 }}>あの日を除外</SectionTitle>
            <Text style={a.sectionNote}>タップで分析から除外／含めます（直近14日間）</Text>
            <View style={a.chipRow}>
              {last14.map(ymd => {
                const excl = excludedDates.includes(ymd);
                return (
                  <TouchableOpacity key={ymd} style={[a.chip, excl && a.chipExcl]} onPress={() => onToggleExclude(ymd)}>
                    <Text style={[a.chipText, excl && a.chipTextExcl]}>{toMMDD(ymd)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 48 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Promotions hook ──────────────────────────────────────────────────────────

interface Promotion { id: number; message: string; triggerLogType: string; externalUrl?: string; sponsor?: { name: string } | null }

function useContextualPromos(logs: Log[]) {
  const [promoMap, setPromoMap] = useState<Record<number, Promotion>>({});
  useEffect(() => {
    if (!logs.length) return;
    const seen = new Set<string>();
    const toFetch: { logId: number; logType: string }[] = [];
    for (const log of logs.slice(0, 20)) {
      if (!seen.has(log.type)) { seen.add(log.type); toFetch.push({ logId: log.id, logType: log.type }); }
    }
    let cancelled = false;
    (async () => {
      const results: Record<number, Promotion> = {};
      for (const { logId, logType } of toFetch) {
        try {
          const promo = await apiGet<Promotion | null>(`/api/promotions/contextual/${logType}`);
          if (promo && !cancelled) results[logId] = promo;
        } catch {}
      }
      if (!cancelled) setPromoMap(results);
    })();
    return () => { cancelled = true; };
  }, [logs.length]);
  return promoMap;
}

// ─── TimelineScreen ───────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const { user }     = useAuthStore();
  const navigation   = useNavigation<Nav>();
  const familyId     = user?.familyId ?? 1;
  const queryClient  = useQueryClient();
  const toast        = useToast();
  const { isDark, colors } = useTheme();
  const { activeChildId, activeChild } = useChildStore();
  const userId = String(user?.id ?? '');
  const child = activeChild();

  const today = useMemo(() => new Date(), []);
  const [selectedDate,  setSelectedDate]  = useState(today);
  const [editingLog,    setEditingLog]    = useState<Log | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [pdfExporting,  setPdfExporting]  = useState(false);
  const [showQuickAdd,  setShowQuickAdd]  = useState(false);
  const [quickAddType,  setQuickAddType]  = useState<string | null>(null);
  const [reorderMode,   setReorderMode]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(EXCLUDED_DATES_KEY).then(v => { if (v) setExcludedDates(JSON.parse(v)); });
  }, []);

  // ── Full quick-log set (FAB sheet) — sourced EXACTLY like HomeScreen ──────
  //    phase → hidden filter → saved order → custom buttons. We only READ the
  //    same AsyncStorage keys Home owns so both screens stay in sync. ────────
  const phaseIndex = getPhaseIndex(child?.birthday);

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set(HIDDEN_BY_DEFAULT));
  useEffect(() => {
    if (!activeChildId) { setHiddenTypes(new Set(HIDDEN_BY_DEFAULT)); return; }
    AsyncStorage.getItem(`@weyu_btn_hidden_${activeChildId}`).then((stored) => {
      if (stored) setHiddenTypes(new Set(JSON.parse(stored)));
      else setHiddenTypes(new Set(HIDDEN_BY_DEFAULT));
    });
  }, [activeChildId]);

  const visibleButtons = useMemo(
    () => PHASE_BUTTONS[phaseIndex].filter((b) => !hiddenTypes.has(b.type)),
    [phaseIndex, hiddenTypes],
  );

  const [btnOrder, setBtnOrder] = useState<string[]>([]);
  useEffect(() => {
    if (!activeChildId) { setBtnOrder([]); return; }
    AsyncStorage.getItem(`@weyu_btn_order_${activeChildId}`).then((stored) => {
      if (stored) {
        try { setBtnOrder(JSON.parse(stored)); return; } catch { /* ignore */ }
      }
      setBtnOrder([]);
    });
  }, [activeChildId, showQuickAdd]);

  const phaseButtons = useMemo(() => {
    if (btnOrder.length === 0) return visibleButtons;
    const byType = new Map(visibleButtons.map((b) => [b.type, b]));
    const ordered: typeof visibleButtons = [];
    const seen = new Set<string>();
    for (const ty of btnOrder) {
      const b = byType.get(ty);
      if (b && !seen.has(ty)) { ordered.push(b); seen.add(ty); }
    }
    for (const b of visibleButtons) {
      if (!seen.has(b.type)) ordered.push(b);
    }
    return ordered;
  }, [visibleButtons, btnOrder]);

  const persistOrder = useCallback(async (types: string[]) => {
    setBtnOrder(types);
    if (activeChildId) {
      await AsyncStorage.setItem(`@weyu_btn_order_${activeChildId}`, JSON.stringify(types));
    }
  }, [activeChildId]);

  const [customButtons, setCustomButtons] = useState<
    Array<{ label: string; icon?: string; emoji?: string; color: string; type: string }>
  >([]);
  useEffect(() => {
    AsyncStorage.getItem('@weyu_custom_buttons').then((stored) => {
      if (stored) setCustomButtons(JSON.parse(stored));
    });
  }, [showQuickAdd]);

  const handleToggleExclude = useCallback(async (ymd: string) => {
    setExcludedDates(prev => {
      const next = prev.includes(ymd) ? prev.filter(d => d !== ymd) : [...prev, ymd];
      AsyncStorage.setItem(EXCLUDED_DATES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs', familyId],
    queryFn: () => getLogs(familyId),
  });

  // ── PDF/export — mirrors web generateTimelinePdf (7-day report). The web
  //    button opens a printable window; on native we hand the same 7-day
  //    report to the OS share/print sheet using already-loaded data. ───────
  const handleExportPdf = useCallback(async () => {
    if (pdfExporting) return;
    setPdfExporting(true);
    try {
      const report = buildTimelineReport(logs, selectedDate);
      await Share.share({ title: 'We育 1週間レポート', message: report });
    } catch (e) {
      showAlert('PDFの作成に失敗しました');
    } finally {
      setPdfExporting(false);
    }
  }, [pdfExporting, logs, selectedDate]);

  // ── Quick-add (web FAB → QuickActions sheet). Opens the existing
  //    LogDialog for the chosen type; save creates a log via createLog. ────
  const partnerUserId = user?.role === 'mama' ? 'papa' : 'mama';

  const createLogMutation = useMutation({
    mutationFn: createLog,
    onSuccess: (newLog) => {
      queryClient.invalidateQueries({ queryKey: ['logs', familyId] });
      toast.show(logRecordedToast(newLog.type, newLog.points ?? 10));
    },
    onError: () => showAlert('記録の保存に失敗しました。'),
  });

  const handleQuickAddSave = useCallback((data: LogSaveData) => {
    if (!activeChildId) { showAlert('子どもを選択してください'); return; }
    setQuickAddType(null);
    const base = {
      type: data.type,
      childId: activeChildId,
      familyId: String(familyId),
      points: 1,
      memo: data.memo,
      bodyTemperature: data.bodyTemperature,
      formulaMl: data.formulaMl,
      expressedMl: data.expressedMl,
      breastLeftMin: data.breastLeftMin,
      breastRightMin: data.breastRightMin,
      symptoms: data.symptoms,
    } as any;
    if (data.medicineName) {
      base.medicineName = data.medicineName;
      base.medicineDose = data.memo;
      delete base.memo;
    }
    data.assignees.forEach((a) => {
      const uid = a === 'self' ? userId : a === 'partner' ? partnerUserId : 'other';
      createLogMutation.mutate({ ...base, userId: uid });
    });
  }, [activeChildId, familyId, userId, partnerUserId, createLogMutation]);

  // Custom buttons create a `custom` log immediately (same as HomeScreen's
  // handleCustomButtonPress) — reuses the createLog path already wired here.
  const handleCustomButtonPress = useCallback((btn: { label: string }) => {
    if (!activeChildId) { showAlert('子どもを選択してください'); return; }
    setShowQuickAdd(false);
    createLogMutation.mutate({
      type: 'custom', childId: activeChildId, familyId: String(familyId),
      userId, points: 1, memo: btn.label,
    } as any);
  }, [activeChildId, familyId, userId, createLogMutation]);

  const promoMap = useContextualPromos(logs);

  // Filter logs for selected day
  const dayLogs = useMemo(() => {
    const sel = toYMD(selectedDate);
    return logs
      .filter(l => toYMD(new Date(l.createdAt)) === sel)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [logs, selectedDate]);

  const daySleepLogs = useMemo(() => dayLogs.filter(l => l.type === 'sleep'), [dayLogs]);
  const dayPointLogs = useMemo(() => dayLogs.filter(l => l.type !== 'sleep'), [dayLogs]);

  // Web: column layout — group near-overlapping entries into side-by-side cols
  const logLayout = useMemo(() => {
    const map = new Map<number, { top: number; col: number; cols: number }>();
    const groups: Log[][] = [];
    for (const log of dayPointLogs) {
      const min = minutesFromMidnight(new Date(log.createdAt));
      const top = minutesToTopPx(min) - LOG_ENTRY_HEIGHT / 2;
      let placed = false;
      for (const g of groups) {
        const gTop = minutesToTopPx(minutesFromMidnight(new Date(g[0].createdAt))) - LOG_ENTRY_HEIGHT / 2;
        if (Math.abs(top - gTop) < LOG_ENTRY_HEIGHT + 4) { g.push(log); placed = true; break; }
      }
      if (!placed) groups.push([log]);
    }
    for (const g of groups) {
      const gTop = minutesToTopPx(minutesFromMidnight(new Date(g[0].createdAt))) - LOG_ENTRY_HEIGHT / 2;
      g.forEach((log, idx) => map.set(log.id, { top: Math.max(0, gTop), col: idx, cols: g.length }));
    }
    return map;
  }, [dayPointLogs]);

  // Day sleep total (minutes) — sum of '分' tokens in sleep memos
  const daySleepTotalMinutes = useMemo(() => {
    let total = 0;
    for (const l of daySleepLogs) {
      const parts = (l.memo ?? '').split('\n')[0].split('・');
      const tok = parts.find(p => SLEEP_DURATION_RE.test(p));
      if (tok) total += parseInt(tok);
    }
    return total;
  }, [daySleepLogs]);

  const goToPrevDay = useCallback(() => setSelectedDate(d => addDays(d, -1)), []);
  const goToNextDay = useCallback(() => setSelectedDate(d => {
    if (toYMD(d) === toYMD(today)) return d;
    return addDays(d, 1);
  }), [today]);

  // Swipe detection
  const swipeRef = useRef({ startX: 0, startY: 0 });
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy),
    onPanResponderGrant: (e) => {
      swipeRef.current = { startX: e.nativeEvent.pageX, startY: e.nativeEvent.pageY };
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 60) goToPrevDay();
      else if (gs.dx < -60) goToNextDay();
    },
  }), [goToPrevDay, goToNextDay]);

  const selectedStr = toYMD(selectedDate);
  const isToday = selectedStr === toYMD(today);

  // ── Drag-to-change-time (client feedback #3, 2026-07-30) ─────────────
  // Long-press a log for 400ms to activate drag; drag vertically to move
  // its record time; release to commit. Mirrors web Timeline.tsx:660-750.
  const [draggingLogId, setDraggingLogId] = useState<number | null>(null);
  const [dragTopPx, setDragTopPx]         = useState<number | null>(null);
  const dragOriginTop = useRef<number>(0);

  const updateLogTimeMut = useMutation({
    mutationFn: ({ id, createdAt }: { id: number; createdAt: string }) =>
      apiPost(`/api/logs/${id}/update-time`, { createdAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', familyId] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: () => {
      Alert.alert('時刻の変更に失敗しました', 'ネットワーク接続をご確認ください。');
    },
  });

  const commitDrag = useCallback((log: Log, newTopPx: number) => {
    // Center the entry, snap to 5-minute increments, clamp to the day.
    const centerPx = newTopPx + LOG_ENTRY_HEIGHT / 2;
    const rawMin = topPxToMinutes(centerPx);
    const snappedMin = Math.max(0, Math.min(24 * 60 - 1, Math.round(rawMin / 5) * 5));
    const d = new Date(selectedDate);
    d.setHours(Math.floor(snappedMin / 60), snappedMin % 60, 0, 0);
    updateLogTimeMut.mutate({ id: log.id, createdAt: d.toISOString() });
  }, [selectedDate, updateLogTimeMut]);

  // 7-day chip strip ending at today (or window around selectedDate)
  const dateChips = useMemo(() => {
    const windowEnd = (new Date(selectedDate).getTime() < addDays(today, -6).getTime())
      ? addDays(selectedDate, 6) : today;
    return Array.from({ length: 7 }, (_, i) => addDays(windowEnd, -(6 - i)));
  }, [today, selectedDate]);

  const dayLabel = selectedDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' });
  const nowTop = minutesToTopPx(minutesFromMidnight(new Date()));

  if (isLoading) {
    return <View style={t.centered}><ActivityIndicator color={palette.primary} size="large" /></View>;
  }

  return (
    <View style={[t.container, isDark && { backgroundColor: colors.background }]}>
      {/* ── WeYu Header (BABY / name / 担当中 / gear) ──────────────────────── */}
      <WeHeader />

      {/* ── Header (web: title + 分析 / 振り返り / PDF / date toggle) ─────── */}
      {/* Title on its own row, pills on a horizontally-scrolling row below —
          previously all 4 pills sat next to the title in a flex row, which
          overflowed off the right edge on narrow phones (title ~150px +
          4 pills ~230px > 360px screen). */}
      <View style={t.headerStack}>
        <Title style={t.headerTitle}>1週間タイムライン</Title>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={t.headerBtnsScroll}
        >
          <TouchableOpacity style={[t.pill, t.pillIndigo]} onPress={() => navigation.navigate('DailyStats')} activeOpacity={0.85}>
            <Moon size={13} color="#6366F1" strokeWidth={2} />
            <Text style={[t.pillText, { color: '#6366F1' }]}>分析</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[t.pill, t.pillGreen]} onPress={() => navigation.navigate('Review')} activeOpacity={0.85}>
            <Star size={13} color={palette.secondary} strokeWidth={2} />
            <Text style={[t.pillText, { color: palette.secondary }]}>振り返り</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[t.pill, t.pillRose, pdfExporting && { opacity: 0.5 }]}
            onPress={handleExportPdf}
            disabled={pdfExporting}
            activeOpacity={0.85}
          >
            {pdfExporting
              ? <Loader2 size={13} color={palette.destructive} strokeWidth={2} />
              : <FileDown size={13} color={palette.destructive} strokeWidth={2} />}
            <Text style={[t.pillText, { color: palette.destructive }]}>
              {pdfExporting ? '作成中' : 'PDF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[t.pill, t.pillPurple]}
            onPress={() => setShowDatePicker(v => !v)}
            activeOpacity={0.85}
          >
            <CalendarDays size={14} color={palette.primary} strokeWidth={2} />
            <Text style={[t.pillText, { color: palette.accentForeground }]}>
              {selectedDate.getMonth() + 1}/{selectedDate.getDate()}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Collapsible 7-day date-chip strip ───────────────────────────── */}
      {showDatePicker && (
        <View style={t.dateStripWrap}>
          <View style={t.dateStripRow}>
            <TouchableOpacity style={t.dateNavBtn} onPress={goToPrevDay} activeOpacity={0.7}>
              <ChevronLeft size={16} color={palette.primary} strokeWidth={2} />
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={t.dateChips}
            >
              {dateChips.map(date => {
                const ds = toYMD(date);
                const sel = ds === selectedStr;
                const td = ds === toYMD(today);
                return (
                  <TouchableOpacity
                    key={ds}
                    onPress={() => setSelectedDate(date)}
                    style={[t.dateChip, sel && t.dateChipSel]}
                    activeOpacity={0.8}
                  >
                    <Text style={[t.dateChipDow, sel && t.dateChipDowSel]}>
                      {date.toLocaleDateString('ja-JP', { weekday: 'short' })}
                    </Text>
                    <Text style={[t.dateChipDay, sel && t.dateChipDaySel]}>{date.getDate()}</Text>
                    {td && <View style={[t.dateChipDot, sel && t.dateChipDotSel]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[t.dateNavBtn, isToday && t.dateNavBtnDisabled]}
              onPress={goToNextDay}
              disabled={isToday}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color={isToday ? palette.border : palette.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <View style={t.dateMetaWrap}>
            <Text style={t.dateMeta}>
              {dayLabel}{isToday ? ' - 今日' : ''}
            </Text>
            {daySleepTotalMinutes > 0 && (
              <Text style={t.dateSleepMeta}>
                <Moon size={11} color="#A5B4FC" strokeWidth={2} />{'  '}
                睡眠合計 {daySleepTotalMinutes >= 60
                  ? `${Math.floor(daySleepTotalMinutes / 60)}時間${daySleepTotalMinutes % 60 > 0 ? `${daySleepTotalMinutes % 60}分` : ''}`
                  : `${daySleepTotalMinutes}分`}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* ── 24-hour vertical timeline (swipeable) ───────────────────────── */}
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <View style={t.timelineCardWrap}>
          <View style={[t.timelineCard, isDark && { backgroundColor: colors.card }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ height: TOTAL_HEIGHT }}
            >
              <View style={{ height: TOTAL_HEIGHT, position: 'relative' }}>
                {/* Hour gridlines + gutter labels */}
                {Array.from({ length: 24 }).map((_, h) => (
                  <View key={h} style={[t.hourLine, { top: h * HOUR_HEIGHT }]}>
                    <View style={t.hourLabelChip}>
                      <Text style={t.hourLabel}>{String(h).padStart(2, '0')}:00</Text>
                    </View>
                  </View>
                ))}
                {/* Gutter vertical rule */}
                <View style={[t.gutterRule, { height: TOTAL_HEIGHT }]} />

                {/* Sleep blocks */}
                {daySleepLogs.map(log => (
                  <SleepBlock key={`sleep-${log.id}`} log={log} onPress={() => setEditingLog(log)} />
                ))}

                {/* Log entries (positioned by time, column-packed) */}
                {dayPointLogs.map(log => {
                  const min = minutesFromMidnight(new Date(log.createdAt));
                  const layout = logLayout.get(log.id) ?? { top: minutesToTopPx(min) - LOG_ENTRY_HEIGHT / 2, col: 0, cols: 1 };
                  const colW = layout.cols > 1 ? 100 / layout.cols : 100;
                  const colL = layout.col * colW;
                  const vis = logVisual(log.type);
                  const label = logLabel(log.type);
                  const detail = logDetailText(log);
                  const isFever = log.type === 'temperature' && (log.bodyTemperature ?? 0) >= 38.5;
                  const cardBg = isFever ? '#FEE2E2' : (isDark ? colors.card : vis.soft);
                  const cardBorder = isFever ? '#F87171' : vis.bord;
                  const textPri = isDark && !isFever ? '#EFEFEF' : palette.foreground;
                  const textSec = isDark && !isFever ? '#AAAACC' : palette.mutedForeground;
                  const promo = promoMap[log.id];
                  const isDragging = draggingLogId === log.id;
                  const effectiveTop = isDragging && dragTopPx !== null
                    ? dragTopPx
                    : Math.max(0, layout.top);
                  // Pan gesture activates after a 400ms long-press. Short tap
                  // still fires onPress on the TouchableOpacity below.
                  // Gesture callbacks run on the UI thread as worklets —
                  // React setState calls MUST be wrapped in runOnJS or the
                  // app crashes the moment you touch a log card (this was
                  // the root cause of the "app closes on tap" bug reported
                  // 2026-07-31). Mirrors the pattern used by the reorder
                  // gesture at line 385.
                  const dragGesture = Gesture.Pan()
                    .activateAfterLongPress(400)
                    .onStart(() => {
                      const originTop = Math.max(0, layout.top);
                      dragOriginTop.current = originTop;
                      runOnJS(setDraggingLogId)(log.id);
                      runOnJS(setDragTopPx)(originTop);
                    })
                    .onUpdate((e) => {
                      const next = Math.max(
                        0,
                        Math.min(
                          TOTAL_HEIGHT - LOG_ENTRY_HEIGHT,
                          dragOriginTop.current + e.translationY,
                        ),
                      );
                      runOnJS(setDragTopPx)(next);
                    })
                    .onEnd(() => {
                      // dragTopPx is a JS ref captured at gesture-build
                      // time; safe to read from the worklet. Use runOnJS
                      // for anything that touches React state.
                      const finalPx = dragTopPx;
                      if (finalPx !== null && Math.abs(finalPx - dragOriginTop.current) > 2) {
                        runOnJS(commitDrag)(log, finalPx);
                      }
                      runOnJS(setDraggingLogId)(null);
                      runOnJS(setDragTopPx)(null);
                    })
                    .onFinalize(() => {
                      // Cleanup even on cancel — matches pattern above.
                      runOnJS(setDraggingLogId)(null);
                      runOnJS(setDragTopPx)(null);
                    });
                  const dragTimeLabel = isDragging && dragTopPx !== null
                    ? mmToHHmm(Math.round(topPxToMinutes(dragTopPx + LOG_ENTRY_HEIGHT / 2) / 5) * 5)
                    : null;
                  return (
                    <View
                      key={`log-${log.id}`}
                      style={[
                        tl.logEntryWrap,
                        { top: effectiveTop, zIndex: isDragging ? 100 : 10 },
                      ]}
                    >
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: GUTTER + 4,
                          right: 8,
                        }}
                      >
                        <View style={{ flexDirection: 'row' }}>
                          <View style={{ width: `${colL}%` }} />
                          <View style={{ width: `${colW}%` }}>
                            <GestureDetector gesture={dragGesture}>
                              <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={() => { if (!isDragging) setEditingLog(log); }}
                              >
                                <View style={[
                                  tl.logCard,
                                  { backgroundColor: cardBg, borderColor: cardBorder },
                                  isFever && tl.logCardFever,
                                  isDragging && { transform: [{ scale: 1.05 }], shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
                                ]}>
                                  <LogIcon type={logVisualType(log.type)} size={15} strokeWidth={2} />
                                  <View style={tl.logBody}>
                                    <Text numberOfLines={1} style={[tl.logTitle, { color: textPri }]}>
                                      {detail || label}
                                    </Text>
                                    <Text numberOfLines={1} style={[tl.logTime, { color: textSec }]}>
                                      {dragTimeLabel ?? fmtHHmm(log.createdAt)}{log.points ? `  +${log.points}pt` : ''}
                                    </Text>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            </GestureDetector>
                            {promo && !isDragging && (
                              <View style={tl.promoCard}>
                                <Heart size={13} color="#D4A017" strokeWidth={2} />
                                <Text style={tl.promoMsg} numberOfLines={2}>{promo.message}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Now line (today only) */}
                {isToday && (
                  <View style={[t.nowLine, { top: nowTop }]} pointerEvents="none">
                    <View style={t.nowDot} />
                    <View style={t.nowRule} />
                  </View>
                )}

                {/* Empty state */}
                {dayLogs.length === 0 && (
                  <View style={t.emptyOverlay} pointerEvents="none">
                    <CalendarDays size={36} color={palette.border} strokeWidth={1.5} />
                    <Text style={t.emptyText}>この日の記録はありません</Text>
                    <Text style={t.emptyHint}>ログを追加するとここに表示されます</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      {/* ── Edit dialog ──────────────────────────────────────────────────── */}
      <EditLogDialog
        log={editingLog}
        onClose={() => setEditingLog(null)}
        onSaved={() => setEditingLog(null)}
      />

      {/* ── Analytics panel ──────────────────────────────────────────────── */}
      <AnalyticsPanel
        logs={logs}
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        excludedDates={excludedDates}
        onToggleExclude={handleToggleExclude}
      />

      {/* ── Quick Add FAB (web: fixed bottom-20 right-4 w-14 h-14 #805AAA) ── */}
      <TouchableOpacity
        style={t.fab}
        onPress={() => setShowQuickAdd(true)}
        activeOpacity={0.85}
        accessibilityLabel="きろくを追加"
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Quick Add sheet — web: <Sheet> w/ full <QuickActions /> grid.
            Shows the SAME full quick-log set Home renders for the active
            child's phase (phase buttons + custom buttons), scrollable, with
            an X close (top-right) + 並び替え affordance, matching WeYu. ───── */}
      <Modal
        visible={showQuickAdd}
        transparent
        animationType="slide"
        onRequestClose={() => { setReorderMode(false); setShowQuickAdd(false); }}
      >
        <GestureHandlerRootView style={qa.overlay}>
          <View style={qa.sheet}>
            <View style={qa.handle} />
            {/* Header — title left, X close top-right (web sheet.tsx) */}
            <View style={qa.headerRow}>
              <View style={qa.headerTitleRow}>
                <Plus size={18} color={palette.primary} strokeWidth={2.5} />
                <Title style={qa.title}>きろくを追加</Title>
              </View>
              <TouchableOpacity
                style={qa.closeIconBtn}
                onPress={() => { setReorderMode(false); setShowQuickAdd(false); }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="閉じる"
              >
                <X size={20} color={palette.mutedForeground} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={qa.scroll}
              contentContainerStyle={qa.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* 並び替え toggle — web ActionButtons.tsx:1058-1079 */}
              <View style={qa.reorderRow}>
                {reorderMode ? (
                  <TouchableOpacity
                    style={[qa.reorderBtn, qa.reorderDoneBtn]}
                    onPress={() => setReorderMode(false)}
                    activeOpacity={0.8}
                  >
                    <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={[qa.reorderText, qa.reorderDoneText]}>完了</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={qa.reorderBtn}
                    onPress={() => setReorderMode(true)}
                    activeOpacity={0.8}
                  >
                    <GripVertical size={14} color={palette.mutedForeground} strokeWidth={2} />
                    <Text style={qa.reorderText}>並び替え</Text>
                  </TouchableOpacity>
                )}
              </View>

              {phaseButtons.length === 0 ? (
                <Text style={qa.emptyHint}>記録ボタンがありません</Text>
              ) : reorderMode ? (
                <View style={qa.dragGridWrap}>
                  <DraggableQuickGrid
                    order={phaseButtons.map((b) => b.type)}
                    tileWidth={TILE_W}
                    gap={GRID_GAP}
                    columns={3}
                    onReorder={(keys) => persistOrder(keys)}
                    tiles={phaseButtons.map((btn) => {
                      const v = getLogVisual(btn.type);
                      return {
                        key: btn.type,
                        render: () => (
                          <View
                            style={[
                              qa.tile,
                              { width: TILE_W },
                              isDark
                                ? { backgroundColor: colors.card, borderColor: colors.border }
                                : { backgroundColor: v.soft, borderColor: v.bord },
                            ]}
                          >
                            <View style={qa.tileBadge}>
                              <GripVertical size={20} color="#9CA3AF" strokeWidth={2} />
                            </View>
                            <Text
                              style={[qa.tileLabel, { color: isDark ? colors.text : v.tint }]}
                              numberOfLines={1}
                            >
                              {btn.label}
                            </Text>
                          </View>
                        ),
                      };
                    })}
                  />
                </View>
              ) : (
                <View style={qa.grid}>
                  {phaseButtons.map((btn) => {
                    const v = getLogVisual(btn.type);
                    return (
                      <TouchableOpacity
                        key={btn.type}
                        style={[
                          qa.tile,
                          { width: TILE_W },
                          isDark
                            ? { backgroundColor: colors.card, borderColor: colors.border }
                            : { backgroundColor: v.soft, borderColor: v.bord },
                        ]}
                        activeOpacity={0.85}
                        disabled={createLogMutation.isPending}
                        onPress={() => {
                          setShowQuickAdd(false);
                          setQuickAddType(btn.type);
                        }}
                      >
                        <View style={qa.tileBadge}>
                          <LogIcon
                            type={btn.type}
                            size={20}
                            strokeWidth={2.5}
                            color={isDark ? colors.text : v.tint}
                          />
                        </View>
                        <Text
                          style={[qa.tileLabel, { color: isDark ? colors.text : v.tint }]}
                          numberOfLines={1}
                        >
                          {btn.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* カスタム sub-grid — web ActionButtons.tsx:1174-1233 */}
              {customButtons.length > 0 && (
                <View style={qa.customGridWrap}>
                  <Text style={qa.customGridLabel}>カスタム</Text>
                  <View style={qa.grid}>
                    {customButtons.map((btn, index) => {
                      const sw = resolveSwatch(btn.color);
                      return (
                        <TouchableOpacity
                          key={`custom-${index}`}
                          style={[
                            qa.tile,
                            { width: TILE_W },
                            isDark
                              ? { backgroundColor: colors.card, borderColor: colors.border }
                              : { backgroundColor: sw.soft, borderColor: sw.bord },
                          ]}
                          activeOpacity={0.85}
                          disabled={createLogMutation.isPending}
                          onPress={() => handleCustomButtonPress(btn)}
                        >
                          <View style={qa.tileBadge}>
                            <CustomButtonIcon
                              icon={btn.icon}
                              emoji={btn.emoji}
                              size={20}
                              strokeWidth={2.5}
                              color={isDark ? colors.text : sw.tint}
                            />
                          </View>
                          <Text
                            style={[qa.tileLabel, { color: isDark ? colors.text : sw.tint }]}
                            numberOfLines={1}
                          >
                            {btn.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* ── LogDialog (existing add-log flow, opened by quick-add) ───────── */}
      <LogDialog
        visible={quickAddType !== null}
        logType={quickAddType}
        userRole={user?.role}
        onClose={() => setQuickAddType(null)}
        onSave={handleQuickAddSave}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const t = StyleSheet.create({
  // Web: gradient from-purple-50 via-white to-green-50
  container: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },

  // Web: px-4 pt-2; title text-lg font-black + action pills
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8,
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Stacked layout (title above pills) — pills row is horizontally scrollable.
  headerStack: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8, gap: 8 },
  headerBtnsScroll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 24 },

  // Web: rounded-2xl px-3 py-1.5 soft tinted pills with 1px border
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1,
  },
  pillIndigo: { backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' },
  pillGreen:  { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  pillRose:   { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' },
  pillPurple: { backgroundColor: palette.accent, borderColor: '#EDE9FE' },
  pillText: { fontSize: 11, fontFamily: fonts.bodyBold, fontWeight: '700' },

  // Date-chip strip (web: collapsible date picker)
  dateStripWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  dateStripRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavBtn: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dateNavBtnDisabled: { opacity: 0.3 },
  dateChips: { gap: 6, paddingHorizontal: 2 },
  dateChip: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.lg, backgroundColor: palette.card,
    borderWidth: 1, borderColor: palette.border, minWidth: 44,
  },
  dateChipSel: { backgroundColor: palette.primary, borderColor: palette.primary },
  dateChipDow: { fontSize: 10, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  dateChipDowSel: { color: '#E9D8FD' },
  dateChipDay: { fontSize: 14, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground, lineHeight: 18 },
  dateChipDaySel: { color: palette.primaryForeground },
  dateChipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.primary, marginTop: 2 },
  dateChipDotSel: { backgroundColor: '#FFFFFF' },
  dateMetaWrap: { alignItems: 'center', marginTop: 6, gap: 2 },
  dateMeta: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  dateSleepMeta: { fontSize: 11, fontFamily: fonts.bodyBold, fontWeight: '700', color: '#A5B4FC' },

  // Timeline card — web: rounded-3xl shadow card wrapping the 24h grid
  // paddingBottom was 90 (extra buffer above the tab bar) — client
  // 2026-07-31 asked to shrink the empty band between the timeline
  // card and the tab bar. Reduced to 12; the FAB (bottom: 80) floats
  // OVER the timeline card, which is how FABs are supposed to work.
  timelineCardWrap: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
  timelineCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.soft, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },

  hourLine: {
    position: 'absolute', left: 0, right: 0,
    borderTopWidth: 1, borderTopColor: palette.border,
  },
  hourLabelChip: {
    position: 'absolute', left: 8, top: -8,
    backgroundColor: palette.card, paddingHorizontal: 4,
  },
  hourLabel: { fontSize: 10, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  gutterRule: { position: 'absolute', left: GUTTER, top: 0, width: 1, backgroundColor: '#EDE9FE' },

  // Now line — web: red dot + red rule
  nowLine: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 20 },
  nowDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444', marginLeft: GUTTER - 4 },
  nowRule: { flex: 1, height: 2, backgroundColor: 'rgba(239,68,68,0.6)' },

  emptyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  emptyText: { fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  emptyHint: { fontSize: 12, fontFamily: fonts.body, color: palette.mutedForeground },

  // Quick Add FAB — web: fixed bottom-20 right-4 w-14 h-14 rounded-full
  //   bg-[#805AAA] shadow-xl shadow-purple-200 (bottom-20 = above bottom nav)
  fab: {
    position: 'absolute', right: 16, bottom: 80,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#805AAA',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 40,
    shadowColor: '#805AAA', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
});

const qa = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // web: rounded-t-3xl px-0 pb-safe max-h-[85dvh] overflow-y-auto
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, backgroundColor: palette.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  // web SheetHeader px-5 pb-2 + X close absolute right-4 top-4
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontFamily: fonts.sans, fontWeight: '700', color: palette.primary },
  closeIconBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flexGrow: 0 },
  // comfortable bottom padding so the last rows + custom section clear the
  // device home indicator (web pb-safe)
  scrollContent: { paddingBottom: 48 },

  // 並び替え toggle row — web ActionButtons.tsx:1058-1079 (justify-end)
  reorderRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: GRID_PAD, marginBottom: 8,
  },
  reorderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
  },
  reorderText: { fontSize: 12, color: palette.mutedForeground, fontFamily: fonts.bodyBold },
  reorderDoneBtn: { backgroundColor: palette.primary },
  reorderDoneText: { color: '#FFFFFF' },

  // web: grid grid-cols-3 gap-3 px-6 w-full max-w-md mx-auto
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP,
    paddingHorizontal: GRID_PAD, maxWidth: GRID_MAX,
    alignSelf: 'center', width: '100%',
  },
  dragGridWrap: {
    paddingHorizontal: GRID_PAD, maxWidth: GRID_MAX,
    alignSelf: 'center', width: '100%',
  },
  // web tile: flex-col items-center justify-center gap-2 py-4 px-2
  //   rounded-[2rem] border-2 shadow-sm (identical to HomeScreen logButton)
  tile: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: 8,
    borderRadius: 32, borderWidth: 2,
    shadowColor: '#805AAA', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  // web badge: bg-white p-2.5 rounded-full shadow-sm
  tileBadge: {
    backgroundColor: '#fff', padding: 10, borderRadius: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
  },
  tileLabel: {
    fontSize: 12, textAlign: 'center', fontFamily: fonts.bodyBold,
    fontWeight: '700', letterSpacing: 0.3,
  },

  // カスタム sub-grid — web ActionButtons.tsx:1174-1178
  customGridWrap: { marginTop: 12, width: '100%' },
  customGridLabel: {
    fontSize: 10, color: '#9CA3AF', fontFamily: fonts.bodyBold,
    letterSpacing: 1.5, textTransform: 'uppercase',
    paddingHorizontal: GRID_PAD + 4, marginBottom: 8,
  },

  emptyHint: {
    fontSize: 12, fontFamily: fonts.body, color: palette.mutedForeground,
    textAlign: 'center', paddingVertical: 24,
  },
});

const tl = StyleSheet.create({
  sleepBlock: {
    position: 'absolute', left: GUTTER + 8, right: 8,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(167,139,201,0.18)',
    borderWidth: 1, borderColor: 'rgba(167,139,201,0.4)',
    justifyContent: 'center', zIndex: 5,
  },
  // Sleep-block content sits at the LEFT so it stays visible when
  // point-in-time logs (walk / hold / etc.) are positioned on top of
  // the sleep bar. Was center-aligned before, which meant every
  // overlapping log card would completely hide the ねんね label.
  sleepInner: { alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 4, gap: 3 },
  sleepHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sleepTitle: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: '#7C5CBF' },
  sleepBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-start' },
  sleepBadge: { borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  sleepBadgeMethod: { backgroundColor: 'rgba(167,139,201,0.4)' },
  sleepBadgeLoc:    { backgroundColor: 'rgba(165,180,252,0.4)' },
  sleepBadgeText: { fontSize: 9, fontFamily: fonts.bodyBold, fontWeight: '700' },
  sleepBadgeTextMethod: { color: '#6D28D9' },
  sleepBadgeTextLoc:    { color: '#4338CA' },

  logEntryWrap: { position: 'absolute', left: 0, right: 0, height: 1, zIndex: 10 },
  logCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: radius.lg,
    paddingHorizontal: 8, paddingVertical: 6, minHeight: LOG_ENTRY_HEIGHT,
    // Subtle shadow so the card clearly reads as "above" any sleep block
    // it may overlap with. Android needs `elevation`; iOS uses shadow*.
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  logCardFever: {
    shadowColor: '#EF4444', shadowOpacity: 0.2, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  logBody: { flex: 1, minWidth: 0 },
  logTitle: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700' },
  logTime: { fontSize: 10, fontFamily: fonts.body, marginTop: 1 },

  // Promo — web sponsored note style (warm amber tint, left accent)
  promoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF9E7', borderRadius: radius.sm,
    borderLeftWidth: 3, borderLeftColor: '#F5C842',
    paddingHorizontal: 8, paddingVertical: 6, marginTop: 4,
  },
  promoMsg: { flex: 1, fontSize: 11, fontFamily: fonts.bodySemibold, color: '#7A6A2F' },
});

const ed = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // maxHeight 88% + reduced vertical padding keeps sleep-log edit content
  // fully reachable via the internal ScrollView on small phones. Was:
  // no maxHeight, padding 24, paddingBottom 32 — content overflowed
  // screen top on sleep logs since the extra fields were added.
  sheet: { backgroundColor: palette.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, maxHeight: '88%' },
  handle: { width: 40, height: 4, backgroundColor: palette.border, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  title: { fontSize: 15, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground, textAlign: 'center', marginBottom: 10 },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  infoLabel: { fontSize: 13, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.foreground },
  infoDetail: { fontSize: 11, fontFamily: fonts.body, color: palette.mutedForeground, marginTop: 1 },
  label: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground, marginBottom: 6 },
  input: {
    backgroundColor: palette.card, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.body, borderWidth: 1, borderColor: palette.border,
    color: palette.foreground, marginBottom: 12,
  },
  hint: { fontSize: 12, fontFamily: fonts.body, color: palette.primary, marginBottom: 8, marginTop: -8 },

  // Chips for the sleep-log settling-method / sleep-location selectors.
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.md, borderWidth: 2,
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  chipTextOn: { color: '#fff' },
  chipOnIndigo:  { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipOffIndigo: { backgroundColor: palette.card, borderColor: '#E0E7FF' },
  chipTextIndigo: { color: '#6366F1' },
  chipOnSky:  { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipOffSky: { backgroundColor: palette.card, borderColor: '#E0F2FE' },
  chipTextSky: { color: '#0EA5E9' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: palette.muted, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: palette.mutedForeground, fontSize: 14, fontFamily: fonts.bodySemibold },
  saveBtn: { flex: 1, backgroundColor: palette.primary, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: palette.primaryForeground, fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10 },
  deleteText: { color: palette.destructive, fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700' },
});

const a = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground },
  body: { paddingHorizontal: 20, paddingTop: 16 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground },
  sectionNote: { fontSize: 11, fontFamily: fonts.body, color: palette.mutedForeground, marginTop: -6, marginBottom: 10 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  summaryCard: {
    width: '47%', backgroundColor: palette.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: palette.border, padding: 14, alignItems: 'center', gap: 4,
    ...shadows.soft, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  summaryIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 12, fontFamily: fonts.bodySemibold, color: palette.mutedForeground },
  summaryCount: { fontSize: 26, fontFamily: fonts.sans, fontWeight: '700', color: palette.primary },
  summaryUnit: { fontSize: 14, fontFamily: fonts.body, fontWeight: '400', color: palette.mutedForeground },
  summaryTrend: { fontSize: 11, fontFamily: fonts.bodyBold, fontWeight: '700' },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 },
  barCol: { alignItems: 'center', flex: 1 },
  barLabel: { fontSize: 9, fontFamily: fonts.bodyBold, color: palette.primary, marginBottom: 2, fontWeight: '700' },
  barTrack: { height: MAX_H, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  bar: { width: '70%', borderRadius: 4 },
  barDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 2 },
  barDateLabel: { fontSize: 9, fontFamily: fonts.body, color: palette.mutedForeground, marginTop: 4 },
  excludedText: { color: palette.border, textDecorationLine: 'line-through' },
  chartNote: { fontSize: 10, fontFamily: fonts.body, color: palette.mutedForeground, textAlign: 'right', marginBottom: 4 },

  heatCell: { width: 14, height: 14, backgroundColor: palette.accent, marginRight: 1, borderRadius: 2 },
  heatCellActive: { backgroundColor: palette.primary },

  top3Card: { backgroundColor: palette.accent, borderRadius: radius.sm, padding: 12, marginTop: 8, gap: 4 },
  top3Title: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.accentForeground, marginBottom: 4 },
  top3Row: { fontSize: 13, fontFamily: fonts.bodySemibold, color: palette.foreground },

  table: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: palette.border },
  tableHeader: { flexDirection: 'row', backgroundColor: palette.accent, paddingVertical: 8 },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 10, backgroundColor: palette.card },
  tableCell: { flex: 1, textAlign: 'center', fontSize: 13, fontFamily: fonts.bodySemibold, color: palette.mutedForeground },
  tableCellLabel: { fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.accentForeground },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: palette.accent, borderWidth: 1, borderColor: '#D8B4FE' },
  chipExcl: { backgroundColor: palette.muted, borderColor: palette.border },
  chipText: { fontSize: 11, fontFamily: fonts.bodySemibold, color: palette.accentForeground, fontWeight: '600' },
  chipTextExcl: { color: palette.mutedForeground, textDecorationLine: 'line-through' },
});
