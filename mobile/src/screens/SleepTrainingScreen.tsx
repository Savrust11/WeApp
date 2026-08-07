/**
 * ネントレ支援 (Sleep Training) Screen — ported section-for-section from the
 * canonical web project `WeYu/client/src/pages/SleepTraining.tsx`.
 *
 * Four tabs, identical order/labels/copy to WeYu:
 *   1. 環境   — EnvironmentChecklist  (API: /api/sleep/checklist, daily)
 *   2. ルーティン — RoutineMission     (API: /api/sleep/routines + routine-logs)
 *   3. タイマー  — CryingTimer        (count-up + 見守り + /api/sleep-success)
 *   4. 分析   — SleepAnalysis        (weekly logs / routine calendar / 24h timeline)
 *
 * Styling is taken only from ../theme/tokens + ../theme/ui; icons from
 * lucide-react-native (same set WeYu uses). Existing mobile data contracts
 * (apiGet/apiPost, react-query, auth/child stores) are preserved — no new
 * backend contracts are introduced.
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Moon,
  Check,
  EyeOff,
  Eye,
  Thermometer,
  Shield,
  Volume2,
  Bath,
  Shirt,
  Milk as MilkIcon,
  BookOpen,
  Lamp,
  Plus,
  Trash2,
  Timer,
  Play,
  Square,
  RotateCcw,
  Zap,
  Users,
  CheckCircle2,
  Circle,
  BarChart3,
  TrendingUp,
  Star,
  Settings2,
  Bell,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { apiGet, apiPost, apiRequest } from '../api/client';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Screen, Card, Badge, Text, Title, Muted } from '../theme/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SleepChecklist {
  date?: string;
  darkness: boolean;
  temperature: boolean;
  safety: boolean;
  whiteNoise: boolean;
}

interface SleepRoutine {
  id: number;
  familyId: string;
  title: string;
  assignee: string;
  sortOrder: number;
}

interface SleepRoutineLog {
  id: number;
  familyId: string;
  routineId: number;
  date: string;
  completedBy: string;
}

interface SleepSessionRow {
  id: number;
  familyId: string;
  childId?: number | null;
  startedAt: string;
  endedAt?: string | null;
  durationMin?: number | null;
}

interface LogRow {
  id: number;
  type: string;
  createdAt: string;
  childId?: number | null;
}

type TabId = 'checklist' | 'routine' | 'timer' | 'analysis';

// ─── Theme constants (WeYu dark-timer palette, expressed as hex) ───────────────

const DARK = {
  slate900: '#0F172A',
  slate800: '#1E293B',
  indigo950: '#1E1B4B',
  indigo900: '#312E81',
  indigo800: '#3730A3',
  indigo700: '#4338CA',
  indigo600: '#4F46E5',
  indigo500: '#6366F1',
  indigo400: '#818CF8',
  indigo300: '#A5B4FC',
  indigo200: '#C7D2FE',
  indigo100: '#E0E7FF',
  indigo50: '#EEF2FF',
  purple700: '#7E22CE',
  purple300: '#D8B4FE',
  purple200: '#E9D5FF',
  amber500: '#F59E0B',
  amber400: '#FBBF24',
  amber300: '#FCD34D',
  amber200: '#FDE68A',
  emerald500: '#10B981',
  emerald400: '#34D399',
  emerald300: '#6EE7B7',
  green500: '#22C55E',
  green600: '#16A34A',
  green700: '#15803D',
  green200: '#BBF7D0',
  green50: '#F0FDF4',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray300: '#D1D5DB',
};

// ─── Checklist items (verbatim labels/desc/icons from WeYu) ────────────────────

const CHECKLIST_ITEMS = [
  {
    key: 'darkness' as const,
    label: '遮光',
    desc: '部屋は真っ暗か？',
    Icon: EyeOff,
    tint: '#4F46E5',
    soft: '#EEF2FF',
    bord: '#C7D2FE',
  },
  {
    key: 'temperature' as const,
    label: '室温',
    desc: '夏：25-27度 / 冬：20度前後か？',
    Icon: Thermometer,
    tint: '#9333EA',
    soft: '#FAF5FF',
    bord: '#E9D5FF',
  },
  {
    key: 'safety' as const,
    label: '安全',
    desc: '枕やぬいぐるみなど窒息の危険がないか？',
    Icon: Shield,
    tint: '#DC2626',
    soft: '#FEF2F2',
    bord: '#FECACA',
  },
  {
    key: 'whiteNoise' as const,
    label: 'ホワイトノイズ',
    desc: '音の準備はいいか？',
    Icon: Volume2,
    tint: '#0D9488',
    soft: '#F0FDFA',
    bord: '#99F6E4',
  },
];

const ROUTINE_ICONS: Record<string, typeof Bath> = {
  'お風呂': Bath,
  '着替え': Shirt,
  '授乳/ミルク': MilkIcon,
  '絵本': BookOpen,
  '消灯（入眠）': Lamp,
};

const TIMER_PHASES = [
  { minutes: 0, message: 'セルフねんねの特訓開始です。今は信じて待ちましょう。' },
  { minutes: 2, message: '2分経過。まだ大丈夫、赤ちゃんは自分で寝る方法を探しています。' },
  {
    minutes: 5,
    message:
      'まだ泣いていますね。でも大丈夫、脳が『自分で寝る方法』を学習中です。あと2分で見守りに行きましょう。',
  },
  { minutes: 7, message: '一度トントンしに行って、安心させてあげましょう。でも抱っこは我慢です。' },
  { minutes: 10, message: '10分経過。赤ちゃんの自立心が育っています。もう少し待ってみましょう。' },
  {
    minutes: 15,
    message: '15分到達。もう一度トントンタイムです。短くトントン、声かけだけで戻りましょう。',
  },
  { minutes: 20, message: '20分経過。ここまで頑張ったパパ・ママ、本当にお疲れ様です。' },
];

const CHECK_IN_OPTIONS = [
  { value: 3, label: '3分' },
  { value: 5, label: '5分' },
  { value: 7, label: '7分' },
  { value: 10, label: '10分' },
];

const ENCOURAGEMENT_MESSAGES = [
  '今、お子様は自分で眠る力を育んでいるところっす！おふたりで温かく見守ってあげてくださいっす！',
  'つらくなったら、パートナーとそっと手を取り合ってくださいっす！おふたりの絆が一番の力っすよ！',
  'これはお子様への素敵な贈り物っす！自分で眠れる力は一生の宝物っす！',
  '大丈夫っす！お子様は安心できるお部屋にいるっす！パパとママを信頼しているっすよ！',
  'おふたりで一緒に乗り越えるっす！今夜の頑張りが、穏やかな明日につながるっす！',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SleepTrainingScreen() {
  const { user } = useAuthStore();
  const familyId = user?.familyId ?? '';
  const userId = user?.role ?? 'papa';
  const today = todayKey();
  const [activeTab, setActiveTab] = useState<TabId>('checklist');

  const tabs: { id: TabId; label: string; Icon: typeof Moon }[] = [
    { id: 'checklist', label: '環境', Icon: Check },
    { id: 'routine', label: 'ルーティン', Icon: Users },
    { id: 'timer', label: 'タイマー', Icon: Timer },
    { id: 'analysis', label: '分析', Icon: BarChart3 },
  ];

  const isTimerDark = activeTab === 'timer';

  return (
    <Screen
      style={isTimerDark ? styles.screenDark : undefined}
      contentStyle={styles.content}
    >
      {/* ── Header (title + tab bar) ── */}
      <View style={styles.headerRow}>
        <Moon size={20} color={isTimerDark ? DARK.indigo400 : DARK.indigo500} />
        <Title
          style={[styles.headerTitle, isTimerDark && { color: DARK.indigo200 }]}
        >
          ネントレ支援
        </Title>
      </View>

      <View
        style={[
          styles.tabBar,
          isTimerDark ? styles.tabBarDark : styles.tabBarLight,
        ]}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabBtn,
                active &&
                  (isTimerDark ? styles.tabBtnActiveDark : styles.tabBtnActive),
              ]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <tab.Icon
                size={14}
                color={
                  active
                    ? isTimerDark
                      ? DARK.indigo200
                      : DARK.indigo700
                    : isTimerDark
                    ? DARK.indigo500
                    : DARK.indigo400
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: active
                      ? isTimerDark
                        ? DARK.indigo200
                        : DARK.indigo700
                      : isTimerDark
                      ? DARK.indigo500
                      : DARK.indigo400,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Tab body ── */}
      {activeTab === 'checklist' && (
        <EnvironmentChecklist familyId={familyId} date={today} />
      )}
      {activeTab === 'routine' && (
        <RoutineMission familyId={familyId} userId={userId} date={today} />
      )}
      {activeTab === 'timer' && (
        <CryingTimer familyId={familyId} userId={userId} />
      )}
      {activeTab === 'analysis' && <SleepAnalysis familyId={familyId} />}

      <View style={{ height: 48 }} />
    </Screen>
  );
}

// ─── 1. 環境チェックリスト ─────────────────────────────────────────────────────

function EnvironmentChecklist({
  familyId,
  date,
}: {
  familyId: string;
  date: string;
}) {
  const queryClient = useQueryClient();

  const { data: checklist, isLoading } = useQuery<SleepChecklist>({
    queryKey: ['sleepChecklist', familyId, date],
    queryFn: () =>
      apiGet<SleepChecklist>(`/api/sleep/checklist/${familyId}/${date}`),
    enabled: !!familyId,
    refetchInterval: 5000,
  });

  const updateChecklist = useMutation({
    mutationFn: (data: Partial<SleepChecklist>) =>
      apiPost('/api/sleep/checklist', { familyId, date, ...data }),
    // Optimistic update — the button used to wait for the server round-trip
    // AND the next refetch before reflecting the checked state, which made it
    // feel unresponsive on slow networks. Flip the cached value immediately;
    // roll back if the request fails.
    onMutate: async (data) => {
      const queryKey = ['sleepChecklist', familyId, date];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Partial<SleepChecklist>>(queryKey);
      queryClient.setQueryData(queryKey, {
        ...(previous ?? {}),
        ...data,
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(['sleepChecklist', familyId, date], ctx.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['sleepChecklist', familyId, date],
      }),
  });

  const allChecked =
    !!checklist?.darkness &&
    !!checklist?.temperature &&
    !!checklist?.safety &&
    !!checklist?.whiteNoise;

  const toggleItem = (
    key: 'darkness' | 'temperature' | 'safety' | 'whiteNoise',
  ) => {
    const current = checklist || {
      darkness: false,
      temperature: false,
      safety: false,
      whiteNoise: false,
    };
    updateChecklist.mutate({
      darkness: current.darkness,
      temperature: current.temperature,
      safety: current.safety,
      whiteNoise: current.whiteNoise,
      [key]: !current[key],
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={DARK.indigo400} />
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      <Card style={styles.hintCard}>
        <View style={styles.hintRow}>
          <View style={styles.hintIcon}>
            <Zap size={18} color={DARK.indigo600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hintTitle}>環境チェック</Text>
            <Text style={styles.hintText}>
              {allChecked
                ? '環境は完璧です。この調子で毎晩チェックしましょう。赤ちゃんの安眠は環境づくりから。'
                : '寝かしつけ前に、環境をチェックしましょう。全部クリアで準備万端です。'}
            </Text>
          </View>
        </View>
      </Card>

      {CHECKLIST_ITEMS.map((item) => {
        const isChecked = (checklist?.[item.key] ?? false) as boolean;
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.8}
            onPress={() => toggleItem(item.key)}
            style={[
              styles.checkCard,
              isChecked
                ? { backgroundColor: item.soft, borderColor: item.bord }
                : { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View
              style={[
                styles.checkIconBox,
                {
                  backgroundColor: isChecked ? item.soft : palette.muted,
                },
              ]}
            >
              <item.Icon
                size={20}
                color={isChecked ? item.tint : palette.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.checkLabel,
                  { color: isChecked ? palette.foreground : palette.mutedForeground },
                ]}
              >
                {item.label}
              </Text>
              <Muted style={styles.checkDesc}>{item.desc}</Muted>
            </View>
            <View
              style={[
                styles.checkCircle,
                isChecked
                  ? { backgroundColor: DARK.green500, borderColor: DARK.green500 }
                  : { borderColor: palette.border },
              ]}
            >
              {isChecked && (
                <Check size={15} color={palette.primaryForeground} strokeWidth={3} />
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {allChecked && (
        <Card style={styles.completeCardGreen}>
          <View style={styles.completeRow}>
            <View style={[styles.completeIcon, { backgroundColor: DARK.green500 }]}>
              <CheckCircle2 size={22} color={palette.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.completeTitle, { color: DARK.green700 }]}>
                環境は完璧っす！
              </Text>
              <Muted style={[styles.completeSub, { color: DARK.green600 }]}>
                安心してネントレを始められるっす！
              </Muted>
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

// ─── 2. ルーティンミッション ───────────────────────────────────────────────────

function RoutineMission({
  familyId,
  userId,
  date,
}: {
  familyId: string;
  userId: string;
  date: string;
}) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState<'パパ' | 'ママ' | '未定'>('パパ');

  const { data: routines, isLoading: routinesLoading } = useQuery<SleepRoutine[]>(
    {
      queryKey: ['sleepRoutines', familyId],
      queryFn: () => apiGet<SleepRoutine[]>(`/api/sleep/routines/${familyId}`),
      enabled: !!familyId,
      refetchInterval: 5000,
    },
  );

  const { data: routineLogs } = useQuery<SleepRoutineLog[]>({
    queryKey: ['sleepRoutineLogs', familyId, date],
    queryFn: async () => {
      const json = await apiGet<SleepRoutineLog[]>(
        `/api/sleep/routine-logs/${familyId}/${date}`,
      );
      return Array.isArray(json) ? json : [];
    },
    enabled: !!familyId,
    refetchInterval: 3000,
  });

  const completeStep = useMutation({
    mutationFn: (data: {
      familyId: string;
      routineId: number;
      date: string;
      completedBy: string;
    }) => apiPost('/api/sleep/routine-logs/complete', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['sleepRoutineLogs', familyId, date],
      });
    },
  });

  const createRoutine = useMutation({
    mutationFn: (data: {
      familyId: string;
      title: string;
      assignee: string;
      sortOrder: number;
    }) => apiPost('/api/sleep/routines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleepRoutines', familyId] });
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/sleep/routines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleepRoutines', familyId] });
    },
  });

  const completedIds = new Set((routineLogs || []).map((l) => l.routineId));
  const list = routines || [];
  const allDone = list.length > 0 && list.every((r) => completedIds.has(r.id));
  const progress =
    list.length > 0 ? Math.round((completedIds.size / list.length) * 100) : 0;

  const handleComplete = (routineId: number) => {
    completeStep.mutate({ familyId, routineId, date, completedBy: userId });
  };

  const handleAddRoutine = () => {
    if (!newTitle.trim()) return;
    const maxOrder = list.reduce(
      (max, r) => Math.max(max, r.sortOrder),
      -1,
    );
    createRoutine.mutate({
      familyId,
      title: newTitle.trim(),
      assignee: newAssignee,
      sortOrder: maxOrder + 1,
    });
    setNewTitle('');
    setNewAssignee('パパ');
    setShowAddForm(false);
  };

  if (routinesLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={DARK.indigo400} />
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      <Card style={styles.hintCard}>
        <View style={styles.hintRow}>
          <View style={styles.hintIcon}>
            <Zap size={18} color={DARK.indigo600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hintTitle}>ルーティンのヒント</Text>
            <Text style={styles.hintText}>
              {allDone
                ? 'ルーティン全完了。最高のチームワークです。3倍ポイントゲット！'
                : '毎日同じ流れを繰り返すことが、ネントレ成功の秘訣です。夫婦で分担して頑張りましょう。'}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>今日の進捗</Text>
          <View style={styles.progressRight}>
            <Text style={styles.progressCount}>
              {completedIds.size}/{list.length}
            </Text>
            {allDone && (
              <View style={styles.progressBadge}>
                <Text style={styles.progressBadgeText}>+30pt</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%` },
            ]}
          />
        </View>
      </Card>

      {list.map((routine) => {
        const isDone = completedIds.has(routine.id);
        const IconComp = ROUTINE_ICONS[routine.title] || Moon;
        const assigneeColor =
          routine.assignee === 'パパ'
            ? { tint: '#2563EB', soft: '#EFF6FF' }
            : routine.assignee === 'ママ'
            ? { tint: '#DB2777', soft: '#FDF2F8' }
            : { tint: palette.mutedForeground, soft: palette.muted };
        return (
          <Card
            key={routine.id}
            style={[
              styles.routineCard,
              isDone
                ? { backgroundColor: '#F0FDF4', borderColor: DARK.green200 }
                : null,
            ]}
          >
            <View
              style={[
                styles.routineIconBox,
                { backgroundColor: isDone ? '#DCFCE7' : DARK.indigo50 },
              ]}
            >
              <IconComp
                size={16}
                color={isDone ? DARK.green600 : DARK.indigo500}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.routineTitleRow}>
                <Text
                  style={[
                    styles.routineTitle,
                    isDone && {
                      color: DARK.green700,
                      textDecorationLine: 'line-through',
                    },
                  ]}
                >
                  {routine.title}
                </Text>
                <View
                  style={[
                    styles.assigneeBadge,
                    { backgroundColor: assigneeColor.soft },
                  ]}
                >
                  <Text
                    style={[styles.assigneeText, { color: assigneeColor.tint }]}
                  >
                    {routine.assignee}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.routineActions}>
              {!isDone ? (
                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={() => handleComplete(routine.id)}
                  disabled={completeStep.isPending}
                  activeOpacity={0.8}
                >
                  <Check size={13} color={DARK.indigo600} />
                  <Text style={styles.completeBtnText}>完了</Text>
                </TouchableOpacity>
              ) : (
                <CheckCircle2 size={20} color={DARK.green500} />
              )}
              <TouchableOpacity
                onPress={() => deleteRoutine.mutate(routine.id)}
                style={styles.deleteBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={15} color={palette.mutedForeground} />
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      {!showAddForm ? (
        <TouchableOpacity
          style={styles.addRoutineBtn}
          onPress={() => setShowAddForm(true)}
          activeOpacity={0.8}
        >
          <Plus size={16} color={DARK.indigo500} />
          <Text style={styles.addRoutineText}>ステップを追加</Text>
        </TouchableOpacity>
      ) : (
        <Card style={styles.addFormCard}>
          <Text style={styles.formLabel}>ステップ名</Text>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="例：歯磨き"
            placeholderTextColor={palette.mutedForeground}
            style={styles.formInput}
          />
          <Text style={[styles.formLabel, { marginTop: 12 }]}>担当</Text>
          <View style={styles.assigneeRow}>
            {(['パパ', 'ママ', '未定'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.assigneeOpt,
                  newAssignee === opt && styles.assigneeOptActive,
                ]}
                onPress={() => setNewAssignee(opt)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.assigneeOptText,
                    newAssignee === opt && styles.assigneeOptTextActive,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formBtnRow}>
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnCancel]}
              onPress={() => {
                setShowAddForm(false);
                setNewTitle('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.formBtnCancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.formBtn,
                styles.formBtnSave,
                !newTitle.trim() && { opacity: 0.5 },
              ]}
              onPress={handleAddRoutine}
              disabled={!newTitle.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.formBtnSaveText}>追加する</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {allDone && (
        <Card style={styles.completeCardIndigo}>
          <View style={styles.completeRow}>
            <View style={[styles.completeIcon, { backgroundColor: DARK.indigo500 }]}>
              <Zap size={22} color={palette.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.completeTitle, { color: DARK.indigo800 }]}>
                ルーティン完了！
              </Text>
              <Muted style={[styles.completeSub, { color: DARK.indigo600 }]}>
                チーム3倍ポイント +30pt 獲得！
              </Muted>
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

// ─── 3. 夜泣き / 見守りタイマー ────────────────────────────────────────────────

function CryingTimer({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  const { activeChildId } = useChildStore();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [checkInInterval, setCheckInInterval] = useState(5);
  const [isObserving, setIsObserving] = useState(false);
  const [observeElapsed, setObserveElapsed] = useState(0);
  const [sleepRecorded, setSleepRecorded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const observeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  useEffect(() => {
    if (isObserving) {
      observeRef.current = setInterval(() => {
        setObserveElapsed((prev) => prev + 1);
      }, 1000);
    } else if (observeRef.current) {
      clearInterval(observeRef.current);
    }
    return () => {
      if (observeRef.current) clearInterval(observeRef.current);
    };
  }, [isObserving]);

  useEffect(() => {
    const elapsedMinutes = elapsed / 60;
    let phase = 0;
    for (let i = TIMER_PHASES.length - 1; i >= 0; i--) {
      if (elapsedMinutes >= TIMER_PHASES[i].minutes) {
        phase = i;
        break;
      }
    }
    setCurrentPhase(phase);
  }, [elapsed]);

  const handleStart = () => {
    setIsRunning(true);
    setSleepRecorded(false);
  };
  const handleStop = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setElapsed(0);
    setCurrentPhase(0);
    setIsObserving(false);
    setObserveElapsed(0);
    setSleepRecorded(false);
  };
  const handleObserve = () => {
    setIsRunning(false);
    setIsObserving(true);
    setObserveElapsed(0);
  };
  const handleObserveEnd = () => {
    setIsObserving(false);
    setObserveElapsed(0);
    setIsRunning(true);
  };

  const handleSleepSuccess = async () => {
    setIsRunning(false);
    setIsObserving(false);
    setIsSaving(true);
    try {
      await apiPost('/api/sleep-success', {
        familyId,
        userId,
        childId: activeChildId ?? null,
        elapsedMinutes: Math.floor(elapsed / 60),
      });
      setSleepRecorded(true);
    } catch {
      setSleepRecorded(false);
    } finally {
      setIsSaving(false);
    }
  };

  const checkInSeconds = checkInInterval * 60;
  const secsUntilCheckIn =
    elapsed > 0 ? checkInSeconds - (elapsed % checkInSeconds) : checkInSeconds;
  const isCheckInSoon =
    secsUntilCheckIn <= 120 &&
    secsUntilCheckIn > 0 &&
    elapsed > 0 &&
    secsUntilCheckIn < checkInSeconds;
  const isCheckInNow = secsUntilCheckIn <= 5 && elapsed > 0;
  const encouragementIdx =
    Math.floor(elapsed / 60) % ENCOURAGEMENT_MESSAGES.length;

  if (sleepRecorded) {
    return (
      <View style={styles.tabBody}>
        <View style={styles.successWrap}>
          <View style={styles.successMoon}>
            <Moon size={56} color={DARK.indigo300} />
          </View>
          <Title style={styles.successTitle}>おやすみなさい</Title>
          <Text style={styles.successLine1}>
            {Math.floor(elapsed / 60)}分{elapsed % 60}秒で入眠しました
          </Text>
          <Text style={styles.successLine2}>
            タイムラインに記録済み・パートナーに通知しました
          </Text>
        </View>
        <TouchableOpacity
          style={styles.darkPrimaryBtn}
          onPress={handleReset}
          activeOpacity={0.85}
        >
          <RotateCcw size={16} color={DARK.indigo200} />
          <Text style={[styles.darkBtnText, { color: DARK.indigo200 }]}>
            新しいセッションを始める
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      {/* Usage hint */}
      <Card style={styles.darkHintCard}>
        <View style={styles.hintRow}>
          <View style={styles.darkHintIcon}>
            <Moon size={18} color={DARK.indigo300} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.darkHintTitle}>使い方</Text>
            <Text style={styles.darkHintText}>
              赤ちゃんを布団に置いてからスタート。設定した間隔で様子を見に行くタイミングをお知らせします。
            </Text>
          </View>
        </View>
      </Card>

      {/* Check-in interval selector */}
      <Card style={styles.darkSettingCard}>
        <View style={styles.darkSettingRow}>
          <View style={styles.darkSettingLeft}>
            <Settings2 size={15} color={DARK.indigo400} />
            <Text style={styles.darkSettingLabel}>様子見の間隔</Text>
          </View>
          <View style={styles.intervalRow}>
            {CHECK_IN_OPTIONS.map((opt) => {
              const active = checkInInterval === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => !isRunning && setCheckInInterval(opt.value)}
                  disabled={isRunning}
                  activeOpacity={0.8}
                  style={[
                    styles.intervalBtn,
                    active && styles.intervalBtnActive,
                    isRunning && { opacity: 0.4 },
                  ]}
                >
                  <Text
                    style={[
                      styles.intervalBtnText,
                      active && { color: DARK.indigo100 },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Card>

      {/* Main timer card */}
      <View style={styles.timerMainCard}>
        <View
          style={[
            styles.timerRing,
            isCheckInNow
              ? { borderColor: 'rgba(245,158,11,0.8)', backgroundColor: 'rgba(120,53,15,0.2)' }
              : isCheckInSoon
              ? { borderColor: 'rgba(245,158,11,0.5)', backgroundColor: 'rgba(69,26,3,0.2)' }
              : isObserving
              ? { borderColor: 'rgba(16,185,129,0.5)', backgroundColor: 'rgba(6,78,59,0.2)' }
              : isRunning
              ? { borderColor: 'rgba(99,102,241,0.5)', backgroundColor: 'rgba(30,27,75,0.3)' }
              : { borderColor: 'rgba(49,46,129,0.4)', backgroundColor: 'rgba(30,41,59,0.4)' },
          ]}
        >
          <Text
            style={[
              styles.timerDisplay,
              {
                color: isCheckInNow
                  ? DARK.amber300
                  : isCheckInSoon
                  ? DARK.amber400
                  : isObserving
                  ? DARK.emerald300
                  : isRunning
                  ? DARK.indigo200
                  : DARK.indigo500,
              },
            ]}
          >
            {isObserving ? formatTime(observeElapsed) : formatTime(elapsed)}
          </Text>
        </View>

        {isObserving && (
          <View style={styles.observeBox}>
            <View style={styles.observeHead}>
              <Eye size={15} color={DARK.emerald400} />
              <Text style={styles.observeTitle}>様子見中</Text>
            </View>
            <Text style={styles.observeText}>
              短くトントン・声かけだけで戻りましょう。抱っこは我慢。
            </Text>
          </View>
        )}

        {isRunning && elapsed > 0 && !isObserving && (
          <View
            style={[
              styles.checkinBox,
              isCheckInNow
                ? { backgroundColor: 'rgba(120,53,15,0.3)', borderColor: 'rgba(217,119,6,0.5)' }
                : isCheckInSoon
                ? { backgroundColor: 'rgba(69,26,3,0.3)', borderColor: 'rgba(146,64,14,0.4)' }
                : { backgroundColor: 'rgba(30,27,75,0.3)', borderColor: 'rgba(49,46,129,0.4)' },
            ]}
          >
            <Bell
              size={15}
              color={
                isCheckInNow
                  ? DARK.amber300
                  : isCheckInSoon
                  ? DARK.amber400
                  : DARK.indigo400
              }
            />
            <Text
              style={[
                styles.checkinText,
                {
                  color: isCheckInNow
                    ? DARK.amber200
                    : isCheckInSoon
                    ? DARK.amber300
                    : DARK.indigo300,
                },
              ]}
            >
              {isCheckInNow
                ? '様子を見に行きましょう'
                : isCheckInSoon
                ? `あと ${formatTime(secsUntilCheckIn)} で様子見の時間`
                : `次の様子見まで ${formatTime(secsUntilCheckIn)}`}
            </Text>
          </View>
        )}

        {!isObserving && (
          <View style={styles.timerControls}>
            {!isRunning && elapsed === 0 && (
              <TouchableOpacity
                style={styles.timerStartBtn}
                onPress={handleStart}
                activeOpacity={0.85}
              >
                <Play size={18} color={DARK.indigo100} fill={DARK.indigo100} />
                <Text style={styles.timerStartBtnText}>スタート</Text>
              </TouchableOpacity>
            )}

            {!isRunning && elapsed > 0 && (
              <TouchableOpacity
                style={styles.timerResumeBtn}
                onPress={handleStart}
                activeOpacity={0.85}
              >
                <Play size={18} color={DARK.indigo200} fill={DARK.indigo200} />
                <Text style={[styles.timerStartBtnText, { color: DARK.indigo200 }]}>
                  再開
                </Text>
              </TouchableOpacity>
            )}

            {isRunning && (
              <>
                <TouchableOpacity
                  style={styles.timerStopBtn}
                  onPress={handleStop}
                  activeOpacity={0.85}
                >
                  <Square size={15} color="#CBD5E1" fill="#CBD5E1" />
                  <Text style={styles.timerStopBtnText}>
                    一時停止（確認・中断）
                  </Text>
                </TouchableOpacity>

                {(isCheckInSoon || isCheckInNow) && (
                  <TouchableOpacity
                    style={styles.timerObserveBtn}
                    onPress={handleObserve}
                    activeOpacity={0.85}
                  >
                    <Eye size={15} color={DARK.amber200} />
                    <Text style={styles.timerObserveBtnText}>
                      様子を見る（介入タイマー）
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {elapsed > 0 && (
              <TouchableOpacity
                style={styles.sleepSuccessBtn}
                onPress={handleSleepSuccess}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Moon size={18} color="#FFFFFF" />
                )}
                <Text style={styles.sleepSuccessBtnText}>寝た（入眠成功）</Text>
              </TouchableOpacity>
            )}

            {elapsed > 0 && !isRunning && (
              <TouchableOpacity
                style={styles.resetGhostBtn}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <RotateCcw size={15} color={DARK.indigo500} />
                <Text style={styles.resetGhostText}>リセット</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isObserving && (
          <View style={styles.timerControls}>
            <TouchableOpacity
              style={styles.observeEndBtn}
              onPress={handleObserveEnd}
              activeOpacity={0.85}
            >
              <RotateCcw size={15} color={DARK.emerald300} />
              <Text style={styles.observeEndText}>
                見守り終了・タイマーに戻る
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sleepSuccessBtn}
              onPress={handleSleepSuccess}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Moon size={18} color="#FFFFFF" />
              )}
              <Text style={styles.sleepSuccessBtnText}>寝た（入眠成功）</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Coaching message */}
      {(isRunning || elapsed > 0) && !isObserving && (
        <Card style={styles.coachCard}>
          <View style={styles.hintRow}>
            <View style={styles.coachIcon}>
              <Zap size={18} color={DARK.indigo300} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.coachTitleRow}>
                <Text style={styles.coachTitle}>ねんねコーチング</Text>
                <View style={styles.coachBadge}>
                  <Text style={styles.coachBadgeText}>
                    {TIMER_PHASES[currentPhase].minutes}分
                  </Text>
                </View>
              </View>
              <Text style={styles.coachText}>
                {TIMER_PHASES[currentPhase].message}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Encouragement */}
      {isRunning && elapsed >= 60 && (
        <Card style={styles.cheerCard}>
          <View style={styles.hintRow}>
            <View style={styles.cheerIcon}>
              <Star size={18} color={DARK.purple300} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cheerTitle}>応援メッセージ</Text>
              <Text style={styles.cheerText}>
                {ENCOURAGEMENT_MESSAGES[encouragementIdx]}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Method list */}
      <Card style={styles.methodCard}>
        <Text style={styles.methodTitle}>メソッド一覧</Text>
        {TIMER_PHASES.map((phase, i) => {
          const activeRow =
            currentPhase === i && (isRunning || elapsed > 0);
          const doneRow = currentPhase > i && (isRunning || elapsed > 0);
          const reachedRow = currentPhase >= i && (isRunning || elapsed > 0);
          return (
            <View
              key={i}
              style={[styles.methodRow, activeRow && styles.methodRowActive]}
            >
              <View
                style={[
                  styles.methodNum,
                  reachedRow
                    ? { backgroundColor: DARK.indigo600 }
                    : { backgroundColor: 'rgba(51,65,85,0.6)' },
                ]}
              >
                {doneRow ? (
                  <Check size={12} color={DARK.indigo100} />
                ) : (
                  <Text
                    style={[
                      styles.methodNumText,
                      { color: reachedRow ? DARK.indigo100 : DARK.indigo500 },
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.methodText,
                  activeRow
                    ? { color: DARK.indigo200, fontFamily: fonts.bodyBold }
                    : { color: DARK.indigo500 },
                ]}
              >
                {phase.minutes}分 - {phase.message.substring(0, 30)}...
              </Text>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

// ─── 4. 睡眠分析 ───────────────────────────────────────────────────────────────

function SleepAnalysis({ familyId }: { familyId: string }) {
  const { activeChildId } = useChildStore();

  const { data: allLogs, isLoading: logsLoading } = useQuery<LogRow[]>({
    queryKey: ['logs', familyId],
    queryFn: () => apiGet<LogRow[]>(`/api/logs/${familyId}`),
    enabled: !!familyId,
    refetchInterval: 5000,
  });

  const { data: routines } = useQuery<SleepRoutine[]>({
    queryKey: ['sleepRoutines', familyId],
    queryFn: () => apiGet<SleepRoutine[]>(`/api/sleep/routines/${familyId}`),
    enabled: !!familyId,
    refetchInterval: 5000,
  });

  const { data: allSleepSessions } = useQuery<SleepSessionRow[]>({
    queryKey: ['sleepSessions', familyId],
    queryFn: () => apiGet<SleepSessionRow[]>(`/api/sleep-sessions/${familyId}`),
    enabled: !!familyId,
    refetchInterval: 5000,
  });

  const logs = useMemo(() => {
    if (!allLogs) return undefined;
    if (!activeChildId) return allLogs;
    return allLogs.filter(
      (l) => !l.childId || l.childId === activeChildId,
    );
  }, [allLogs, activeChildId]);

  const sleepSessions = useMemo(() => {
    const arr = allSleepSessions || [];
    if (!activeChildId) return arr;
    return arr.filter((s) => !s.childId || s.childId === activeChildId);
  }, [allSleepSessions, activeChildId]);

  const weekDates = useMemo(() => {
    const now = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      );
    }
    return dates;
  }, []);

  const { data: weekRoutineLogs, isLoading: routineLogsLoading } = useQuery<
    { date: string; logs: SleepRoutineLog[] }[]
  >({
    queryKey: ['sleepRoutineLogsWeek', familyId, weekDates[0]],
    queryFn: async () => {
      const results = await Promise.all(
        weekDates.map(async (date) => {
          try {
            const data = await apiGet<SleepRoutineLog[]>(
              `/api/sleep/routine-logs/${familyId}/${date}`,
            );
            return { date, logs: Array.isArray(data) ? data : [] };
          } catch {
            return { date, logs: [] as SleepRoutineLog[] };
          }
        }),
      );
      return results;
    },
    enabled: !!familyId,
  });

  const isLoading = logsLoading || routineLogsLoading;
  const totalRoutines = routines?.length || 0;

  const weeklyData = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    const now = new Date();
    const days: {
      date: string;
      label: string;
      sleepCount: number;
      nightWakings: number;
      routineComplete: boolean;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
        d.getDate(),
      )}`;
      const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

      const dayLogs = logs.filter((l) => {
        const ld = new Date(l.createdAt);
        return (
          `${ld.getFullYear()}-${pad2(ld.getMonth() + 1)}-${pad2(
            ld.getDate(),
          )}` === dateStr
        );
      });

      const sleepCount = dayLogs.filter((l) => l.type === 'sleep').length;
      const nightWakings = dayLogs.filter((l) => {
        if (l.type !== 'sleep') return false;
        const h = new Date(l.createdAt).getHours();
        return h >= 0 && h < 6;
      }).length;

      const dayRoutineLogs =
        weekRoutineLogs?.find((r) => r.date === dateStr)?.logs || [];
      const routineComplete =
        totalRoutines > 0 && dayRoutineLogs.length >= totalRoutines;

      days.push({
        date: dateStr,
        label: dayLabel,
        sleepCount,
        nightWakings,
        routineComplete,
      });
    }
    return days;
  }, [logs, weekRoutineLogs, totalRoutines]);

  const totalSleepLogs = weeklyData.reduce((s, d) => s + d.sleepCount, 0);
  const totalNightWakings = weeklyData.reduce(
    (s, d) => s + d.nightWakings,
    0,
  );
  const consistentDays = weeklyData.filter((d) => d.routineComplete).length;
  const avgNightWakings =
    weeklyData.length > 0 ? (totalNightWakings / 7).toFixed(1) : '0';
  const maxBar = Math.max(
    1,
    ...weeklyData.map((d) => Math.max(d.sleepCount, d.nightWakings)),
  );

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={DARK.indigo400} />
      </View>
    );
  }

  if (weeklyData.length === 0) {
    return (
      <View style={styles.tabBody}>
        <Card style={styles.emptyCard}>
          <BarChart3 size={40} color={palette.border} />
          <Text style={styles.emptyTitle}>まだデータがありません</Text>
          <Muted style={styles.emptySub}>
            ねんねを記録すると、ここに分析が表示されます
          </Muted>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      <Card style={styles.hintCard}>
        <View style={styles.hintRow}>
          <View style={styles.hintIcon}>
            <Zap size={18} color={DARK.indigo600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hintTitle}>週間分析</Text>
            <Text style={styles.hintText}>
              {consistentDays >= 5
                ? 'この1週間、素晴らしいです。ルーティンが定着してきています。最高のチームワークですね。'
                : consistentDays >= 3
                ? 'いい感じです。ルーティンを続けることが大事です。もう少しで習慣化しますよ。'
                : 'ルーティンを毎日続けると、睡眠パターンが安定します。夫婦で頑張りましょう。'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Stat tiles */}
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Moon size={20} color={DARK.indigo500} />
          <Text style={styles.statValue}>{totalSleepLogs}</Text>
          <Text style={styles.statLabel}>ねんね記録</Text>
        </Card>
        <Card style={styles.statCard}>
          <TrendingUp size={20} color={DARK.amber500} />
          <Text style={styles.statValue}>{avgNightWakings}</Text>
          <Text style={styles.statLabel}>平均夜泣き/日</Text>
        </Card>
        <Card style={styles.statCard}>
          <Star size={20} color="#A855F7" />
          <Text style={styles.statValue}>{consistentDays}</Text>
          <Text style={styles.statLabel}>ルーティン達成</Text>
        </Card>
      </View>

      {/* Weekly bar chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>1週間のねんね記録</Text>
        <View style={styles.barChart}>
          {weeklyData.map((d) => (
            <View key={d.date} style={styles.barCol}>
              <View style={styles.barPair}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${(d.sleepCount / maxBar) * 100}%`,
                      backgroundColor: '#818CF8',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${(d.nightWakings / maxBar) * 100}%`,
                      backgroundColor: '#FBBF24',
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{d.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#818CF8' }]} />
            <Text style={styles.legendText}>ねんね</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
            <Text style={styles.legendText}>夜泣き(0-6時)</Text>
          </View>
        </View>
      </Card>

      {/* Routine consistency calendar */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>ルーティン達成カレンダー</Text>
        <View style={styles.calRow}>
          {weeklyData.map((day) => (
            <View key={day.date} style={styles.calCol}>
              <Text style={styles.calLabel}>{day.label}</Text>
              <View
                style={[
                  styles.calCell,
                  day.routineComplete
                    ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }
                    : { backgroundColor: palette.muted, borderColor: palette.border },
                ]}
              >
                {day.routineComplete ? (
                  <CheckCircle2 size={18} color={DARK.green500} />
                ) : (
                  <Circle size={18} color={palette.border} />
                )}
              </View>
            </View>
          ))}
        </View>
        {consistentDays >= 5 && (
          <View style={styles.calBonus}>
            <Text style={styles.calBonusText}>
              週5日以上達成！ボーナスポイント対象っす！
            </Text>
          </View>
        )}
      </Card>

      {sleepSessions.length > 0 && <SleepTimeline sessions={sleepSessions} />}
    </View>
  );
}

function SleepTimeline({ sessions }: { sessions: SleepSessionRow[] }) {
  const sleepBlocks = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const blocks: {
      startHour: number;
      endHour: number;
      durationMin: number;
      isNight: boolean;
    }[] = [];

    sessions
      .filter((s) => s.endedAt)
      .forEach((s) => {
        const start = new Date(s.startedAt);
        const end = new Date(s.endedAt as string);
        const clippedStart = start < dayStart ? dayStart : start;
        const clippedEnd = end > dayEnd ? dayEnd : end;
        if (clippedStart >= clippedEnd) return;
        const startHour =
          clippedStart.getHours() + clippedStart.getMinutes() / 60;
        const endHour = clippedEnd.getHours() + clippedEnd.getMinutes() / 60;
        const durationMin = Math.round(
          (clippedEnd.getTime() - clippedStart.getTime()) / 60000,
        );
        const isNight = start.getHours() >= 19 || start.getHours() < 7;
        blocks.push({
          startHour,
          endHour: endHour === 0 ? 24 : endHour,
          durationMin,
          isNight,
        });
      });
    return blocks;
  }, [sessions]);

  const totalSleepMin = sleepBlocks.reduce((s, b) => s + b.durationMin, 0);
  const totalHours = Math.floor(totalSleepMin / 60);
  const totalMins = totalSleepMin % 60;

  return (
    <Card style={styles.chartCard}>
      <View style={styles.timelineHead}>
        <Text style={styles.chartTitle}>24時間スリープタイムライン</Text>
        <Text style={styles.timelineTotal}>
          {totalHours}h{totalMins > 0 ? `${totalMins}m` : ''}
        </Text>
      </View>
      <View style={styles.timelineTrack}>
        {sleepBlocks.map((block, i) => {
          const left = (block.startHour / 24) * 100;
          const width = Math.max(
            ((block.endHour - block.startHour) / 24) * 100,
            1,
          );
          return (
            <View
              key={i}
              style={[
                styles.timelineBlock,
                {
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: block.isNight ? '#6366F1' : '#A5B4FC',
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.timelineAxis}>
        {[0, 6, 12, 18, 24].map((h) => (
          <Text key={h} style={styles.timelineAxisText}>
            {h === 24 ? '0' : h}時
          </Text>
        ))}
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
          <Text style={styles.legendText}>夜(19-7時)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#A5B4FC' }]} />
          <Text style={styles.legendText}>昼寝</Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  screenDark: { backgroundColor: DARK.slate900 },

  // Header / tabs
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, color: DARK.indigo900 },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    marginBottom: 16,
  },
  tabBarLight: { backgroundColor: 'rgba(238,242,255,0.8)' },
  tabBarDark: { backgroundColor: 'rgba(30,41,59,0.8)' },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  tabBtnActive: {
    backgroundColor: palette.card,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tabBtnActiveDark: { backgroundColor: 'rgba(49,46,129,0.8)' },
  tabLabel: { fontSize: 12, fontFamily: fonts.bodyBold },

  tabBody: { gap: 12 },
  loadingBox: { paddingVertical: 80, alignItems: 'center' },

  // Hint card (light)
  hintCard: {
    backgroundColor: 'rgba(238,242,255,0.5)',
    borderColor: DARK.indigo100,
    borderRadius: radius.lg,
    padding: 16,
  },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  hintIcon: {
    backgroundColor: '#E0E7FF',
    padding: 8,
    borderRadius: radius.md,
  },
  hintTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo900,
  },
  hintText: {
    fontSize: 12,
    color: '#4338CA',
    marginTop: 4,
    lineHeight: 18,
  },

  // Checklist
  checkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  checkIconBox: { padding: 10, borderRadius: radius.md },
  checkLabel: { fontSize: 14, fontFamily: fonts.bodyBold },
  checkDesc: { fontSize: 12, marginTop: 2 },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Completion banners
  completeCardGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: 20,
  },
  completeCardIndigo: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: 20,
  },
  completeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  completeIcon: { padding: 10, borderRadius: radius.md },
  completeTitle: { fontSize: 18, fontFamily: fonts.bodyBold },
  completeSub: { fontSize: 12, marginTop: 2 },

  // Routine progress
  progressCard: { borderRadius: radius.lg, padding: 16 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
  },
  progressRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressCount: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo600,
  },
  progressBadge: {
    backgroundColor: DARK.green50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  progressBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: DARK.green600,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: palette.muted,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    backgroundColor: DARK.indigo500,
    borderRadius: radius.full,
  },

  // Routine items
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
  },
  routineIconBox: { padding: 8, borderRadius: radius.sm },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  routineTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
  },
  assigneeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  assigneeText: { fontSize: 10, fontFamily: fonts.bodyBold },
  routineActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completeBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo600,
  },
  deleteBtn: { padding: 6 },

  // Add-routine
  addRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  addRoutineText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo500,
  },
  addFormCard: {
    borderWidth: 2,
    borderColor: '#C7D2FE',
    borderRadius: radius.md,
    padding: 16,
  },
  formLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.body,
    color: palette.foreground,
  },
  assigneeRow: { flexDirection: 'row', gap: 8 },
  assigneeOpt: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  assigneeOptActive: {
    backgroundColor: DARK.indigo50,
    borderColor: DARK.indigo400,
  },
  assigneeOptText: {
    fontSize: 13,
    fontFamily: fonts.bodySemibold,
    color: palette.mutedForeground,
  },
  assigneeOptTextActive: {
    color: DARK.indigo600,
    fontFamily: fonts.bodyBold,
  },
  formBtnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  formBtn: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formBtnCancel: { borderWidth: 1, borderColor: palette.border },
  formBtnCancelText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
  },
  formBtnSave: { backgroundColor: DARK.indigo500 },
  formBtnSaveText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: '#FFFFFF',
  },

  // Dark timer — hint
  darkHintCard: {
    backgroundColor: 'rgba(30,27,75,0.6)',
    borderColor: 'rgba(49,46,129,0.5)',
    borderRadius: radius.lg,
    padding: 16,
  },
  darkHintIcon: {
    backgroundColor: 'rgba(55,48,163,0.6)',
    padding: 8,
    borderRadius: radius.md,
  },
  darkHintTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo200,
  },
  darkHintText: {
    fontSize: 12,
    color: DARK.indigo400,
    marginTop: 4,
    lineHeight: 18,
  },

  // Dark timer — interval setting
  darkSettingCard: {
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderColor: 'rgba(49,46,129,0.5)',
    borderRadius: radius.md,
    padding: 12,
  },
  darkSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  darkSettingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  darkSettingLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo300,
  },
  intervalRow: { flexDirection: 'row', gap: 4 },
  intervalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(51,65,85,0.6)',
  },
  intervalBtnActive: { backgroundColor: DARK.indigo600 },
  intervalBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo400,
  },

  // Dark timer — main card
  timerMainCard: {
    backgroundColor: 'rgba(30,41,59,0.4)',
    borderWidth: 2,
    borderColor: 'rgba(49,46,129,0.5)',
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 18,
  },
  timerRing: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDisplay: {
    fontSize: 46,
    fontFamily: fonts.sansRegular,
    letterSpacing: 3,
  },
  observeBox: {
    width: '100%',
    backgroundColor: 'rgba(6,78,59,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(6,95,70,0.5)',
    borderRadius: radius.md,
    padding: 12,
  },
  observeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  observeTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.emerald300,
  },
  observeText: {
    fontSize: 12,
    color: 'rgba(52,211,153,0.8)',
    textAlign: 'center',
  },
  checkinBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  checkinText: { fontSize: 14, fontFamily: fonts.bodyBold },

  timerControls: { width: '100%', gap: 12 },
  timerStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DARK.indigo600,
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  timerStartBtnText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo100,
  },
  timerResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(67,56,202,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.4)',
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  timerStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(51,65,85,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(71,85,105,0.4)',
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  timerStopBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: '#E2E8F0',
  },
  timerObserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(146,64,14,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.4)',
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  timerObserveBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: DARK.amber200,
  },
  sleepSuccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DARK.indigo600,
    borderRadius: radius.md,
    paddingVertical: 18,
    ...shadows.glow,
  },
  sleepSuccessBtnText: {
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    color: '#FFFFFF',
  },
  resetGhostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  resetGhostText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo500,
  },
  observeEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(4,120,87,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.4)',
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  observeEndText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: DARK.emerald300,
  },

  // Success screen
  successWrap: { alignItems: 'center', paddingVertical: 48 },
  successMoon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(30,27,75,0.5)',
    borderWidth: 2,
    borderColor: 'rgba(129,140,248,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: { fontSize: 24, color: DARK.indigo200, marginBottom: 8 },
  successLine1: { fontSize: 14, color: DARK.indigo400, marginBottom: 4 },
  successLine2: { fontSize: 12, color: DARK.indigo500 },
  darkPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(55,48,163,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(67,56,202,0.3)',
    borderRadius: radius.md,
    paddingVertical: 18,
  },
  darkBtnText: { fontSize: 15, fontFamily: fonts.bodyBold },

  // Coaching / encouragement (dark)
  coachCard: {
    backgroundColor: 'rgba(30,27,75,0.5)',
    borderColor: 'rgba(49,46,129,0.4)',
    borderRadius: radius.lg,
    padding: 16,
  },
  coachIcon: {
    backgroundColor: 'rgba(67,56,202,0.5)',
    padding: 8,
    borderRadius: radius.md,
  },
  coachTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  coachTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo200,
  },
  coachBadge: {
    backgroundColor: 'rgba(49,46,129,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  coachBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo400,
  },
  coachText: {
    fontSize: 14,
    color: 'rgba(165,180,252,0.8)',
    lineHeight: 20,
  },
  cheerCard: {
    backgroundColor: 'rgba(59,7,100,0.4)',
    borderColor: 'rgba(107,33,168,0.4)',
    borderRadius: radius.lg,
    padding: 16,
  },
  cheerIcon: {
    backgroundColor: 'rgba(126,34,206,0.5)',
    padding: 8,
    borderRadius: radius.md,
  },
  cheerTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.purple200,
    marginBottom: 4,
  },
  cheerText: {
    fontSize: 12,
    color: 'rgba(216,180,254,0.8)',
    lineHeight: 18,
  },

  // Method list (dark)
  methodCard: {
    backgroundColor: 'rgba(30,41,59,0.4)',
    borderColor: 'rgba(49,46,129,0.4)',
    borderRadius: radius.lg,
    padding: 16,
  },
  methodTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo300,
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: radius.sm,
  },
  methodRowActive: {
    backgroundColor: 'rgba(49,46,129,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(67,56,202,0.4)',
  },
  methodNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodNumText: { fontSize: 10, fontFamily: fonts.bodyBold },
  methodText: { fontSize: 12, flex: 1 },

  // Analysis
  emptyCard: {
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
  },
  emptySub: { fontSize: 12, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: palette.mutedForeground,
  },
  chartCard: { borderRadius: radius.lg, padding: 16 },
  chartTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
    marginBottom: 12,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: 6,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barPair: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  bar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  barLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemibold,
    color: palette.mutedForeground,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: palette.mutedForeground,
  },
  calRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calCol: { alignItems: 'center', gap: 4 },
  calLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: palette.mutedForeground,
  },
  calCell: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calBonus: {
    marginTop: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: radius.sm,
    padding: 8,
  },
  calBonusText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: DARK.green700,
    textAlign: 'center',
  },
  timelineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timelineTotal: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: DARK.indigo500,
  },
  timelineTrack: {
    height: 40,
    backgroundColor: palette.muted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    position: 'relative',
  },
  timelineBlock: {
    position: 'absolute',
    top: 0,
    height: '100%',
    borderRadius: 4,
  },
  timelineAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timelineAxisText: {
    fontSize: 9,
    fontFamily: fonts.bodyBold,
    color: palette.mutedForeground,
  },
});
