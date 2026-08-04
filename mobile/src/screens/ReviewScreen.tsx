import React, { useState, useMemo } from 'react';
import {
  View,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft, ChevronRight, Apple, Star, Award,
  MessageCircle, Utensils, Cookie, ArrowLeft, UtensilsCrossed,
  School, Stethoscope, Thermometer, BookOpen, Inbox,
  Milk, Baby, CalendarDays, Building2,
} from 'lucide-react-native';
import { apiGet } from '../api/client';
import { getEvents, type CalendarEvent } from '../api/events';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import type { Log } from '../api/logs';
import type { Child } from '../api/children';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Text, Title } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabKey = 'all' | 'food' | 'milestone' | 'school';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',       label: '全部' },
  { key: 'food',      label: '食事' },
  { key: 'milestone', label: '成長' },
  { key: 'school',    label: '園・予定' },
];

// ─── Type sets ────────────────────────────────────────────────────────────────

/** 食事 tab: solid food only (not milk feeds) */
const FOOD_TAB_TYPES    = new Set(['food', 'meal', 'snack']);
const MILESTONE_TYPES   = new Set(['milestone', 'first_time', 'word', 'achievement']);
const SCHOOL_LOG_TYPES  = new Set(['school', 'schedule', 'appointment']);
const ALL_LOG_TYPES     = new Set([...FOOD_TAB_TYPES, ...MILESTONE_TYPES, ...SCHOOL_LOG_TYPES]);

// ─── Metadata maps ────────────────────────────────────────────────────────────
// Icons + colors mirror the web LogReview/Timeline TYPE_CONFIG (lucide-react).

type IconCfg = { Icon: any; label: string; color: string; bg: string };

const LOG_LABEL: Record<string, IconCfg> = {
  food:        { Icon: Apple,          label: '離乳食',  color: '#F97316', bg: '#FFF7ED' },
  meal:        { Icon: Utensils,       label: 'ごはん',  color: '#D97706', bg: '#FFFBEB' },
  formula:     { Icon: Milk,           label: 'ミルク',  color: '#3B82F6', bg: '#EFF6FF' },
  breastfeed:  { Icon: Baby,           label: '母乳',    color: '#EC4899', bg: '#FDF2F8' },
  expressed:   { Icon: Milk,           label: '搾乳',    color: '#3B82F6', bg: '#EFF6FF' },
  snack:       { Icon: Cookie,         label: 'おやつ',  color: '#EAB308', bg: '#FEFCE8' },
  sleep:       { Icon: Star,           label: 'ねんね',  color: '#8C5EBA', bg: '#F2EEF6' },
  diaper_wet:  { Icon: Stethoscope,    label: 'おしっこ', color: '#F59E0B', bg: '#FFFBEB' },
  diaper_poop: { Icon: Stethoscope,    label: 'うんち',  color: '#F59E0B', bg: '#FFFBEB' },
  milestone:   { Icon: Star,           label: 'はじめて', color: '#8C5EBA', bg: '#F2EEF6' },
  first_time:  { Icon: Award,          label: 'できた',  color: '#059669', bg: '#ECFDF5' },
  word:        { Icon: MessageCircle,  label: 'ことば',  color: '#16A34A', bg: '#F0FDF4' },
  achievement: { Icon: Award,          label: 'できた！', color: '#059669', bg: '#ECFDF5' },
  school:      { Icon: School,         label: '園の記録', color: '#0284C7', bg: '#F0F9FF' },
  schedule:    { Icon: CalendarDays,   label: '予定',    color: '#8C5EBA', bg: '#F2EEF6' },
  appointment: { Icon: Stethoscope,    label: '通院',    color: '#F43F5E', bg: '#FFF1F2' },
  medicine:    { Icon: BookOpen,       label: '薬',      color: '#0D9488', bg: '#F0FDFA' },
  temperature: { Icon: Thermometer,    label: '体温',    color: '#EF4444', bg: '#FEF2F2' },
  symptoms:    { Icon: Stethoscope,    label: '症状',    color: '#F43F5E', bg: '#FFF1F2' },
  bath:        { Icon: Star,           label: 'お風呂',  color: '#0EA5E9', bg: '#F0F9FF' },
};

const MILESTONE_BADGE: Record<string, { label: string; color: string }> = {
  milestone:   { label: 'はじめて', color: '#8C5EBA' },
  first_time:  { label: 'できた',   color: '#059669' },
  word:        { label: 'ことば',   color: '#16A34A' },
  achievement: { label: 'できた！', color: '#059669' },
};

const FOOD_STAGE_META: Record<string, { label: string; color: string }> = {
  done:     { label: '完食',    color: '#4CAF50' },
  almost:   { label: 'ほぼ完食', color: '#8BC34A' },
  morehalf: { label: '半分↑',  color: '#CDDC39' },
  half:     { label: '半分',   color: '#FFC107' },
  bit:      { label: 'ひと口', color: '#FF9800' },
  little:   { label: '少し',   color: '#FF7043' },
  refuse:   { label: '拒否',   color: '#EF5350' },
};

// ─── Normalized list item ─────────────────────────────────────────────────────

interface FoodChip {
  name: string;
  stageLabel: string;
  stageColor: string;
}

interface ReviewItem {
  id: string;
  kind: 'log' | 'event';
  dateKey: string;   // YYYY-MM-DD
  sortKey: number;   // ms for ordering within a day
  time: string;      // HH:MM or ''
  Icon: any;
  iconColor: string;
  iconBg: string;
  label: string;
  detail: string;
  foodChips: FoodChip[];
  badge?: string;
  badgeColor?: string;
}

interface ReviewSection {
  dateKey: string;
  title: string;
  data: ReviewItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}

function parseFoodChips(memo?: string | null): FoodChip[] {
  if (!memo) return [];
  const firstLine = memo.split('\n')[0];
  if (!firstLine || !firstLine.includes(':')) return [];
  return firstLine.split(',').flatMap(part => {
    const idx = part.indexOf(':');
    if (idx === -1) return [];
    const name  = part.slice(0, idx).trim();
    const stage = part.slice(idx + 1).trim();
    if (!name) return [];
    const meta = FOOD_STAGE_META[stage] ?? { label: stage, color: '#999' };
    return [{ name, stageLabel: meta.label, stageColor: meta.color }];
  });
}

function foodMemoText(memo?: string | null): string {
  if (!memo) return '';
  const lines = memo.split('\n');
  // First line is food items (contains ':'), rest is user memo
  if (lines[0]?.includes(':')) return lines.slice(1).join('\n').trim();
  return memo.trim();
}

function logToItem(log: Log): ReviewItem {
  const meta = LOG_LABEL[log.type]
    ?? { Icon: UtensilsCrossed, label: log.type, color: palette.mutedForeground, bg: palette.muted };
  const d    = new Date(log.createdAt);

  let detail = '';
  if (log.bodyTemperature) detail = `${log.bodyTemperature}℃`;
  else if (log.formulaMl) detail = `${log.formulaMl}ml`;
  else if (log.expressedMl) detail = `${log.expressedMl}ml`;
  else if (log.breastLeftMin || log.breastRightMin)
    detail = `左${log.breastLeftMin ?? 0}分 右${log.breastRightMin ?? 0}分`;
  else if (log.symptoms) detail = log.symptoms;
  else if (FOOD_TAB_TYPES.has(log.type)) detail = foodMemoText(log.memo);
  else if (log.memo) detail = log.memo.replace(/\n?__nw:\d+__/, '').trim();

  const foodChips = FOOD_TAB_TYPES.has(log.type) ? parseFoodChips(log.memo) : [];
  const mBadge   = MILESTONE_TYPES.has(log.type) ? MILESTONE_BADGE[log.type] : undefined;

  return {
    id: `log-${log.id}`,
    kind: 'log',
    dateKey: toLocalDateKey(log.createdAt),
    sortKey: d.getTime(),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    Icon: meta.Icon,
    iconColor: meta.color,
    iconBg: meta.bg,
    label: meta.label,
    detail,
    foodChips,
    badge: mBadge?.label,
    badgeColor: mBadge?.color,
  };
}

function eventToItem(ev: CalendarEvent): ReviewItem {
  const sortKey = ev.time
    ? new Date(`${ev.date}T${ev.time}:00`).getTime()
    : new Date(ev.date).getTime();

  let detail = '';
  if (ev.assignee && ev.assignee !== '未定') detail = ev.assignee;
  if (ev.memo) detail = detail ? `${detail}  ${ev.memo}` : ev.memo;

  return {
    id: `event-${ev.id}`,
    kind: 'event',
    dateKey: ev.date,
    sortKey,
    time: ev.time ?? '',
    Icon: CalendarDays,
    iconColor: palette.primary,
    iconBg: palette.accent,
    label: ev.title,
    detail,
    foodChips: [],
  };
}

function buildSections(items: ReviewItem[]): ReviewSection[] {
  const map: Record<string, ReviewItem[]> = {};
  const order: string[] = [];
  for (const item of items) {
    if (!map[item.dateKey]) { map[item.dateKey] = []; order.push(item.dateKey); }
    map[item.dateKey].push(item);
  }
  order.sort((a, b) => b.localeCompare(a));
  return order.map(key => ({
    dateKey: key,
    title: formatDateHeader(key),
    data: map[key].sort((a, b) => b.sortKey - a.sortKey),
  }));
}

// ─── PDF generation ──────────────────────────────────────────────────────────

function calcAgeStr(birthday: string): string {
  const b = new Date(birthday);
  const n = new Date();
  let y = n.getFullYear() - b.getFullYear();
  let m = n.getMonth() - b.getMonth();
  if (m < 0) { y -= 1; m += 12; }
  return y > 0 ? `${y}歳${m}ヶ月` : `${m}ヶ月`;
}

function toYM(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toDisplayYM(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPdfHtml(allLogs: Log[], child: Child | null): string {
  const now       = new Date();
  const todayStr  = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const childName = child?.name ?? 'お子さま';
  const birthday  = child?.birthday ?? '';
  const ageStr    = birthday ? calcAgeStr(birthday) : '';
  const birthdayDisp = birthday
    ? new Date(birthday).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  // ── Milestone records ──
  const MS_META: Record<string, { label: string; color: string }> = {
    milestone:   { label: 'はじめて', color: '#7C5CBF' },
    first_time:  { label: 'できた',   color: '#4CAF50' },
    word:        { label: 'ことば',   color: '#29B6F6' },
    achievement: { label: 'できた！', color: '#FF9800' },
  };
  const mLogs = allLogs
    .filter(l => MILESTONE_TYPES.has(l.type))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const msByMonth: Record<string, Log[]> = {};
  for (const l of mLogs) {
    const ym = toYM(l.createdAt);
    if (!msByMonth[ym]) msByMonth[ym] = [];
    msByMonth[ym].push(l);
  }
  const msMonths = Object.keys(msByMonth).sort();

  const milestoneHtml = msMonths.map(ym => {
    const rows = msByMonth[ym].map(log => {
      const meta  = MS_META[log.type] ?? { label: log.type, color: '#555' };
      const d     = new Date(log.createdAt);
      const day   = `${d.getMonth() + 1}/${d.getDate()}`;
      const text  = log.memo ?? '';
      return `<div class="ms-item">
        <span class="badge" style="background:${meta.color}">${meta.label}</span>
        <span class="day">${day}</span>
        <span class="text">${escHtml(text)}</span>
      </div>`;
    }).join('');
    return `<div class="month-block"><div class="month-title">${toDisplayYM(ym)}</div>${rows}</div>`;
  }).join('');

  // ── Monthly stats ──
  const BREAST_TYPES = new Set(['breastfeed', 'breast']);
  const MILK_TYPES   = new Set(['formula', 'milk']);
  const DIAPER_TYPES = new Set(['diaper', 'diaper_wet', 'diaper_poop']);

  const statsByMonth: Record<string, { breast: number; milk: number; diaper: number }> = {};
  for (const log of allLogs) {
    if (!BREAST_TYPES.has(log.type) && !MILK_TYPES.has(log.type) && !DIAPER_TYPES.has(log.type)) continue;
    const ym = toYM(log.createdAt);
    if (!statsByMonth[ym]) statsByMonth[ym] = { breast: 0, milk: 0, diaper: 0 };
    if (BREAST_TYPES.has(log.type)) statsByMonth[ym].breast++;
    else if (MILK_TYPES.has(log.type)) statsByMonth[ym].milk++;
    else statsByMonth[ym].diaper++;
  }
  const statsMonths = Object.keys(statsByMonth).sort();
  const statsRows = statsMonths.map(ym => {
    const s = statsByMonth[ym];
    return `<tr><td>${toDisplayYM(ym)}</td><td>${s.breast}</td><td>${s.milk}</td><td>${s.diaper}</td></tr>`;
  }).join('');

  // ── ありがとうメッセージ ──
  const thankLogs = allLogs
    .filter(l => l.type === 'thank_you' && l.memo)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const thankHtml = thankLogs.map(log => {
    const dateStr = new Date(log.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    return `<div class="thankyou-item">
      <div class="thankyou-date">${dateStr}</div>
      <div class="thankyou-text">${escHtml(log.memo ?? '')}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escHtml(childName)}の思い出</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; color: #333; background: #fff; }
@page { size: A4; margin: 20mm; }
@media print { .no-print { display: none; } }

.cover {
  page-break-after: always; display: flex; flex-direction: column;
  align-items: center; justify-content: center; min-height: 100vh;
  text-align: center; padding: 40px;
  background: linear-gradient(135deg, #EDE7F6 0%, #F9F5FF 100%);
}
.cover-emoji  { font-size: 72px; margin-bottom: 24px; }
.cover-name   { font-size: 36px; font-weight: 700; color: #7C5CBF; margin-bottom: 8px; }
.cover-sub    { font-size: 18px; color: #666; margin-bottom: 6px; }
.cover-date   { font-size: 14px; color: #999; margin-top: 32px; }
.cover-line   { width: 80px; height: 3px; background: #7C5CBF; border-radius: 2px; margin: 20px auto; }

.section      { margin-bottom: 40px; }
.section-title {
  font-size: 22px; font-weight: 700; color: #7C5CBF;
  border-left: 5px solid #7C5CBF; padding-left: 12px; margin-bottom: 20px;
}

.month-block  { margin-bottom: 20px; }
.month-title  { font-size: 15px; font-weight: 700; color: #9C7FD0; margin-bottom: 8px; }
.ms-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: #F9F5FF; border-radius: 8px; margin-bottom: 6px;
}
.badge {
  font-size: 11px; color: #fff; border-radius: 10px; padding: 2px 8px;
  white-space: nowrap; font-weight: 600;
}
.day  { font-size: 12px; color: #999; white-space: nowrap; min-width: 36px; }
.text { font-size: 14px; color: #333; flex: 1; }

table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th { background: #7C5CBF; color: #fff; padding: 10px 14px; text-align: center; font-size: 13px; }
td { padding: 9px 14px; text-align: center; font-size: 13px; border-bottom: 1px solid #EDE7F6; }
tr:nth-child(even) td { background: #F9F5FF; }

.thankyou-item {
  background: #FFF8E7; border-left: 4px solid #FFD54F;
  padding: 12px 16px; border-radius: 6px; margin-bottom: 12px;
}
.thankyou-date { font-size: 12px; color: #999; margin-bottom: 4px; }
.thankyou-text { font-size: 14px; color: #555; line-height: 1.6; }

.empty-note { color: #B0A0D0; font-size: 14px; font-style: italic; }
.footer { text-align: center; color: #CCC; font-size: 12px; margin-top: 60px; padding-top: 20px; border-top: 1px solid #EEE; }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-emoji">📖</div>
  <div class="cover-name">${escHtml(childName)}</div>
  <div class="cover-line"></div>
  ${birthdayDisp ? `<div class="cover-sub">誕生日：${escHtml(birthdayDisp)}</div>` : ''}
  ${ageStr ? `<div class="cover-sub">現在：${escHtml(ageStr)}</div>` : ''}
  <div class="cover-date">作成日：${escHtml(todayStr)}</div>
</div>

<div class="section">
  <div class="section-title">⭐ はじめて・できた・ことばの記録</div>
  ${msMonths.length > 0 ? milestoneHtml : '<p class="empty-note">まだ記録がありません</p>'}
</div>

<div class="section" style="page-break-before: always">
  <div class="section-title">📊 月別育児サマリー</div>
  ${statsMonths.length > 0 ? `
  <table>
    <thead><tr><th>月</th><th>🤱 母乳</th><th>🍼 ミルク</th><th>🚼 おむつ</th></tr></thead>
    <tbody>${statsRows}</tbody>
  </table>` : '<p class="empty-note">まだ記録がありません</p>'}
</div>

${thankLogs.length > 0 ? `
<div class="section">
  <div class="section-title">💌 ありがとうメッセージ</div>
  ${thankHtml}
</div>` : ''}

<div class="footer">weyu — 家族の記録アプリ &nbsp;|&nbsp; ${escHtml(todayStr)} 生成</div>

</body>
</html>`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MonthNavProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}

function MonthNav({ year, month, onPrev, onNext }: MonthNavProps) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  // Web LogReview: white rounded-2xl card, ghost chevron icon buttons,
  // bold centered "yyyy年M月" label. Next disabled at current month.
  return (
    <View style={styles.monthNav}>
      <TouchableOpacity style={styles.monthArrow} onPress={onPrev} activeOpacity={0.7}>
        <ChevronLeft size={16} color={palette.mutedForeground} strokeWidth={2} />
      </TouchableOpacity>
      <Text style={styles.monthLabel}>{year}年{month}月</Text>
      <TouchableOpacity
        style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
        onPress={onNext}
        disabled={isCurrentMonth}
        activeOpacity={0.7}
      >
        <ChevronRight
          size={16}
          color={isCurrentMonth ? palette.border : palette.mutedForeground}
          strokeWidth={2}
        />
      </TouchableOpacity>
    </View>
  );
}

function ItemRow({ item }: { item: ReviewItem }) {
  const { Icon } = item;
  // Web row: colored icon box, label + time on top line, content below.
  return (
    <View style={styles.logRow}>
      <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
        <Icon size={16} color={item.iconColor} strokeWidth={2} />
      </View>
      <View style={styles.logBody}>
        {/* Label + time line */}
        <View style={styles.labelRow}>
          {item.badge ? (
            <View style={[styles.badge, { backgroundColor: item.badgeColor }]}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : null}
          <Text style={styles.logLabel}>{item.label}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.logTime}>{item.time || '--:--'}</Text>
        </View>

        {/* Food ingredient chips */}
        {item.foodChips.length > 0 && (
          <View style={styles.foodChipsRow}>
            {item.foodChips.map((chip, i) => (
              <View key={i} style={styles.foodChip}>
                <View style={[styles.stageDot, { backgroundColor: chip.stageColor }]} />
                <Text style={styles.foodChipName}>{chip.name}</Text>
                <Text style={[styles.foodChipStage, { color: chip.stageColor }]}>
                  {chip.stageLabel}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Detail / memo */}
        {item.detail ? (
          <Text style={styles.logDetail} numberOfLines={2}>{item.detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { isDark, colors } = useTheme();
  const { user }        = useAuthStore();
  const { activeChildId, activeChild } = useChildStore();
  const navigation      = useNavigation<any>();
  const familyId        = user?.familyId ?? '';
  const babyName        = activeChild()?.name;

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const { data: logs   = [], isLoading: logsLoading } = useQuery<Log[]>({
    queryKey: ['logs', familyId],
    queryFn:  () => apiGet<Log[]>(`/api/logs/${familyId}`),
    enabled: !!familyId,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['events', familyId],
    queryFn:  () => getEvents(familyId),
    enabled: !!familyId,
  });

  const isLoading = logsLoading || eventsLoading;

  const goPrev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goNext = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Logs/events filtered to current month
  const monthLogs = useMemo(() =>
    logs.filter(log => {
      const d = new Date(log.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month &&
        (activeChildId === null || log.childId === activeChildId);
    }),
    [logs, year, month, activeChildId],
  );

  const monthEvents = useMemo(() =>
    events.filter(ev => {
      const [y, m] = ev.date.split('-').map(Number);
      return y === year && m === month;
    }),
    [events, year, month],
  );

  const items = useMemo((): ReviewItem[] => {
    switch (activeTab) {
      case 'food':
        return monthLogs.filter(l => FOOD_TAB_TYPES.has(l.type)).map(logToItem);
      case 'milestone':
        return monthLogs.filter(l => MILESTONE_TYPES.has(l.type)).map(logToItem);
      case 'school':
        return [
          ...monthLogs.filter(l => SCHOOL_LOG_TYPES.has(l.type)).map(logToItem),
          ...monthEvents.map(eventToItem),
        ];
      case 'all':
      default:
        return [
          ...monthLogs.filter(l => ALL_LOG_TYPES.has(l.type)).map(logToItem),
          ...monthEvents.map(eventToItem),
        ];
    }
  }, [activeTab, monthLogs, monthEvents]);

  const sections = useMemo(() => buildSections(items), [items]);

  // Web LogReview: school tab shows a count badge of school-related records
  const schoolCount = useMemo(
    () =>
      monthLogs.filter((l) => SCHOOL_LOG_TYPES.has(l.type)).length +
      monthEvents.length,
    [monthLogs, monthEvents],
  );

  const handlePdfPress = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('思い出PDF', 'PDFの書き出しはウェブ版でご利用ください。');
      return;
    }
    const child = useChildStore.getState().activeChild();
    const html  = buildPdfHtml(logs, child);
    const w = window.open('', '_blank');
    if (!w) {
      window.alert('ポップアップがブロックされました。ポップアップを許可してください。');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.background }]}>
      {/* Sticky header — web LogReview: back arrow + (title + baby subtitle) + 思い出PDF */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={palette.mutedForeground} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Title style={styles.topBarTitle}>振り返り</Title>
          {babyName ? (
            <Text style={styles.topBarSub}>{babyName}の食事・成長・園の記録</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={handlePdfPress}
          activeOpacity={0.7}
        >
          <BookOpen size={16} color={palette.primary} strokeWidth={2} />
          <Text style={styles.pdfBtnText}>思い出PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Month navigator + tabs */}
      <View style={styles.bodyPad}>
        <MonthNav year={year} month={month} onPrev={goPrev} onNext={goNext} />

        {/* Tabs — web LogReview: grid-cols-4 pill row, border-2, purple when active */}
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const showBadge = tab.key === 'school' && schoolCount > 0 && !isActive;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {showBadge && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {schoolCount > 9 ? '9+' : schoolCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* School info banner — web LogReview: sky-50 explainer */}
        {activeTab === 'school' && (
          <View style={styles.schoolBanner}>
            <Building2 size={16} color="#0EA5E9" strokeWidth={2} />
            <Text style={styles.schoolBannerText}>
              園の記録・入学準備・よてい・しつけなど、園や学校に関連した記録をまとめて確認できます。
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <Inbox size={48} color={palette.border} strokeWidth={1.5} />
          <Text style={styles.emptyText}>この月の記録はありません</Text>
          {activeTab === 'school' && (
            <Text style={styles.emptyHint}>「きろく」から園の記録を追加できます</Text>
          )}
        </View>
      ) : (
        <SectionList
          style={styles.list}
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.dateHeaderText}>{section.title}</Text>
          )}
          renderItem={({ item }) => <ItemRow item={item} />}
          renderSectionFooter={() => <View style={styles.sectionGap} />}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Web: min-h-screen bg-gray-50
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },

  // Sticky top bar — web: bg-white border-b px-4 py-3, back arrow + title
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: fonts.sans,
    fontWeight: '700',
    color: palette.foreground,
  },
  topBarSub: {
    fontSize: 12,
    fontFamily: fonts.bodySemibold,
    color: palette.mutedForeground,
    marginTop: 1,
  },

  bodyPad: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },

  // Month navigator — web: white rounded-2xl card, ghost chevron buttons
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    gap: 12,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  monthArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  monthArrowDisabled: {
    opacity: 0.5,
  },
  monthLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.sans,
    fontWeight: '700',
    color: palette.foreground,
    textAlign: 'center',
  },
  // 思い出PDF text button — web LogReview: ghost button, purple text + BookOpen
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: palette.accent,
  },
  pdfBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.primary,
  },

  // Tab bar — web LogReview: grid-cols-4 pill buttons, border-2, purple when active
  tabBar: {
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    fontSize: 9,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  schoolBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  schoolBannerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: '#0369A1',
    lineHeight: 18,
  },
  tabActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.mutedForeground,
  },
  tabTextActive: {
    color: palette.primaryForeground,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sectionGap: { height: 12 },

  // Section / date header — web: text-xs font-black text-gray-400 px-1 pt-1
  dateHeaderText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.mutedForeground,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },

  // Log rows — web: white rounded-2xl card, divided rows
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    ...shadows.soft,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  // Web: p-2 rounded-xl colored icon box
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  logBody: {
    flex: 1,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: palette.primaryForeground,
    fontWeight: '700',
  },
  logLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.foreground,
  },
  logDetail: {
    fontSize: 13,
    fontFamily: fonts.bodySemibold,
    color: palette.foreground,
    lineHeight: 18,
  },
  logTime: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: palette.mutedForeground,
    fontWeight: '700',
  },

  // Food chips
  foodChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  foodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  foodChipName: {
    fontSize: 12,
    fontFamily: fonts.bodySemibold,
    color: palette.foreground,
  },
  foodChipStage: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },

  // Empty / loading
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: palette.mutedForeground,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: palette.border,
    textAlign: 'center',
    marginTop: -4,
  },
});
