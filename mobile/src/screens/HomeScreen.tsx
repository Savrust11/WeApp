import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';

// Web grid: `grid grid-cols-3 gap-3 px-6 max-w-md` → 3 cols, gap 12, px 24,
// content capped at 448. Compute the exact tile width so it matches 1:1.
const GRID_MAX = 448;
const GRID_PAD = 24; // px-6
const GRID_GAP = 12; // gap-3
const GRID_W = Math.min(Dimensions.get('window').width, GRID_MAX);
const TILE_W = (GRID_W - GRID_PAD * 2 - GRID_GAP * 2) / 3;
// Custom-modal icon picker: web ActionButtons.tsx:3736 uses grid-cols-6 gap-2.
// Modal sheet has 20px horiz padding each side; 6 cols with 8px gaps.
const MODAL_ICON_GAP = 8;
const MODAL_ICON_W =
  (Math.min(Dimensions.get('window').width, GRID_MAX) - 40 - MODAL_ICON_GAP * 5) / 6;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  differenceInDays,
  differenceInMonths,
  differenceInMinutes,
  parseISO,
  addYears,
  addMinutes,
  format,
} from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { getLogs, createLog } from '../api/logs';
import { useToast } from '../components/Toast';
import { logRecordedToast } from '../utils/logToast';
import { getChildren } from '../api/children';
import {
  getActiveSleepSession, startSleepSession, endSleepSession, manualSleepEntry,
  type SleepSession,
} from '../api/sleepSessions';
import type { RootStackParamList } from '../navigation';
import { scheduleNextFeedingAlarm } from '../utils/alarmManager';
import { rebuildWidgetSnapshot } from '../utils/widgetCache';
import {
  Sprout, Leaf, TreePine, Apple, Moon, Heart, Milk, Droplets, Clock,
  ChevronRight, Zap, Bell, Users, Gem, GripVertical, EyeOff, Eye,
  CircleDot, Plus, X, Check, Trash2,
  Star, Smile, Sun, Gift, Music, BookOpen, Camera, Coffee, Footprints,
  Bike, Gamepad2, Sparkles, Baby, Bath, Cookie, Pencil, Flag, Bell as BellIcon,
  Cloud, Umbrella, Leaf as LeafIcon, Flower2, Palette, Puzzle, Car, Plane,
  TrainFront, Rocket, Crown, Trophy, Medal,
} from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import WeBoard from '../components/WeBoard';
import WeHeader from '../components/WeHeader';
import LogDialog, { type LogSaveData } from '../components/LogDialog';
import { useTheme } from '../contexts/ThemeContext';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { LogIcon, getLogVisual } from '../theme/logIcons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Phase definitions ────────────────────────────────────────────────────────
//
//  Phase 0: 乳児期       0–11 months
//  Phase 1: 幼児前期    12–23 months (1–2 years)
//  Phase 2: 幼児後期    24–47 months (2–4 years)
//  Phase 3: 就学準備期  48+  months  (4–6 years)
//
// Buttons hidden by default regardless of phase: 'moisturize', 'nail_cut'

interface LogButton { type: string; label: string; emoji: string; color: string; icon?: string }

export const PHASE_LABELS = [
  '乳児期 (0〜11ヶ月)',
  '幼児前期 (1〜2歳)',
  '幼児後期 (2〜4歳)',
  '就学準備期 (4〜6歳)',
];

/** Types hidden by default in ALL phases — user enables in ChildProfile */
// Web shows every phase action (incl. 保湿/爪切り) — nothing hidden by default.
export const HIDDEN_BY_DEFAULT = new Set<string>();

export const PHASE_BUTTONS: LogButton[][] = [
  // ── Phase 0: 乳児期 ─────────────────────────────────────────────────────
  [
    { type: 'milk',        label: 'ミルク',    emoji: '🍼', color: '#FFF8E1' },
    { type: 'expressed',   label: '搾乳',      emoji: '🍶', color: '#F3E5F5' },
    { type: 'diaper',      label: 'おむつ',    emoji: '🚼', color: '#E3F2FD' },
    { type: 'sleep',       label: 'ねんね',    emoji: '😴', color: '#EDE7F6' },
    { type: 'food',        label: '離乳食',    emoji: '🥣', color: '#E8F5E9' },
    { type: 'snack',       label: 'おやつ',    emoji: '🍪', color: '#FFF8E1' },
    { type: 'milestone',   label: 'はじめて',  emoji: '⭐', color: '#FFF9C4' },
    { type: 'bath',        label: 'おふろ',    emoji: '🛁', color: '#E0F7FA' },
    { type: 'play',        label: 'あそび',    emoji: '🎈', color: '#FCE4EC' },
    { type: 'hold',        label: '抱っこ',    emoji: '🤗', color: '#FFF0F5' },
    { type: 'walk',        label: 'お散歩',    emoji: '🚶', icon: 'Footprints', color: '#E8F5E9' },
    { type: 'drink',       label: 'のみもの',  emoji: '🥤', color: '#E3F2FD' },
    { type: 'school',      label: '園の記録',  emoji: '🏫', color: '#E8F5E9' },
    { type: 'toothbrush',  label: 'はみがき',  emoji: '🦷', color: '#E0F2F1' },
    { type: 'moisturize',  label: '保湿',      emoji: '💧', color: '#E3F2FD' },   // hidden by default
    { type: 'nail_cut',    label: '爪切り',    emoji: '✂️', color: '#F3E5F5' },   // hidden by default
    { type: 'medicine',    label: 'おくすり',  emoji: '💊', color: '#FCE4EC' },
    { type: 'temperature', label: 'たいおん',  emoji: '🌡️', color: '#FFF8E1' },
    { type: 'appointment', label: '通院',      emoji: '🏥', color: '#FCE4EC' },
    { type: 'thank_you',   label: 'ありがとう',emoji: '💌', color: '#FCE4EC' },
  ],

  // ── Phase 1: 幼児前期 ────────────────────────────────────────────────────
  [
    { type: 'meal',        label: 'ごはん',    emoji: '🍱', color: '#E8F5E9' },
    { type: 'milk',        label: 'ミルク',    emoji: '🍼', color: '#FFF8E1' },
    { type: 'snack',       label: 'おやつ',    emoji: '🍪', color: '#FFF8E1' },
    { type: 'toilet',      label: 'トイレ',    emoji: '🚽', color: '#E0F7FA' },
    { type: 'sleep',       label: 'ねんね',    emoji: '😴', color: '#EDE7F6' },
    { type: 'word',        label: 'ことば',    emoji: '💬', color: '#FFF9C4' },
    { type: 'bath',        label: 'おふろ',    emoji: '🛁', color: '#E0F7FA' },
    { type: 'diaper',      label: 'おむつ',    emoji: '🚼', color: '#E3F2FD' },
    { type: 'achievement', label: 'できた',    emoji: '🏆', color: '#FFF9C4' },
    { type: 'thank_you',   label: 'ありがとう',emoji: '💌', color: '#FCE4EC' },
    { type: 'play',        label: 'あそび',    emoji: '🎈', color: '#FCE4EC' },
    { type: 'milestone',   label: 'はじめて',  emoji: '⭐', color: '#FFF9C4' },
    { type: 'hold',        label: '抱っこ',    emoji: '🤗', color: '#FFF0F5' },
    { type: 'walk',        label: 'お散歩',    emoji: '🚶', icon: 'Footprints', color: '#E8F5E9' },
    { type: 'drink',       label: 'のみもの',  emoji: '🥤', color: '#E3F2FD' },
    { type: 'school',      label: '園の記録',  emoji: '🏫', color: '#E8F5E9' },
    { type: 'toothbrush',  label: 'はみがき',  emoji: '🦷', color: '#E0F2F1' },
    { type: 'moisturize',  label: '保湿',      emoji: '💧', color: '#E3F2FD' },
    { type: 'nail_cut',    label: '爪切り',    emoji: '✂️', color: '#F3E5F5' },
    { type: 'medicine',    label: 'おくすり',  emoji: '💊', color: '#FCE4EC' },
    { type: 'temperature', label: 'たいおん',  emoji: '🌡️', color: '#FFF8E1' },
    { type: 'appointment', label: '通院',      emoji: '🏥', color: '#FCE4EC' },
  ],

  // ── Phase 2: 幼児後期 ────────────────────────────────────────────────────
  [
    { type: 'meal',        label: 'ごはん',    emoji: '🍱', color: '#E8F5E9' },
    { type: 'snack',       label: 'おやつ',    emoji: '🍪', color: '#FFF8E1' },
    { type: 'toilet',      label: 'トイレ',    emoji: '🚽', color: '#E0F7FA' },
    { type: 'sleep',       label: 'ねんね',    emoji: '😴', color: '#EDE7F6' },
    { type: 'discipline',  label: 'しつけ',    emoji: '📖', color: '#E8F5E9' },
    { type: 'interest',    label: 'きょうみ',  emoji: '🌟', color: '#FFF9C4' },
    { type: 'achievement', label: 'できた！',  emoji: '🏆', color: '#FFF9C4' },
    { type: 'thank_you',   label: 'ありがとう',emoji: '💌', color: '#FCE4EC' },
    { type: 'milk',        label: 'ミルク',    emoji: '🍼', color: '#FFF8E1' },
    { type: 'diaper',      label: 'おむつ',    emoji: '🚼', color: '#E3F2FD' },
    { type: 'bath',        label: 'おふろ',    emoji: '🛁', color: '#E0F7FA' },
    { type: 'hold',        label: '抱っこ',    emoji: '🤗', color: '#FFF0F5' },
    { type: 'walk',        label: 'お散歩',    emoji: '🚶', icon: 'Footprints', color: '#E8F5E9' },
    { type: 'drink',       label: 'のみもの',  emoji: '🥤', color: '#E3F2FD' },
    { type: 'school',      label: '園の記録',  emoji: '🏫', color: '#E8F5E9' },
    { type: 'toothbrush',  label: 'はみがき',  emoji: '🦷', color: '#E0F2F1' },
    { type: 'moisturize',  label: '保湿',      emoji: '💧', color: '#E3F2FD' },
    { type: 'nail_cut',    label: '爪切り',    emoji: '✂️', color: '#F3E5F5' },
    { type: 'medicine',    label: 'おくすり',  emoji: '💊', color: '#FCE4EC' },
    { type: 'temperature', label: 'たいおん',  emoji: '🌡️', color: '#FFF8E1' },
    { type: 'appointment', label: '通院',      emoji: '🏥', color: '#FCE4EC' },
  ],

  // ── Phase 3: 就学準備期 ──────────────────────────────────────────────────
  [
    { type: 'meal',        label: 'ごはん',    emoji: '🍱', color: '#E8F5E9' },
    { type: 'sleep',       label: 'ねんね',    emoji: '😴', color: '#EDE7F6' },
    { type: 'school',      label: '園の記録',  emoji: '🏫', color: '#E8F5E9' },
    { type: 'discipline',  label: 'しつけ',    emoji: '📖', color: '#E8F5E9' },
    { type: 'schedule',    label: 'よてい',    emoji: '📅', color: '#E3F2FD' },
    { type: 'school_prep', label: '入学準備',  emoji: '🎒', color: '#E8F5E9' },
    { type: 'achievement', label: 'できた！',  emoji: '🏆', color: '#FFF9C4' },
    { type: 'thank_you',   label: 'ありがとう',emoji: '💌', color: '#FCE4EC' },
    { type: 'snack',       label: 'おやつ',    emoji: '🍪', color: '#FFF8E1' },
    { type: 'drink',       label: 'のみもの',  emoji: '🥤', color: '#E3F2FD' },
    { type: 'walk',        label: 'お散歩',    emoji: '🚶', icon: 'Footprints', color: '#E8F5E9' },
    { type: 'toothbrush',  label: 'はみがき',  emoji: '🦷', color: '#E0F2F1' },
    { type: 'moisturize',  label: '保湿',      emoji: '💧', color: '#E3F2FD' },
    { type: 'nail_cut',    label: '爪切り',    emoji: '✂️', color: '#F3E5F5' },
    { type: 'medicine',    label: 'おくすり',  emoji: '💊', color: '#FCE4EC' },
    { type: 'temperature', label: 'たいおん',  emoji: '🌡️', color: '#FFF8E1' },
    { type: 'appointment', label: '通院',      emoji: '🏥', color: '#FCE4EC' },
  ],
];

// ─── Phase helpers ────────────────────────────────────────────────────────────

export function getPhaseIndex(birthday: string | undefined): number {
  if (!birthday) return 0;
  const birth = new Date(birthday);
  if (isNaN(birth.getTime())) return 0;
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 12) return 0;
  if (months < 24) return 1;
  if (months < 48) return 2;
  return 3;
}

// ─── Custom button add modal — icon picker + named color swatches ───────────
// Color swatches (紫/青/緑/水/橙/桃/黄/赤) — soft tile bg + matching tint/border,
// mirroring the logIcons.tsx Tailwind-50/100/N convention used across the grid.
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

type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
// lucide icon picker grid — name persisted on the custom button
const ICON_OPTIONS: Array<{ name: string; Cmp: IconCmp }> = [
  { name: 'Sparkles', Cmp: Sparkles }, { name: 'Star', Cmp: Star },
  { name: 'Heart', Cmp: Heart },       { name: 'Smile', Cmp: Smile },
  { name: 'Sun', Cmp: Sun },           { name: 'Moon', Cmp: Moon },
  { name: 'Gift', Cmp: Gift },         { name: 'Music', Cmp: Music },
  { name: 'BookOpen', Cmp: BookOpen }, { name: 'Camera', Cmp: Camera },
  { name: 'Coffee', Cmp: Coffee },     { name: 'Footprints', Cmp: Footprints },
  { name: 'Bike', Cmp: Bike },         { name: 'Gamepad2', Cmp: Gamepad2 },
  { name: 'Baby', Cmp: Baby },         { name: 'Bath', Cmp: Bath },
  { name: 'Cookie', Cmp: Cookie },     { name: 'Apple', Cmp: Apple },
  { name: 'Milk', Cmp: Milk },         { name: 'Pencil', Cmp: Pencil },
  { name: 'Flag', Cmp: Flag },         { name: 'Bell', Cmp: BellIcon },
  { name: 'Cloud', Cmp: Cloud },       { name: 'Umbrella', Cmp: Umbrella },
  { name: 'Leaf', Cmp: LeafIcon },     { name: 'Flower2', Cmp: Flower2 },
  { name: 'Palette', Cmp: Palette },   { name: 'Puzzle', Cmp: Puzzle },
  { name: 'Car', Cmp: Car },           { name: 'Plane', Cmp: Plane },
  { name: 'TrainFront', Cmp: TrainFront }, { name: 'Rocket', Cmp: Rocket },
  { name: 'Crown', Cmp: Crown },       { name: 'Trophy', Cmp: Trophy },
  { name: 'Medal', Cmp: Medal },
];
const ICON_MAP: Record<string, IconCmp> = ICON_OPTIONS.reduce(
  (m, o) => { m[o.name] = o.Cmp; return m; },
  {} as Record<string, IconCmp>,
);
function CustomButtonIcon({
  icon, emoji, size = 20, color, strokeWidth = 2.5,
}: { icon?: string; emoji?: string; size?: number; color?: string; strokeWidth?: number }) {
  if (icon && ICON_MAP[icon]) {
    const Cmp = ICON_MAP[icon];
    return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
  }
  // Backward-compat: older custom buttons stored only an emoji
  return <Text style={{ fontSize: size }}>{emoji ?? '✨'}</Text>;
}

// Web Tailwind hex values referenced for the ported sections (same palette as logIcons.tsx)
const C = {
  gray400: '#9CA3AF',
  gray700: '#374151',
  gray100: '#F3F4F6',
  green50: '#F0FDF4',
  green400: '#4ADE80',
  green500: '#22C55E',
  emerald500: '#10B981',
  indigo50: '#EEF2FF',
  indigo100: '#E0E7FF',
  indigo200: '#C7D2FE',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  indigo800: '#3730A3',
  red500: '#EF4444',
  red600: '#DC2626',
  red700: '#B91C1C',
  pink50: '#FDF2F8',
  pink100: '#FCE7F3',
  pink200: '#FBCFE8',
  pink400: '#F472B6',
  pink500: '#EC4899',
  pink700: '#BE185D',
  blue50: '#EFF6FF',
  blue400: '#60A5FA',
  cyan50: '#ECFEFF',
  cyan500: '#06B6D4',
  amber50: '#FFFBEB',
  amber100: '#FEF3C7',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber700: '#B45309',
  teal50: '#F0FDFA',
  teal100: '#CCFBF1',
  teal400: '#2DD4BF',
  teal500: '#14B8A6',
  teal600: '#0D9488',
  teal800: '#115E59',
  purple50: '#FAF5FF',
  purple100: '#F3E8FF',
  purple200: '#E9D5FF',
  purple400: '#C084FC',
  purple500: '#A855F7',
  purple600: '#9333EA',
  purple700: '#7E22CE',
  purple800: '#6B21A8',
  primary: palette.primary,
} as const;

// Default feeding interval (mobile alarmManager DEFAULT_SETTINGS.intervalMinutes)
const FEEDING_INTERVAL_MIN = 180;

function showAlert(msg: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(msg);
  } else {
    Alert.alert(msg);
  }
}

// ─── Drag-to-reorder quick-log grid ──────────────────────────────────────────
//
// Mirrors WeYu/client ActionButtons.tsx arrange mode: while 並び替え is active
// the user picks a tile up (press-drag) and the order array reorders live as
// the finger moves over other tiles (web does this via pointer move + array
// splice — see onGripPointerMove). On drop the new order is committed to the
// existing `@weyu_btn_order_<childId>` AsyncStorage key by the parent through
// `onReorder`. No per-tile chevrons — WeYu has none.
//
// 3-column wrap grid: every tile is absolutely positioned at its slot
// (index → row/col). Non-dragged tiles animate (withTiming) to their slot when
// the order changes; the picked tile follows the finger via a Pan gesture.

type DragTile = {
  key: string;
  render: (dragging: boolean) => React.ReactNode;
};

function DraggableQuickGrid({
  tiles,
  order,
  tileWidth,
  gap,
  columns,
  onReorder,
}: {
  tiles: DragTile[];
  order: string[]; // ordered keys (parent-provided, == tiles order)
  tileWidth: number;
  gap: number;
  columns: number;
  onReorder: (keys: string[]) => void;
}) {
  // Live order during a drag (preview); resyncs from props when not dragging.
  const [liveOrder, setLiveOrder] = useState<string[]>(order);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [tileH, setTileH] = useState(96); // measured from first tile onLayout

  // Keep liveOrder in sync with the parent order whenever we're not dragging
  // (phase / visibility / custom changes, exit, etc.).
  useEffect(() => {
    if (!dragKey) setLiveOrder(order);
  }, [order, dragKey]);

  const tileByKey = useMemo(() => {
    const m = new Map<string, DragTile>();
    for (const t of tiles) m.set(t.key, t);
    return m;
  }, [tiles]);

  // Render in a stable key order so each tile keeps its own gesture/anim state;
  // its on-screen slot is derived from its index in liveOrder.
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

  const commit = (keys: string[]) => {
    setDragKey(null);
    onReorder(keys);
  };

  const moveLive = (key: string, toIdx: number) => {
    setLiveOrder((prev) => {
      const from = prev.indexOf(key);
      if (from === -1 || toIdx < 0 || toIdx >= prev.length || from === toIdx) {
        return prev;
      }
      const next = [...prev];
      next.splice(from, 1);
      next.splice(toIdx, 0, key);
      return next;
    });
  };

  return (
    <View
      style={{
        width: tileWidth * columns + gap * (columns - 1),
        height: gridHeight,
        alignSelf: 'center',
      }}
    >
      {tiles.map((t, renderIdx) => (
        <DraggableTile
          key={t.key}
          tile={t}
          measure={renderIdx === 0}
          onMeasure={setTileH}
          liveOrder={liveOrder}
          tileWidth={tileWidth}
          slotW={slotW}
          slotH={slotH}
          columns={columns}
          count={liveOrder.length}
          isDragging={dragKey === t.key}
          onPickUp={() => setDragKey(t.key)}
          onHover={(toIdx) => moveLive(t.key, toIdx)}
          onDrop={() => commit(liveOrder)}
          slotOf={slotOf}
        />
      ))}
    </View>
  );
}

function DraggableTile({
  tile,
  measure,
  onMeasure,
  liveOrder,
  tileWidth,
  slotW,
  slotH,
  columns,
  count,
  isDragging,
  onPickUp,
  onHover,
  onDrop,
  slotOf,
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

  // Base slot position (animated for non-dragged tiles when the order shifts).
  const baseX = useSharedValue(slot.x);
  const baseY = useSharedValue(slot.y);
  // Finger-follow translation while this tile is the one being dragged.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const active = useSharedValue(0);
  // Pan start origin (this tile's slot at pick-up) for hover-index math.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (isDragging) return; // dragged tile is driven by the gesture
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
      // Center of the dragged tile in grid space → nearest slot index.
      const cx = startX.value + e.translationX + tileWidth / 2;
      const cy = startY.value + e.translationY + (slotH / 2);
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
        onLayout={
          measure
            ? (ev) => onMeasure(ev.nativeEvent.layout.height)
            : undefined
        }
      >
        {tile.render(isDragging)}
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { activeChildId, activeChild, children, setChildren } = useChildStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const familyId = user?.familyId ?? 'default';
  const userId   = String(user?.id ?? '');
  const child    = activeChild();

  // ── Phase + button visibility ──────────────────────────────────────────────
  const phaseIndex = getPhaseIndex(child?.birthday);

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set(HIDDEN_BY_DEFAULT));

  useEffect(() => {
    if (!activeChildId) { setHiddenTypes(new Set(HIDDEN_BY_DEFAULT)); return; }
    AsyncStorage.getItem(`@weyu_btn_hidden_${activeChildId}`).then((stored) => {
      if (stored) {
        setHiddenTypes(new Set(JSON.parse(stored)));
      } else {
        // First time: persist the default hidden set
        const defaults = [...HIDDEN_BY_DEFAULT];
        AsyncStorage.setItem(`@weyu_btn_hidden_${activeChildId}`, JSON.stringify(defaults));
        setHiddenTypes(new Set(defaults));
      }
    });
  }, [activeChildId]);

  const visibleButtons = useMemo(
    () => PHASE_BUTTONS[phaseIndex].filter((b) => !hiddenTypes.has(b.type)),
    [phaseIndex, hiddenTypes],
  );

  // ── Quick-log reorder mode ─────────────────────────────────────────────────
  // Persist the user's chosen tile order per child under a key parallel to the
  // existing `@weyu_btn_hidden_<childId>` convention. `@weyu_btn_hidden_*` keeps
  // its exact meaning (hidden set); the order array is a NEW parallel key.
  const [reorderMode, setReorderMode] = useState(false);
  const [btnOrder, setBtnOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!activeChildId) { setBtnOrder([]); return; }
    AsyncStorage.getItem(`@weyu_btn_order_${activeChildId}`).then((stored) => {
      if (stored) {
        try { setBtnOrder(JSON.parse(stored)); return; } catch { /* ignore */ }
      }
      setBtnOrder([]);
    });
  }, [activeChildId]);

  // Apply the saved order; any new/visible types not yet in the order array are
  // appended (keeps the grid stable when phase/visibility changes).
  const phaseButtons = useMemo(() => {
    if (btnOrder.length === 0) return visibleButtons;
    const byType = new Map(visibleButtons.map((b) => [b.type, b]));
    const ordered: typeof visibleButtons = [];
    const seen = new Set<string>();
    for (const t of btnOrder) {
      const b = byType.get(t);
      if (b && !seen.has(t)) { ordered.push(b); seen.add(t); }
    }
    for (const b of visibleButtons) {
      if (!seen.has(b.type)) ordered.push(b);
    }
    return ordered;
  }, [visibleButtons, btnOrder]);

  const persistOrder = async (types: string[]) => {
    setBtnOrder(types);
    if (activeChildId) {
      await AsyncStorage.setItem(`@weyu_btn_order_${activeChildId}`, JSON.stringify(types));
    }
  };

  // ── Custom buttons ────────────────────────────────────────────────────────
  const [customButtons, setCustomButtons] = useState<
    Array<{ label: string; icon?: string; emoji?: string; color: string; type: string }>
  >([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [newBtnLabel, setNewBtnLabel] = useState('');
  const [newBtnIcon, setNewBtnIcon] = useState('Sparkles');
  const [newBtnColorId, setNewBtnColorId] = useState<string>(COLOR_SWATCHES[0].id);

  useEffect(() => {
    AsyncStorage.getItem('@weyu_custom_buttons').then((stored) => {
      if (stored) setCustomButtons(JSON.parse(stored));
    });
  }, []);

  // ── Log dialog ────────────────────────────────────────────────────────────
  const [activeLogType, setActiveLogType] = useState<string | null>(null);

  // ── Sleep session ─────────────────────────────────────────────────────────
  const [activeSleepSession, setActiveSleepSession] = useState<SleepSession | null>(null);

  const refreshActiveSleep = async () => {
    const session = await getActiveSleepSession(familyId);
    setActiveSleepSession(session);
  };

  useEffect(() => { if (familyId && familyId !== 'default') refreshActiveSleep(); }, [familyId]);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: childrenData } = useQuery({
    queryKey: ['children', familyId],
    queryFn: () => getChildren(familyId),
    enabled: !!familyId && familyId !== 'default',
  });

  useEffect(() => {
    if (childrenData && childrenData.length > 0) setChildren(childrenData);
  }, [childrenData]);

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['logs', familyId],
    queryFn: () => getLogs(familyId),
    enabled: !!familyId,
  });

  const FEEDING_TYPES = new Set(['breastfeed', 'formula', 'expressed', 'milk']);

  const createLogMutation = useMutation({
    mutationFn: createLog,
    onSuccess: (newLog) => {
      queryClient.invalidateQueries({ queryKey: ['logs', familyId] });
      if (FEEDING_TYPES.has(newLog.type)) {
        scheduleNextFeedingAlarm(new Date(newLog.createdAt)).catch(() => {});
      }
      const allLogs = queryClient.getQueryData<any[]>(['logs', familyId]) ?? [];
      rebuildWidgetSnapshot(allLogs, child?.name ?? null).catch(() => {});
      toast.show(logRecordedToast(newLog.type, newLog.points ?? 10));
    },
    onError: () => showAlert('記録の保存に失敗しました。'),
  });

  // ── Today stats + milk summary ────────────────────────────────────────────
  const todayLogs = useMemo(
    () => logs.filter((l) => new Date(l.createdAt).toDateString() === new Date().toDateString()),
    [logs],
  );

  const milkSummary = useMemo(() => {
    const breastCount   = todayLogs.filter((l) => l.type === 'breastfeed').length;
    const expressedCount = todayLogs.filter((l) => l.type === 'expressed').length;
    const formulaTotal  = todayLogs.filter((l) => l.type === 'formula').reduce((s, l) => s + (l.formulaMl ?? 0), 0);
    const expressedTotal = todayLogs.filter((l) => l.type === 'expressed').reduce((s, l) => s + (l.expressedMl ?? 0), 0);
    return { breastCount: breastCount + expressedCount, formulaTotal, expressedTotal };
  }, [todayLogs]);

  // ── Growth math — ported from web Home.tsx:42-58,224 ──────────────────────
  const birthdayStr = child?.birthday;
  const birthday = birthdayStr ? parseISO(birthdayStr) : new Date();
  const firstBirthday = addYears(birthday, 1);
  const daysOld = Math.max(0, differenceInDays(new Date(), birthday));
  const daysUntilBirthday = Math.max(0, differenceInDays(firstBirthday, new Date()));
  const childAgeMonths = birthdayStr ? differenceInMonths(new Date(), parseISO(birthdayStr)) : 0;
  const childAgeYears = Math.floor(childAgeMonths / 12);
  const childAgeRemMonths = childAgeMonths % 12;
  const ageDisplay = childAgeMonths < 12
    ? `${childAgeMonths}ヶ月`
    : childAgeRemMonths === 0
    ? `${childAgeYears}歳`
    : `${childAgeYears}歳${childAgeRemMonths}ヶ月`;
  const agePhase: 'infant' | 'toddler' | 'kids' =
    childAgeMonths < 12 ? 'infant' : childAgeMonths < 48 ? 'toddler' : 'kids';
  const ageLabel =
    agePhase === 'infant' ? 'すくすく成長中' : agePhase === 'toddler' ? 'ぐんぐん成長中' : 'もうすぐ小学生';
  // web Home.tsx:224 — GrowthIcon by days old
  const GrowthIcon = daysOld < 100 ? Sprout : daysOld < 200 ? Leaf : daysOld < 300 ? TreePine : Apple;
  const growthPct = Math.min(100, (daysOld / 365) * 100);

  // ── Today's summary — ported from web Home.tsx:151-189 ────────────────────
  const months = childAgeMonths;
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // sleep minutes — web Home.tsx:170-183 uses sleep sessions; mobile uses sleep
  // logs (no session list query). Approximate: 'sleep' logs today × est duration
  // is unreliable, so we sum any memo'd minutes and otherwise count today's
  // 'sleep' log durations from active session if running.
  const todaySleepMinutes = useMemo(() => {
    const sleepLogs = logs.filter(
      (l) => l.type === 'sleep' && new Date(l.createdAt) >= todayStart,
    );
    let total = 0;
    for (const l of sleepLogs) {
      const m = l.memo ? parseInt(String(l.memo).replace(/[^0-9]/g, ''), 10) : NaN;
      if (!isNaN(m)) total += m;
    }
    if (
      activeSleepSession?.startedAt &&
      !activeSleepSession?.endedAt &&
      new Date(activeSleepSession.startedAt) >= todayStart
    ) {
      total += Math.max(0, differenceInMinutes(new Date(), new Date(activeSleepSession.startedAt)));
    }
    return total;
  }, [logs, todayStart, activeSleepSession]);

  const todayBreastCount = useMemo(
    () =>
      logs.filter(
        (l) =>
          (l.type === 'breastfeed' || (l.type === 'milk' && (l.breastLeftMin || l.breastRightMin))) &&
          new Date(l.createdAt) >= todayStart,
      ).length,
    [logs, todayStart],
  );

  const todayMilkMl = useMemo(() => {
    const milkLogs = logs.filter(
      (l) => (l.type === 'milk' || l.type === 'formula' || l.type === 'expressed') &&
        new Date(l.createdAt) >= todayStart,
    );
    return milkLogs.reduce((s, l) => s + (l.formulaMl ?? 0) + (l.expressedMl ?? 0), 0);
  }, [logs, todayStart]);

  // web Home.tsx:169-175 — milk breakdown (粉/搾) shown under ミルク stat
  const todayFormulaMl = useMemo(() => {
    return logs
      .filter(
        (l) => (l.type === 'milk' || l.type === 'formula') &&
          new Date(l.createdAt) >= todayStart,
      )
      .reduce((s, l) => s + (l.formulaMl ?? 0), 0);
  }, [logs, todayStart]);

  const todayExpressedMl = useMemo(() => {
    return logs
      .filter(
        (l) => (l.type === 'milk' || l.type === 'expressed') &&
          new Date(l.createdAt) >= todayStart,
      )
      .reduce((s, l) => s + (l.expressedMl ?? 0), 0);
  }, [logs, todayStart]);

  const todayPeeCount = useMemo(
    () =>
      logs.filter(
        (l) =>
          (l.type === 'diaper' || l.type.startsWith('diaper')) &&
          new Date(l.createdAt) >= todayStart &&
          l.poopColor == null && l.poopConsistency == null,
      ).length,
    [logs, todayStart],
  );

  const todayPoopCount = useMemo(
    () =>
      logs.filter(
        (l) =>
          (l.type === 'diaper' || l.type.startsWith('diaper')) &&
          new Date(l.createdAt) >= todayStart &&
          (l.poopColor != null || l.poopConsistency != null),
      ).length,
    [logs, todayStart],
  );

  // ── Next feeding — last feeding + interval (mobile alarmManager default) ──
  const lastFeeding = useMemo(() => {
    const feeds = logs
      .filter((l) => l.type === 'breastfeed' || l.type === 'formula' || l.type === 'expressed' || l.type === 'milk')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return feeds[0] ?? null;
  }, [logs]);

  const lastFeedingBothSides = !!(
    lastFeeding && (lastFeeding.breastLeftMin ?? 0) > 0 && (lastFeeding.breastRightMin ?? 0) > 0
  );

  const nextFeedingTime = useMemo(() => {
    if (!lastFeeding) return null;
    return addMinutes(new Date(lastFeeding.createdAt), FEEDING_INTERVAL_MIN);
  }, [lastFeeding]);

  const minutesUntilFeeding = useMemo(() => {
    if (!nextFeedingTime) return null;
    return differenceInMinutes(nextFeedingTime, new Date());
  }, [nextFeedingTime]);

  const feedingMessage = useMemo(() => {
    if (!nextFeedingTime) return 'まだ授乳の記録がありません';
    if (minutesUntilFeeding === null) return '';
    if (minutesUntilFeeding <= 0) return 'そろそろ授乳の時間です';
    if (minutesUntilFeeding <= 30) return 'もうすぐ授乳の時間です';
    return `次の授乳まであと約${minutesUntilFeeding}分`;
  }, [nextFeedingTime, minutesUntilFeeding]);

  // ── Wake window / next nap — ported from web Home.tsx:96-149 ──────────────
  const [wakeTick, setWakeTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setWakeTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const isSleeping = !!(activeSleepSession?.id && !activeSleepSession?.endedAt);

  // last completed sleep — derived from latest 'sleep' log when not sleeping
  const lastSleepLog = useMemo(() => {
    const slept = logs
      .filter((l) => l.type === 'sleep')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return slept[0] ?? null;
  }, [logs]);

  const wakeMinutes = useMemo(() => {
    if (!lastSleepLog || isSleeping) return 0;
    // wakeTick referenced so this recomputes on the 30s timer
    void wakeTick;
    return Math.max(0, differenceInMinutes(new Date(), new Date(lastSleepLog.createdAt)));
  }, [lastSleepLog, isSleeping, wakeTick]);

  // web Home.tsx:101-108
  const wakeWindowMinutes = useMemo(() => {
    if (months <= 1) return { min: 40, max: 60 };
    if (months <= 3) return { min: 60, max: 80 };
    if (months <= 6) return { min: 90, max: 120 };
    if (months <= 9) return { min: 120, max: 180 };
    if (months <= 12) return { min: 180, max: 240 };
    return { min: 240, max: 300 };
  }, [months]);

  const nextNapTime = useMemo(() => {
    if (!lastSleepLog || isSleeping) return null;
    return addMinutes(new Date(lastSleepLog.createdAt), wakeWindowMinutes.max);
  }, [lastSleepLog, isSleeping, wakeWindowMinutes]);

  const minutesUntilNap = useMemo(() => {
    if (!nextNapTime) return null;
    void wakeTick;
    return differenceInMinutes(nextNapTime, new Date());
  }, [nextNapTime, wakeTick]);

  // web Home.tsx:121-149
  const wakeWindowAlert = useMemo(() => {
    if (!lastSleepLog || isSleeping || wakeMinutes < 0) return null;
    const warnMin = wakeWindowMinutes.min;
    const maxMin = wakeWindowMinutes.max;
    const preWarnMin = Math.max(warnMin, maxMin - 15);
    if (wakeMinutes >= maxMin) {
      return {
        level: 'urgent' as const,
        message: '活動限界です。すぐに寝室を暗くして、ねんねの体勢に入りましょう。',
      };
    }
    if (wakeMinutes >= preWarnMin) {
      return {
        level: 'warning' as const,
        message: 'あと15分ほどで活動限界です。そろそろ寝室を暗くする準備を始めましょう。',
      };
    }
    if (wakeMinutes >= warnMin) {
      return {
        level: 'info' as const,
        message: 'そろそろねんねの準備を始めてもよい頃です。',
      };
    }
    return null;
  }, [wakeMinutes, lastSleepLog, isSleeping, wakeWindowMinutes]);

  const [wakeHidden, setWakeHidden] = useState(false);

  // ── Team power / total points — ported from web Home.tsx:39-48 ────────────
  const totalPoints = useMemo(
    () => logs.reduce((sum: number, log: any) => sum + (log.points || 0), 0),
    [logs],
  );
  const thanksCount = useMemo(
    () => logs.filter((l) => l.type === 'thanks' || l.type === 'thank_you').length,
    [logs],
  );
  const teamPower = Math.round((totalPoints + thanksCount * 5) / Math.max(1, daysOld));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogPress = async (type: string) => {
    if (!activeChildId) { showAlert('子どもを選択してください'); return; }
    // Refresh active sleep session right before opening sleep dialog
    if (type === 'sleep') await refreshActiveSleep();
    setActiveLogType(type);
  };

  const partnerUserId = user?.role === 'mama' ? 'papa' : 'mama';

  const handleLogSave = (data: LogSaveData) => {
    if (!activeChildId) return;
    setActiveLogType(null);

    const base = {
      type:     data.type,
      childId:  activeChildId,
      familyId: String(familyId),
      points:   1,
      memo:     data.memo,
      bodyTemperature: data.bodyTemperature,
      formulaMl:       data.formulaMl,
      expressedMl:     data.expressedMl,
      breastLeftMin:   data.breastLeftMin,
      breastRightMin:  data.breastRightMin,
      symptoms:        data.symptoms,
    } as any;

    if (data.medicineName) {
      base.medicineName = data.medicineName;
      base.medicineDose = data.memo;
      delete base.memo;
    }

    // For sleep with no active session, start a new sleep session tracking
    if (data.type === 'sleep' && !activeSleepSession) {
      startSleepSession({ familyId, createdBy: userId, childId: activeChildId })
        .then(setActiveSleepSession)
        .catch(() => {});
    }

    data.assignees.forEach((a) => {
      const uid = a === 'self' ? userId : a === 'partner' ? partnerUserId : 'other';
      createLogMutation.mutate({ ...base, userId: uid });
    });
  };

  const handleEndSleepSession = async (sessionId: number) => {
    try {
      await endSleepSession(sessionId);
      setActiveSleepSession(null);
      // Create a sleep log entry
      if (activeChildId) {
        createLogMutation.mutate({
          type: 'sleep', childId: activeChildId,
          familyId: String(familyId), userId, points: 1,
        } as any);
      }
    } catch {
      showAlert('終了の記録に失敗しました。');
    }
  };

  const handleManualSleep = async (data: { durationMin: number; startedAt: string }) => {
    if (!activeChildId) return;
    try {
      await manualSleepEntry({ familyId, createdBy: userId, childId: activeChildId, ...data });
      setActiveSleepSession(null);
      createLogMutation.mutate({
        type: 'sleep', childId: activeChildId,
        familyId: String(familyId), userId, points: 1,
        memo: `${data.durationMin}分`,
      } as any);
    } catch {
      showAlert('睡眠記録の保存に失敗しました。');
    }
  };

  const handleCustomButtonPress = (btn: { label: string }) => {
    if (!activeChildId) { showAlert('子どもを選択してください'); return; }
    createLogMutation.mutate({
      type: 'custom', childId: activeChildId, familyId: String(familyId),
      userId, points: 1, memo: btn.label,
    } as any);
  };

  const handleCustomButtonLongPress = (index: number) => {
    const doRemove = async () => {
      const updated = customButtons.filter((_, i) => i !== index);
      setCustomButtons(updated);
      await AsyncStorage.setItem('@weyu_custom_buttons', JSON.stringify(updated));
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`「${customButtons[index].label}」を削除しますか？`)) doRemove();
    } else {
      Alert.alert('削除しますか？', customButtons[index].label, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: doRemove },
      ]);
    }
  };

  const closeCustomModal = () => {
    setShowCustomModal(false);
    setNewBtnLabel('');
    setNewBtnIcon('Sparkles');
    setNewBtnColorId(COLOR_SWATCHES[0].id);
  };

  const handleAddCustomButton = async () => {
    if (!newBtnLabel.trim()) { showAlert('名前を入力してください'); return; }
    const swatch = COLOR_SWATCHES.find((s) => s.id === newBtnColorId) ?? COLOR_SWATCHES[0];
    const newBtn = {
      label: newBtnLabel.trim(),
      icon: newBtnIcon,
      color: swatch.id,
      type: 'custom',
    };
    const updated = [...customButtons, newBtn];
    setCustomButtons(updated);
    await AsyncStorage.setItem('@weyu_custom_buttons', JSON.stringify(updated));
    closeCustomModal();
  };

  // Resolve a stored custom-button color → swatch. Older buttons may have a hex
  // string under `color`; map those back, else fall back to the first swatch.
  const resolveSwatch = (color: string): SwatchColor =>
    COLOR_SWATCHES.find((s) => s.id === color || s.soft === color) ?? COLOR_SWATCHES[0];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchLogs();
    setRefreshing(false);
  };

  const fmtTime = (d: Date) => format(d, 'H:mm');

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.container, isDark && { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 1. Header (web-parity component) */}
      <WeHeader />

      {/* Child selector */}
      {(childrenData ?? []).length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childScroll}>
          {childrenData!.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, activeChildId === c.id && styles.childChipActive]}
              onPress={() => useChildStore.getState().setActiveChildId(c.id)}
            >
              <Text style={styles.childChipText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 2. すくすく成長中 card — web Home.tsx:265-295 */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.growthCard, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => child?.id != null && navigation.navigate('ChildProfile', { childId: child.id })}
      >
        <View style={styles.growthTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tinyLabel}>{ageLabel}</Text>
            <Text style={styles.growthAge}>
              現在{' '}
              <Text style={[styles.growthAgeBig, { color: child?.color || C.primary }]}>
                生後{ageDisplay}
              </Text>
            </Text>
          </View>
          <View style={styles.growthIconCircle}>
            <GrowthIcon size={24} color={C.green500} strokeWidth={2.5} />
          </View>
        </View>
        {agePhase === 'infant' && daysUntilBirthday > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.growthDays}>1歳の誕生日まであと{daysUntilBirthday}日</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${growthPct}%` }]} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* 3. TODAY'S SUMMARY card — web Home.tsx:344-451 (5-stat infant row) */}
      <View style={[styles.summaryCard, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.uppercaseLabel}>Today's Summary</Text>
        <View style={styles.summaryRow}>
          {/* 睡眠 — web: bg-indigo-50 / Moon text-indigo-500 */}
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIconCircle, { backgroundColor: C.indigo50 }]}>
              <Moon size={14} color={C.indigo500} strokeWidth={2.5} />
            </View>
            <Text style={styles.summaryNumber}>
              {todaySleepMinutes >= 60 ? (
                <>
                  {Math.floor(todaySleepMinutes / 60)}
                  <Text style={styles.summaryUnit}>h</Text>
                  {todaySleepMinutes % 60 > 0 ? (
                    <>
                      {todaySleepMinutes % 60}
                      <Text style={styles.summaryUnit}>m</Text>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {todaySleepMinutes}
                  <Text style={styles.summaryUnit}>m</Text>
                </>
              )}
            </Text>
            <Text style={styles.summaryLabel}>睡眠</Text>
          </View>

          {/* 母乳 — web: bg-pink-50 / Heart text-pink-400 */}
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIconCircle, { backgroundColor: C.pink50 }]}>
              <Heart size={14} color={C.pink400} strokeWidth={2.5} />
            </View>
            <Text style={styles.summaryNumber}>
              {todayBreastCount}
              <Text style={styles.summaryUnit}>回</Text>
            </Text>
            <Text style={styles.summaryLabel}>母乳</Text>
          </View>

          {/* ミルク — web: bg-blue-50 / Milk text-blue-400 + 粉/搾 breakdown */}
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIconCircle, { backgroundColor: C.blue50 }]}>
              <Milk size={14} color={C.blue400} strokeWidth={2.5} />
            </View>
            <Text style={styles.summaryNumber}>
              {todayMilkMl}
              <Text style={styles.summaryUnit}>ml</Text>
            </Text>
            {todayFormulaMl > 0 && todayExpressedMl > 0 ? (
              <Text style={styles.summaryBreakdown}>
                粉{todayFormulaMl}/搾{todayExpressedMl}
              </Text>
            ) : (
              <Text style={styles.summaryLabel}>
                {todayFormulaMl > 0 ? '粉' : todayExpressedMl > 0 ? '搾乳' : 'ミルク'}
              </Text>
            )}
          </View>

          {/* おしっこ — web: bg-blue-50 / Droplets text-blue-400, value text-blue-600 */}
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIconCircle, { backgroundColor: C.blue50 }]}>
              <Droplets size={14} color={C.blue400} strokeWidth={2.5} />
            </View>
            <Text style={[styles.summaryNumber, { color: '#2563EB' }]}>{todayPeeCount}</Text>
            <Text style={styles.summaryLabel}>おしっこ</Text>
          </View>

          {/* うんち — web: bg-amber-50 / CircleDot text-amber-500, value text-amber-600 */}
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIconCircle, { backgroundColor: C.amber50 }]}>
              <CircleDot size={14} color={C.amber500} strokeWidth={2.5} />
            </View>
            <Text style={[styles.summaryNumber, { color: C.amber600 }]}>{todayPoopCount}</Text>
            <Text style={styles.summaryLabel}>うんち</Text>
          </View>
        </View>
      </View>

      {/* 4. NEXT FEEDING card — web Home.tsx:454-505 (overdue / soon / time states) */}
      {lastFeeding && (() => {
        const isOverdue = minutesUntilFeeding !== null && minutesUntilFeeding <= 0;
        const isSoon =
          minutesUntilFeeding !== null && minutesUntilFeeding > 0 && minutesUntilFeeding < 30;
        return (
          <View
            style={[
              styles.nextFeedCard,
              // Origin dark: bg-pink-950/60 / bg-amber-950/60 with pink-800 / amber-800 borders
              isOverdue
                ? isDark
                  ? { backgroundColor: '#500724CC', borderColor: '#9D174D' }
                  : { backgroundColor: C.pink50, borderColor: C.pink200 }
                : isSoon
                ? isDark
                  ? { backgroundColor: '#451A03CC', borderColor: '#92400E' }
                  : { backgroundColor: C.amber50, borderColor: C.amber100 }
                : isDark
                ? { backgroundColor: '#50072499', borderColor: '#831843' }
                : { backgroundColor: '#FDF2F899', borderColor: C.pink100 },
            ]}
          >
            <View style={styles.nextFeedTopRow}>
              <View style={styles.cardIconRow}>
                <View
                  style={[
                    styles.feedIconBadge,
                    { backgroundColor: isOverdue ? C.pink200 : C.pink100 },
                  ]}
                >
                  <Heart size={18} color={C.pink500} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.uppercaseLabel, { marginBottom: 2 }]}>Next Feeding</Text>
                  <Text
                    style={[
                      styles.nextFeedMsg,
                      isOverdue
                        ? { color: '#DB2777' }
                        : isSoon
                        ? { color: C.amber700 }
                        : { color: C.pink700 },
                    ]}
                  >
                    {feedingMessage}
                  </Text>
                  {nextFeedingTime && (
                    <Text style={styles.nextFeedDetail}>
                      予定 {fmtTime(nextFeedingTime)}・前回 {fmtTime(new Date(lastFeeding.createdAt))}
                      {lastFeedingBothSides ? (
                        <Text style={{ color: C.pink500 }}>（両側）</Text>
                      ) : null}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        );
      })()}

      {/* 5. WAKE WINDOW card — web Home.tsx:543-629 (purple=urgent / indigo=warning|info)
              Dark values ported from origin dark: classes:
                urgent bg → bg-purple-950/60  #3B076499
                warning  → bg-indigo-950/60   #1E1B4B99
                info     → bg-indigo-950/50   #1E1B4B80
                urgent border → dark:border-purple-800  #6B21A8
                warning/info border → dark:border-indigo-800  #3730A3 */}
      {lastSleepLog && !isSleeping && !wakeHidden && (
        <View
          style={[
            styles.wakeCard,
            wakeWindowAlert?.level === 'urgent'
              ? isDark
                ? { backgroundColor: '#3B076499', borderColor: '#6B21A8' }
                : { backgroundColor: '#FAF5FFCC', borderColor: C.purple200 }
              : wakeWindowAlert?.level === 'warning'
              ? isDark
                ? { backgroundColor: '#1E1B4B99', borderColor: '#3730A3' }
                : { backgroundColor: '#EEF2FFCC', borderColor: C.indigo200 }
              : isDark
              ? { backgroundColor: '#1E1B4B80', borderColor: '#3730A3' }
              : { backgroundColor: '#FFFFFF99', borderColor: C.indigo100 },
          ]}
        >
          <View style={styles.cardIconRow}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor:
                    wakeWindowAlert?.level === 'urgent'
                      ? C.purple100
                      : wakeWindowAlert?.level === 'warning'
                      ? C.indigo100
                      : C.indigo50,
                },
              ]}
            >
              <Clock
                size={18}
                strokeWidth={2.5}
                color={
                  wakeWindowAlert?.level === 'urgent'
                    ? C.purple500
                    : C.indigo500
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uppercaseLabel}>Wake Window</Text>
              <Text style={styles.wakeTime}>
                {Math.floor(wakeMinutes / 60) > 0 ? `${Math.floor(wakeMinutes / 60)}時間` : ''}
                {wakeMinutes % 60}分 起きてます
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setWakeHidden(true)}
              style={styles.eyeToggle}
              accessibilityLabel="非表示にする"
            >
              <EyeOff size={16} color="#D1D5DB" />
            </TouchableOpacity>
          </View>

          {nextNapTime && (
            <View
              style={[
                styles.napBox,
                wakeWindowAlert?.level === 'urgent'
                  ? isDark ? { backgroundColor: '#581C8766' } : { backgroundColor: '#F3E8FF99' }
                  : wakeWindowAlert?.level === 'warning'
                  ? isDark ? { backgroundColor: '#31278166' } : { backgroundColor: '#E0E7FF99' }
                  : isDark ? { backgroundColor: '#1E1B4B99' } : { backgroundColor: '#EEF2FFCC' },
              ]}
            >
              <View style={styles.napRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Moon
                    size={14}
                    color={
                      wakeWindowAlert?.level === 'urgent'
                        ? C.purple400
                        : C.indigo400
                    }
                  />
                  <Text style={styles.napLabel}>次のねんね予想</Text>
                </View>
                <Text
                  style={[
                    styles.napTime,
                    {
                      color:
                        wakeWindowAlert?.level === 'urgent'
                          ? C.purple700
                          : C.indigo700,
                    },
                  ]}
                >
                  {fmtTime(nextNapTime)}ごろ
                </Text>
              </View>
              {minutesUntilNap !== null && minutesUntilNap > 0 && (
                <Text style={styles.napCountdown}>あと約{minutesUntilNap}分</Text>
              )}
              {minutesUntilNap !== null && minutesUntilNap <= 0 && (
                <Text style={[styles.napCountdown, { color: C.purple500 }]}>
                  予想時刻が過ぎました。焦らず大丈夫です。
                </Text>
              )}
            </View>
          )}

          {wakeWindowAlert && (
            <View
              style={[
                styles.wakeAdviceBox,
                {
                  borderTopColor:
                    wakeWindowAlert.level === 'urgent'
                      ? C.purple200
                      : wakeWindowAlert.level === 'warning'
                      ? C.indigo200
                      : C.indigo100,
                },
              ]}
            >
              <Text
                style={[
                  styles.wakeAdvice,
                  {
                    color:
                      wakeWindowAlert.level === 'urgent'
                        ? C.purple600
                        : C.indigo600,
                  },
                ]}
              >
                {wakeWindowAlert.message}
              </Text>
            </View>
          )}
        </View>
      )}
      {lastSleepLog && !isSleeping && wakeHidden && (
        <TouchableOpacity style={styles.wakeShowRow} onPress={() => setWakeHidden(false)}>
          <Eye size={14} color={C.gray400} />
          <Text style={styles.wakeShowText}>活動時間を表示する</Text>
        </TouchableOpacity>
      )}

      {/* Phase badge */}
      <View style={styles.phaseBadgeRow}>
        <View style={styles.phaseBadge}>
          <Text style={styles.phaseBadgeText}>
            {child?.birthday ? `🔄 ${PHASE_LABELS[phaseIndex]}` : '誕生日を設定すると月齢に合ったボタンが表示されます'}
          </Text>
        </View>
      </View>

      {/* 6. クイックログ heading (web Home.tsx:521-523) + tile grid + reorder */}
      <View style={styles.quickLogHeader}>
        <Text style={styles.quickLogTitle}>クイックログ</Text>
        {reorderMode ? (
          <TouchableOpacity
            style={[styles.reorderBtn, styles.reorderDoneBtn]}
            onPress={() => setReorderMode(false)}
          >
            <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={[styles.reorderText, styles.reorderDoneText]}>完了</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.reorderBtn}
            onPress={() => setReorderMode(true)}
          >
            <GripVertical size={14} color={palette.mutedForeground} />
            <Text style={styles.reorderText}>並び替え</Text>
          </TouchableOpacity>
        )}
      </View>
      {reorderMode ? (
        /* 並び替え mode — drag-to-reorder grid. Mirrors WeYu ActionButtons.tsx:
           the white badge shows GripVertical (no chevrons) and tiles are
           draggable; the new order persists to @weyu_btn_order_<childId>
           via persistOrder. */
        <View style={styles.dragGridWrap}>
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
                render: (dragging: boolean) => (
                  <View
                    style={[
                      styles.logButton,
                      { width: TILE_W },
                      isDark
                        ? [styles.logButtonDark, { backgroundColor: colors.card, borderColor: colors.border }]
                        : { backgroundColor: v.soft, borderColor: v.bord },
                      dragging && styles.logButtonDragging,
                    ]}
                  >
                    <View style={[styles.logBadge, isDark && { backgroundColor: colors.cardAlt, shadowOpacity: 0 }]}>
                      <GripVertical size={20} color={C.gray400} strokeWidth={2} />
                    </View>
                    <Text
                      style={[styles.logLabel, { color: isDark ? colors.text : v.tint }]}
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
        <View style={styles.buttonGrid}>
          {phaseButtons.map((btn) => {
            const v = getLogVisual(btn.type);
            return (
              <TouchableOpacity
                key={btn.type}
                style={[
                  styles.logButton,
                  { width: TILE_W },
                  isDark
                    ? [styles.logButtonDark, { backgroundColor: colors.card, borderColor: colors.border }]
                    : { backgroundColor: v.soft, borderColor: v.bord },
                ]}
                onPress={() => handleLogPress(btn.type)}
                disabled={createLogMutation.isPending}
                activeOpacity={0.85}
              >
                <View style={[styles.logBadge, isDark && { backgroundColor: colors.cardAlt, shadowOpacity: 0 }]}>
                  <LogIcon
                    type={btn.type}
                    size={20}
                    strokeWidth={2.5}
                    color={isDark ? colors.text : v.tint}
                  />
                </View>
                <Text
                  style={[styles.logLabel, { color: isDark ? colors.text : v.tint }]}
                  numberOfLines={1}
                >
                  {btn.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* カスタム sub-grid — web ActionButtons.tsx:1173-1233. Custom buttons +
          the dashed "+ 追加" tile (sort mode only) live here, BELOW every
          quick-log tile. This replaces the old standalone カスタムボタン
          add section so the dashed tile is the ONLY add affordance. */}
      {(customButtons.length > 0 || reorderMode) && (
        <View style={styles.customGridWrap}>
          <Text style={styles.customGridLabel}>カスタム</Text>
          <View style={styles.buttonGrid}>
            {customButtons.map((btn, index) => {
              const sw = resolveSwatch(btn.color);
              return (
                <View key={`custom-${index}`} style={[styles.customTileWrap, { width: TILE_W }]}>
                  <TouchableOpacity
                    style={[
                      styles.logButton,
                      { width: TILE_W },
                      { backgroundColor: isDark ? colors.card : sw.soft, borderColor: isDark ? colors.border : sw.bord },
                      isDark && styles.logButtonDark,
                    ]}
                    onPress={() => reorderMode ? undefined : handleCustomButtonPress(btn)}
                    onLongPress={() => handleCustomButtonLongPress(index)}
                    disabled={reorderMode || createLogMutation.isPending}
                    activeOpacity={reorderMode ? 1 : 0.85}
                  >
                    <View style={[styles.logBadge, isDark && { backgroundColor: colors.cardAlt, shadowOpacity: 0 }]}>
                      {reorderMode ? (
                        <GripVertical size={20} color={C.gray400} strokeWidth={2} />
                      ) : (
                        <CustomButtonIcon
                          icon={btn.icon}
                          emoji={btn.emoji}
                          size={20}
                          strokeWidth={2.5}
                          color={isDark ? colors.text : sw.tint}
                        />
                      )}
                    </View>
                    <Text
                      style={[styles.logLabel, { color: isDark ? colors.text : sw.tint }]}
                      numberOfLines={1}
                    >
                      {btn.label}
                    </Text>
                  </TouchableOpacity>

                  {/* web ActionButtons.tsx:1185-1193 — sort-mode-only red
                      circular delete badge at the tile's top-right corner;
                      tapping it removes the custom button (existing logic). */}
                  {reorderMode && (
                    <TouchableOpacity
                      style={styles.customDeleteBadge}
                      onPress={() => handleCustomButtonLongPress(index)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={12} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* dashed "+ 追加" tile — web ActionButtons.tsx:1217-1230.
                Sort-mode-only, after the last custom tile / below the grid. */}
            {reorderMode && customButtons.length < 10 && (
              <TouchableOpacity
                style={[styles.logButton, styles.addTile, { width: TILE_W }]}
                onPress={() => setShowCustomModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.addTileBadge}>
                  <Plus size={20} color={C.gray400} strokeWidth={2.5} />
                </View>
                <Text style={styles.addTileLabel} numberOfLines={1}>追加</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 8. 24時間タイムライン entry — web Home.tsx:527-544 */}
      <TouchableOpacity
        style={styles.timelineCard}
        activeOpacity={0.85}
        onPress={() =>
          (navigation as any).navigate('Timeline')
        }
      >
        <View style={[styles.iconCircle, { backgroundColor: C.indigo100 }]}>
          <Clock size={18} color={C.indigo600} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>24時間タイムライン</Text>
          <Text style={styles.featureSub}>睡眠・ミルク・おむつを一目で確認</Text>
        </View>
        <ChevronRight size={16} color={C.purple400} />
      </TouchableOpacity>

      {/* 9. TEAM POWER / TOTAL POINTS — web Home.tsx:546-561 */}
      <View style={styles.teamPowerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Zap size={22} color={C.purple500} strokeWidth={2.5} />
          <View>
            <Text style={styles.uppercaseLabel}>TEAM POWER</Text>
            <Text style={styles.teamPowerNum}>{teamPower}</Text>
          </View>
        </View>
        <View style={styles.teamDivider} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.uppercaseLabel}>TOTAL POINTS</Text>
          <Text style={styles.teamPowerNum}>{totalPoints} pt</Text>
        </View>
      </View>

      {/* 10. 泣き止みレスキュー SOS — mirrors web SosButton.tsx (→ rescue) */}
      <View style={styles.sosWrap}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.sosCircle}
          onPress={() => navigation.navigate('Alarm')}
        >
          <View style={styles.sosInner}>
            <Bell size={40} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={styles.sosTitle}>泣き止み{'\n'}レスキュー</Text>
          <View style={styles.sosBadge}>
            <Text style={styles.sosBadgeText}>🚨 SOS</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 11. Feature cards — web Home.tsx:707-776. Each card uses WeYu's exact
          per-shade Tailwind values: card bg -50, badge -100, icon -600,
          title -800, sub -500, chevron -400 (RN flat-fills the web gradient). */}
      {[
        {
          Icon: Heart,
          cardBg: C.teal50, border: C.teal100, badge: C.teal100,
          iconC: C.teal600, title: C.teal800, sub: C.teal500, chev: C.teal400,
          titleText: '健康・成長記録', subText: '体温・おむつ詳細・症状メモ・成長曲線',
          onPress: () => navigation.navigate('Health'),
        },
        {
          Icon: Users,
          cardBg: C.purple50, border: C.purple100, badge: C.purple100,
          iconC: C.purple600, title: C.purple800, sub: C.purple500, chev: C.purple400,
          titleText: 'チーム育児スキル', subText: 'ふたりの経験値を確認する',
          onPress: () => navigation.navigate('SkillTree'),
        },
        {
          Icon: Moon,
          cardBg: C.indigo50, border: C.indigo100, badge: C.indigo100,
          iconC: C.indigo600, title: C.indigo800, sub: C.indigo500, chev: C.indigo400,
          titleText: 'ネントレ支援', subText: '環境チェック・ルーティン・見守りタイマー',
          onPress: () => navigation.navigate('SleepTraining'),
        },
        {
          Icon: Gem,
          cardBg: C.purple50, border: C.purple100, badge: C.purple100,
          iconC: C.purple600, title: C.purple800, sub: C.purple500, chev: C.purple400,
          titleText: '貢献度ダッシュボード', subText: 'ふたりの育児をグラフで可視化',
          onPress: () => navigation.navigate('Dashboard'),
        },
      ].map((f) => (
        <TouchableOpacity
          key={f.titleText}
          activeOpacity={0.85}
          style={[styles.featureCard2, { backgroundColor: f.cardBg, borderColor: f.border }, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={f.onPress}
        >
          <View style={[styles.featureBadge, { backgroundColor: f.badge }]}>
            <f.Icon size={18} color={f.iconC} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: f.title }]}>{f.titleText}</Text>
            <Text style={[styles.featureSub, { color: f.sub }]}>{f.subText}</Text>
          </View>
          <ChevronRight size={16} color={f.chev} />
        </TouchableOpacity>
      ))}

      {/* 12. WeBoard */}
      {familyId && userId && <WeBoard familyId={familyId} userId={userId} />}

      {/* Bottom-tab clearance — was 100 (created a visible empty band under
          WeBoard); 24 is enough for the 64px tab bar since content already
          stops above it. */}
      <View style={{ height: 24 }} />

      {/* 13. ── LogDialog ─────────────────────────────────────────────────────── */}
      <LogDialog
        visible={activeLogType !== null}
        logType={activeLogType}
        userRole={user?.role}
        activeSleepSession={activeLogType === 'sleep' ? activeSleepSession : null}
        onClose={() => setActiveLogType(null)}
        onSave={handleLogSave}
        onEndSleepSession={handleEndSleepSession}
        onManualSleep={handleManualSleep}
      />

      {/* ── Custom button add modal ───────────────────────────────────────────── */}
      <Modal visible={showCustomModal} transparent animationType="slide" onRequestClose={closeCustomModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>カスタムボタンを追加</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={closeCustomModal}>
                <X size={20} color={C.gray400} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.customModalScroll}
              contentContainerStyle={styles.customModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ボタン名 — web ActionButtons.tsx:3723-3733 */}
              <Text style={styles.customModalLabel}>ボタン名</Text>
              <TextInput
                style={styles.input}
                placeholder="例：肛門刺激、爪磨き..."
                placeholderTextColor="#aaa"
                value={newBtnLabel}
                onChangeText={setNewBtnLabel}
                maxLength={12}
              />

              {/* アイコン — web ActionButtons.tsx:3734-3748 (grid-cols-6) */}
              <Text style={styles.customModalLabel}>アイコン</Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map(({ name, Cmp }) => {
                  const selected = newBtnIcon === name;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.iconOption, selected && styles.iconOptionSelected]}
                      onPress={() => setNewBtnIcon(name)}
                    >
                      <Cmp
                        size={20}
                        strokeWidth={2.5}
                        color={selected ? C.purple600 : '#6B7280'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* カラー — web ActionButtons.tsx:3749-3764 (pill chips: dot + label) */}
              <Text style={styles.customModalLabel}>カラー</Text>
              <View style={styles.colorRow}>
                {COLOR_SWATCHES.map((sw) => {
                  const selected = newBtnColorId === sw.id;
                  return (
                    <TouchableOpacity
                      key={sw.id}
                      style={[
                        styles.colorChip,
                        selected
                          ? { backgroundColor: sw.soft, borderColor: sw.bord }
                          : { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
                      ]}
                      onPress={() => setNewBtnColorId(sw.id)}
                    >
                      <View style={[styles.colorChipDot, { backgroundColor: sw.tint }]} />
                      <Text
                        style={[
                          styles.colorChipLabel,
                          { color: selected ? sw.tint : '#6B7280' },
                        ]}
                      >
                        {sw.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* プレビュー — web ActionButtons.tsx:3765-3779 */}
              {(() => {
                const sw = COLOR_SWATCHES.find((s) => s.id === newBtnColorId) ?? COLOR_SWATCHES[0];
                return (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>プレビュー</Text>
                    <View
                      style={[
                        styles.previewTile,
                        { backgroundColor: sw.soft, borderColor: sw.bord },
                      ]}
                    >
                      <View style={[styles.logBadge, isDark && { backgroundColor: colors.cardAlt, shadowOpacity: 0 }]}>
                        <CustomButtonIcon icon={newBtnIcon} size={20} strokeWidth={2.5} color={sw.tint} />
                      </View>
                      <Text style={[styles.logLabel, { color: sw.tint }]} numberOfLines={1}>
                        {newBtnLabel.trim() || 'ボタン名'}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* 追加する — web ActionButtons.tsx:3780-3790 (inside scroll;
                  generous bottom space keeps it above the home indicator) */}
              <TouchableOpacity
                style={[styles.modalSaveBtn, !newBtnLabel.trim() && styles.modalSaveBtnDisabled]}
                onPress={handleAddCustomButton}
                disabled={!newBtnLabel.trim()}
              >
                <Text style={styles.modalSaveText}>追加する</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },

  childScroll: { paddingHorizontal: 16, paddingVertical: 8 },
  childChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  childChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  childChipText: { fontSize: 14, color: '#333', fontFamily: fonts.body },

  // ── shared bits ──
  tinyLabel: { fontSize: 10, color: C.gray400, fontFamily: fonts.bodyBold, textTransform: 'uppercase' },
  uppercaseLabel: { fontSize: 10, color: C.gray400, fontFamily: fonts.bodyBold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // 2. growth card
  growthCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: palette.card, borderRadius: radius.xl, padding: 16,
    borderWidth: 1, borderColor: palette.border, ...shadows.soft,
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  growthTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  growthAge: { fontSize: 18, color: C.gray700, fontFamily: fonts.sans, fontWeight: '700', marginTop: 2 },
  growthAgeBig: { fontSize: 24, fontFamily: fonts.sans, fontWeight: '700' },
  growthIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center' },
  growthDays: { fontSize: 9, color: C.gray400, fontFamily: fonts.bodyBold, marginBottom: 4 },
  progressTrack: { height: 6, backgroundColor: C.gray100, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.green400, borderRadius: 999 },

  // 3. summary card
  summaryCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: palette.card, borderRadius: radius.xl, padding: 16,
    borderWidth: 1, borderColor: palette.border, ...shadows.soft,
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  // web: grid grid-cols-5 gap-1
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  summaryItem: { alignItems: 'center', flex: 1 },
  // web: w-7 h-7 rounded-full
  summaryIconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  // web: text-base font-black leading-tight
  summaryNumber: { fontSize: 16, color: C.gray700, fontFamily: fonts.sans, fontWeight: '700' },
  // web: text-[10px] font-bold text-gray-400
  summaryUnit: { fontSize: 10, color: C.gray400, fontFamily: fonts.bodyBold },
  // web: text-[8px] font-bold text-gray-400
  summaryLabel: { fontSize: 8, color: C.gray400, fontFamily: fonts.bodyBold, marginTop: 2 },
  // web: text-[7px] font-bold text-gray-400 leading-tight
  summaryBreakdown: { fontSize: 7, color: C.gray400, fontFamily: fonts.bodyBold, marginTop: 2, lineHeight: 9 },

  // 4. next feeding card — web: rounded-3xl p-4 border-2 shadow-sm
  nextFeedCard: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: radius.xl, padding: 16,
    borderWidth: 2,
    shadowColor: '#805AAA',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  nextFeedTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // web: p-2.5 rounded-2xl
  feedIconBadge: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  // web: text-sm font-black
  nextFeedMsg: { fontSize: 14, fontFamily: fonts.sans, fontWeight: '700' },
  // web: text-xs text-gray-600 font-bold mt-0.5
  nextFeedDetail: { fontSize: 12, color: '#4B5563', fontFamily: fonts.bodyBold, marginTop: 2 },

  // 5. wake window card
  wakeCard: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: radius.xl, padding: 16, borderWidth: 2,
  },
  wakeTime: { fontSize: 17, color: C.gray700, fontFamily: fonts.sans, fontWeight: '700' },
  eyeToggle: { padding: 6 },
  napBox: { marginTop: 12, borderRadius: radius.lg, padding: 12 },
  napRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  napLabel: { fontSize: 12, color: '#6B7280', fontFamily: fonts.bodyBold },
  napTime: { fontSize: 17, fontFamily: fonts.sans, fontWeight: '700' },
  napCountdown: { fontSize: 10, color: C.gray400, fontFamily: fonts.bodyBold, marginTop: 4, textAlign: 'right' },
  wakeAdviceBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  wakeAdvice: { fontSize: 12, fontFamily: fonts.bodyBold },
  wakeShowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 12, paddingVertical: 8, justifyContent: 'center' },
  wakeShowText: { fontSize: 12, color: C.gray400, fontFamily: fonts.bodyBold },

  phaseBadgeRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  phaseBadge: { alignSelf: 'flex-start', backgroundColor: '#EDE7F6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  phaseBadgeText: { fontSize: 11, color: '#7C5CBF', fontWeight: '600', fontFamily: fonts.bodySemibold },

  // 6. quick log heading
  quickLogHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 12, marginBottom: 12,
  },
  quickLogTitle: { fontSize: 18, color: C.gray700, fontFamily: fonts.sans, fontWeight: '700' },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  reorderText: { fontSize: 12, color: palette.mutedForeground, fontFamily: fonts.bodyBold },
  reorderDoneBtn: { backgroundColor: palette.primary },
  reorderDoneText: { color: '#FFFFFF' },

  // 並び替え mode — drag-to-reorder grid (mirrors WeYu arrange mode; no
  // chevrons). The wrapper is centered like buttonGrid and padded to match the
  // px-6 grid gutter; the inner grid sizes itself to 3 columns.
  dragGridWrap: {
    paddingHorizontal: GRID_PAD,
    maxWidth: GRID_MAX,
    alignSelf: 'center',
    width: '100%',
  },
  // Picked-up tile lift (web sets dragged scale/opacity; mobile lifts it).
  logButtonDragging: {
    shadowColor: '#805AAA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  // Custom tile wrapper so the delete badge can overhang the corner.
  customTileWrap: { position: 'relative' },
  // web ActionButtons.tsx:1185-1193 — absolute -top-2 -right-2 w-6 h-6
  // rounded-full bg-red-500 text-white shadow.
  customDeleteBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: C.red500,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  // カスタム sub-grid — web ActionButtons.tsx:1174-1178
  customGridWrap: { marginTop: 8, width: '100%' },
  // web: text-[10px] font-black text-gray-400 uppercase tracking-widest, px-1
  customGridLabel: {
    fontSize: 10, color: C.gray400, fontFamily: fonts.bodyBold,
    letterSpacing: 1.5, textTransform: 'uppercase',
    paddingHorizontal: GRID_PAD + 4, marginBottom: 8,
  },
  // dashed "+ 追加" tile — web ActionButtons.tsx:1217-1230
  // border-dashed border-gray-300, badge bg-gray-50, content text-gray-400
  addTile: {
    backgroundColor: 'transparent',
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  addTileBadge: {
    backgroundColor: '#F9FAFB', padding: 10, borderRadius: 999,
  },
  addTileLabel: { fontSize: 12, textAlign: 'center', fontFamily: fonts.bodyBold, fontWeight: '700', letterSpacing: 0.3, color: C.gray400 },

  // web: grid grid-cols-3 gap-3 px-6 w-full max-w-md mx-auto
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: GRID_PAD,
    maxWidth: GRID_MAX,
    alignSelf: 'center',
    width: '100%',
  },
  // web tile: flex-col items-center justify-center gap-2 py-4 px-2 rounded-[2rem] border-2 shadow-sm
  logButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 2,
    shadowColor: '#805AAA',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  logButtonDark: {},
  // web badge: bg-white p-2.5 rounded-full shadow-sm
  logBadge: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  // web label: font-bold text-xs tracking-wide (colored to the tint inline)
  logLabel: { fontSize: 12, textAlign: 'center', fontFamily: fonts.bodyBold, fontWeight: '700', letterSpacing: 0.3 },

  // 8. timeline / 11. feature cards
  timelineCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: C.indigo50, borderRadius: radius.xl, padding: 16,
    borderWidth: 2, borderColor: C.indigo100,
  },
  featureCard2: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 12,
    borderRadius: radius.xl, padding: 16, borderWidth: 2,
  },
  // web Home.tsx feature card icon box: p-2.5 rounded-2xl (not a circle)
  featureBadge: {
    width: 38, height: 38, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontSize: 14, color: C.indigo800, fontFamily: fonts.sans, fontWeight: '700' },
  featureSub: { fontSize: 10, color: C.indigo500, fontFamily: fonts.body, marginTop: 2 },

  // 9. team power
  teamPowerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: palette.card, borderRadius: radius.xl, padding: 16,
    borderWidth: 2, borderColor: C.purple100, ...shadows.soft,
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  teamPowerNum: { fontSize: 20, color: C.purple600, fontFamily: fonts.sans, fontWeight: '700', letterSpacing: -0.5 },
  teamDivider: { width: 1, height: 32, backgroundColor: C.purple100 },

  // 10. SOS
  sosWrap: { alignItems: 'center', paddingVertical: 36 },
  sosCircle: {
    width: 224, height: 224, borderRadius: 112,
    backgroundColor: palette.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 8, borderColor: 'rgba(255,255,255,0.2)',
    ...shadows.glow,
  },
  sosInner: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 16, borderRadius: 999, marginBottom: 14,
  },
  sosTitle: { fontSize: 22, color: '#FFFFFF', fontFamily: fonts.sans, fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  sosBadge: { marginTop: 10, backgroundColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  sosBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bodyBold },

  // ── カスタムボタンを追加 modal — web ActionButtons.tsx:3716-3793 ──────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  // rounded-[2.5rem] sheet, max-h-[85vh] (web), comfortable bottom space
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
    paddingTop: 12, paddingHorizontal: 20,
    maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 },
  // web DialogTitle: text-xl font-black text-center
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1F2937', textAlign: 'center', fontFamily: fonts.sans },
  modalCloseBtn: { position: 'absolute', right: 0, top: -2, padding: 6 },
  customModalScroll: { },
  // web content: space-y-5 py-4 px-2 + roomy tail so 追加する clears the
  // device home indicator and is fully reachable by scrolling.
  customModalScrollContent: { paddingHorizontal: 2, paddingTop: 16, paddingBottom: 56 },

  // web Input: rounded-2xl border-2 h-12 text-sm
  input: {
    backgroundColor: '#fff', borderRadius: radius.lg, height: 48,
    paddingHorizontal: 14, fontSize: 14, borderWidth: 2, borderColor: '#E5E7EB',
    color: '#1F2937', fontFamily: fonts.body,
  },
  // web label: text-xs font-black text-gray-600
  customModalLabel: { fontSize: 12, fontWeight: '800', color: '#4B5563', marginBottom: 8, marginTop: 20, fontFamily: fonts.bodyBold },
  // web: grid grid-cols-6 gap-2, options aspect-square rounded-2xl border-2
  iconGrid: { flexDirection: 'row', gap: MODAL_ICON_GAP, flexWrap: 'wrap' },
  iconOption: {
    width: MODAL_ICON_W, height: MODAL_ICON_W, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9FAFB', borderWidth: 2, borderColor: '#E5E7EB',
  },
  iconOptionSelected: { borderColor: C.purple400, backgroundColor: C.purple100 },
  // web: flex gap-2 flex-wrap; chips px-3 py-1.5 rounded-full border-2
  colorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  colorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 2,
  },
  colorChipDot: { width: 12, height: 12, borderRadius: 6 },
  colorChipLabel: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold },
  // web preview: p-3 rounded-2xl border-2 border-gray-100 bg-gray-50
  previewCard: {
    marginTop: 20, padding: 12, borderRadius: radius.lg, borderWidth: 2,
    borderColor: '#F3F4F6', backgroundColor: '#F9FAFB',
    alignItems: 'center', gap: 8,
  },
  // web: text-[10px] font-bold text-gray-400
  previewLabel: { fontSize: 10, color: C.gray400, fontFamily: fonts.bodyBold },
  // web preview tile: py-3 px-5 rounded-[2rem] border-2
  previewTile: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 32,
    borderWidth: 2,
  },
  // web button: w-full h-14 rounded-2xl bg-purple-500 font-black text-lg
  modalSaveBtn: {
    marginTop: 24, height: 56, borderRadius: radius.lg,
    backgroundColor: C.purple500, alignItems: 'center', justifyContent: 'center',
  },
  modalSaveBtnDisabled: { opacity: 0.5 },
  modalSaveText: { color: '#fff', fontSize: 18, fontWeight: '800', fontFamily: fonts.sans },
});
