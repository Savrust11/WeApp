/**
 * DashboardScreen — re-ported 1:1 from the canonical web project
 * WeYu/client/src/pages/Dashboard.tsx ("貢献度ダッシュボード").
 *
 * Section order / styling / labels / icons match WeYu exactly:
 *   1. Title block (centered heading + subtitle)
 *   2. Range tabs: 今日 / 1週間 / 全期間 (web: today / week / all)
 *   3. 負担割合  — donut pie (react-native-svg) + per-user % bars
 *   4. Imbalance notice — amber card when one side ≥ 80%
 *   5. タスク別の内訳 — horizontal stacked bars per log type
 *   6. 時給換算 — 件数 × 10分 → 時給1121円換算
 *   7. 名もなき育児を記録 — chore logging + recent list (assignee + time)
 *   8. Chore dialog (performer selector + chore grid + カスタム追加)
 *   9. Custom-item add dialog (name + preset icon picker)
 *
 * Data wiring (no new backend contracts — reuses the endpoints WeYu's hooks use):
 *   • Logs              GET  /api/logs/:familyId            (same as WeYu useLogs)
 *   • Create chore log  POST /api/logs                      (same as WeYu useCreateLog:
 *                        { type:"chore", message, subType, performedBy })
 *   • Custom items      GET  /api/families/:familyId/custom-childcare-items
 *                        POST /api/families/:familyId/custom-childcare-items
 *                        (same endpoints as WeYu useCustomChildcareItems /
 *                         useCreateCustomChildcareItem; already used by SettingsScreen)
 *
 * Adaptations vs web:
 *   • recharts → react-native-svg donut + flex/View stacked bars (same colors).
 *   • framer-motion AnimatePresence → conditional render (no entrance anim).
 *   • Radix Dialog → RN <Modal> bottom sheet (matches the app's modal pattern).
 *   • Web useUserLabels (localStorage rename) has no mobile equivalent and is
 *     shared infra we cannot add — labels derive from auth role (papa→パパ,
 *     mama→ママ, other→その他), with the same papa/mama colour semantics.
 *   • activeChild filtering uses the mobile childStore (web uses useActiveChild);
 *     same predicate: keep logs with no childId or matching the active child.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  TrendingUp,
  Clock,
  Sparkles,
  Shirt,
  ShoppingCart,
  Trash2,
  Utensils,
  Zap,
  Plus,
  X,
  Milk,
  Heart,
  Bath,
  Droplets,
  Star,
  Stethoscope,
  Pill,
  Scissors,
  Brush,
  Bike,
  Package,
  Lamp,
  HandHeart,
  Thermometer,
} from 'lucide-react-native';
import { apiGet, apiPost, apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import type { Log } from '../api/logs';
import { palette, fonts, radius } from '../theme/tokens';
import { Screen, Card, Button, Text, Title } from '../theme/ui';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type RangeKey = 'today' | 'week' | 'all';
type Performer = 'mama' | 'papa' | 'other';

interface ChoreDef {
  id: string;
  title: string;
  icon: typeof Heart;
  isCustom: boolean;
}

interface CustomItem {
  id: number;
  itemName: string;
  icon: string;
  isActive: boolean;
}

// ─────────────────────────────────────────────
// Constants — verbatim from web Dashboard.tsx
// ─────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Heart> = {
  Star, Stethoscope, Pill, Scissors, Brush, Bike, Package, Lamp, HandHeart, Thermometer,
  Shirt, ShoppingCart, Trash2, Utensils, Bath, Droplets, Milk, Heart,
};

const PRESET_ICONS: { name: string; icon: typeof Heart }[] = [
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'HandHeart', icon: HandHeart },
  { name: 'Scissors', icon: Scissors },
  { name: 'Brush', icon: Brush },
  { name: 'Package', icon: Package },
  { name: 'Lamp', icon: Lamp },
  { name: 'Thermometer', icon: Thermometer },
  { name: 'Pill', icon: Pill },
  { name: 'Bike', icon: Bike },
];

const UNNAMED_CHORES: { id: string; title: string; icon: typeof Heart }[] = [
  { id: 'laundry', title: '洗濯', icon: Shirt },
  { id: 'bottle_wash', title: '哺乳瓶洗い', icon: Milk },
  { id: 'shopping', title: '買い物', icon: ShoppingCart },
  { id: 'trash', title: 'ゴミ出し', icon: Trash2 },
  { id: 'cooking', title: '食事の準備', icon: Utensils },
  { id: 'bath_clean', title: 'お風呂の掃除', icon: Bath },
  { id: 'refill', title: 'シャンプー・洗剤の入替', icon: Droplets },
];

const TYPE_LABELS: Record<string, string> = {
  milk: 'ミルク',
  food: '離乳食',
  diaper: 'おむつ',
  sleep: 'ねんね',
  play: 'あそび',
  sos: 'レスキュー',
  thanks: 'ありがとう',
  event_done: '予定完了',
  temp: '体温',
  symptom: '症状メモ',
  milestone: 'マイルストーン',
  routine_complete: 'ルーティン',
  chore: '名もなき育児',
};

const HOURLY_RATE = 1121;
const MINUTES_PER_TASK = 10;
const TASK_VALUE = Math.round((HOURLY_RATE * MINUTES_PER_TASK) / 60);

const PAPA_COLOR = '#7C5CBF';
const MAMA_COLOR = '#E8A0BF';

// ─────────────────────────────────────────────
// Date helpers (web used date-fns: startOfDay / subDays / isSameDay)
// ─────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function subDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() - days);
  return n;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// web: isToday ? "HH:mm" : "M/d HH:mm"
function formatLogTime(d: Date, today: boolean): string {
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return today ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

// SVG donut arc path (replaces recharts <Pie innerRadius=30 outerRadius=55>)
function donutSlice(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const polar = (r: number, a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  // clamp a full circle slightly so the arc renders
  const sweep = endAngle - startAngle;
  const adj = sweep >= 360 ? 359.999 : sweep;
  const e = startAngle + adj;
  const p1 = polar(rOuter, startAngle);
  const p2 = polar(rOuter, e);
  const p3 = polar(rInner, e);
  const p4 = polar(rInner, startAngle);
  const large = adj > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

// ─────────────────────────────────────────────
// DashboardScreen
// ─────────────────────────────────────────────

export default function DashboardScreen(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';
  const userRole: Performer = user?.role ?? 'papa';
  const queryClient = useQueryClient();

  const activeChildId = useChildStore((s) => s.activeChildId);

  // web useUserLabels has no mobile equivalent (shared infra) → derive from role
  const papaLabel = 'パパ';
  const mamaLabel = 'ママ';
  const getUserLabel = (id: string): string =>
    id === 'papa' ? papaLabel : id === 'mama' ? mamaLabel : 'その他';

  // ── Logs (web: useLogs(familyId)) ─────────────
  const { data: allLogs = [] } = useQuery<Log[]>({
    queryKey: ['logs', familyId],
    queryFn: () => apiGet<Log[]>(`/api/logs/${familyId}`),
    enabled: !!familyId,
    refetchInterval: 3000,
  });

  // web: filter to the active child (keep logs w/o childId or matching child)
  const logs = useMemo(() => {
    if (!activeChildId) return allLogs;
    return allLogs.filter(
      (l: any) => !l.childId || l.childId === activeChildId,
    );
  }, [allLogs, activeChildId]);

  // ── Custom childcare items (web: useCustomChildcareItems) ──
  const { data: customItems = [] } = useQuery<CustomItem[]>({
    queryKey: ['/api/families', familyId, 'custom-childcare-items'],
    queryFn: async () => {
      const res = await apiRequest(
        'GET',
        `/api/families/${familyId}/custom-childcare-items`,
      );
      return res.json();
    },
    enabled: !!familyId,
    refetchInterval: 5000,
  });

  // ── Create log (web: useCreateLog → POST /api/logs) ──
  const createLog = useMutation({
    mutationFn: (data: {
      type: string;
      message: string;
      subType: string;
      performedBy: Performer;
    }) =>
      apiPost<Log>('/api/logs', {
        ...data,
        familyId,
        userId: data.performedBy,
        childId: activeChildId ?? undefined,
        points: 10,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', familyId] });
    },
  });

  // ── Create custom item (web: useCreateCustomChildcareItem) ──
  const createCustomItem = useMutation({
    mutationFn: (data: { itemName: string; icon: string }) =>
      apiPost('/api/families/' + familyId + '/custom-childcare-items', {
        familyId,
        itemName: data.itemName,
        icon: data.icon,
        createdBy: userRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families'] });
    },
  });

  // ── UI state ────────────────────────────────
  const [choreDialogOpen, setChoreDialogOpen] = useState(false);
  const [addCustomDialogOpen, setAddCustomDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemIcon, setNewItemIcon] = useState('Star');
  const [selectedRange, setSelectedRange] = useState<RangeKey>('today');
  const [chorePerformer, setChorePerformer] = useState<Performer>(
    userRole === 'mama' ? 'mama' : 'papa',
  );

  const activeCustomItems = useMemo(
    () => (customItems as CustomItem[]).filter((i) => i.isActive),
    [customItems],
  );

  const allChores = useMemo<ChoreDef[]>(() => {
    const base: ChoreDef[] = UNNAMED_CHORES.map((c) => ({
      id: c.id,
      title: c.title,
      icon: c.icon,
      isCustom: false,
    }));
    const custom: ChoreDef[] = activeCustomItems.map((item) => ({
      id: `custom_${item.id}`,
      title: item.itemName,
      icon: ICON_MAP[item.icon] || Star,
      isCustom: true,
    }));
    return [...base, ...custom];
  }, [activeCustomItems]);

  // ── Range filter (web: filteredLogs) ─────────
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekAgo = subDays(today, 7);
    return (logs as any[]).filter((log: any) => {
      const logDate = new Date(log.createdAt);
      if (selectedRange === 'today') return isSameDay(logDate, now);
      if (selectedRange === 'week') return logDate >= weekAgo;
      return true;
    });
  }, [logs, selectedRange]);

  const perfOf = (l: any): string => l.performedBy || l.userId;

  const papaLogs = filteredLogs.filter((l: any) => perfOf(l) === 'papa');
  const mamaLogs = filteredLogs.filter((l: any) => perfOf(l) === 'mama');

  const papaPoints = papaLogs.reduce((s: number, l: any) => s + (l.points || 0), 0);
  const mamaPoints = mamaLogs.reduce((s: number, l: any) => s + (l.points || 0), 0);
  const totalPoints = papaPoints + mamaPoints;

  const papaPercent = totalPoints > 0 ? Math.round((papaPoints / totalPoints) * 100) : 50;
  const mamaPercent = totalPoints > 0 ? 100 - papaPercent : 50;

  const isImbalanced = totalPoints > 0 && (papaPercent >= 80 || mamaPercent >= 80);
  const dominantUser = papaPercent > mamaPercent ? papaLabel : mamaLabel;
  const lesserUser = papaPercent > mamaPercent ? mamaLabel : papaLabel;

  // pie slices (web: pieData, value falls back to 1 like recharts)
  const pieValues = useMemo(() => {
    const a = papaPoints || 1;
    const b = mamaPoints || 1;
    const sum = a + b;
    return [
      { value: a, sweep: (a / sum) * 360, fill: PAPA_COLOR },
      { value: b, sweep: (b / sum) * 360, fill: MAMA_COLOR },
    ];
  }, [papaPoints, mamaPoints]);

  // ── Per-type breakdown (web: typeBreakdown) ──
  const typeBreakdown = useMemo(() => {
    const types = new Set(filteredLogs.map((l: any) => l.type));
    return Array.from(types)
      .map((type) => {
        const papaCount = filteredLogs.filter(
          (l: any) => perfOf(l) === 'papa' && l.type === type,
        ).length;
        const mamaCount = filteredLogs.filter(
          (l: any) => perfOf(l) === 'mama' && l.type === type,
        ).length;
        return {
          name: TYPE_LABELS[type as string] || (type as string),
          papa: papaCount,
          mama: mamaCount,
        };
      })
      .filter((d) => d.papa > 0 || d.mama > 0)
      .sort((a, b) => b.papa + b.mama - (a.papa + a.mama));
  }, [filteredLogs]);

  const maxTypeTotal = useMemo(
    () => Math.max(1, ...typeBreakdown.map((d) => d.papa + d.mama)),
    [typeBreakdown],
  );

  // ── 時給換算 (web: totalValue/totalTasks) ─────
  const totalTasks = filteredLogs.length;
  const totalMinutes = totalTasks * MINUTES_PER_TASK;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainMinutes = totalMinutes % 60;
  const totalValue = totalTasks * TASK_VALUE;
  const durationStr =
    totalHours > 0
      ? `${totalHours}時間${remainMinutes > 0 ? `${remainMinutes}分` : ''}`
      : `${remainMinutes}分`;
  const rangeWord =
    selectedRange === 'today' ? '今日' : selectedRange === 'week' ? 'この1週間' : '今まで';

  // ── Recent chores (web: recentChores) ────────
  const recentChores = useMemo(() => {
    return (logs as any[])
      .filter((l: any) => l.type === 'chore')
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 8);
  }, [logs]);

  // ── Handlers ────────────────────────────────
  const handleChore = useCallback(
    (choreId: string, choreTitle?: string) => {
      const title =
        choreTitle ||
        UNNAMED_CHORES.find((c) => c.id === choreId)?.title ||
        '名もなき育児';
      createLog.mutate({
        type: 'chore',
        message: `${title}を完了`,
        subType: choreId,
        performedBy: chorePerformer,
      });
      setChoreDialogOpen(false);
    },
    [createLog, chorePerformer],
  );

  const handleAddCustomItem = useCallback(() => {
    if (!newItemName.trim() || newItemName.length > 20) return;
    if (activeCustomItems.length >= 10) return;
    createCustomItem.mutate(
      { itemName: newItemName.trim(), icon: newItemIcon },
      {
        onSuccess: () => {
          setNewItemName('');
          setNewItemIcon('Star');
          setAddCustomDialogOpen(false);
        },
      },
    );
  }, [newItemName, newItemIcon, activeCustomItems.length, createCustomItem]);

  // ── Render ──────────────────────────────────
  return (
    <Screen contentStyle={styles.screenContent}>
      {/* Title block — web: centered, text-purple-800 / text-purple-500 */}
      <View style={styles.titleBlock}>
        <Title style={styles.dashTitle}>貢献度ダッシュボード</Title>
        <Text style={styles.dashSub}>ふたりの育児をデータで可視化</Text>
      </View>

      {/* Range tabs — web: 今日 / 1週間 / 全期間 */}
      <View style={styles.rangeRow}>
        {(['today', 'week', 'all'] as RangeKey[]).map((range) => {
          const selected = selectedRange === range;
          return (
            <TouchableOpacity
              key={range}
              activeOpacity={0.8}
              style={[
                styles.rangeBtn,
                selected ? styles.rangeBtnActive : styles.rangeBtnInactive,
              ]}
              onPress={() => setSelectedRange(range)}
            >
              <Text
                style={[
                  styles.rangeBtnText,
                  selected ? styles.rangeBtnTextActive : styles.rangeBtnTextInactive,
                ]}
              >
                {range === 'today' ? '今日' : range === 'week' ? '1週間' : '全期間'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Section: 負担割合 ─────────────────── */}
      <Card style={styles.sectionCard}>
        <View style={styles.cardHeading}>
          <Users size={16} color="#A855F7" />
          <Text style={styles.cardHeadingText}>負担割合</Text>
        </View>
        <View style={styles.balanceRow}>
          <View style={styles.pieWrap}>
            <Svg width={128} height={128} viewBox="0 0 128 128">
              {(() => {
                let angle = 0;
                return pieValues.map((slice, idx) => {
                  const start = angle;
                  angle += slice.sweep;
                  return (
                    <Path
                      key={idx}
                      d={donutSlice(64, 64, 55, 30, start, angle)}
                      fill={slice.fill}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  );
                });
              })()}
            </Svg>
            <View style={styles.pieCenter} pointerEvents="none">
              <Text style={styles.pieCenterText}>{totalPoints}pt</Text>
            </View>
          </View>
          <View style={styles.balanceLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PAPA_COLOR }]} />
              <Text style={styles.legendLabel}>{papaLabel}</Text>
              <Text style={[styles.legendPct, { color: PAPA_COLOR }]}>{papaPercent}%</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${papaPercent}%`, backgroundColor: PAPA_COLOR },
                ]}
              />
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: MAMA_COLOR }]} />
              <Text style={styles.legendLabel}>{mamaLabel}</Text>
              <Text style={[styles.legendPct, { color: MAMA_COLOR }]}>{mamaPercent}%</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${mamaPercent}%`, backgroundColor: MAMA_COLOR },
                ]}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* Imbalance notice — web: amber card w/ Sparkles (≥80%) */}
      {isImbalanced && (
        <Card style={styles.warningCard}>
          <View style={styles.warningRow}>
            <View style={styles.warningIconBox}>
              <Sparkles size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningKicker}>お知らせ</Text>
              <Text style={styles.warningText}>
                {lesserUser}さん、{dominantUser}さんの負担が大きくなっています。
                今はバトンタッチのタイミングかもしれません。
                おふたりで助け合うことが、何よりの力になります。
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* ── Section: タスク別の内訳 ───────────── */}
      {typeBreakdown.length > 0 && (
        <Card style={styles.sectionCardGray}>
          <View style={styles.cardHeading}>
            <TrendingUp size={16} color="#A855F7" />
            <Text style={styles.cardHeadingText}>タスク別の内訳</Text>
          </View>
          <View style={styles.breakdownWrap}>
            {typeBreakdown.map((d) => {
              const rowTotal = d.papa + d.mama;
              return (
                <View key={d.name} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <View style={styles.breakdownBarArea}>
                    <View
                      style={[
                        styles.breakdownBar,
                        { width: `${(rowTotal / maxTypeTotal) * 100}%` },
                      ]}
                    >
                      {d.papa > 0 && (
                        <View
                          style={{
                            flex: d.papa,
                            backgroundColor: PAPA_COLOR,
                          }}
                        />
                      )}
                      {d.mama > 0 && (
                        <View
                          style={{
                            flex: d.mama,
                            backgroundColor: MAMA_COLOR,
                            borderTopRightRadius: 4,
                            borderBottomRightRadius: 4,
                          }}
                        />
                      )}
                    </View>
                  </View>
                  <Text style={styles.breakdownCount}>{rowTotal}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legendCenterRow}>
            <View style={styles.legendItemInline}>
              <View style={[styles.legendSquare, { backgroundColor: PAPA_COLOR }]} />
              <Text style={styles.legendSmall}>{papaLabel}</Text>
            </View>
            <View style={styles.legendItemInline}>
              <View style={[styles.legendSquare, { backgroundColor: MAMA_COLOR }]} />
              <Text style={styles.legendSmall}>{mamaLabel}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* ── Section: 時給換算 ─────────────────── */}
      <Card style={styles.wageCard}>
        <View style={styles.cardHeading}>
          <Clock size={16} color="#22C55E" />
          <Text style={styles.cardHeadingText}>時給換算</Text>
        </View>
        <View style={styles.wageCenter}>
          <Title style={styles.wageMain}>{totalValue.toLocaleString()}円</Title>
          <Text style={styles.wageSub}>
            {totalTasks}件 x {MINUTES_PER_TASK}分 = {durationStr}（時給{HOURLY_RATE}円換算）
          </Text>
        </View>
        <View style={styles.wageHintBox}>
          <View style={styles.wageHintIconBox}>
            <Zap size={16} color="#16A34A" />
          </View>
          <Text style={styles.wageHintText}>
            もしこれを外注（ベビーシッター等）したら、{rangeWord}
            のおふたりの働きは
            <Text style={styles.wageHintBold}> {totalValue.toLocaleString()}円分 </Text>
            の価値があるっす！
          </Text>
        </View>
      </Card>

      {/* ── Section: 名もなき育児を記録 ───────── */}
      <Card style={styles.sectionCard}>
        <View style={styles.cardHeading}>
          <Heart size={16} color="#A855F7" />
          <Text style={styles.cardHeadingText}>名もなき育児を記録</Text>
        </View>
        <Text style={styles.choreDesc}>
          洗濯や哺乳瓶洗いなど、見えにくい家事もしっかり記録できます。
        </Text>
        <Button
          style={styles.primaryButton}
          onPress={() => {
            setChorePerformer(userRole === 'mama' ? 'mama' : 'papa');
            setChoreDialogOpen(true);
          }}
        >
          <Plus size={16} color={palette.primaryForeground} />
          <Text style={styles.primaryButtonText}>名もなき育児を記録する</Text>
        </Button>

        {recentChores.length > 0 && (
          <View style={styles.recentWrap}>
            <Text style={styles.recentKicker}>最近の記録</Text>
            {recentChores.map((log: any) => {
              const choreInfo = allChores.find((c) => c.id === log.subType);
              const ChoreIcon = choreInfo?.icon ?? Heart;
              const performer = log.performedBy || log.userId;
              const performerLabel =
                performer === 'other' ? 'その他' : getUserLabel(performer);
              const logDate = new Date(log.createdAt);
              const today = isSameDay(logDate, new Date());
              const timeStr = formatLogTime(logDate, today);
              return (
                <View key={log.id} style={styles.recordRow}>
                  <ChoreIcon size={14} color="#C084FC" />
                  <Text style={styles.recordLabel} numberOfLines={1}>
                    {choreInfo?.title ?? log.message}
                  </Text>
                  {!!performerLabel && (
                    <View style={styles.recordBadge}>
                      <Text style={styles.recordBadgeText}>{performerLabel}</Text>
                    </View>
                  )}
                  <Text style={styles.recordTime}>{timeStr}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* ── Chore dialog ─────────────────────── */}
      <Modal
        visible={choreDialogOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setChoreDialogOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Title style={styles.modalTitle}>名もなき育児を記録</Title>
                <Text style={styles.modalSubtitle}>
                  見えない頑張りもしっかりポイントに
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setChoreDialogOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={palette.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={styles.whoQuestion}>だれがやった？</Text>
            <View style={styles.whoRow}>
              {(['mama', 'papa', 'other'] as Performer[]).map((p) => {
                const label = getUserLabel(p);
                const isSelected = chorePerformer === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.whoChip,
                      isSelected
                        ? { backgroundColor: palette.primary, borderColor: palette.primary }
                        : { borderColor: palette.border, backgroundColor: palette.card },
                    ]}
                    onPress={() => setChorePerformer(p)}
                  >
                    <Text
                      style={[
                        styles.whoChipText,
                        {
                          color: isSelected
                            ? palette.primaryForeground
                            : palette.mutedForeground,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView
              style={styles.choreGridScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.choreGrid}>
                {allChores.map((chore) => {
                  const ChoreIcon = chore.icon;
                  return (
                    <TouchableOpacity
                      key={chore.id}
                      style={styles.choreCell}
                      onPress={() => handleChore(chore.id, chore.title)}
                      disabled={createLog.isPending}
                      activeOpacity={0.7}
                    >
                      <ChoreIcon size={24} color={palette.primary} />
                      <Text style={styles.choreCellLabel} numberOfLines={1}>
                        {chore.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {activeCustomItems.length < 10 && (
                  <TouchableOpacity
                    style={styles.choreCellDashed}
                    onPress={() => {
                      setChoreDialogOpen(false);
                      setAddCustomDialogOpen(true);
                    }}
                  >
                    <Plus size={24} color="#C084FC" />
                    <Text style={styles.choreCellLabelMuted}>カスタム追加</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Custom-item add dialog ───────────── */}
      <Modal
        visible={addCustomDialogOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAddCustomDialogOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Title style={styles.modalTitle}>カスタム項目を追加</Title>
                <Text style={styles.modalSubtitle}>
                  最大10個まで追加できます（{activeCustomItems.length}/10）
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddCustomDialogOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={palette.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>項目名（最大20文字）</Text>
            <TextInput
              style={styles.customLabelInput}
              placeholder="例: 保育園の準備"
              placeholderTextColor={palette.mutedForeground}
              value={newItemName}
              onChangeText={(t) => setNewItemName(t.slice(0, 20))}
              maxLength={20}
            />
            <Text style={styles.fieldCounter}>{newItemName.length}/20</Text>

            <Text style={styles.fieldLabel}>アイコン</Text>
            <View style={styles.iconGrid}>
              {PRESET_ICONS.map((preset) => {
                const PresetIcon = preset.icon;
                const selected = newItemIcon === preset.name;
                return (
                  <TouchableOpacity
                    key={preset.name}
                    style={[
                      styles.iconChoice,
                      selected
                        ? { borderColor: palette.primary, backgroundColor: palette.accent }
                        : { borderColor: palette.border },
                    ]}
                    onPress={() => setNewItemIcon(preset.name)}
                  >
                    <PresetIcon
                      size={20}
                      color={selected ? palette.primary : palette.mutedForeground}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.customActionRow}>
              <Button
                variant="outline"
                style={styles.customActionBtn}
                onPress={() => setAddCustomDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                style={styles.customActionBtn}
                disabled={!newItemName.trim() || createCustomItem.isPending}
                onPress={handleAddCustomItem}
              >
                <Plus size={16} color={palette.primaryForeground} />
                <Text style={styles.primaryButtonText}>追加</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 20 },

  // Title block — web: text-purple-800 / text-purple-500
  titleBlock: { alignItems: 'center' },
  dashTitle: { fontSize: 20, color: '#6B21A8' },
  dashSub: { fontSize: 12, color: '#A855F7', marginTop: 4 },

  // Range tabs — web: Button default vs outline, rounded-2xl
  rangeRow: { flexDirection: 'row', gap: 8 },
  rangeBtn: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeBtnActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  rangeBtnInactive: { backgroundColor: 'transparent', borderColor: palette.border },
  rangeBtnText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  rangeBtnTextActive: { color: palette.primaryForeground },
  rangeBtnTextInactive: { color: palette.foreground },

  // Section cards — web: rounded-3xl border-purple-100 / border-gray-100
  sectionCard: { borderRadius: radius.lg, padding: 20, borderColor: '#E9D5FF' },
  sectionCardGray: { borderRadius: radius.lg, padding: 20, borderColor: '#F3F4F6' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardHeadingText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#374151' },

  // 負担割合 — pie + bars
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pieWrap: { width: 128, height: 128, position: 'relative' },
  pieCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#6B7280' },
  balanceLegend: { flex: 1, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#374151', flex: 1 },
  legendPct: { fontFamily: fonts.bodyBold, fontSize: 14 },
  barTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },

  // Imbalance — web: rounded-3xl border-amber-200 bg-amber-50
  warningCard: {
    borderRadius: radius.lg,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 16,
  },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  warningIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#D97706',
    marginBottom: 2,
  },
  warningText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 20,
  },

  // タスク別の内訳 — horizontal stacked bars
  breakdownWrap: { gap: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: {
    width: 64,
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#6B7280',
  },
  breakdownBarArea: { flex: 1, justifyContent: 'center' },
  breakdownBar: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
    minWidth: 4,
  },
  breakdownCount: {
    width: 24,
    textAlign: 'right',
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#6B7280',
  },
  legendCenterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItemInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSquare: { width: 12, height: 12, borderRadius: 3 },
  legendSmall: { fontFamily: fonts.bodyBold, fontSize: 10, color: '#6B7280' },

  // 時給換算 — web: bg-gradient from-green-50, border-green-100
  wageCard: {
    borderRadius: radius.lg,
    padding: 20,
    borderColor: '#DCFCE7',
    backgroundColor: '#F0FDF4',
  },
  wageCenter: { alignItems: 'center', gap: 8 },
  wageMain: { fontSize: 30, color: '#15803D' },
  wageSub: { fontSize: 12, color: '#16A34A', textAlign: 'center' },
  wageHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: radius.lg,
    padding: 12,
    marginTop: 12,
  },
  wageHintIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wageHintText: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: '#15803D',
    lineHeight: 20,
  },
  wageHintBold: { fontFamily: fonts.bodyBold, color: '#14532D' },

  // 名もなき育児
  choreDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  primaryButton: { width: '100%', borderRadius: radius.lg },
  primaryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: palette.primaryForeground,
  },
  recentWrap: { marginTop: 16, gap: 6 },
  recentKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: '#FAF5FF',
    gap: 10,
  },
  recordLabel: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#374151',
  },
  recordBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recordBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#A855F7',
  },
  recordTime: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#9CA3AF',
    minWidth: 56,
    textAlign: 'right',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  modalTitle: { fontSize: 18, color: '#6B21A8', textAlign: 'center' },
  modalSubtitle: {
    fontSize: 12,
    color: '#A855F7',
    textAlign: 'center',
    marginTop: 4,
  },
  whoQuestion: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: palette.mutedForeground,
    marginBottom: 8,
  },
  whoRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  whoChip: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  whoChipText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  choreGridScroll: { maxHeight: 360 },
  choreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choreCell: {
    width: '47%',
    height: 80,
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  choreCellDashed: {
    width: '47%',
    height: 80,
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E9D5FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  choreCellLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: palette.foreground,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  choreCellLabelMuted: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#C084FC',
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: palette.mutedForeground,
    marginBottom: 6,
    marginTop: 8,
  },
  customLabelInput: {
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.foreground,
  },
  fieldCounter: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customActionRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  customActionBtn: { flex: 1, borderRadius: radius.sm },
});
