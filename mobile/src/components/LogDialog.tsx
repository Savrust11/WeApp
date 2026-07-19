/**
 * LogDialog — unified bottom-sheet dialog for all 20+ log types.
 *
 * Full visual port of the CANONICAL web QuickActions dialogs
 * (WeYu/client/src/components/ActionButtons.tsx). Replicates WeYu's
 * dialog layouts/fields/steppers/pickers/chips/colors/icons for every
 * log type: milk (type→detail step flow, breast timer pause/resume/stop,
 * +分追加, 搾乳した母乳 checkbox, 吐き戻し section, slider for ミルク量),
 * 搾乳 (timer/手入力 toggle, left/right timers, alarm, 2-step → amount slider),
 * おむつ (pee/poop multi-toggle + うんち詳細 color/形状/量), ねんね
 * (今すぐ/時刻指定 main, 手入力 with duration calc, ねんね中 active card with
 * 時刻を修正/昼寝を記録), 離乳食 (per-食材 7-level amount rows, すべて完食),
 * たいおん (big colored display + stepper + presets), トイレ/ごはん/しつけ/
 * のみもの/あそび/抱っこ and all text dialogs, with the "時間を変更"
 * datetime affordance and the 担当者（複数選択可）selector.
 *
 * Public API (LogSaveData / Props / callbacks) is preserved EXACTLY.
 * New WeYu-captured fields are added to LogSaveData additively as
 * OPTIONAL fields so existing callers (HomeScreen) keep typechecking.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  Milk, Baby, Moon, Apple, Cookie, Star, Bath, Blocks, School, Sparkles,
  Pill, Thermometer, Heart, UtensilsCrossed, Droplets, MessageCircle,
  ThumbsUp, Palette, Award, CalendarCheck, GraduationCap, Sun, Plus, Minus,
  ClipboardList, CircleDot, Hand, Coffee, Scissors, Stethoscope, Check, X,
  Edit3, Clock, ChevronDown, ChevronUp, Timer,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { SleepSession } from '../api/sleepSessions';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Text } from '../theme/ui';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LogSaveData {
  type: string;
  memo?: string;
  bodyTemperature?: number;
  formulaMl?: number;
  expressedMl?: number;
  breastLeftMin?: number;
  breastRightMin?: number;
  medicineName?: string;
  medicineDose?: string;
  symptoms?: string;
  assignees: Array<'self' | 'partner' | 'other'>;

  // ── WeYu-added fields (all OPTIONAL → back-compatible with HomeScreen) ──────
  /** Milk sub-type: 'breast' | 'formula' | 'mixed' (web `subType`). */
  subType?: string;
  /** Diaper: whether おしっこ / うんち were recorded. */
  diaperPee?: boolean;
  diaperPoop?: boolean;
  /** うんち details (ids). */
  poopColor?: string;
  poopConsistency?: string;
  stoolAmount?: string;
  /** Milk: 搾乳した母乳をあげた flag. */
  isExpressed?: boolean;
  /** Milk: 吐き戻し section. */
  spitUp?: boolean;
  spitUpAmount?: string;
  spitUpTiming?: string;
  spitUpNote?: string;
  /** 離乳食: JSON string of [{name, amount}] + summary + note. */
  foodItems?: string;
  foodAmount?: string;
  foodNote?: string;
  /** あそび: selected play type ids. */
  playTypes?: string;
  /** のみもの: amount in ml (string). */
  drinkAmount?: string;
  /** ごはん: 食べ具合 id. */
  mealResult?: string;
  /** トイレ: 成功/失敗/誘った id. */
  toiletResult?: string;
  /** しつけ: 褒めた/叱った id. */
  disciplineType?: string;
  /** 抱っこ: end time ISO string. */
  holdEndAt?: string;
  /** Custom record timestamp (ISO) when user changed "時間を変更". */
  createdAt?: string;
  /** Joined performer roles for web parity ("mama・papa"). */
  performedBy?: string;
}

interface Props {
  visible: boolean;
  logType: string | null;
  userRole?: 'papa' | 'mama' | 'other';
  /** Set when an active sleep session exists (shows ねんね中 UI) */
  activeSleepSession?: SleepSession | null;
  onClose: () => void;
  onSave: (data: LogSaveData) => void;
  /** Called when user taps "起きた" to end the active sleep session */
  onEndSleepSession?: (sessionId: number) => void;
  /** Called when user manually enters a past sleep entry */
  onManualSleep?: (data: { durationMin: number; startedAt: string }) => void;
}

// ─── Internal constants ───────────────────────────────────────────────────────

// 離乳食 / ごはん 7-level amount buttons (web parity)
const FOOD_AMOUNTS: { label: string; color: string }[] = [
  { label: 'イヤイヤ', color: '#F43F5E' }, // rose-500
  { label: '少し',     color: '#FDA4AF' }, // rose-300
  { label: '1/3',     color: '#FCD34D' }, // amber-300
  { label: '半分',     color: '#FBBF24' }, // amber-400
  { label: '2/3',     color: '#A3E635' }, // lime-400
  { label: '8割',     color: '#34D399' }, // emerald-400
  { label: '完食',     color: '#22C55E' }, // green-500
];

const MEAL_RESULTS = [
  { id: 'refused',   label: 'イヤイヤ' },
  { id: 'little',    label: '少し' },
  { id: 'third',     label: '1/3' },
  { id: 'half',      label: '半分' },
  { id: 'twoThirds', label: '2/3' },
  { id: 'mostly',    label: '8割' },
  { id: 'complete',  label: '完食' },
] as const;

const POOP_COLORS = [
  { id: 'yellow', label: '黄色', color: '#FBBF24' },
  { id: 'green',  label: '緑色', color: '#22C55E' },
  { id: 'brown',  label: '茶色', color: '#B45309' },
  { id: 'black',  label: '黒色', color: '#1F2937' },
  { id: 'white',  label: '白色', color: '#F3F4F6', border: '#D1D5DB' },
  { id: 'red',    label: '赤色', color: '#EF4444' },
];

const POOP_CONSISTENCY = [
  { id: 'normal',  label: '普通' },
  { id: 'hard',    label: '硬い' },
  { id: 'soft',    label: '軟らかい' },
  { id: 'watery',  label: '水っぽい' },
];

const STOOL_AMOUNTS = [
  { id: 'small',  label: '少量' },
  { id: 'medium', label: '普通' },
  { id: 'large',  label: '多い' },
];

const SPIT_UP_AMOUNTS = [
  { value: 'small', label: '少し' },
  { value: 'half',  label: '半分くらい' },
  { value: 'most',  label: 'ほぼ全部' },
];
const SPIT_UP_TIMINGS = [
  { value: 'immediate',    label: '直後' },
  { value: 'within_30min', label: '30分以内' },
  { value: 'within_1hour', label: '1時間以内' },
];

const TOILET_RESULTS = [
  { id: 'success', label: '成功' },
  { id: 'fail',    label: '失敗' },
  { id: 'tried',   label: '誘った' },
];

const DISCIPLINE_TYPES = [
  { id: 'praise', label: '褒めた' },
  { id: 'scold',  label: '叱った' },
];

// web PLAY_OPTIONS (lib/phases.ts)
const PLAY_OPTIONS = [
  { id: 'tummy',    label: 'うつ伏せ練習' },
  { id: 'peekaboo', label: 'いないいないばあ' },
  { id: 'rhythm',   label: 'お歌・リズム遊び' },
  { id: 'walk',     label: 'お散歩' },
  { id: 'toy',      label: 'おもちゃ遊び' },
  { id: 'reading',  label: '絵本' },
  { id: 'other',    label: 'その他' },
];

const DRINK_TYPES = ['お水', '麦茶', '牛乳', 'りんごジュース', 'みかんジュース', '野菜ジュース', 'お茶', 'その他'];
const DRINK_AMOUNTS = ['50', '100', '150', '200'];

const SYMPTOM_OPTIONS = ['発熱', '咳・鼻水', '湿疹', '下痢・便秘', '吐き戻し', '機嫌が悪い'] as const;

// Web tailwind accent colors (client uses these per-category)
const PINK_50 = '#FDF2F8', PINK_100 = '#FCE7F3', PINK_200 = '#FBCFE8',
      PINK_300 = '#F0ABCC', PINK_400 = '#F472B6', PINK_500 = '#EC4899', PINK_600 = '#DB2777';
const BLUE_50 = '#EFF6FF', BLUE_100 = '#DBEAFE', BLUE_300 = '#93C5FD',
      BLUE_400 = '#60A5FA', BLUE_500 = '#3B82F6', BLUE_600 = '#2563EB', BLUE_900 = '#1E3A8A';
const GRAY_50 = '#F9FAFB', GRAY_100 = '#F3F4F6', GRAY_200 = '#E5E7EB',
      GRAY_300 = '#D1D5DB', GRAY_400 = '#9CA3AF', GRAY_500 = '#6B7280',
      GRAY_600 = '#4B5563', GRAY_700 = '#374151', GRAY_800 = '#1F2937';
const INDIGO_50 = '#EEF2FF', INDIGO_100 = '#E0E7FF', INDIGO_200 = '#C7D2FE',
      INDIGO_300 = '#A5B4FC', INDIGO_400 = '#818CF8', INDIGO_500 = '#6366F1',
      INDIGO_600 = '#4F46E5', INDIGO_700 = '#4338CA', INDIGO_800 = '#3730A3';
const PURPLE_50 = '#FAF5FF', PURPLE_100 = '#F3E8FF', PURPLE_200 = '#E9D5FF',
      PURPLE_400 = '#A480D0', PURPLE_500 = '#A855F7', PURPLE_600 = '#9333EA';
const AMBER_50 = '#FFFBEB', AMBER_100 = '#FEF3C7', AMBER_300 = '#FCD34D',
      AMBER_400 = '#FBBF24', AMBER_500 = '#F59E0B', AMBER_600 = '#D97706', AMBER_700 = '#B45309';
const RED_100 = '#FEE2E2', RED_500 = '#EF4444', RED_600 = '#DC2626';
const GREEN_100 = '#DCFCE7', GREEN_500 = '#22C55E', GREEN_600 = '#16A34A';
const TEAL_50 = '#F0FDFA', TEAL_100 = '#CCFBF1', TEAL_200 = '#99F6E4',
      TEAL_300 = '#5EEAD4', TEAL_400 = '#2DD4BF', TEAL_500 = '#14B8A6',
      TEAL_600 = '#0D9488', TEAL_700 = '#0F766E';
const CYAN_50 = '#ECFEFF', CYAN_200 = '#A5F3FC', CYAN_500 = '#06B6D4', CYAN_600 = '#0891B2', CYAN_700 = '#0E7490';
const ORANGE_50 = '#FFF7ED', ORANGE_100 = '#FFEDD5', ORANGE_400 = '#FB923C',
      ORANGE_500 = '#F97316', ORANGE_700 = '#C2410C', ORANGE_900 = '#7C2D12';
const LIME_500 = '#84CC16';
const SKY_500 = '#0EA5E9';
const GREEN_ACCENT_500 = '#22C55E';
const YELLOW_500 = '#EAB308';
const FUCHSIA_500 = '#D946EF';
const VIOLET_500 = '#8B5CF6';
const ROSE_400 = '#FB7185';
const SLATE_500 = '#64748B';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtTimer(sec: number) { return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`; }
function fmtElapsed(min: number) {
  const h = Math.floor(min / 60);
  return `${h > 0 ? `${h}時間` : ''}${min % 60}分`;
}

const TYPE_LABELS: Record<string, string> = {
  milk: 'ミルク', expressed: '搾乳', diaper: 'おむつ', sleep: 'ねんね',
  food: '離乳食', snack: 'おやつ', milestone: 'はじめて', bath: 'おふろ',
  play: 'あそび', hold: '抱っこ', drink: 'のみもの', school: '園の記録',
  toothbrush: 'はみがき', moisturize: '保湿', nail_cut: '爪切り',
  medicine: 'おくすり', temperature: 'たいおん', appointment: '通院',
  thank_you: 'ありがとう', meal: 'ごはん', toilet: 'トイレ',
  word: 'ことば', achievement: 'できた', discipline: 'しつけ',
  interest: 'きょうみ', schedule: 'よてい', school_prep: '入学準備',
  symptoms: '症状',
};

// lucide-react-native icons mirroring the web's lucide-react usage
const TYPE_ICON: Record<string, LucideIcon> = {
  milk: Milk, expressed: Timer, diaper: Baby, sleep: Moon,
  food: Apple, snack: Cookie, milestone: Star, bath: Bath,
  play: Blocks, hold: Heart, drink: Coffee, school: School,
  toothbrush: Sparkles, moisturize: Hand, nail_cut: Scissors,
  medicine: Pill, temperature: Thermometer, appointment: Stethoscope,
  thank_you: Heart, meal: UtensilsCrossed, toilet: Droplets,
  word: MessageCircle, achievement: Award, discipline: ThumbsUp,
  interest: Palette, schedule: CalendarCheck, school_prep: GraduationCap,
  symptoms: Stethoscope,
};

const NO_ASSIGNEE = new Set(['temperature', 'thank_you', 'symptoms']);

// types with simple required text body
const TEXT_TYPES = new Set([
  'milestone', 'word', 'achievement', 'thank_you', 'school',
  'appointment', 'discipline', 'interest', 'schedule', 'school_prep', 'snack',
]);

// ─── Component ────────────────────────────────────────────────────────────────

export default function LogDialog({
  visible, logType, userRole, activeSleepSession,
  onClose, onSave, onEndSleepSession, onManualSleep,
}: Props) {

  // ── Assignee (担当者 複数選択可) ─────────────────────────────────────────────
  const [assignees, setAssignees] = useState<Set<'self' | 'partner' | 'other'>>(new Set(['self']));
  const selfLabel    = userRole === 'mama' ? 'ママ' : 'パパ';
  const partnerLabel = userRole === 'mama' ? 'パパ' : 'ママ';

  const toggleAssignee = (a: 'self' | 'partner' | 'other') => {
    setAssignees(prev => {
      const n = new Set(prev);
      if (n.has(a)) { if (n.size > 1) n.delete(a); }
      else n.add(a);
      return n;
    });
  };
  const performedBy = () =>
    [...assignees].map(a => (a === 'self' ? (userRole ?? 'papa') : a === 'partner' ? (userRole === 'mama' ? 'papa' : 'mama') : 'other')).join('・');

  // ── 時間を変更 (datetime affordance) ─────────────────────────────────────────
  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const [logTime, setLogTime] = useState(''); // HH:MM
  const createdAtIso = (): string | undefined => {
    if (!logTime || logTime.length < 4) return undefined;
    const m = /^(\d{1,2}):(\d{2})$/.exec(logTime.trim());
    if (!m) return undefined;
    const h = Math.min(23, parseInt(m[1], 10));
    const min = Math.min(59, parseInt(m[2], 10));
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d.toISOString();
  };

  // ── Milk / breastfeed (type → detail step flow) ─────────────────────────────
  const [milkStep, setMilkStep] = useState<'type' | 'detail'>('type');
  const [selectedMilkType, setSelectedMilkType] = useState<'breast' | 'formula' | 'mixed'>('breast');
  const [breastLeftMin,  setBreastLeftMin]  = useState(0);
  const [breastRightMin, setBreastRightMin] = useState(0);
  const [lastAddedLeft,  setLastAddedLeft]  = useState(0);
  const [lastAddedRight, setLastAddedRight] = useState(0);
  const [breastTimerRunning, setBreastTimerRunning] = useState(false);
  const [breastTimerPaused,  setBreastTimerPaused]  = useState(false);
  const [breastTimerSide,    setBreastTimerSide]    = useState<'left' | 'right'>('left');
  const [breastTimerSec,     setBreastTimerSec]     = useState(0);
  const breastRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isExpressed, setIsExpressed] = useState(false);
  const [expressedMl, setExpressedMl] = useState(0);
  const [formulaMl,   setFormulaMl]   = useState(0);
  const [spitUp,       setSpitUp]       = useState(false);
  const [spitUpAmount, setSpitUpAmount] = useState('');
  const [spitUpTiming, setSpitUpTiming] = useState('');
  const [spitUpNote,   setSpitUpNote]   = useState('');

  const clearBreast = () => { if (breastRef.current) { clearInterval(breastRef.current); breastRef.current = null; } };
  const startBreastTimer = (side: 'left' | 'right') => {
    clearBreast();
    setBreastTimerSide(side);
    setBreastTimerSec(0);
    setBreastTimerPaused(false);
    setBreastTimerRunning(true);
    breastRef.current = setInterval(() => setBreastTimerSec(s => s + 1), 1000);
  };
  const pauseBreastTimer = () => { clearBreast(); setBreastTimerRunning(false); setBreastTimerPaused(true); };
  const resumeBreastTimer = () => {
    setBreastTimerRunning(true); setBreastTimerPaused(false);
    breastRef.current = setInterval(() => setBreastTimerSec(s => s + 1), 1000);
  };
  const stopBreastTimer = () => {
    clearBreast();
    const mins = Math.round(breastTimerSec / 60);
    if (breastTimerSide === 'left')  { setBreastLeftMin(p => p + mins); setLastAddedLeft(mins); setLastAddedRight(0); }
    else                             { setBreastRightMin(p => p + mins); setLastAddedRight(mins); setLastAddedLeft(0); }
    setBreastTimerRunning(false); setBreastTimerPaused(false); setBreastTimerSec(0);
  };

  // ── Expressed (搾乳) — timer / 手入力, left+right, alarm, 2-step ─────────────
  const [exprStep,       setExprStep]       = useState<'timer' | 'amount'>('timer');
  const [exprManualMode, setExprManualMode] = useState(false);
  const [exprLeftSec,    setExprLeftSec]    = useState(0);
  const [exprRightSec,   setExprRightSec]   = useState(0);
  const [exprActiveSide, setExprActiveSide] = useState<'left' | 'right' | null>(null);
  const [exprManualLeft,  setExprManualLeft]  = useState<string>('');
  const [exprManualRight, setExprManualRight] = useState<string>('');
  const [exprAlarmMin,   setExprAlarmMin]   = useState(0);
  const [exprLeftAlarm,  setExprLeftAlarm]  = useState(false);
  const [exprRightAlarm, setExprRightAlarm] = useState(false);
  const [exprAmount,     setExprAmount]     = useState(0);
  const exprRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearExpr = () => { if (exprRef.current) { clearInterval(exprRef.current); exprRef.current = null; } };
  useEffect(() => {
    clearExpr();
    if (exprActiveSide === 'left') {
      exprRef.current = setInterval(() => setExprLeftSec(s => s + 1), 1000);
    } else if (exprActiveSide === 'right') {
      exprRef.current = setInterval(() => setExprRightSec(s => s + 1), 1000);
    }
    return clearExpr;
  }, [exprActiveSide]);

  // 搾乳アラーム
  useEffect(() => {
    if (exprAlarmMin <= 0) return;
    if (!exprLeftAlarm  && exprLeftSec  >= exprAlarmMin * 60 && exprLeftSec  > 0) setExprLeftAlarm(true);
    if (!exprRightAlarm && exprRightSec >= exprAlarmMin * 60 && exprRightSec > 0) setExprRightAlarm(true);
  }, [exprLeftSec, exprRightSec, exprAlarmMin, exprLeftAlarm, exprRightAlarm]);

  const toggleExprSide = (side: 'left' | 'right') => {
    setExprActiveSide(prev => (prev === side ? null : side));
  };

  // ── Diaper (pee/poop multi-toggle + うんち詳細) ──────────────────────────────
  const [diaperPee,        setDiaperPee]        = useState(false);
  const [diaperPoop,       setDiaperPoop]       = useState(false);
  const [poopColor,        setPoopColor]        = useState('');
  const [poopConsistency,  setPoopConsistency]  = useState('');
  const [stoolAmount,      setStoolAmount]      = useState('');

  // ── Sleep ───────────────────────────────────────────────────────────────────
  const [sleepStep, setSleepStep] = useState<'main' | 'manual' | 'active'>('main');
  const [sleepShowPicker, setSleepShowPicker] = useState(false);
  const [sleepQuickStart, setSleepQuickStart] = useState(''); // HH:MM
  const [sleepQuickEnd,   setSleepQuickEnd]   = useState('');
  const [sleepQuickNoEnd, setSleepQuickNoEnd] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd,   setManualEnd]   = useState('');
  const [manualNoEnd, setManualNoEnd] = useState(false);
  const [manualSleepError, setManualSleepError] = useState('');
  const [sleepElapsedMin, setSleepElapsedMin] = useState(0);
  const sleepElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSleepElapsed = () => {
    if (sleepElapsedRef.current) { clearInterval(sleepElapsedRef.current); sleepElapsedRef.current = null; }
  };

  // Tick elapsed time while ねんね中
  useEffect(() => {
    if (visible && logType === 'sleep' && activeSleepSession && sleepStep === 'active') {
      const startMs = new Date(activeSleepSession.startedAt).getTime();
      const update  = () => setSleepElapsedMin(Math.max(0, Math.floor((Date.now() - startMs) / 60000)));
      update();
      sleepElapsedRef.current = setInterval(update, 10000);
    } else {
      clearSleepElapsed();
    }
    return clearSleepElapsed;
  }, [visible, logType, activeSleepSession, sleepStep]);

  // When opening sleep dialog, jump to active step if a session is running
  useEffect(() => {
    if (visible && logType === 'sleep') {
      setSleepStep(activeSleepSession ? 'active' : 'main');
    }
  }, [visible, logType, activeSleepSession]);

  // ── 抱っこ ──────────────────────────────────────────────────────────────────
  const [holdEndTime, setHoldEndTime] = useState('');
  const [holdMemo,    setHoldMemo]    = useState('');

  // ── Food (per-食材 rows with 7-level amount) ─────────────────────────────────
  interface FoodEntry { name: string; amount: string }
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([{ name: '', amount: '' }]);
  const [foodNote,    setFoodNote]    = useState('');

  // ── Simple text ─────────────────────────────────────────────────────────────
  const [textValue, setTextValue] = useState('');

  // ── Meal ────────────────────────────────────────────────────────────────────
  const [mealResult, setMealResult] = useState('');
  const [mealMemo,   setMealMemo]   = useState('');

  // ── Discipline ──────────────────────────────────────────────────────────────
  const [disciplineType, setDisciplineType] = useState('');
  const [disciplineMemo, setDisciplineMemo] = useState('');

  // ── Play ─────────────────────────────────────────────────────────────────────
  const [playTypes, setPlayTypes] = useState<Set<string>>(new Set());
  const [playMemo,  setPlayMemo]  = useState('');
  const togglePlay  = (p: string) => { setPlayTypes(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; }); };

  // ── Drink ───────────────────────────────────────────────────────────────────
  const [drinkType,   setDrinkType]   = useState('');
  const [drinkCustom, setDrinkCustom] = useState('');
  const [drinkAmount, setDrinkAmount] = useState('');

  // ── Toilet ──────────────────────────────────────────────────────────────────
  const [toiletResult, setToiletResult] = useState('');

  // ── Medicine ─────────────────────────────────────────────────────────────────
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medMemo, setMedMemo] = useState('');

  // ── Temperature ──────────────────────────────────────────────────────────────
  const [tempValue, setTempValue] = useState(36.5);

  // ── Symptoms ─────────────────────────────────────────────────────────────────
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [symptomNote,      setSymptomNote]      = useState('');
  const toggleSymptom = (sym: string) => { setSelectedSymptoms(prev => { const n = new Set(prev); n.has(sym) ? n.delete(sym) : n.add(sym); return n; }); };

  // ─── Reset all state when a new dialog opens ────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    clearBreast(); clearExpr(); clearSleepElapsed();
    setAssignees(new Set(['self']));
    setShowTimeEdit(false); setLogTime('');
    setMilkStep('type'); setSelectedMilkType('breast');
    setBreastLeftMin(0); setBreastRightMin(0); setLastAddedLeft(0); setLastAddedRight(0);
    setBreastTimerRunning(false); setBreastTimerPaused(false); setBreastTimerSide('left'); setBreastTimerSec(0);
    setIsExpressed(false); setExpressedMl(0); setFormulaMl(0);
    setSpitUp(false); setSpitUpAmount(''); setSpitUpTiming(''); setSpitUpNote('');
    setExprStep('timer'); setExprManualMode(false);
    setExprLeftSec(0); setExprRightSec(0); setExprActiveSide(null);
    setExprManualLeft(''); setExprManualRight('');
    setExprAlarmMin(0); setExprLeftAlarm(false); setExprRightAlarm(false); setExprAmount(0);
    setDiaperPee(false); setDiaperPoop(false); setPoopColor(''); setPoopConsistency(''); setStoolAmount('');
    setSleepShowPicker(false);
    setSleepQuickStart(''); setSleepQuickEnd(''); setSleepQuickNoEnd(false);
    setManualStart(''); setManualEnd(''); setManualNoEnd(false); setManualSleepError('');
    setSleepElapsedMin(0);
    setHoldEndTime(''); setHoldMemo('');
    setFoodEntries([{ name: '', amount: '' }]); setFoodNote('');
    setTextValue('');
    setMealResult(''); setMealMemo('');
    setDisciplineType(''); setDisciplineMemo('');
    setPlayTypes(new Set()); setPlayMemo('');
    setDrinkType(''); setDrinkCustom(''); setDrinkAmount('');
    setToiletResult('');
    setMedName(''); setMedDose(''); setMedMemo('');
    setTempValue(36.5);
    setSelectedSymptoms(new Set()); setSymptomNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, logType]);

  // cleanup intervals on unmount
  useEffect(() => () => { clearBreast(); clearExpr(); clearSleepElapsed(); }, []);

  // ─── Save handlers ──────────────────────────────────────────────────────────
  const finishWith = (data: LogSaveData) => {
    const ca = createdAtIso();
    onSave({ ...data, performedBy: performedBy(), ...(ca ? { createdAt: ca } : {}) });
  };

  const handleMilkSubmit = useCallback(() => {
    clearBreast();
    const mType = selectedMilkType;
    const data: LogSaveData = {
      type: 'milk',
      subType: mType,
      assignees: [...assignees] as Array<'self' | 'partner' | 'other'>,
      breastLeftMin:  (mType === 'breast' || mType === 'mixed') ? breastLeftMin || undefined : undefined,
      breastRightMin: (mType === 'breast' || mType === 'mixed') ? breastRightMin || undefined : undefined,
      isExpressed:    (mType === 'breast' || mType === 'mixed') ? isExpressed : false,
      expressedMl:    (mType === 'breast' || mType === 'mixed') && isExpressed ? expressedMl || undefined : undefined,
      formulaMl:      (mType === 'formula' || mType === 'mixed') ? formulaMl || undefined : undefined,
      spitUp,
      spitUpAmount: spitUp ? spitUpAmount || undefined : undefined,
      spitUpTiming: spitUp ? spitUpTiming || undefined : undefined,
      spitUpNote:   spitUp && spitUpNote.trim() ? spitUpNote.trim() : undefined,
    };
    finishWith(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMilkType, assignees, breastLeftMin, breastRightMin, isExpressed, expressedMl,
      formulaMl, spitUp, spitUpAmount, spitUpTiming, spitUpNote, logTime]);

  const handleExpressSubmit = useCallback(() => {
    clearExpr();
    const leftMin  = exprManualMode ? (parseInt(exprManualLeft)  || 0) : Math.round(exprLeftSec  / 60);
    const rightMin = exprManualMode ? (parseInt(exprManualRight) || 0) : Math.round(exprRightSec / 60);
    const ml = exprAmount > 0 ? exprAmount : 30;
    const parts: string[] = [];
    if (rightMin > 0) parts.push(`右${rightMin}分`);
    if (leftMin  > 0) parts.push(`左${leftMin}分`);
    const timerStr = parts.length > 0 ? `（${parts.join('・')}）` : '';
    finishWith({
      type: 'expressed',
      assignees: [...assignees] as Array<'self' | 'partner' | 'other'>,
      expressedMl: ml,
      breastLeftMin:  leftMin || undefined,
      breastRightMin: rightMin || undefined,
      memo: `搾乳 ${ml}ml${timerStr}`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exprManualMode, exprManualLeft, exprManualRight, exprLeftSec, exprRightSec, exprAmount, assignees, logTime]);

  const handleManualSleepSubmit = () => {
    const today  = new Date().toISOString().split('T')[0];
    const mkDate = (hhmm: string) => new Date(`${today}T${/^\d{1,2}:\d{2}$/.test(hhmm) ? hhmm.padStart(5, '0') : '00:00'}:00`);
    const start  = manualStart ? mkDate(manualStart) : null;
    if (!start || isNaN(start.getTime())) { setManualSleepError('入眠時刻を入力してください'); return; }
    if (manualNoEnd) {
      onManualSleep?.({ durationMin: 0, startedAt: start.toISOString() });
      onClose();
      return;
    }
    const end = manualEnd ? mkDate(manualEnd) : null;
    if (!end || isNaN(end.getTime())) { setManualSleepError('起床時刻を入力してください（「入力しない」を使うと省略できます）'); return; }
    if (end <= start) { setManualSleepError('起床時刻は入眠時刻より後にしてください'); return; }
    const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
    onManualSleep?.({ durationMin, startedAt: start.toISOString() });
    onClose();
  };

  const handleSleepQuickSubmit = () => {
    const today  = new Date().toISOString().split('T')[0];
    const mkDate = (hhmm: string) => new Date(`${today}T${/^\d{1,2}:\d{2}$/.test(hhmm) ? hhmm.padStart(5, '0') : '00:00'}:00`);
    const start  = sleepQuickStart ? mkDate(sleepQuickStart) : new Date();
    if (!sleepQuickNoEnd && sleepQuickEnd) {
      const end = mkDate(sleepQuickEnd);
      if (end <= start) return;
      const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
      onManualSleep?.({ durationMin, startedAt: start.toISOString() });
    } else {
      // ねんね開始として記録 — let HomeScreen start the session
      onSave({ type: 'sleep', assignees: [...assignees] as Array<'self' | 'partner' | 'other'> });
    }
    onClose();
  };

  const handleSave = useCallback(() => {
    if (!logType) return;
    clearBreast(); clearExpr();
    let data: LogSaveData = { type: logType, assignees: [...assignees] as Array<'self' | 'partner' | 'other'> };

    switch (logType) {
      case 'expressed':
        handleExpressSubmit();
        return;
      case 'diaper': {
        const subType = diaperPee && diaperPoop ? 'both' : diaperPoop ? 'poop' : 'pee';
        data = {
          ...data,
          type: diaperPoop && !diaperPee ? 'diaper_poop' : 'diaper_wet',
          subType,
          diaperPee, diaperPoop,
          poopColor:       diaperPoop ? poopColor || undefined : undefined,
          poopConsistency: diaperPoop ? poopConsistency || undefined : undefined,
          stoolAmount:     diaperPoop ? stoolAmount || undefined : undefined,
        };
        break;
      }
      case 'food': {
        const valid = foodEntries.filter(e => e.name.trim() || e.amount);
        const names = valid.map(e => e.name).filter(Boolean).join('、');
        const summary = valid.length === 1 ? (valid[0].amount || '記録') : `${valid.length}品`;
        data = {
          ...data,
          foodItems: JSON.stringify(valid),
          foodAmount: summary,
          foodNote:   foodNote.trim() || undefined,
          memo: [names || '離乳食', foodNote.trim()].filter(Boolean).join('\n') || undefined,
        };
        break;
      }
      case 'hold': {
        const ca = createdAtIso();
        const startD = ca ? new Date(ca) : new Date();
        let endIso: string | undefined;
        let durNote = '';
        if (holdEndTime && /^\d{1,2}:\d{2}$/.test(holdEndTime)) {
          const today = new Date().toISOString().split('T')[0];
          const end = new Date(`${today}T${holdEndTime.padStart(5, '0')}:00`);
          if (!isNaN(end.getTime())) {
            endIso = end.toISOString();
            const mins = Math.round((end.getTime() - startD.getTime()) / 60000);
            if (mins > 0) durNote = `（${mins}分間）`;
          }
        }
        data = {
          ...data,
          holdEndAt: endIso,
          memo: [durNote, holdMemo.trim()].filter(Boolean).join(' ') || undefined,
        };
        break;
      }
      case 'meal': {
        const lbl = MEAL_RESULTS.find(m => m.id === mealResult)?.label ?? mealResult;
        data = { ...data, mealResult, memo: [`ごはん: ${lbl}`, mealMemo.trim()].filter(Boolean).join(' ') || undefined };
        break;
      }
      case 'discipline': {
        const lbl = DISCIPLINE_TYPES.find(d => d.id === disciplineType)?.label ?? disciplineType;
        data = { ...data, disciplineType, memo: [`しつけ: ${lbl}`, disciplineMemo.trim()].filter(Boolean).join(' - ') || undefined };
        break;
      }
      case 'play': {
        const ids = [...playTypes];
        const labels = ids.map(id => PLAY_OPTIONS.find(o => o.id === id)?.label || id).join('・');
        data = { ...data, playTypes: ids.join('・'), memo: [labels, playMemo.trim()].filter(Boolean).join(' - ') || undefined };
        break;
      }
      case 'drink': {
        const name = drinkType === 'その他' ? (drinkCustom.trim() || '飲み物') : drinkType;
        const amt  = drinkAmount ? `（${drinkAmount}ml）` : '';
        data = { ...data, subType: name, drinkAmount: drinkAmount || undefined, memo: `${name}${amt}` || undefined };
        break;
      }
      case 'toilet':
        data = { ...data, toiletResult, memo: `トイレ: ${TOILET_RESULTS.find(t => t.id === toiletResult)?.label ?? toiletResult}` };
        break;
      case 'medicine':
        data = { ...data, medicineName: medName, medicineDose: medDose || undefined, memo: [medDose, medMemo.trim()].filter(Boolean).join(' ') || undefined };
        break;
      case 'temperature':
        data = { ...data, bodyTemperature: tempValue };
        break;
      case 'symptoms':
        data = { ...data, symptoms: [...selectedSymptoms].join(','), memo: symptomNote.trim() || undefined };
        break;
      default:
        data = { ...data, memo: textValue.trim() || undefined };
        break;
    }
    finishWith(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    logType, assignees, diaperPee, diaperPoop, poopColor, poopConsistency, stoolAmount,
    foodEntries, foodNote, holdEndTime, holdMemo, mealResult, mealMemo,
    disciplineType, disciplineMemo, playTypes, playMemo, drinkType, drinkCustom, drinkAmount,
    toiletResult, medName, medDose, medMemo, tempValue, selectedSymptoms, symptomNote, textValue,
    logTime, handleExpressSubmit,
  ]);

  if (!logType) return null;

  const TitleIcon    = TYPE_ICON[logType] ?? Edit3;
  const label        = TYPE_LABELS[logType] ?? logType;
  const showAssignee = !NO_ASSIGNEE.has(logType);
  const isMilkType   = logType === 'milk';
  const isExprType   = logType === 'expressed';
  const isSleepType  = logType === 'sleep';

  // Title text (web getDialogTitle parity)
  let titleText = `${label}の記録`;
  if (isMilkType && milkStep === 'detail') {
    titleText = selectedMilkType === 'breast' ? '母乳の記録' : selectedMilkType === 'formula' ? 'ミルクの記録' : '混合の記録';
  } else if (isSleepType && sleepStep === 'manual') {
    titleText = 'ねんねの手入力';
  } else if (isSleepType && sleepStep === 'active') {
    titleText = 'ねんね中';
  }

  // Temperature color state (web: red ≥38.5 / amber ≥37.5 / green)
  const tColor = tempValue >= 38.5 ? RED_500 : tempValue >= 37.5 ? AMBER_500 : GREEN_500;
  const tBg    = tempValue >= 38.5 ? RED_100 : tempValue >= 37.5 ? AMBER_100 : GREEN_100;
  const tStat  = tempValue >= 38.5 ? '発熱' : tempValue >= 37.5 ? '微熱' : '平熱';

  // Save guards
  const foodReady = logType !== 'food' || foodEntries.some(e => e.amount);
  const textReady = !TEXT_TYPES.has(logType) || logType === 'snack' || textValue.trim().length > 0;
  const milkDisabled =
    (selectedMilkType === 'formula' && formulaMl === 0) ||
    (selectedMilkType === 'mixed' && breastLeftMin === 0 && breastRightMin === 0 && !isExpressed && formulaMl === 0);
  const mealReady = logType !== 'meal' || !!mealResult;
  const disciplineReady = logType !== 'discipline' || !!disciplineType;
  const playReady = logType !== 'play' || playTypes.size > 0;
  const drinkReady = logType !== 'drink' || (!!drinkType && !(drinkType === 'その他' && !drinkCustom.trim()));
  const toiletReady = logType !== 'toilet' || !!toiletResult;
  const medReady = logType !== 'medicine' || medName.trim().length > 0;
  const diaperReady = logType !== 'diaper' || diaperPee || diaperPoop;

  const canSave =
    foodReady && textReady && mealReady && disciplineReady && playReady &&
    drinkReady && toiletReady && medReady && diaperReady;

  // ── shared sub-renderers ──────────────────────────────────────────────────
  const renderAssignee = () => (
    <View style={s.section}>
      <Text style={s.sectionLabel}>担当者（複数選択可）</Text>
      <View style={s.row}>
        {(['self', 'partner', 'other'] as const).map(a => {
          const on = assignees.has(a);
          const tone =
            a === 'self'
              ? { bg: PINK_500, border: PINK_500 }
              : a === 'partner'
              ? { bg: BLUE_500, border: BLUE_500 }
              : { bg: GRAY_500, border: GRAY_500 };
          return (
            <TouchableOpacity
              key={a}
              style={[
                s.performerBtn,
                on
                  ? { backgroundColor: tone.bg, borderColor: tone.border }
                  : { backgroundColor: palette.card, borderColor: GRAY_100 },
              ]}
              onPress={() => toggleAssignee(a)}
            >
              <Text style={[s.performerText, { color: on ? '#fff' : GRAY_500 }]}>
                {a === 'self' ? selfLabel : a === 'partner' ? partnerLabel : 'その他'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderTimeEdit = () => {
    const now = new Date();
    const display = logTime || `${now.getHours()}:${pad2(now.getMinutes())}`;
    return (
      <View style={{ marginTop: 4 }}>
        {showTimeEdit ? (
          <View>
            <Text style={s.sectionLabel}>記録時刻（HH:MM）</Text>
            <TextInput
              style={s.input}
              placeholder={display}
              placeholderTextColor={GRAY_400}
              value={logTime}
              onChangeText={setLogTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        ) : (
          <TouchableOpacity style={s.timeChip} onPress={() => setShowTimeEdit(true)}>
            <Clock size={13} color={GRAY_400} strokeWidth={2.5} />
            <Text style={s.timeChipText}>{display}</Text>
            <Text style={s.timeChipHint}>時間を変更</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderTextInput = (
    value: string, set: (v: string) => void, placeholder: string, multiline = false,
  ) => (
    <TextInput
      style={multiline ? [s.input, s.multilineInput] : s.input}
      placeholder={placeholder}
      placeholderTextColor={GRAY_400}
      value={value}
      onChangeText={set}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
  );

  // ─── content per dialog ────────────────────────────────────────────────────
  let body: React.ReactNode = null;

  if (isSleepType) {
    if (sleepStep === 'active' && activeSleepSession) {
      body = (
        <View style={s.section}>
          <View style={s.sleepActiveCard}>
            <View style={s.sleepActiveTop}>
              <View style={s.sleepActiveIconBox}>
                <Moon size={20} color={INDIGO_700} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sleepActiveLabel}>NOW SLEEPING</Text>
                <Text style={s.sleepElapsedText}>{fmtElapsed(sleepElapsedMin)}経過</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={s.wakeBtn}
            onPress={() => { onEndSleepSession?.(activeSleepSession.id); onClose(); }}
          >
            <Sun size={20} color="#fff" strokeWidth={2.5} />
            <Text style={s.wakeBtnText}>起きた（記録して終了）</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.outlineBtn, { borderColor: INDIGO_200, marginTop: 8 }]}
            onPress={() => { setSleepStep('manual'); setManualNoEnd(false); setManualSleepError(''); }}
          >
            <ClipboardList size={16} color={INDIGO_600} strokeWidth={2.5} />
            <Text style={[s.outlineBtnText, { color: INDIGO_600 }]}>昼寝を記録</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (sleepStep === 'manual') {
      const today = new Date().toISOString().split('T')[0];
      const sd = manualStart && /^\d{1,2}:\d{2}$/.test(manualStart) ? new Date(`${today}T${manualStart.padStart(5, '0')}:00`) : null;
      const ed = manualEnd && /^\d{1,2}:\d{2}$/.test(manualEnd) ? new Date(`${today}T${manualEnd.padStart(5, '0')}:00`) : null;
      const dur = sd && ed ? Math.round((ed.getTime() - sd.getTime()) / 60000) : 0;
      body = (
        <View style={s.section}>
          <View style={s.labelWithIcon}>
            <Moon size={14} color={GRAY_500} strokeWidth={2.5} />
            <Text style={s.sectionLabel}>入眠時刻（HH:MM）</Text>
          </View>
          <TextInput style={s.input} placeholder="HH:MM" placeholderTextColor={GRAY_400}
            value={manualStart} onChangeText={t => { setManualStart(t); setManualSleepError(''); }}
            keyboardType="numbers-and-punctuation" maxLength={5} />
          <View style={s.rowBetween}>
            <View style={s.labelWithIcon}>
              <Sun size={14} color={GRAY_500} strokeWidth={2.5} />
              <Text style={s.sectionLabel}>起床時刻（HH:MM）</Text>
            </View>
            <TouchableOpacity
              style={[s.miniToggle, manualNoEnd && s.miniToggleOn]}
              onPress={() => { setManualNoEnd(v => !v); setManualEnd(''); setManualSleepError(''); }}
            >
              <Text style={[s.miniToggleText, manualNoEnd && s.miniToggleTextOn]}>
                {manualNoEnd ? 'まだ起きていない' : '入力しない'}
              </Text>
            </TouchableOpacity>
          </View>
          {!manualNoEnd && (
            <TextInput style={s.input} placeholder="HH:MM" placeholderTextColor={GRAY_400}
              value={manualEnd} onChangeText={t => { setManualEnd(t); setManualSleepError(''); }}
              keyboardType="numbers-and-punctuation" maxLength={5} />
          )}
          {manualNoEnd && (
            <View style={s.infoBox}>
              <Text style={s.infoBoxText}>ねんね開始として記録します。起きたらタイマーを止めてください。</Text>
            </View>
          )}
          {!manualNoEnd && dur > 0 && (
            <View style={s.infoBox}>
              <Text style={[s.infoBoxText, { fontWeight: '900', color: INDIGO_700 }]}>{fmtElapsed(dur)}のねんね</Text>
            </View>
          )}
          {!!manualSleepError && <Text style={s.errorText}>{manualSleepError}</Text>}
          <View style={s.row}>
            <TouchableOpacity
              style={[s.outlineBtn, { flex: 0, paddingHorizontal: 18 }]}
              onPress={() => { setManualNoEnd(false); setSleepStep(activeSleepSession ? 'active' : 'main'); }}
            >
              <Text style={s.outlineBtnText}>戻る</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primarySolid, { flex: 1, backgroundColor: INDIGO_500 }]} onPress={handleManualSleepSubmit}>
              <Text style={s.primarySolidText}>{manualNoEnd ? 'ねんね開始' : '記録する'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } else if (!sleepShowPicker) {
      body = (
        <View style={s.section}>
          <TouchableOpacity
            style={[s.primarySolid, { backgroundColor: INDIGO_500, paddingVertical: 18 }]}
            onPress={() => { onSave({ type: 'sleep', assignees: [...assignees] as Array<'self' | 'partner' | 'other'> }); onClose(); }}
          >
            <Moon size={22} color="#fff" strokeWidth={2.5} />
            <Text style={[s.primarySolidText, { fontSize: 18 }]}>今すぐ記録する</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.outlineBtn, { borderColor: INDIGO_200, marginTop: 10 }]}
            onPress={() => { setSleepShowPicker(true); setSleepQuickNoEnd(false); setSleepQuickEnd(''); }}
          >
            <Clock size={16} color={INDIGO_600} strokeWidth={2.5} />
            <Text style={[s.outlineBtnText, { color: INDIGO_600 }]}>時刻を指定して記録</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      const today = new Date().toISOString().split('T')[0];
      const sd = sleepQuickStart && /^\d{1,2}:\d{2}$/.test(sleepQuickStart) ? new Date(`${today}T${sleepQuickStart.padStart(5, '0')}:00`) : null;
      const ed = sleepQuickEnd && /^\d{1,2}:\d{2}$/.test(sleepQuickEnd) ? new Date(`${today}T${sleepQuickEnd.padStart(5, '0')}:00`) : null;
      const dur = sd && ed ? Math.round((ed.getTime() - sd.getTime()) / 60000) : 0;
      body = (
        <View style={s.section}>
          <View style={s.labelWithIcon}>
            <Moon size={14} color={GRAY_500} strokeWidth={2.5} />
            <Text style={s.sectionLabel}>入眠時刻（HH:MM）</Text>
          </View>
          <TextInput style={s.input} placeholder="HH:MM" placeholderTextColor={GRAY_400}
            value={sleepQuickStart} onChangeText={setSleepQuickStart}
            keyboardType="numbers-and-punctuation" maxLength={5} />
          <View style={s.rowBetween}>
            <View style={s.labelWithIcon}>
              <Sun size={14} color={GRAY_500} strokeWidth={2.5} />
              <Text style={s.sectionLabel}>起床時刻（HH:MM）</Text>
            </View>
            <TouchableOpacity
              style={[s.miniToggle, sleepQuickNoEnd && s.miniToggleOn]}
              onPress={() => { setSleepQuickNoEnd(v => !v); setSleepQuickEnd(''); }}
            >
              <Text style={[s.miniToggleText, sleepQuickNoEnd && s.miniToggleTextOn]}>
                {sleepQuickNoEnd ? 'まだ起きていない' : '入力しない'}
              </Text>
            </TouchableOpacity>
          </View>
          {!sleepQuickNoEnd && (
            <TextInput style={s.input} placeholder="HH:MM" placeholderTextColor={GRAY_400}
              value={sleepQuickEnd} onChangeText={setSleepQuickEnd}
              keyboardType="numbers-and-punctuation" maxLength={5} />
          )}
          {sleepQuickNoEnd && (
            <View style={s.infoBox}>
              <Text style={s.infoBoxText}>ねんね開始として記録します。起きたらタイマーを止めてください。</Text>
            </View>
          )}
          {!sleepQuickNoEnd && dur > 0 && (
            <View style={s.infoBox}>
              <Text style={[s.infoBoxText, { fontWeight: '900', color: INDIGO_700 }]}>{fmtElapsed(dur)}のねんね</Text>
            </View>
          )}
          <View style={s.row}>
            <TouchableOpacity
              style={[s.outlineBtn, { flex: 0, paddingHorizontal: 18 }]}
              onPress={() => { setSleepShowPicker(false); setSleepQuickNoEnd(false); setSleepQuickEnd(''); }}
            >
              <Text style={s.outlineBtnText}>戻る</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primarySolid, { flex: 1, backgroundColor: INDIGO_500 }]} onPress={handleSleepQuickSubmit}>
              <Moon size={18} color="#fff" strokeWidth={2.5} />
              <Text style={s.primarySolidText}>{sleepQuickNoEnd ? 'ねんね開始' : '記録する'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  } else if (isMilkType && milkStep === 'type') {
    body = (
      <View style={s.section}>
        {renderAssignee()}
        <Text style={s.sectionLabel}>種別</Text>
        <View style={s.row}>
          {([
            { id: 'breast',  label: '母乳' },
            { id: 'formula', label: 'ミルク' },
            { id: 'mixed',   label: '混合' },
          ] as const).map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={s.bigChoiceCard}
              onPress={() => { setSelectedMilkType(opt.id); setMilkStep('detail'); }}
            >
              {opt.id === 'breast'
                ? <Heart size={26} color={PINK_500} strokeWidth={2} />
                : opt.id === 'formula'
                ? <Milk size={26} color={BLUE_500} strokeWidth={2} />
                : <Plus size={26} color={PURPLE_500} strokeWidth={2.5} />}
              <Text style={s.bigCardText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  } else if (isMilkType && milkStep === 'detail') {
    const showBreast  = selectedMilkType === 'breast' || selectedMilkType === 'mixed';
    const showFormula = selectedMilkType === 'formula' || selectedMilkType === 'mixed';
    body = (
      <View style={s.section}>
        {renderTimeEdit()}

        {showBreast && (
          <>
            <Text style={s.sectionLabel}>授乳時間</Text>
            {(breastTimerRunning || breastTimerPaused) ? (
              <View style={[s.breastTimerBox, breastTimerPaused ? { backgroundColor: GRAY_50, borderColor: GRAY_200 } : { backgroundColor: PINK_50, borderColor: PINK_200 }]}>
                <Text style={[s.breastTimerCaption, { color: breastTimerPaused ? GRAY_400 : PINK_400 }]}>
                  {(breastTimerPaused ? '一時停止中' : '授乳中') + ' — ' + (breastTimerSide === 'left' ? '左' : '右')}
                </Text>
                <Text style={[s.breastTimerVal, { color: breastTimerPaused ? GRAY_500 : PINK_600 }]}>{fmtTimer(breastTimerSec)}</Text>
                <View style={[s.row, { marginTop: 8 }]}>
                  {breastTimerPaused ? (
                    <TouchableOpacity style={[s.primarySolid, { flex: 1, backgroundColor: PINK_500, paddingVertical: 11 }]} onPress={resumeBreastTimer}>
                      <Text style={s.primarySolidText}>再開</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[s.outlineBtn, { flex: 1, borderColor: PINK_200 }]} onPress={pauseBreastTimer}>
                      <Text style={[s.outlineBtnText, { color: PINK_600 }]}>一時停止</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.primarySolid, { flex: 1, backgroundColor: GRAY_700, paddingVertical: 11 }]} onPress={stopBreastTimer}>
                    <Text style={s.primarySolidText}>終了して記録</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={s.timerStartBox}>
                <Text style={s.timerStartCaption}>タイマーで計る</Text>
                <View style={s.row}>
                  {(['left', 'right'] as const).map(side => (
                    <TouchableOpacity key={side} style={s.timerStartBtn} onPress={() => startBreastTimer(side)}>
                      <Text style={s.timerStartBtnText}>{side === 'left' ? '左' : '右'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={s.row}>
              {(['left', 'right'] as const).map(side => {
                const val = side === 'left' ? breastLeftMin : breastRightMin;
                const added = side === 'left' ? lastAddedLeft : lastAddedRight;
                return (
                  <View key={side} style={{ flex: 1 }}>
                    <Text style={s.inputSideLabel}>{side === 'left' ? '左（分）' : '右（分）'}</Text>
                    <TextInput
                      style={s.bigNumInput}
                      value={val ? String(val) : ''}
                      placeholder="0"
                      placeholderTextColor={GRAY_300}
                      keyboardType="numeric"
                      onChangeText={t => {
                        const n = Math.max(0, Math.min(99, parseInt(t) || 0));
                        if (side === 'left') { setBreastLeftMin(n); setLastAddedLeft(0); }
                        else { setBreastRightMin(n); setLastAddedRight(0); }
                      }}
                    />
                    {added > 0 && <Text style={s.addedHint}>+{added}分追加</Text>}
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[s.checkRow, { backgroundColor: BLUE_50, borderColor: BLUE_100 }]}
              onPress={() => setIsExpressed(v => !v)}
            >
              <View style={[s.checkbox, isExpressed && { backgroundColor: BLUE_500, borderColor: BLUE_500 }]}>
                {isExpressed && <Check size={13} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={[s.checkLabel, { color: BLUE_900 }]}>搾乳した母乳をあげた</Text>
            </TouchableOpacity>
            {isExpressed && (
              <View style={[s.amountBox, { backgroundColor: BLUE_50, borderColor: BLUE_100 }]}>
                <TextInput
                  style={[s.amountInput, { color: BLUE_600 }]}
                  value={expressedMl ? String(expressedMl) : ''}
                  placeholder="0"
                  placeholderTextColor={BLUE_300}
                  keyboardType="numeric"
                  onChangeText={t => setExpressedMl(Math.max(0, Math.min(500, parseInt(t) || 0)))}
                />
                <Text style={[s.amountUnit, { color: BLUE_400 }]}>ml</Text>
              </View>
            )}
          </>
        )}

        {showFormula && (
          <>
            <View style={s.rowBetween}>
              <Text style={s.sectionLabel}>{selectedMilkType === 'mixed' ? 'ミルクの量' : '飲んだ量'}</Text>
              <Text style={[s.bigAmountText, { color: formulaMl > 0 ? BLUE_600 : GRAY_300 }]}>
                {formulaMl > 0 ? `${formulaMl}ml` : '---'}
              </Text>
            </View>
            <View style={s.stepperRow}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setFormulaMl(v => Math.max(0, v - 5))}>
                <Minus size={20} color={palette.foreground} strokeWidth={2.5} />
              </TouchableOpacity>
              <TextInput
                style={[s.input, s.stepInput]}
                value={formulaMl ? String(formulaMl) : ''}
                placeholder="0"
                placeholderTextColor={GRAY_400}
                keyboardType="numeric"
                onChangeText={t => setFormulaMl(Math.max(0, Math.min(300, parseInt(t) || 0)))}
              />
              <TouchableOpacity style={s.stepBtn} onPress={() => setFormulaMl(v => Math.min(300, v + 5))}>
                <Plus size={20} color={palette.foreground} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <View style={s.chipWrap}>
              {[30, 100, 160, 220, 300].map(ml => (
                <TouchableOpacity key={ml} style={[s.presetChip, formulaMl === ml && s.presetChipOn]} onPress={() => setFormulaMl(ml)}>
                  <Text style={[s.presetText, formulaMl === ml && s.presetTextOn]}>{ml}ml</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* 吐き戻し */}
        <TouchableOpacity
          style={[s.checkRow, { backgroundColor: ORANGE_50, borderColor: ORANGE_100 }]}
          onPress={() => { setSpitUp(v => !v); if (spitUp) { setSpitUpAmount(''); setSpitUpTiming(''); setSpitUpNote(''); } }}
        >
          <View style={[s.checkbox, spitUp && { backgroundColor: ORANGE_500, borderColor: ORANGE_500 }]}>
            {spitUp && <Check size={13} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={[s.checkLabel, { color: ORANGE_900 }]}>吐き戻しあり</Text>
        </TouchableOpacity>
        {spitUp && (
          <>
            <Text style={s.sectionLabel}>吐き戻しの量</Text>
            <View style={s.row}>
              {SPIT_UP_AMOUNTS.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[s.subChip, spitUpAmount === o.value && { backgroundColor: ORANGE_100, borderColor: ORANGE_400 }]}
                  onPress={() => setSpitUpAmount(spitUpAmount === o.value ? '' : o.value)}
                >
                  <Text style={[s.subChipText, spitUpAmount === o.value && { color: ORANGE_700 }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.sectionLabel}>タイミング</Text>
            <View style={s.row}>
              {SPIT_UP_TIMINGS.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[s.subChip, spitUpTiming === o.value && { backgroundColor: ORANGE_100, borderColor: ORANGE_400 }]}
                  onPress={() => setSpitUpTiming(spitUpTiming === o.value ? '' : o.value)}
                >
                  <Text style={[s.subChipText, spitUpTiming === o.value && { color: ORANGE_700 }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.sectionLabel}>メモ（任意）</Text>
            {renderTextInput(spitUpNote, setSpitUpNote, '例）噴水のように吐いた、ダラダラ続く…', true)}
          </>
        )}

        <TouchableOpacity
          style={[s.primarySolid, { backgroundColor: BLUE_500, paddingVertical: 15, marginTop: 4 }, milkDisabled && s.btnDisabled]}
          disabled={milkDisabled}
          onPress={handleMilkSubmit}
        >
          <Text style={[s.primarySolidText, { fontSize: 17 }]}>記録する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.outlineBtn, { marginTop: 8 }]} onPress={() => setMilkStep('type')}>
          <Text style={s.outlineBtnText}>← 種別を選び直す</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isExprType) {
    if (exprStep === 'timer') {
      const totalSec = exprManualMode
        ? ((parseInt(exprManualLeft) || 0) + (parseInt(exprManualRight) || 0)) * 60
        : exprLeftSec + exprRightSec;
      body = (
        <View style={s.section}>
          {renderTimeEdit()}
          <View style={s.segmentWrap}>
            <TouchableOpacity
              style={[s.segment, !exprManualMode && s.segmentOn]}
              onPress={() => setExprManualMode(false)}
            >
              <Text style={[s.segmentText, !exprManualMode && s.segmentTextOn]}>タイマー</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segment, exprManualMode && s.segmentOn]}
              onPress={() => {
                if (exprActiveSide !== null) setExprActiveSide(null);
                if (!exprManualLeft && exprLeftSec > 0)  setExprManualLeft(String(Math.round(exprLeftSec / 60)));
                if (!exprManualRight && exprRightSec > 0) setExprManualRight(String(Math.round(exprRightSec / 60)));
                setExprManualMode(true);
              }}
            >
              <Text style={[s.segmentText, exprManualMode && s.segmentTextOn]}>手入力</Text>
            </TouchableOpacity>
          </View>

          {exprManualMode ? (
            <View style={s.row}>
              {(['left', 'right'] as const).map(side => {
                const v = side === 'left' ? exprManualLeft : exprManualRight;
                const set = side === 'left' ? setExprManualLeft : setExprManualRight;
                return (
                  <View key={side} style={s.exprManualCard}>
                    <Text style={s.exprSideLabel}>{side === 'left' ? '左' : '右'}</Text>
                    <View style={s.exprManualInputRow}>
                      <TextInput
                        style={s.exprManualInput}
                        value={v}
                        placeholder="0"
                        placeholderTextColor={GRAY_300}
                        keyboardType="numeric"
                        onChangeText={t => set(String(Math.max(0, Math.min(120, parseInt(t) || 0)) || ''))}
                      />
                      <Text style={s.exprManualUnit}>分</Text>
                    </View>
                    <Text style={s.exprSideHint}>直接入力</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.row}>
              {(['left', 'right'] as const).map(side => {
                const isActive  = exprActiveSide === side;
                const sec       = side === 'left' ? exprLeftSec : exprRightSec;
                const fired     = side === 'left' ? exprLeftAlarm : exprRightAlarm;
                return (
                  <TouchableOpacity
                    key={side}
                    style={[
                      s.exprTimerCard,
                      fired ? { backgroundColor: AMBER_50, borderColor: AMBER_300 }
                        : isActive ? { backgroundColor: TEAL_50, borderColor: TEAL_300 }
                        : { backgroundColor: GRAY_50, borderColor: GRAY_200 },
                    ]}
                    onPress={() => toggleExprSide(side)}
                  >
                    <Text style={[s.exprSideLabel, { color: fired ? AMBER_600 : isActive ? TEAL_500 : GRAY_400 }]}>
                      {side === 'left' ? '左' : '右'}
                    </Text>
                    <Text style={[s.exprTimerVal, { color: fired ? AMBER_700 : isActive ? TEAL_700 : GRAY_600 }]}>
                      {fmtTimer(sec)}
                    </Text>
                    <Text style={[s.exprSideHint, { color: fired ? AMBER_500 : isActive ? TEAL_400 : GRAY_400 }]}>
                      {fired ? 'アラーム鳴動中' : isActive ? 'タップで停止' : sec > 0 ? 'タップで再開' : 'タップで開始'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {!exprManualMode && (
            <View style={[s.row, { alignItems: 'center' }]}>
              <Text style={[s.sectionLabel, { marginTop: 0 }]}>アラーム</Text>
              <TextInput
                style={[s.alarmInput, exprAlarmMin > 0 && { borderColor: TEAL_400, color: TEAL_700 }]}
                value={exprAlarmMin === 0 ? '' : String(exprAlarmMin)}
                placeholder="0"
                placeholderTextColor={GRAY_400}
                keyboardType="numeric"
                onChangeText={t => { setExprAlarmMin(Math.max(0, Math.min(60, parseInt(t) || 0))); setExprLeftAlarm(false); setExprRightAlarm(false); }}
              />
              <Text style={s.alarmUnit}>分後</Text>
              {exprAlarmMin > 0 && (
                <TouchableOpacity style={s.alarmOff} onPress={() => { setExprAlarmMin(0); setExprLeftAlarm(false); setExprRightAlarm(false); }}>
                  <Text style={s.alarmOffText}>OFF</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={s.exprTotalRow}>
            <Text style={s.exprTotalLabel}>合計　</Text>
            <Text style={s.exprTotalVal}>{fmtTimer(totalSec)}</Text>
          </View>

          <TouchableOpacity
            style={[s.primarySolid, { backgroundColor: TEAL_500, paddingVertical: 15 }]}
            onPress={() => {
              if (exprManualMode) {
                setExprLeftSec((parseInt(exprManualLeft) || 0) * 60);
                setExprRightSec((parseInt(exprManualRight) || 0) * 60);
              }
              setExprActiveSide(null);
              setExprStep('amount');
            }}
          >
            <Droplets size={18} color="#fff" strokeWidth={2.5} />
            <Text style={[s.primarySolidText, { fontSize: 16 }]}>搾乳完了・量を記録する</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      body = (
        <View style={s.section}>
          {(exprRightSec > 0 || exprLeftSec > 0) && (
            <View style={s.exprSummary}>
              {exprRightSec > 0 && (
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.exprSummaryLabel}>右</Text>
                  <Text style={s.exprSummaryVal}>
                    {Math.floor(exprRightSec / 60)}分{exprRightSec % 60 > 0 ? `${exprRightSec % 60}秒` : ''}
                  </Text>
                </View>
              )}
              {exprRightSec > 0 && exprLeftSec > 0 && <View style={s.exprSummaryDivider} />}
              {exprLeftSec > 0 && (
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.exprSummaryLabel}>左</Text>
                  <Text style={s.exprSummaryVal}>
                    {Math.floor(exprLeftSec / 60)}分{exprLeftSec % 60 > 0 ? `${exprLeftSec % 60}秒` : ''}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View style={s.rowBetween}>
            <Text style={[s.sectionLabel, { color: TEAL_700, marginTop: 0 }]}>搾乳量</Text>
            <Text style={s.bigAmountText}>
              <Text style={{ color: TEAL_600 }}>{exprAmount > 0 ? exprAmount : 30}</Text>
              <Text style={{ fontSize: 14, color: TEAL_600 }}> ml</Text>
            </Text>
          </View>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setExprAmount(v => Math.max(10, (v > 0 ? v : 30) - 5))}>
              <Minus size={20} color={palette.foreground} strokeWidth={2.5} />
            </TouchableOpacity>
            <TextInput
              style={[s.input, s.stepInput]}
              value={String(exprAmount > 0 ? exprAmount : 30)}
              keyboardType="numeric"
              onChangeText={t => setExprAmount(Math.max(10, Math.min(300, parseInt(t) || 0)))}
            />
            <TouchableOpacity style={s.stepBtn} onPress={() => setExprAmount(v => Math.min(300, (v > 0 ? v : 30) + 5))}>
              <Plus size={20} color={palette.foreground} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <View style={s.chipWrap}>
            {[10, 50, 100, 150, 200, 300].map(ml => (
              <TouchableOpacity key={ml} style={[s.presetChip, exprAmount === ml && s.presetChipOn]} onPress={() => setExprAmount(ml)}>
                <Text style={[s.presetText, exprAmount === ml && s.presetTextOn]}>{ml}ml</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[s.primarySolid, { backgroundColor: TEAL_500, paddingVertical: 15 }]} onPress={handleExpressSubmit}>
            <Droplets size={18} color="#fff" strokeWidth={2.5} />
            <Text style={[s.primarySolidText, { fontSize: 16 }]}>記録する</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.outlineBtn, { marginTop: 8 }]} onPress={() => setExprStep('timer')}>
            <Text style={s.outlineBtnText}>タイマーに戻る</Text>
          </TouchableOpacity>
        </View>
      );
    }
  } else if (logType === 'diaper') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <View style={s.row}>
          <TouchableOpacity
            style={[s.bigCard, diaperPee ? { borderColor: BLUE_400, backgroundColor: BLUE_50 } : s.bigCardOff]}
            onPress={() => setDiaperPee(v => !v)}
          >
            <Droplets size={28} color={diaperPee ? BLUE_400 : GRAY_300} strokeWidth={2} />
            <Text style={[s.bigCardText, { color: diaperPee ? BLUE_600 : GRAY_500 }]}>おしっこ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.bigCard, diaperPoop ? { borderColor: AMBER_400, backgroundColor: AMBER_50 } : s.bigCardOff]}
            onPress={() => setDiaperPoop(v => !v)}
          >
            <CircleDot size={28} color={diaperPoop ? AMBER_400 : GRAY_300} strokeWidth={2} />
            <Text style={[s.bigCardText, { color: diaperPoop ? AMBER_700 : GRAY_500 }]}>うんち</Text>
          </TouchableOpacity>
        </View>

        {diaperPoop && (
          <View style={s.poopDetailBox}>
            <Text style={[s.sectionLabel, { color: AMBER_700 }]}>うんちの色</Text>
            <View style={s.chipWrap}>
              {POOP_COLORS.map(c => {
                const on = poopColor === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.poopColorBtn, on ? { borderColor: AMBER_500, backgroundColor: AMBER_100 } : { borderColor: GRAY_200, backgroundColor: palette.card }]}
                    onPress={() => setPoopColor(on ? '' : c.id)}
                  >
                    <View style={[s.poopSwatch, { backgroundColor: c.color }, c.border ? { borderWidth: 1, borderColor: c.border } : null]} />
                    <Text style={[s.poopColorText, { color: on ? AMBER_700 : GRAY_600 }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.sectionLabel, { color: AMBER_700 }]}>形状</Text>
            <View style={s.chipWrap}>
              {POOP_CONSISTENCY.map(c => {
                const on = poopConsistency === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.subChip, on && { backgroundColor: AMBER_500, borderColor: AMBER_500 }]}
                    onPress={() => setPoopConsistency(on ? '' : c.id)}
                  >
                    <Text style={[s.subChipText, on && { color: '#fff' }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.sectionLabel, { color: AMBER_700 }]}>量</Text>
            <View style={s.chipWrap}>
              {STOOL_AMOUNTS.map(a => {
                const on = stoolAmount === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[s.subChip, on && { backgroundColor: AMBER_500, borderColor: AMBER_500 }]}
                    onPress={() => setStoolAmount(on ? '' : a.id)}
                  >
                    <Text style={[s.subChipText, on && { color: '#fff' }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  } else if (logType === 'food') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <View style={s.rowBetween}>
          <Text style={s.sectionLabel}>食べたもの（食材ごとに記録）</Text>
          {foodEntries.some(e => e.name.trim()) && (
            <TouchableOpacity
              style={s.allCompleteBtn}
              onPress={() => setFoodEntries(foodEntries.map(e => ({ ...e, amount: '完食' })))}
            >
              <Text style={s.allCompleteText}>すべて完食</Text>
            </TouchableOpacity>
          )}
        </View>
        {foodEntries.map((entry, idx) => (
          <View key={idx} style={s.foodCard}>
            <View style={s.row}>
              <TextInput
                style={[s.input, { flex: 1, padding: 9, fontSize: 14 }]}
                placeholder="食材名（例：10倍粥）"
                placeholderTextColor={GRAY_400}
                value={entry.name}
                onChangeText={t => setFoodEntries(prev => prev.map((e, i) => i === idx ? { ...e, name: t } : e))}
              />
              {foodEntries.length > 1 && (
                <TouchableOpacity
                  style={s.foodRemove}
                  onPress={() => setFoodEntries(prev => prev.filter((_, i) => i !== idx))}
                >
                  <X size={15} color={GRAY_400} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
            <View style={s.foodAmountRow}>
              {FOOD_AMOUNTS.map(({ label, color }) => {
                const on = entry.amount === label;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[s.foodAmountBtn, on ? { backgroundColor: color, borderColor: color } : { backgroundColor: palette.card, borderColor: GRAY_200 }]}
                    onPress={() => setFoodEntries(prev => prev.map((e, i) => i === idx ? { ...e, amount: on ? '' : label } : e))}
                  >
                    <Text style={[s.foodAmountText, { color: on ? '#fff' : GRAY_500 }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={s.addFoodEntryBtn}
          onPress={() => setFoodEntries([...foodEntries, { name: '', amount: '' }])}
        >
          <Plus size={16} color={PURPLE_500} strokeWidth={2.5} />
          <Text style={s.addFoodEntryText}>食材を追加</Text>
        </TouchableOpacity>
        <Text style={s.sectionLabel}>食事メモ（任意）</Text>
        {renderTextInput(foodNote, setFoodNote, '例：嬉しそうに食べた、口を開けるまで時間がかかった…', true)}
        {!foodReady && <Text style={s.foodHint}>1つ以上の食材の量を選んでください</Text>}
      </View>
    );
  } else if (logType === 'temperature') {
    body = (
      <View style={s.section}>
        <View style={s.tempWrap}>
          <View style={s.tempValueRow}>
            <Text style={[s.tempValue, { color: tColor }]}>{tempValue.toFixed(1)}</Text>
            <Text style={[s.tempUnit, { color: tColor }]}>°C</Text>
          </View>
          <View style={[s.tempPill, { backgroundColor: tBg }]}>
            <Text style={[s.tempPillText, { color: tColor }]}>{tStat}</Text>
          </View>
          <View style={s.tempControls}>
            <TouchableOpacity
              style={s.tempStepBtn}
              onPress={() => setTempValue(v => Math.max(35.0, Math.round((v - 0.1) * 10) / 10))}
            >
              <Minus size={22} color={palette.foreground} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={s.tempPresetRow}>
              {[36.0, 36.5, 37.0, 37.5, 38.0].map(v => {
                const on = Math.abs(tempValue - v) < 0.05;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[s.tempPresetDot, on && s.tempPresetDotOn]}
                    onPress={() => setTempValue(v)}
                  >
                    <Text style={[s.tempPresetText, on && s.tempPresetTextOn]}>{v.toFixed(1)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={s.tempStepBtn}
              onPress={() => setTempValue(v => Math.min(42.0, Math.round((v + 0.1) * 10) / 10))}
            >
              <Plus size={22} color={palette.foreground} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
        {renderTimeEdit()}
      </View>
    );
  } else if (logType === 'toilet') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>結果</Text>
        <View style={s.row}>
          {TOILET_RESULTS.map(o => {
            const on = toiletResult === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                style={[s.bigChoiceCardSm, on ? { backgroundColor: CYAN_500, borderColor: CYAN_500 } : s.bigCardOff]}
                onPress={() => setToiletResult(o.id)}
              >
                <Text style={[s.bigCardText, { color: on ? '#fff' : GRAY_500 }]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  } else if (logType === 'meal') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>食べ具合</Text>
        <View style={s.foodAmountRow}>
          {MEAL_RESULTS.map((o, i) => {
            const on = mealResult === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                style={[s.foodAmountBtn, on ? { backgroundColor: ORANGE_500, borderColor: ORANGE_500 } : { backgroundColor: palette.card, borderColor: GRAY_100 }]}
                onPress={() => setMealResult(o.id)}
              >
                <Text style={[s.foodAmountText, { color: on ? '#fff' : GRAY_600 }]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.sectionLabel}>メニューメモ</Text>
        {renderTextInput(mealMemo, setMealMemo, '例：カレーライス、サラダ')}
      </View>
    );
  } else if (logType === 'discipline') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>タイプ</Text>
        <View style={s.row}>
          {DISCIPLINE_TYPES.map(o => {
            const on = disciplineType === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                style={[s.bigChoiceCardSm, on ? { backgroundColor: YELLOW_500, borderColor: YELLOW_500 } : s.bigCardOff]}
                onPress={() => setDisciplineType(o.id)}
              >
                <Text style={[s.bigCardText, { color: on ? '#fff' : GRAY_500 }]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.sectionLabel}>理由メモ</Text>
        {renderTextInput(disciplineMemo, setDisciplineMemo, '例：お片付けできた！')}
      </View>
    );
  } else if (logType === 'play') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>あそびの種類（複数選択可）</Text>
        <View style={s.chipWrap}>
          {PLAY_OPTIONS.map(o => {
            const on = playTypes.has(o.id);
            return (
              <TouchableOpacity
                key={o.id}
                style={[s.chip, on && { backgroundColor: LIME_500, borderColor: LIME_500 }]}
                onPress={() => togglePlay(o.id)}
              >
                <Text style={[s.chipText, on && { color: '#fff' }]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.sectionLabel}>メモ</Text>
        {renderTextInput(playMemo, setPlayMemo, '例：公園でブランコ、積み木タワー')}
      </View>
    );
  } else if (logType === 'drink') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>飲み物の種類</Text>
        <View style={s.chipWrap}>
          {DRINK_TYPES.map(d => {
            const on = drinkType === d;
            return (
              <TouchableOpacity
                key={d}
                style={[s.pillChip, on ? { backgroundColor: CYAN_500, borderColor: CYAN_500 } : { backgroundColor: CYAN_50, borderColor: CYAN_200 }]}
                onPress={() => setDrinkType(on ? '' : d)}
              >
                <Text style={[s.pillChipText, { color: on ? '#fff' : CYAN_700 }]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {drinkType === 'その他' && (
          <>
            <Text style={s.sectionLabel}>飲み物の名前</Text>
            {renderTextInput(drinkCustom, setDrinkCustom, '例：スポーツドリンク、豆乳...')}
          </>
        )}
        <Text style={s.sectionLabel}>量（任意）</Text>
        <View style={s.chipWrap}>
          {DRINK_AMOUNTS.map(ml => {
            const on = drinkAmount === ml;
            return (
              <TouchableOpacity
                key={ml}
                style={[s.pillChip, on ? { backgroundColor: CYAN_500, borderColor: CYAN_500 } : { backgroundColor: GRAY_50, borderColor: GRAY_200 }]}
                onPress={() => setDrinkAmount(on ? '' : ml)}
              >
                <Text style={[s.pillChipText, { color: on ? '#fff' : GRAY_600 }]}>{ml}ml</Text>
              </TouchableOpacity>
            );
          })}
          <View style={[s.row, { flex: 0, alignItems: 'center' }]}>
            <TextInput
              style={[s.input, { width: 70, padding: 8, fontSize: 13 }]}
              placeholder="その他"
              placeholderTextColor={GRAY_400}
              value={DRINK_AMOUNTS.includes(drinkAmount) ? '' : drinkAmount}
              onChangeText={setDrinkAmount}
              keyboardType="numeric"
            />
            <Text style={{ fontSize: 13, color: GRAY_500, fontFamily: fonts.body }}>ml</Text>
          </View>
        </View>
      </View>
    );
  } else if (logType === 'hold') {
    const ca = createdAtIso();
    const startD = ca ? new Date(ca) : new Date();
    let dur = 0;
    if (holdEndTime && /^\d{1,2}:\d{2}$/.test(holdEndTime)) {
      const today = new Date().toISOString().split('T')[0];
      const e = new Date(`${today}T${holdEndTime.padStart(5, '0')}:00`);
      if (!isNaN(e.getTime())) dur = Math.round((e.getTime() - startD.getTime()) / 60000);
    }
    body = (
      <View style={s.section}>
        <Text style={s.sectionLabel}>開始時刻</Text>
        {renderTimeEdit()}
        <View style={s.rowBetween}>
          <Text style={s.sectionLabel}>終了時刻（任意・HH:MM）</Text>
          {!!holdEndTime && (
            <TouchableOpacity onPress={() => setHoldEndTime('')}>
              <Text style={s.clearLink}>クリア</Text>
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          style={s.input}
          placeholder="HH:MM"
          placeholderTextColor={GRAY_400}
          value={holdEndTime}
          onChangeText={setHoldEndTime}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        {dur > 0 && <Text style={[s.infoBoxText, { color: VIOLET_500, fontWeight: '700', textAlign: 'center', marginTop: 4 }]}>{dur}分間</Text>}
        {renderAssignee()}
        <Text style={s.sectionLabel}>メモ（任意）</Text>
        {renderTextInput(holdMemo, setHoldMemo, '様子など…')}
      </View>
    );
  } else if (logType === 'medicine') {
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>おくすりの名前</Text>
        {renderTextInput(medName, setMedName, '例：カロナール')}
        <Text style={s.sectionLabel}>用量</Text>
        {renderTextInput(medDose, setMedDose, '例：5ml、1錠')}
        <Text style={s.sectionLabel}>メモ（任意）</Text>
        {renderTextInput(medMemo, setMedMemo, '例：食後に服用')}
      </View>
    );
  } else if (logType === 'symptoms') {
    body = (
      <View style={s.section}>
        <Text style={s.sectionLabel}>症状（複数選択可）</Text>
        <View style={s.chipWrap}>
          {SYMPTOM_OPTIONS.map(sym => {
            const on = selectedSymptoms.has(sym);
            return (
              <TouchableOpacity key={sym} style={[s.chip, on && s.chipOn]} onPress={() => toggleSymptom(sym)}>
                <Text style={[s.chipText, on && s.chipTextOn]}>{sym}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.sectionLabel}>メモ（任意）</Text>
        {renderTextInput(symptomNote, setSymptomNote, '詳しい様子など', true)}
      </View>
    );
  } else if (TEXT_TYPES.has(logType)) {
    const cfg: Record<string, { label: string; ph: string; multiline?: boolean }> = {
      milestone:   { label: '記念日の内容', ph: '例：はじめて寝返りした！' },
      word:        { label: '言った言葉・フレーズ', ph: '例：ママ、わんわん' },
      achievement: { label: '自分でできたこと', ph: '例：ボタンを自分で留められた' },
      thank_you:   { label: 'パートナーへのメッセージ', ph: '例：今日もお疲れさま！', multiline: true },
      school:      { label: '先生からの連絡・お友達のこと', ph: '例：今日はお友達と仲良く遊べました', multiline: true },
      appointment: { label: '病院名・内容（任意）', ph: '例: 小児科・発熱で受診', multiline: true },
      discipline:  { label: '理由メモ', ph: '例：お片付けできた！' },
      interest:    { label: '今ハマっていること', ph: '例：恐竜の図鑑、お絵かき' },
      schedule:    { label: '明日の準備・予定', ph: '例：遠足の準備、お弁当作る', multiline: true },
      school_prep: { label: '入学準備タスク', ph: '例：ランドセル選び、名前シール貼り', multiline: true },
      snack:       { label: 'おやつの内容（任意）', ph: '例：バナナ、ボーロ、おせんべい（空欄でもOK）' },
    };
    const c = cfg[logType] ?? { label: 'メモ（任意）', ph: 'メモ' };
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>{c.label}</Text>
        {renderTextInput(textValue, setTextValue, c.ph, c.multiline)}
      </View>
    );
  } else {
    // bath / toothbrush / moisturize / nail_cut / interest fallback — assignee only
    body = (
      <View style={s.section}>
        {renderTimeEdit()}
        {renderAssignee()}
        <Text style={s.sectionLabel}>メモ（任意）</Text>
        {renderTextInput(textValue, setTextValue, 'メモ')}
      </View>
    );
  }

  // Footer: which step hides the generic save button
  const hideSaveButton =
    isSleepType ||                                      // sleep has its own action buttons
    (isMilkType) ||                                     // milk has its own (type-select / detail submit)
    (isExprType);                                       // express has its own (timer / amount submit)

  const saveColor = (() => {
    switch (logType) {
      case 'diaper': return AMBER_500;
      case 'food':   return PURPLE_500;
      case 'meal':   return ORANGE_500;
      case 'toilet': return CYAN_500;
      case 'discipline': return YELLOW_500;
      case 'play':   return LIME_500;
      case 'drink':  return CYAN_500;
      case 'medicine': return PINK_500;
      case 'temperature': return tColor;
      case 'word':   return GREEN_ACCENT_500;
      case 'achievement': return '#10B981';
      case 'milestone': return PURPLE_500;
      case 'school': return SKY_500;
      case 'schedule': return VIOLET_500;
      case 'school_prep': return BLUE_500;
      case 'interest': return FUCHSIA_500;
      case 'snack':  return PINK_500;
      case 'bath':   return SKY_500;
      case 'hold':   return VIOLET_500;
      case 'appointment': return TEAL_500;
      case 'nail_cut': return SLATE_500;
      case 'moisturize': return ROSE_400;
      case 'thank_you': return RED_500;
      case 'toothbrush': return CYAN_500;
      default:       return palette.primary;
    }
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.titleRow}>
            <TitleIcon size={22} color={palette.primary} strokeWidth={2.5} />
            <Text style={s.title}>{titleText}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {body}
            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            {!hideSaveButton && (
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: saveColor }, !canSave && s.saveBtnDisabled]}
                onPress={canSave ? handleSave : undefined}
                disabled={!canSave}
              >
                <Text style={s.saveText}>記録する</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  handle: { width: 40, height: 4, backgroundColor: palette.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  title: { fontFamily: fonts.sans, fontSize: 20, fontWeight: '900', color: palette.foreground, textAlign: 'center' },

  section: { marginTop: 4, gap: 8 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: GRAY_500, marginTop: 4 },
  labelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },

  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },

  // 担当者 selector — web: py-3 rounded-2xl text-sm font-black border-2
  performerBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: radius.md, borderWidth: 2,
  },
  performerText: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700' },

  // 時間を変更
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  timeChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: GRAY_400, fontWeight: '700' },
  timeChipHint: { fontFamily: fonts.bodyBold, fontSize: 10, color: PURPLE_400, marginLeft: 4 },

  // big choice cards (milk-type / diaper / toilet) — web: h-24 rounded-2xl border-2
  bigChoiceCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, borderRadius: radius.md, borderWidth: 2, borderColor: GRAY_100,
    backgroundColor: palette.card, gap: 6,
  },
  bigChoiceCardSm: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: radius.sm, borderWidth: 2, gap: 4,
  },
  bigCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 22, borderRadius: radius.md, borderWidth: 2, gap: 6,
  },
  bigCardOff: { borderColor: GRAY_100, backgroundColor: palette.card },
  bigCardText: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700' },

  // Breast timer
  breastTimerBox: { borderRadius: radius.md, borderWidth: 2, padding: 14, alignItems: 'center' },
  breastTimerCaption: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  breastTimerVal: { fontFamily: fonts.sans, fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerStartBox: { borderRadius: radius.md, borderWidth: 1, borderColor: PINK_100, overflow: 'hidden' },
  timerStartCaption: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', color: PINK_400, textAlign: 'center', paddingVertical: 6, backgroundColor: PINK_50 },
  timerStartBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: palette.card, borderLeftWidth: 1, borderLeftColor: PINK_100 },
  timerStartBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: PINK_600 },

  inputSideLabel: { fontFamily: fonts.body, fontSize: 11, color: GRAY_400, marginBottom: 4, textAlign: 'center' },
  bigNumInput: {
    fontFamily: fonts.sans, fontSize: 28, fontWeight: '900', textAlign: 'center',
    color: GRAY_800, borderBottomWidth: 2, borderBottomColor: PINK_200, paddingVertical: 4,
  },
  addedHint: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '900', color: PINK_500, textAlign: 'center', marginTop: 2 },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: radius.sm, borderWidth: 1, marginTop: 4,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: GRAY_300,
    alignItems: 'center', justifyContent: 'center', backgroundColor: palette.card,
  },
  checkLabel: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700' },

  amountBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: radius.md, padding: 12, borderWidth: 1,
  },
  amountInput: { flex: 1, fontFamily: fonts.sans, fontSize: 32, fontWeight: '900', textAlign: 'center' },
  amountUnit: { fontFamily: fonts.sans, fontSize: 18, fontWeight: '900' },
  bigAmountText: { fontFamily: fonts.sans, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },

  subChip: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: radius.sm, borderWidth: 2, borderColor: GRAY_200, backgroundColor: palette.card,
  },
  subChipText: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: GRAY_500 },

  // segmented (express timer / 手入力)
  segmentWrap: { flexDirection: 'row', alignSelf: 'center', backgroundColor: GRAY_100, borderRadius: radius.md, padding: 4 },
  segment: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: radius.sm },
  segmentOn: { backgroundColor: palette.card, ...shadows.soft, shadowOpacity: 0.08 },
  segmentText: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '900', color: GRAY_400 },
  segmentTextOn: { color: TEAL_600 },

  exprTimerCard: { flex: 1, alignItems: 'center', borderRadius: radius.lg, borderWidth: 2, padding: 16 },
  exprManualCard: { flex: 1, alignItems: 'center', borderRadius: radius.lg, borderWidth: 2, padding: 16, backgroundColor: GRAY_50, borderColor: GRAY_200 },
  exprSideLabel: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 8, color: GRAY_400 },
  exprTimerVal: { fontFamily: fonts.sans, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  exprSideHint: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', marginTop: 8, color: GRAY_400 },
  exprManualInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  exprManualInput: {
    width: 60, fontFamily: fonts.sans, fontSize: 28, fontWeight: '900', textAlign: 'center',
    color: TEAL_700, borderBottomWidth: 2, borderBottomColor: TEAL_200, fontVariant: ['tabular-nums'],
  },
  exprManualUnit: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '900', color: GRAY_400, marginBottom: 4 },
  alarmInput: {
    width: 60, height: 38, borderRadius: radius.sm, borderWidth: 2, borderColor: GRAY_200,
    textAlign: 'center', fontFamily: fonts.sans, fontSize: 14, fontWeight: '900',
    backgroundColor: GRAY_50, color: GRAY_500,
  },
  alarmUnit: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: GRAY_400 },
  alarmOff: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: GRAY_200, backgroundColor: GRAY_50 },
  alarmOffText: { fontFamily: fonts.bodyBold, fontSize: 11, fontWeight: '900', color: GRAY_400 },
  exprTotalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 4 },
  exprTotalLabel: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: GRAY_400 },
  exprTotalVal: { fontFamily: fonts.sans, fontSize: 20, fontWeight: '900', color: TEAL_600, fontVariant: ['tabular-nums'] },
  exprSummary: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
    backgroundColor: TEAL_50, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: TEAL_100,
  },
  exprSummaryLabel: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', color: GRAY_400, marginBottom: 2 },
  exprSummaryVal: { fontFamily: fonts.sans, fontSize: 18, fontWeight: '900', color: TEAL_700 },
  exprSummaryDivider: { width: 1, backgroundColor: TEAL_200 },

  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 44, height: 44, backgroundColor: palette.card,
    borderRadius: radius.sm, borderWidth: 2, borderColor: palette.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepInput: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900', fontFamily: fonts.sans },

  // Presets
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: palette.card, borderWidth: 2, borderColor: GRAY_100 },
  presetChipOn: { backgroundColor: palette.accent, borderColor: BLUE_300 },
  presetText: { fontFamily: fonts.bodyBold, fontSize: 12, color: GRAY_500, fontWeight: '700' },
  presetTextOn: { color: palette.primary },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 2, borderColor: palette.border, backgroundColor: palette.card },
  chipOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: palette.foreground, fontWeight: '700' },
  chipTextOn: { color: palette.primaryForeground },
  pillChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
  pillChipText: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700' },

  // poop detail
  poopDetailBox: { backgroundColor: AMBER_50, borderRadius: radius.md, borderWidth: 1, borderColor: AMBER_100, padding: 12, gap: 6 },
  poopColorBtn: {
    width: '30%', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: radius.sm, borderWidth: 2,
  },
  poopSwatch: { width: 20, height: 20, borderRadius: 10 },
  poopColorText: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700' },

  // sleep active
  sleepActiveCard: {
    backgroundColor: INDIGO_100, borderRadius: radius.md, padding: 16,
    borderWidth: 1, borderColor: INDIGO_200,
  },
  sleepActiveTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sleepActiveIconBox: { backgroundColor: INDIGO_200, padding: 10, borderRadius: radius.md },
  sleepActiveLabel: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', color: INDIGO_400, letterSpacing: 1 },
  sleepElapsedText: { fontFamily: fonts.sans, fontSize: 22, fontWeight: '900', color: INDIGO_800 },
  wakeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: AMBER_500, borderRadius: radius.md, paddingVertical: 16, marginTop: 12,
  },
  wakeBtnText: { fontFamily: fonts.bodyBold, color: '#fff', fontSize: 16, fontWeight: '900' },

  infoBox: { backgroundColor: INDIGO_50, borderRadius: radius.sm, padding: 12, borderWidth: 1, borderColor: INDIGO_100 },
  infoBoxText: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: INDIGO_500, textAlign: 'center' },
  errorText: { fontFamily: fonts.bodyBold, fontSize: 12, color: RED_500, fontWeight: '700', textAlign: 'center' },
  miniToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 2, borderColor: GRAY_200, backgroundColor: palette.card },
  miniToggleOn: { backgroundColor: INDIGO_100, borderColor: INDIGO_300 },
  miniToggleText: { fontFamily: fonts.bodyBold, fontSize: 11, fontWeight: '700', color: GRAY_400 },
  miniToggleTextOn: { color: INDIGO_600 },

  // food cards
  allCompleteBtn: { backgroundColor: GREEN_500, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  allCompleteText: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: '#fff' },
  foodCard: { backgroundColor: GRAY_50, borderRadius: radius.md, padding: 12, gap: 8, borderWidth: 1, borderColor: GRAY_100 },
  foodRemove: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: GRAY_200, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  foodAmountRow: { flexDirection: 'row', gap: 4 },
  foodAmountBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  foodAmountText: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700' },
  addFoodEntryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: radius.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: PURPLE_200,
  },
  addFoodEntryText: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: PURPLE_500 },
  foodHint: { fontFamily: fonts.body, fontSize: 11, color: palette.destructive, textAlign: 'center', marginTop: 4 },

  clearLink: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', color: GRAY_400, textDecorationLine: 'underline' },

  // Inputs
  input: { backgroundColor: palette.card, borderRadius: radius.sm, padding: 13, fontSize: 15, fontFamily: fonts.body, borderWidth: 2, borderColor: palette.border, color: palette.foreground },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },

  // Temperature display
  tempWrap: { alignItems: 'center', gap: 12, paddingVertical: 4 },
  tempValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  tempValue: { fontFamily: fonts.sans, fontSize: 60, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  tempUnit: { fontFamily: fonts.sans, fontSize: 28, fontWeight: '900', marginBottom: 8, marginLeft: 4 },
  tempPill: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.full },
  tempPillText: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700' },
  tempControls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  tempStepBtn: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 2, borderColor: palette.border, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  tempPresetRow: { flexDirection: 'row', gap: 6 },
  tempPresetDot: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 2, borderColor: GRAY_200, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  tempPresetDotOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  tempPresetText: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', color: GRAY_500 },
  tempPresetTextOn: { color: palette.primaryForeground },

  // generic action buttons
  primarySolid: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.md, paddingVertical: 14,
  },
  primarySolidText: { fontFamily: fonts.bodyBold, color: '#fff', fontSize: 15, fontWeight: '900' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: radius.md, paddingVertical: 12, borderWidth: 2, borderColor: GRAY_200, backgroundColor: palette.card,
  },
  outlineBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700', color: GRAY_500 },
  btnDisabled: { opacity: 0.4 },

  // Bottom buttons
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: palette.muted, borderRadius: 6, paddingVertical: 16, alignItems: 'center' },
  cancelText: { fontFamily: fonts.bodyBold, color: GRAY_500, fontSize: 15, fontWeight: '700' },
  saveBtn: { flex: 1, backgroundColor: palette.primary, borderRadius: 6, paddingVertical: 16, alignItems: 'center', ...shadows.soft, shadowOpacity: 0.18 },
  saveBtnDisabled: { backgroundColor: '#C3B8DC', opacity: 0.7, ...shadows.none },
  saveText: { fontFamily: fonts.bodyBold, color: palette.primaryForeground, fontSize: 17, fontWeight: '900' },
});
