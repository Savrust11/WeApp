/**
 * CalendarScreen — re-ported to match the canonical web page
 * WeYu/client/src/pages/Calendar.tsx.
 *
 * Web-matched presentation:
 *  • Month / Week toggle (tap centred title, ChevronUp/Down)
 *  • White rounded calendar card, red-Sun / blue-Sat weekday header,
 *    rounded day cells with selected (purple) / today (accent ring) states
 *  • Per-day dots: green = all events done, event-colour = pending,
 *    gray = data, rose = symptom/fever
 *  • Selected-date heading + purple "予定を追加" button
 *  • Single merged timeline list (events + logs) sorted by time, each row:
 *    time / coloured lucide icon pill / title + memo / assignee badge /
 *    complete + delete actions (completed → green tint + strikethrough)
 *  • Add sheet: milestone preset chips, title, lucide icon picker grid,
 *    colour swatch picker, time + assignee, memo, live preview + submit
 *
 * All existing mobile logic preserved: queries, mutations, child store,
 * events API (icon/color round-trip), AsyncStorage-free state, navigation.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Check,
  Trash2, X, CalendarDays, Baby, Star, Heart, Sparkles, Gift, Cake,
  Camera, Footprints, Syringe, Stethoscope, Utensils, TreePine, Sun,
  Music, GraduationCap,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import WeHeader from '../components/WeHeader';
import { getLogs } from '../api/logs';
import {
  getEvents, createEvent, completeEvent, deleteEvent,
  type CalendarEvent,
} from '../api/events';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Text, Title } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';
import { LogIcon, getLogVisual } from '../theme/logIcons';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** Log types shown on the calendar (mobile ids; mirrors web CALENDAR_LOG_TYPES) */
const CALENDAR_LOG_TYPES = new Set([
  'word', 'milestone', 'discipline', 'interest', 'achievement',
  'appointment', 'symptoms', 'temperature',
]);
/** mobile log id → logIcons key (canonical WeYu visuals) */
const LOG_VISUAL_KEY: Record<string, string> = {
  word: 'words', milestone: 'milestone', discipline: 'discipline',
  interest: 'hobby', achievement: 'achievement', appointment: 'clinic',
  symptoms: 'symptom', temperature: 'temperature',
};
const LOG_LABEL: Record<string, string> = {
  word: 'ことば', milestone: 'はじめて', discipline: 'しつけ',
  interest: 'きょうみ', achievement: 'できた!', appointment: '通院',
  symptoms: '症状メモ', temperature: '体温',
};

/**
 * Event icon set — lucide-react-native, same icons WeYu's Calendar
 * EVENT_ICONS array imports (Baby, Star, Heart, Sparkles, …).
 */
const EVENT_ICONS: Array<{ name: string; Icon: any; label: string }> = [
  { name: 'Baby',         Icon: Baby,         label: '赤ちゃん' },
  { name: 'Star',         Icon: Star,         label: 'スター' },
  { name: 'Heart',        Icon: Heart,        label: 'ハート' },
  { name: 'Sparkles',     Icon: Sparkles,     label: 'お祝い' },
  { name: 'Gift',         Icon: Gift,         label: 'プレゼント' },
  { name: 'Cake',         Icon: Cake,         label: 'ケーキ' },
  { name: 'Camera',       Icon: Camera,       label: '写真' },
  { name: 'Footprints',   Icon: Footprints,   label: 'あんよ' },
  { name: 'Syringe',      Icon: Syringe,      label: '予防接種' },
  { name: 'Stethoscope',  Icon: Stethoscope,  label: '健診' },
  { name: 'Utensils',     Icon: Utensils,     label: '食事' },
  { name: 'TreePine',     Icon: TreePine,     label: 'お出かけ' },
  { name: 'Sun',          Icon: Sun,          label: '晴れ' },
  { name: 'Music',        Icon: Music,        label: '音楽' },
  { name: 'GraduationCap', Icon: GraduationCap, label: '入学' },
  { name: 'CalendarDays', Icon: CalendarDays, label: '予定' },
];

/**
 * Event colour set — named like WeYu's EVENT_COLORS, with exact Tailwind v3
 * hex for dot / solid (bg) / soft icon background / icon tint.
 */
const EVENT_COLORS: Array<{
  name: string; dot: string; solid: string; iconBg: string; iconText: string; label: string;
}> = [
  { name: 'pink',   dot: '#F472B6', solid: '#EC4899', iconBg: '#FCE7F3', iconText: '#EC4899', label: 'ピンク' },
  { name: 'rose',   dot: '#FB7185', solid: '#F43F5E', iconBg: '#FFE4E6', iconText: '#F43F5E', label: 'ローズ' },
  { name: 'purple', dot: '#C084FC', solid: '#A855F7', iconBg: '#F3E8FF', iconText: '#A855F7', label: 'パープル' },
  { name: 'violet', dot: '#A78BFA', solid: '#8B5CF6', iconBg: '#EDE9FE', iconText: '#8B5CF6', label: 'バイオレット' },
  { name: 'sky',    dot: '#38BDF8', solid: '#0EA5E9', iconBg: '#E0F2FE', iconText: '#0EA5E9', label: 'スカイ' },
  { name: 'teal',   dot: '#2DD4BF', solid: '#14B8A6', iconBg: '#CCFBF1', iconText: '#14B8A6', label: 'ティール' },
  { name: 'green',  dot: '#4ADE80', solid: '#22C55E', iconBg: '#DCFCE7', iconText: '#22C55E', label: 'グリーン' },
  { name: 'amber',  dot: '#FBBF24', solid: '#F59E0B', iconBg: '#FEF3C7', iconText: '#F59E0B', label: 'アンバー' },
  { name: 'orange', dot: '#FB923C', solid: '#F97316', iconBg: '#FFEDD5', iconText: '#F97316', label: 'オレンジ' },
  { name: 'red',    dot: '#F87171', solid: '#EF4444', iconBg: '#FEE2E2', iconText: '#EF4444', label: 'レッド' },
];

const getEventColorDef = (color?: string | null) =>
  EVENT_COLORS.find(c => c.name === color) ?? EVENT_COLORS[2]; // purple default
const getEventIconDef = (icon?: string | null) =>
  EVENT_ICONS.find(i => i.name === icon)
  ?? EVENT_ICONS.find(i => i.name === 'CalendarDays')!;

/** Milestone presets — same titles/icons/colors as WeYu MILESTONE_PRESETS */
const MILESTONE_PRESETS: Array<{ title: string; icon: string; color: string }> = [
  { title: 'お宮参り',         icon: 'Baby',        color: 'pink'   },
  { title: '生後100日',        icon: 'Sparkles',    color: 'amber'  },
  { title: 'お食い初め',       icon: 'Utensils',    color: 'orange' },
  { title: 'ハーフバースデー', icon: 'Cake',        color: 'rose'   },
  { title: '初節句',           icon: 'TreePine',    color: 'green'  },
  { title: '初誕生日',         icon: 'Gift',        color: 'violet' },
  { title: '七五三',           icon: 'Star',        color: 'amber'  },
  { title: '初めてのあんよ',   icon: 'Footprints',  color: 'teal'   },
  { title: '健診',             icon: 'Stethoscope', color: 'sky'    },
  { title: '予防接種',         icon: 'Syringe',     color: 'teal'   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function showAlert(msg: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
  else Alert.alert(msg);
}
function showConfirm(msg: string, onOk: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(msg)) onOk();
  } else {
    Alert.alert('確認', msg, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: onOk },
    ]);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { user }    = useAuthStore();
  const { activeChild } = useChildStore();
  const child       = activeChild();
  const familyId    = user?.familyId ?? 'default';
  const userId      = String(user?.id ?? '');
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();

  const today = useMemo(() => new Date(), []);

  // ── View state ──────────────────────────────────────────────────────────────
  const [viewMode,     setViewMode]     = useState<'month' | 'week'>('month');
  const [currentDate,  setCurrentDate]  = useState(new Date(today));
  const [selectedDate, setSelectedDate] = useState(today);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: events = [] } = useQuery({
    queryKey: ['events', familyId],
    queryFn: () => getEvents(familyId),
    enabled: !!familyId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', familyId],
    queryFn: () => getLogs(familyId),
    enabled: !!familyId,
  });

  const calendarLogs = useMemo(
    () => logs.filter(l => CALENDAR_LOG_TYPES.has(l.type)),
    [logs],
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['events', familyId] });

  const createMut = useMutation({
    mutationFn: createEvent,
    onSuccess: invalidate,
    onError: () => showAlert('予定の保存に失敗しました。'),
  });
  const completeMut = useMutation({
    mutationFn: ({ id }: { id: number }) => completeEvent(id, userId),
    onSuccess: invalidate,
    onError: () => showAlert('完了の更新に失敗しました。'),
  });
  const deleteMut = useMutation({
    mutationFn: deleteEvent,
    onSuccess: invalidate,
    onError: () => showAlert('削除に失敗しました。'),
  });

  // ── Per-day dot map ─────────────────────────────────────────────────────────
  // green = all events done · color = pending event color · gray = data · rose = symptom/fever
  const dotMap = useMemo(() => {
    type Dot = { allDone: boolean; pending: boolean; pendingColor: string | null; data: boolean; symptom: boolean };
    const map = new Map<string, Dot>();
    const get = (d: string) => {
      if (!map.has(d)) map.set(d, { allDone: false, pending: false, pendingColor: null, data: false, symptom: false });
      return map.get(d)!;
    };

    const byDate = new Map<string, CalendarEvent[]>();
    for (const e of events) { if (!byDate.has(e.date)) byDate.set(e.date, []); byDate.get(e.date)!.push(e); }
    for (const [date, evs] of byDate) {
      const d = get(date);
      d.data = true;
      if (evs.every(e => e.completed)) d.allDone = true;
      else {
        d.pending = true;
        const first = evs.find(e => !e.completed) ?? evs[0];
        d.pendingColor = getEventColorDef(first.color).dot;
      }
    }
    for (const l of calendarLogs) {
      const dateStr = l.createdAt.slice(0, 10);
      const d = get(dateStr);
      d.data = true;
      const feverish = l.type === 'temperature' && (l.bodyTemperature ?? 0) >= 37.5;
      if (l.type === 'symptoms' || feverish) d.symptom = true;
    }
    return map;
  }, [events, calendarLogs]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else                      setSelectedDate(d => addDays(d, -7));
  };
  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else                      setSelectedDate(d => addDays(d, 7));
  };
  const toggleView = () => setViewMode(v => v === 'month' ? 'week' : 'month');

  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    if (viewMode === 'week') return;
    if (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [viewMode, currentDate]);

  // ── Month grid data ─────────────────────────────────────────────────────────
  const weeks = useMemo(() => {
    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7) cells.push(null);
    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [year, month]);

  // ── Week strip data ─────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - d.getDay()); // Sunday
    return Array.from({ length: 7 }, (_, i) => addDays(d, i));
  }, [selectedDate]);

  const headerLabel = useMemo(() => {
    const base = viewMode === 'week' ? selectedDate : currentDate;
    return `${base.getFullYear()}年 ${base.getMonth() + 1}月`;
  }, [viewMode, currentDate, selectedDate]);

  // ── Selected day timeline (events + logs merged, sorted by time) ─────────────
  const selectedStr = fmt(selectedDate);
  const timelineItems = useMemo(() => {
    type Item = {
      key: string; time: number; timeStr: string;
      kind: 'event' | 'log';
      event?: CalendarEvent; log?: typeof logs[number];
    };
    const items: Item[] = [];
    for (const e of events.filter(ev => ev.date === selectedStr)) {
      const t = e.time ?? '';
      const [hh, mm] = t ? t.split(':').map(Number) : [9, 0];
      items.push({
        key: `event-${e.id}`,
        time: (hh || 0) * 60 + (mm || 0),
        timeStr: e.time ?? '--:--',
        kind: 'event',
        event: e,
      });
    }
    for (const l of calendarLogs.filter(lg => lg.createdAt.startsWith(selectedStr))) {
      const d = new Date(l.createdAt);
      items.push({
        key: `log-${l.id}`,
        time: d.getHours() * 60 + d.getMinutes(),
        timeStr: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        kind: 'log',
        log: l,
      });
    }
    items.sort((a, b) => a.time - b.time);
    return items;
  }, [events, calendarLogs, selectedStr]);

  // ── Add event modal ─────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [fTitle,    setFTitle]    = useState('');
  const [fDate,     setFDate]     = useState(selectedStr);
  const [fTime,     setFTime]     = useState('');
  const [fAssignee, setFAssignee] = useState<'パパ' | 'ママ' | '未定'>('未定');
  const [fIcon,     setFIcon]     = useState('CalendarDays');
  const [fColor,    setFColor]    = useState('purple');
  const [fMemo,     setFMemo]     = useState('');

  const openAddModal = () => {
    setFTitle(''); setFDate(selectedStr); setFTime('');
    setFAssignee('未定'); setFIcon('CalendarDays'); setFColor('purple'); setFMemo('');
    setShowAddModal(true);
  };

  const applyPreset = (p: typeof MILESTONE_PRESETS[number]) => {
    setFTitle(p.title); setFIcon(p.icon); setFColor(p.color);
  };

  const handleCreate = () => {
    if (!fTitle.trim()) { showAlert('タイトルを入力してください'); return; }
    createMut.mutate({
      familyId, title: fTitle.trim(), date: fDate, time: fTime || undefined,
      assignee: fAssignee, icon: fIcon, color: fColor, memo: fMemo,
    });
    setShowAddModal(false);
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderDots = (dateStr: string, onSelected = false) => {
    const d = dotMap.get(dateStr);
    if (!d || !(d.data || d.symptom)) return null;
    return (
      <View style={st.dotsRow}>
        {d.allDone ? (
          <View style={[st.dot, { backgroundColor: '#4ADE80' }]} />
        ) : d.pending ? (
          <View style={[st.dot, { backgroundColor: onSelected ? '#FFFFFF' : (d.pendingColor ?? '#C084FC') }]} />
        ) : d.data ? (
          <View style={[st.dot, { backgroundColor: onSelected ? 'rgba(255,255,255,0.6)' : '#D1D5DB' }]} />
        ) : null}
        {d.symptom && (
          <View style={[st.dot, { backgroundColor: onSelected ? '#FECDD3' : '#FB7185' }]} />
        )}
      </View>
    );
  };

  const renderMonthGrid = () => (
    <View style={[st.calCard, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.dayLabels}>
        {DAY_LABELS.map((d, i) => (
          <Text key={d} style={[st.dayLabel, i === 0 ? st.sunLabel : i === 6 ? st.satLabel : null]}>{d}</Text>
        ))}
      </View>
      <View style={st.grid}>
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return <View key={`e${wi}-${di}`} style={st.dayCellWrap} />;
            const date    = new Date(year, month, day);
            const dateStr = fmt(date);
            const isSel   = selectedStr === dateStr;
            const isTd    = fmt(today) === dateStr;
            const isSun   = di === 0;
            const isSat   = di === 6;
            return (
              <View key={dateStr} style={st.dayCellWrap}>
                <TouchableOpacity
                  style={[st.dayCell, isSel && st.dayCellSel, isTd && !isSel && st.dayCellToday]}
                  onPress={() => handleDayPress(date)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    st.dayNum,
                    isSel ? st.dayNumSel : isTd ? st.dayNumToday : isSun ? st.dayNumSun : isSat ? st.dayNumSat : null,
                  ]}>
                    {day}
                  </Text>
                  {renderDots(dateStr, isSel)}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const renderWeekStrip = () => (
    <View style={[st.calCard, { padding: 10 }]}>
      <View style={st.dayLabels}>
        {DAY_LABELS.map((d, i) => (
          <Text key={d} style={[st.dayLabelSm, i === 0 ? st.sunLabel : i === 6 ? st.satLabel : null]}>{d}</Text>
        ))}
      </View>
      <View style={st.weekStrip}>
        {weekDays.map((date, i) => {
          const dateStr = fmt(date);
          const isSel   = selectedStr === dateStr;
          const isTd    = fmt(today) === dateStr;
          const isSun   = i === 0;
          const isSat   = i === 6;
          return (
            <View key={dateStr} style={st.weekCellWrap}>
              <TouchableOpacity
                style={[st.weekCell, isSel && st.weekCellSel, isTd && !isSel && st.weekCellToday]}
                onPress={() => handleDayPress(date)}
                activeOpacity={0.7}
              >
                <Text style={[
                  st.weekDayNum,
                  isSel ? st.weekDayNumSel : isTd ? st.weekDayNumToday : isSun ? st.sunLabel : isSat ? st.satLabel : null,
                ]}>
                  {date.getDate()}
                </Text>
                {renderDots(dateStr, isSel)}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderTimeline = () => {
    if (timelineItems.length === 0) {
      return (
        <View style={[st.emptyCard, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <CalendarDays size={40} color={palette.border} strokeWidth={1.5} />
          <Text style={st.emptyText}>この日の記録はありません</Text>
        </View>
      );
    }
    return (
      <View style={[st.timelineCard, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
        {timelineItems.map((item, idx) => {
          const divider = idx > 0;
          if (item.kind === 'event' && item.event) {
            const ev = item.event;
            const colorDef = getEventColorDef(ev.color);
            const iconDef = getEventIconDef(ev.icon);
            const EvIcon = iconDef.Icon;
            const done = ev.completed;
            return (
              <View
                key={item.key}
                style={[
                  st.row,
                  divider && st.rowDivider,
                  done ? st.rowDone : st.rowPending,
                ]}
              >
                <Text style={st.rowTime}>{item.timeStr}</Text>
                <View style={[
                  st.rowIconBox,
                  { backgroundColor: done ? '#DCFCE7' : colorDef.iconBg },
                ]}>
                  <EvIcon size={14} color={done ? '#22C55E' : colorDef.iconText} strokeWidth={2} />
                </View>
                <View style={st.rowBody}>
                  <Text style={[st.rowTitle, done && st.rowTitleDone]} numberOfLines={1}>
                    {ev.title}
                  </Text>
                  {ev.memo ? <Text style={st.rowMemo} numberOfLines={1}>{ev.memo}</Text> : null}
                </View>
                {ev.assignee && (
                  <View style={[
                    st.assigneeBadge,
                    ev.assignee === 'パパ' ? st.assigneePapa
                      : ev.assignee === 'ママ' ? st.assigneeMama : st.assigneeNeutral,
                  ]}>
                    <Text style={[
                      st.assigneeText,
                      ev.assignee === 'パパ' ? st.assigneeTextPapa
                        : ev.assignee === 'ママ' ? st.assigneeTextMama : st.assigneeTextNeutral,
                    ]}>
                      {ev.assignee}
                    </Text>
                  </View>
                )}
                {!done && (
                  <TouchableOpacity style={st.iconBtn} onPress={() => completeMut.mutate({ id: ev.id })}>
                    <Check size={14} color="#22C55E" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={st.iconBtn}
                  onPress={() => showConfirm(`「${ev.title}」を削除しますか？`, () => deleteMut.mutate(ev.id))}
                >
                  <Trash2 size={14} color={palette.border} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            );
          }
          const log = item.log!;
          const vis = getLogVisual(LOG_VISUAL_KEY[log.type] ?? log.type);
          return (
            <View key={item.key} style={[st.row, divider && st.rowDivider]}>
              <Text style={st.rowTime}>{item.timeStr}</Text>
              <View style={[st.rowIconBox, { backgroundColor: vis.soft }]}>
                <LogIcon type={LOG_VISUAL_KEY[log.type] ?? log.type} size={14} strokeWidth={2} />
              </View>
              <View style={st.rowBody}>
                <Text style={st.rowTitle} numberOfLines={1}>
                  {LOG_LABEL[log.type] ?? log.type}
                  {log.type === 'temperature' && log.bodyTemperature
                    ? <Text style={st.rowDetailInline}>  {log.bodyTemperature}°C</Text> : null}
                </Text>
                {log.type === 'symptoms' && log.symptoms ? (
                  <Text style={st.rowMemo} numberOfLines={1}>{log.symptoms.replace(/,/g, '・')}</Text>
                ) : log.memo ? (
                  <Text style={st.rowMemo} numberOfLines={1}>{log.memo}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const PreviewIcon = getEventIconDef(fIcon).Icon;
  const previewColor = getEventColorDef(fColor);

  return (
    <View style={[st.container, isDark && { backgroundColor: colors.background }]}>
      {/* Single page scroll — web: whole Calendar page scrolls under <Header /> */}
      <ScrollView
        style={[st.pageScroll, isDark && { backgroundColor: colors.background }]}
        contentContainerStyle={st.pageContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header (web-parity component, same as Home) ───────────────── */}
        <WeHeader />

        {/* ── Month / week nav — web: ghost chevrons + centred toggle title ── */}
        <View style={st.navRow}>
          <TouchableOpacity style={st.navBtn} onPress={navigatePrev} activeOpacity={0.7}>
            <ChevronLeft size={20} color={palette.mutedForeground} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleView} style={st.titleBtn} activeOpacity={0.7}>
            <Text style={st.titleText}>{headerLabel}</Text>
            {viewMode === 'week'
              ? <ChevronDown size={16} color={palette.mutedForeground} strokeWidth={2} />
              : <ChevronUp size={16} color={palette.mutedForeground} strokeWidth={2} />}
          </TouchableOpacity>
          <TouchableOpacity style={st.navBtn} onPress={navigateNext} activeOpacity={0.7}>
            <ChevronRight size={20} color={palette.mutedForeground} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Calendar card ─────────────────────────────────────────────── */}
        <View style={st.calWrap}>
          {viewMode === 'month' ? renderMonthGrid() : renderWeekStrip()}
        </View>

        {/* ── Selected-date heading + add button + timeline ─────────────── */}
        <View style={st.panel}>
          <View style={st.selectedRow}>
            <Title style={st.panelTitle}>
              {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日（{DAY_LABELS[selectedDate.getDay()]}）
            </Title>
            <TouchableOpacity style={st.addBtn} onPress={openAddModal} activeOpacity={0.85}>
              <Plus size={16} color={palette.primaryForeground} strokeWidth={2.5} />
              <Text style={st.addBtnText}>予定を追加</Text>
            </TouchableOpacity>
          </View>
          {renderTimeline()}
        </View>
      </ScrollView>

      {/* ── Add event sheet (web: bottom sheet, single scroll) ──────────── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={st.modalOverlay}>
          <View style={[st.modalSheet, isDark && { backgroundColor: colors.card }]}>
            <View style={st.sheetHandle} />
            <View style={st.modalHeader}>
              <Title style={st.modalTitle}>予定を追加</Title>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={10}>
                <X size={20} color={palette.mutedForeground} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Milestone presets */}
              <Text style={st.fieldLabel}>よく使う記念日</Text>
              <View style={st.presetWrap}>
                {MILESTONE_PRESETS.map(p => {
                  const pc = getEventColorDef(p.color);
                  const PI = getEventIconDef(p.icon).Icon;
                  const on = fTitle === p.title && fColor === p.color;
                  return (
                    <TouchableOpacity
                      key={p.title}
                      style={[st.presetChip, on && { backgroundColor: pc.solid, borderColor: pc.solid }]}
                      onPress={() => applyPreset(p)}
                      activeOpacity={0.8}
                    >
                      <PI size={12} color={on ? '#FFFFFF' : pc.iconText} strokeWidth={2} />
                      <Text style={[st.presetChipText, on && { color: '#FFFFFF' }]}>{p.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title */}
              <Text style={st.fieldLabel}>タイトル</Text>
              <TextInput
                style={st.input}
                placeholder="例：お宮参り、健診、誕生日"
                placeholderTextColor="#aaa"
                value={fTitle}
                onChangeText={setFTitle}
              />

              {/* Icon picker */}
              <Text style={st.fieldLabel}>アイコン</Text>
              <View style={st.iconGrid}>
                {EVENT_ICONS.map(({ name, Icon: Ico }) => {
                  const on = fIcon === name;
                  const cd = getEventColorDef(fColor);
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[st.iconCell, on && { backgroundColor: cd.solid }]}
                      onPress={() => setFIcon(name)}
                      activeOpacity={0.8}
                    >
                      <Ico size={18} color={on ? '#FFFFFF' : palette.mutedForeground} strokeWidth={2} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Color picker */}
              <Text style={st.fieldLabel}>カラー</Text>
              <View style={st.colorRow}>
                {EVENT_COLORS.map(c => (
                  <TouchableOpacity
                    key={c.name}
                    style={[
                      st.colorCircle,
                      { backgroundColor: c.dot },
                      fColor === c.name && st.colorCircleSel,
                    ]}
                    onPress={() => setFColor(c.name)}
                    activeOpacity={0.8}
                  />
                ))}
              </View>

              {/* Time + Assignee */}
              <View style={st.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>時間（任意）</Text>
                  <TextInput style={st.input} placeholder="HH:MM" placeholderTextColor="#aaa" value={fTime} onChangeText={setFTime} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>担当</Text>
                  <View style={st.assigneeChips}>
                    {(['未定', 'パパ', 'ママ'] as const).map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[st.assigneeChip, fAssignee === opt && st.assigneeChipOn]}
                        onPress={() => setFAssignee(opt)}
                        activeOpacity={0.8}
                      >
                        <Text style={[st.assigneeChipText, fAssignee === opt && st.assigneeChipTextOn]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Memo */}
              <Text style={st.fieldLabel}>メモ（任意）</Text>
              <TextInput
                style={[st.input, st.inputMulti]}
                placeholder="持ち物や注意点など"
                placeholderTextColor="#aaa"
                value={fMemo}
                onChangeText={setFMemo}
                multiline
                numberOfLines={3}
              />

              {/* Preview + submit */}
              <View style={st.previewRow}>
                <View style={[st.previewIconBox, { backgroundColor: previewColor.solid }]}>
                  <PreviewIcon size={20} color="#FFFFFF" strokeWidth={2} />
                </View>
                <TouchableOpacity
                  style={[st.submitBtn, { backgroundColor: previewColor.solid }]}
                  onPress={handleCreate}
                  disabled={createMut.isPending || !fTitle.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={st.submitText}>
                    {createMut.isPending ? '追加中...' : fTitle.trim() ? `「${fTitle}」を追加する` : 'この日に追加する'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  // Web: gradient from-purple-50 via-white to-green-50
  container: { flex: 1, backgroundColor: palette.background },

  // Single page scroll wrapping header + calendar + day panel (web parity)
  pageScroll: { flex: 1 },
  pageContent: { paddingBottom: 100 },

  // Month/week nav row — web: flex justify-between, ghost icon buttons
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '700', color: palette.foreground },

  // Calendar card — web: bg-white/80 rounded-3xl p-3/4 border shadow-sm
  calWrap: { paddingHorizontal: 24, paddingBottom: 4 },
  calCard: {
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Weekday labels — red Sun / blue Sat
  dayLabels: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground, paddingVertical: 4 },
  dayLabelSm: { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground, paddingVertical: 2 },
  sunLabel: { color: '#F87171' },
  satLabel: { color: '#60A5FA' },

  // Month grid — web: grid-cols-7 gap-1, aspect-square rounded-2xl cells
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellWrap: { width: `${100 / 7}%`, padding: 2 },
  dayCell: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  dayCellSel: { backgroundColor: palette.primary, ...shadows.soft, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  dayCellToday: { backgroundColor: palette.accent, borderWidth: 2, borderColor: '#D8B4FE' },
  dayNum: { fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.foreground },
  dayNumSel: { color: palette.primaryForeground },
  dayNumToday: { color: palette.primary },
  dayNumSun: { color: '#F87171' },
  dayNumSat: { color: '#60A5FA' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  // Week strip — web: compact h-10 cells
  weekStrip: { flexDirection: 'row' },
  weekCellWrap: { width: `${100 / 7}%`, padding: 2 },
  weekCell: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: 2 },
  weekCellSel: { backgroundColor: palette.primary },
  weekCellToday: { backgroundColor: palette.accent, borderWidth: 2, borderColor: '#D8B4FE' },
  weekDayNum: { fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.foreground },
  weekDayNumSel: { color: palette.primaryForeground },
  weekDayNumToday: { color: palette.primary },

  // Day panel — web: px-6 below the calendar card
  panel: { paddingHorizontal: 24 },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
  },
  panelTitle: { fontSize: 16, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtnText: { color: palette.primaryForeground, fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700' },

  // Empty card — web: bg-white/60 rounded-3xl p-8 center
  emptyCard: {
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
    ...shadows.soft,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyText: { color: palette.mutedForeground, fontSize: 13, fontFamily: fonts.bodyBold, fontWeight: '700' },

  // Timeline card — web: bg-white/60 rounded-3xl, divide-y rows
  timelineCard: {
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    ...shadows.soft,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  rowPending: { backgroundColor: 'rgba(140,94,186,0.05)' },
  rowDone: { backgroundColor: 'rgba(106,175,134,0.08)' },
  rowTime: {
    width: 40,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.mutedForeground,
  },
  rowIconBox: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.foreground },
  rowTitleDone: { textDecorationLine: 'line-through', color: palette.mutedForeground },
  rowDetailInline: { fontFamily: fonts.body, fontWeight: '400', color: palette.mutedForeground },
  rowMemo: { fontSize: 11, fontFamily: fonts.body, color: palette.mutedForeground, marginTop: 2 },

  assigneeBadge: { borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  assigneePapa: { backgroundColor: '#DBEAFE' },
  assigneeMama: { backgroundColor: '#FCE7F3' },
  assigneeNeutral: { backgroundColor: palette.muted },
  assigneeText: { fontSize: 10, fontFamily: fonts.bodyBold, fontWeight: '700' },
  assigneeTextPapa: { color: '#2563EB' },
  assigneeTextMama: { color: '#DB2777' },
  assigneeTextNeutral: { color: palette.mutedForeground },
  iconBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },

  // Modal — web: bg-white rounded-t-[2rem] p-6
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: palette.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground },

  fieldLabel: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground, marginTop: 14, marginBottom: 6 },

  // Preset chips — web: flex-wrap rounded-2xl border-2
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.lg, borderWidth: 2, borderColor: palette.border,
    backgroundColor: palette.card,
  },
  presetChipText: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },

  input: {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.foreground,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },

  // Icon picker — web: grid-cols-8
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconCell: {
    width: `${(100 - 7 * 2) / 8}%`,
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Color swatches — web: round border-4
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 4, borderColor: 'transparent' },
  colorCircleSel: { borderColor: '#9CA3AF', transform: [{ scale: 1.1 }] },

  twoCol: { flexDirection: 'row', gap: 12 },
  assigneeChips: { flexDirection: 'row', gap: 4, marginTop: 0 },
  assigneeChip: {
    flex: 1, paddingVertical: 11, borderRadius: radius.lg,
    borderWidth: 1, borderColor: palette.border, alignItems: 'center',
  },
  assigneeChipOn: { borderColor: palette.primary, backgroundColor: palette.accent },
  assigneeChipText: { fontSize: 12, fontFamily: fonts.bodySemibold, color: palette.mutedForeground },
  assigneeChipTextOn: { color: palette.primary, fontFamily: fonts.bodyBold, fontWeight: '700' },

  // Preview + submit — web: icon pill + flex-1 colored button
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  previewIconBox: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  submitBtn: { flex: 1, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', ...shadows.soft, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  submitText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.sans, fontWeight: '700' },
});
