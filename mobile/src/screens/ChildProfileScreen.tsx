import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Baby,
  Eye,
  Save,
  Moon,
  Star,
  Footprints,
  GraduationCap,
  ChevronUp,
  ChevronDown,
  Users,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react-native';
import DatePickerModal from '../components/DatePickerModal';
import { getChildren, updateChild, type Child } from '../api/children';
import { getLogs } from '../api/logs';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import type { RootStackParamList } from '../navigation';
// Re-use phase definitions from HomeScreen to stay in sync
import { PHASE_BUTTONS, getPhaseIndex } from './HomeScreen';
import { useTheme } from '../contexts/ThemeContext';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Screen, Card, Button, Badge, Text, Title, Muted } from '../theme/ui';
import { getLogVisual, LogIcon } from '../theme/logIcons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Static config (web parity: ChildProfile.tsx) ────────────────────────────

// web GENDER_OPTIONS: 男の子 / 女の子 / 未設定. The mobile Child.gender type is
// 'male' | 'female' | 'other' — keep that backend contract by mapping 未設定 → 'other'.
const GENDER_OPTIONS = [
  { label: '男の子', value: 'male' as const },
  { label: '女の子', value: 'female' as const },
  { label: '未設定', value: 'other' as const },
];

const CHILD_COLORS = [
  { label: 'ぶどう', value: '#805AAA' },
  { label: 'さくら', value: '#E88B9C' },
  { label: 'そら', value: '#5B9BD5' },
  { label: 'みどり', value: '#6BBF6B' },
  { label: 'ひまわり', value: '#F5A623' },
  { label: 'うみ', value: '#3BBCB8' },
];

// web nicknames key — same convention SettingsScreen uses.
const NICKNAMES_KEY = '@weyu_nicknames';
const DEFAULT_NICKNAMES = { mama: 'ママ', papa: 'パパ' };

interface ModeConfig {
  id: string;
  label: string;
  icon: typeof Baby;
  color: string;
  bg: string;
  border: string;
  description: string;
  ageRange: string;
  // mobile PHASE_BUTTONS indices: 0=乳児期 1=幼児前期 2=幼児後期 3=就学準備期
  phaseIndices: number[];
}

// web MODES (indigo/orange/emerald) → exact Tailwind hex from logIcons.tsx legend.
const MODES: ModeConfig[] = [
  {
    id: 'infant',
    label: '乳児モード',
    icon: Baby,
    color: '#4F46E5', // indigo-600
    bg: '#EEF2FF', // indigo-50
    border: '#A5B4FC', // indigo-300
    description: '授乳・おむつ・睡眠中心',
    ageRange: '0-1歳',
    phaseIndices: [0],
  },
  {
    id: 'toddler',
    label: '幼児モード',
    icon: Footprints,
    color: '#EA580C', // orange-600
    bg: '#FFF7ED', // orange-50
    border: '#FDBA74', // orange-300
    description: 'トイトレ・食事・イヤイヤ期・ことば中心',
    ageRange: '1-3歳',
    phaseIndices: [1, 2],
  },
  {
    id: 'kids',
    label: 'キッズモード',
    icon: GraduationCap,
    color: '#059669', // emerald-600
    bg: '#ECFDF5', // emerald-50
    border: '#6EE7B7', // emerald-300
    description: '予定管理・できたねスタンプ・入学準備中心',
    ageRange: '4-6歳',
    phaseIndices: [3],
  },
];

function getAgeMonths(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const birth = new Date(birthday);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 0) return null;
  return months;
}

function getAgeText(birthday: string | null | undefined): string {
  const months = getAgeMonths(birthday);
  if (months === null) return '';
  if (months < 12) return `生後${months}ヶ月`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years}歳` : `${years}歳${rem}ヶ月`;
}

// web getSuggestedMode: <12m infant, <48m toddler, else kids
function getSuggestedMode(ageMonths: number | null): string {
  if (ageMonths === null) return 'infant';
  if (ageMonths < 12) return 'infant';
  if (ageMonths < 48) return 'toddler';
  return 'kids';
}

// web getActionsForMode: union of the mode's phases, de-duped by id (here: btn.type)
function getActionsForMode(mode: ModeConfig) {
  const seen = new Set<string>();
  const actions: { type: string; label: string }[] = [];
  for (const idx of mode.phaseIndices) {
    const phase = PHASE_BUTTONS[idx] ?? [];
    for (const btn of phase) {
      if (!seen.has(btn.type)) {
        seen.add(btn.type);
        actions.push({ type: btn.type, label: btn.label });
      }
    }
  }
  return actions;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChildProfileScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const familyId = user?.familyId ?? '';
  const userRole = user?.role === 'mama' ? 'mama' : 'papa';
  const { isDark, colors } = useTheme();
  const childId = route.params?.childId as number;
  const queryClient = useQueryClient();
  const setActiveChildId = useChildStore((s) => s.setActiveChildId);

  const { data: children = [] } = useQuery({
    queryKey: ['children', familyId],
    queryFn: () => getChildren(familyId),
  });
  const child = children.find((c) => c.id === childId);

  const { data: allLogs = [] } = useQuery({
    queryKey: ['logs', familyId],
    queryFn: () => getLogs(familyId),
    enabled: !!familyId,
  });

  const [name, setName] = useState(child?.name ?? '');
  const [birthday, setBirthday] = useState(child?.birthday ?? '');
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(
    child?.gender ?? 'male',
  );
  const [color, setColor] = useState(child?.color ?? '#805AAA');
  const [selectedMode, setSelectedMode] = useState('infant');
  const [sleepTrainingEnabled, setSleepTrainingEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [labels, setLabels] = useState(DEFAULT_NICKNAMES);

  // Per-child AsyncStorage keys (same @weyu_<feature>_<childId> convention the
  // rest of the mobile app uses). Hidden = OFF list (consumed by HomeScreen).
  const hiddenKey = `@weyu_btn_hidden_${childId}`;
  const orderKey = `@weyu_btn_order_${childId}`;
  const sleepKey = `@weyu_sleep_training_${childId}`;

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  // Persisted custom order of action types (reorder feature).
  const [order, setOrder] = useState<string[]>([]);

  // Sync local form state when the active child resolves / changes.
  useEffect(() => {
    if (!child) return;
    setName(child.name || '');
    setBirthday(child.birthday || '');
    setGender(child.gender ?? 'male');
    setColor(child.color || '#805AAA');
    setActiveChildId(child.id);
    const months = getAgeMonths(child.birthday);
    setSelectedMode(getSuggestedMode(months));
  }, [child?.id]);

  // Partner labels — read the same @weyu_nicknames key SettingsScreen writes.
  useEffect(() => {
    AsyncStorage.getItem(NICKNAMES_KEY).then((raw) => {
      if (!raw) return;
      try {
        const n = JSON.parse(raw);
        setLabels({
          mama: n.mama || DEFAULT_NICKNAMES.mama,
          papa: n.papa || DEFAULT_NICKNAMES.papa,
        });
      } catch {
        /* ignore */
      }
    });
  }, []);

  // Nentore toggle — persisted per child (same key convention as buttons).
  useEffect(() => {
    AsyncStorage.getItem(sleepKey).then((stored) => {
      if (stored !== null) setSleepTrainingEnabled(stored === '1');
    });
  }, [sleepKey]);

  const ageText = useMemo(() => getAgeText(birthday), [birthday]);
  const ageMonths = useMemo(() => getAgeMonths(birthday), [birthday]);
  const suggestedMode = useMemo(
    () => getSuggestedMode(ageMonths),
    [ageMonths],
  );

  const currentMode = useMemo(
    () => MODES.find((m) => m.id === selectedMode) || MODES[0],
    [selectedMode],
  );
  const modeActions = useMemo(
    () => getActionsForMode(currentMode),
    [currentMode],
  );

  // Load hidden + order for this child / mode.
  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(hiddenKey),
      AsyncStorage.getItem(orderKey),
    ]).then(([h, o]) => {
      if (cancelled) return;
      setHiddenTypes(h ? new Set<string>(JSON.parse(h)) : new Set<string>());
      if (o) {
        try {
          setOrder(JSON.parse(o));
          return;
        } catch {
          /* ignore */
        }
      }
      setOrder(modeActions.map((a) => a.type));
    });
    return () => {
      cancelled = true;
    };
  }, [childId, selectedMode]);

  // Ordered list of the current mode's actions (custom order first, then any
  // new ones appended). This drives both the customize list and the preview.
  const orderedActions = useMemo(() => {
    const byType = new Map(modeActions.map((a) => [a.type, a]));
    const result: { type: string; label: string }[] = [];
    for (const t of order) {
      const a = byType.get(t);
      if (a) {
        result.push(a);
        byType.delete(t);
      }
    }
    for (const a of byType.values()) result.push(a);
    return result;
  }, [modeActions, order]);

  const enabledActions = useMemo(
    () => orderedActions.filter((a) => !hiddenTypes.has(a.type)),
    [orderedActions, hiddenTypes],
  );

  const toggleAction = useCallback(
    async (type: string) => {
      const next = new Set(hiddenTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      setHiddenTypes(next);
      await AsyncStorage.setItem(hiddenKey, JSON.stringify([...next]));
    },
    [hiddenTypes, hiddenKey],
  );

  const moveAction = useCallback(
    async (type: string, direction: 'up' | 'down') => {
      const current = orderedActions.map((a) => a.type);
      const idx = current.indexOf(type);
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || target < 0 || target >= current.length) return;
      [current[idx], current[target]] = [current[target], current[idx]];
      setOrder(current);
      await AsyncStorage.setItem(orderKey, JSON.stringify(current));
    },
    [orderedActions, orderKey],
  );

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Child>) => updateChild(childId, data),
    onSuccess: async () => {
      await AsyncStorage.setItem(
        sleepKey,
        sleepTrainingEnabled ? '1' : '0',
      );
      queryClient.invalidateQueries({ queryKey: ['children', familyId] });
      Alert.alert(
        `${name || (child?.name ?? '')}の成長に合わせて、ホーム画面をアップデートしました！`,
        '',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    },
    onError: () => Alert.alert('エラー', '保存に失敗しました。'),
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: name.trim() || child?.name,
      birthday: birthday || undefined,
      gender,
      color,
    });
  };

  const handleCopyCode = () => {
    const id = String(familyId);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).clipboard?.writeText(id).catch(() => {});
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RN = require('react-native');
        RN.Clipboard?.setString(id);
      } catch {
        /* ignore */
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Latest log per role (web: first log filtered by userId === papa/mama).
  const papaLog = useMemo(
    () => (allLogs as any[]).find((l) => l.userId === 'papa') ?? null,
    [allLogs],
  );
  const mamaLog = useMemo(
    () => (allLogs as any[]).find((l) => l.userId === 'mama') ?? null,
    [allLogs],
  );

  const switchTrack = {
    false: isDark ? '#3A3A55' : palette.border,
    true: isDark ? palette.primary : '#C3A8E8',
  };
  const switchThumb = (on: boolean) =>
    on
      ? isDark
        ? '#EFEFEF'
        : palette.primary
      : isDark
      ? '#888899'
      : '#f5f5f5';

  if (!child) {
    return (
      <View style={styles.centered}>
        <Muted>読み込み中...</Muted>
      </View>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      {/* 1 — Avatar / name / age */}
      <Card style={styles.profileCard}>
        <View style={styles.avatarBlock}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: color + '30', borderColor: color },
            ]}
          >
            <Baby size={40} color={color} />
          </View>
          <Title style={styles.childName}>{name || child.name}</Title>
          {!!ageText && (
            <Text style={[styles.childAge, { color }]}>{ageText}</Text>
          )}
        </View>

        {/* 2 — Profile form */}
        <View style={styles.formBlock}>
          <View>
            <Text style={styles.label}>なまえ</Text>
            <TextInput
              style={[styles.input, isDark && { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="お子さまの名前"
              placeholderTextColor={palette.mutedForeground}
            />
          </View>

          <View>
            <Text style={styles.label}>たんじょうび</Text>
            {/* Calendar picker instead of manual entry (client feedback 2026-07-30). */}
            <Button
              variant="outline"
              onPress={() => setShowBirthdayPicker(true)}
              style={[styles.datePickerBtn, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.datePickerBtnInner}>
                <CalendarIcon size={16} color={palette.mutedForeground} strokeWidth={2} />
                <Text style={[
                  styles.datePickerBtnText,
                  !birthday && { color: palette.mutedForeground },
                  isDark && birthday && { color: colors.text },
                ]}>
                  {birthday || '日付を選ぶ'}
                </Text>
              </View>
            </Button>
            <DatePickerModal
              visible={showBirthdayPicker}
              initialDate={birthday}
              maxDate={new Date()}
              title="たんじょうびを選ぶ"
              onConfirm={setBirthday}
              onClose={() => setShowBirthdayPicker(false)}
            />
          </View>

          <View>
            <Text style={styles.label}>せいべつ</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={gender === opt.value ? 'default' : 'outline'}
                  onPress={() => setGender(opt.value)}
                  style={styles.genderBtn}
                >
                  {opt.label}
                </Button>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.label}>イメージカラー</Text>
            <View style={styles.colorRow}>
              {CHILD_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setColor(c.value)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c.value },
                    color === c.value && styles.colorSwatchActive,
                    color === c.value && { borderColor: c.value },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </Card>

      {/* 3 — 育児モード・セレクト */}
      <Card style={[styles.sectionCard, { borderColor: '#BFDBFE' }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#DBEAFE' }]}>
            <Star size={20} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>育児モード・セレクト</Text>
            <Muted style={styles.sectionSub}>
              お子さまの成長に合わせたモード
            </Muted>
          </View>
        </View>

        <View style={styles.modeList}>
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;
            const isSuggested = suggestedMode === mode.id;
            return (
              <TouchableOpacity
                key={mode.id}
                activeOpacity={0.85}
                onPress={() => setSelectedMode(mode.id)}
                style={[
                  styles.modeRow,
                  isSelected
                    ? { backgroundColor: mode.bg, borderColor: mode.border }
                    : styles.modeRowIdle,
                ]}
              >
                <View
                  style={[styles.modeIconTile, { backgroundColor: mode.bg }]}
                >
                  <Icon size={24} color={mode.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.modeTitleRow}>
                    <Text
                      style={[
                        styles.modeLabel,
                        { color: isSelected ? mode.color : palette.foreground },
                      ]}
                    >
                      {mode.label}
                    </Text>
                    {isSuggested && (
                      <Badge variant="secondary" style={styles.suggestBadge}>
                        おすすめ
                      </Badge>
                    )}
                  </View>
                  <Muted style={styles.modeAge}>{mode.ageRange}</Muted>
                  <Muted style={styles.modeDesc}>{mode.description}</Muted>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* 4 — ネントレモード */}
      <Card style={[styles.sectionCardSm, { borderColor: '#C7D2FE' }]}>
        <View style={styles.nentoreHeader}>
          <View style={styles.nentoreLeft}>
            <View
              style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}
            >
              <Moon size={20} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>ネントレモード</Text>
              <Muted style={styles.sectionSub}>睡眠トレーニング機能を使う</Muted>
            </View>
          </View>
          <Switch
            value={sleepTrainingEnabled}
            onValueChange={setSleepTrainingEnabled}
            trackColor={switchTrack}
            thumbColor={switchThumb(sleepTrainingEnabled)}
          />
        </View>
        {sleepTrainingEnabled && (
          <Text style={styles.nentoreHint}>
            ねんねボタンに「ネントレタイマーで計測する」が表示されます
          </Text>
        )}
      </Card>

      {/* 5 — ボタンカスタマイズ */}
      <Card style={[styles.sectionCard, { borderColor: '#C7D2FE' }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}>
            <Eye size={20} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>ボタンカスタマイズ</Text>
            <Muted style={styles.sectionSub}>表示・並び順を変更</Muted>
          </View>
        </View>

        <View style={styles.toggleList}>
          {orderedActions.map((action, index) => {
            const isOn = !hiddenTypes.has(action.type);
            const v = getLogVisual(action.type);
            return (
              <View
                key={action.type}
                style={[styles.toggleRow, !isOn && styles.toggleRowOff]}
              >
                <View
                  style={[
                    styles.toggleIconTile,
                    { backgroundColor: v.soft, borderColor: v.bord },
                  ]}
                >
                  <LogIcon type={action.type} size={18} />
                </View>
                <Text style={styles.toggleLabel}>{action.label}</Text>

                {isOn && (
                  <View style={styles.reorderGroup}>
                    <TouchableOpacity
                      onPress={() => moveAction(action.type, 'up')}
                      disabled={index <= 0}
                      style={[
                        styles.reorderBtn,
                        index <= 0 && styles.reorderBtnDisabled,
                      ]}
                      hitSlop={6}
                    >
                      <ChevronUp size={16} color={palette.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveAction(action.type, 'down')}
                      disabled={index >= orderedActions.length - 1}
                      style={[
                        styles.reorderBtn,
                        index >= orderedActions.length - 1 &&
                          styles.reorderBtnDisabled,
                      ]}
                      hitSlop={6}
                    >
                      <ChevronDown size={16} color={palette.foreground} />
                    </TouchableOpacity>
                  </View>
                )}

                <Switch
                  value={isOn}
                  onValueChange={() => toggleAction(action.type)}
                  trackColor={switchTrack}
                  thumbColor={switchThumb(isOn)}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>ホーム画面プレビュー</Text>
          <View style={styles.previewWrap}>
            {enabledActions.map((action) => {
              const v = getLogVisual(action.type);
              return (
                <View
                  key={action.type}
                  style={[
                    styles.previewChip,
                    { backgroundColor: v.soft, borderColor: v.bord },
                  ]}
                >
                  <LogIcon type={action.type} size={14} />
                  <Text style={[styles.previewChipText, { color: v.tint }]}>
                    {action.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </Card>

      {/* 6 — We育ステータス */}
      <Card style={[styles.sectionCard, { borderColor: '#BBF7D0' }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#DCFCE7' }]}>
            <Users size={20} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>We育ステータス</Text>
            <Muted style={styles.sectionSub}>パートナーとの共有状況</Muted>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={styles.label}>ペアリングコード</Text>
            <View style={styles.pairRow}>
              <View style={styles.pairCode}>
                <Text style={styles.pairCodeText}>{String(familyId)}</Text>
              </View>
              <TouchableOpacity
                onPress={handleCopyCode}
                style={styles.copyBtn}
                activeOpacity={0.7}
              >
                {copied ? (
                  <Check size={16} color={palette.secondary} />
                ) : (
                  <Copy size={16} color={palette.foreground} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statusGrid}>
            <View
              style={[
                styles.statusCard,
                { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
              ]}
            >
              <Text style={[styles.statusLabel, { color: '#3B82F6' }]}>
                {labels.papa}の最新記録
              </Text>
              {papaLog ? (
                <Text style={styles.statusValue}>
                  {papaLog.type} -{' '}
                  {new Date(papaLog.createdAt).toLocaleDateString('ja-JP')}
                </Text>
              ) : (
                <Muted style={styles.statusEmpty}>まだ記録なし</Muted>
              )}
            </View>
            <View
              style={[
                styles.statusCard,
                { backgroundColor: '#FDF2F8', borderColor: '#FCE7F3' },
              ]}
            >
              <Text style={[styles.statusLabel, { color: '#EC4899' }]}>
                {labels.mama}の最新記録
              </Text>
              {mamaLog ? (
                <Text style={styles.statusValue}>
                  {mamaLog.type} -{' '}
                  {new Date(mamaLog.createdAt).toLocaleDateString('ja-JP')}
                </Text>
              ) : (
                <Muted style={styles.statusEmpty}>まだ記録なし</Muted>
              )}
            </View>
          </View>

          <View
            style={[
              styles.statusCard,
              { backgroundColor: '#FAF5FF', borderColor: '#F3E8FF' },
            ]}
          >
            <Text style={[styles.statusLabel, { color: '#9333EA' }]}>
              現在の担当
            </Text>
            <Text style={[styles.caregiverValue, { color: '#7C3AED' }]}>
              {(userRole === 'papa' ? labels.papa : labels.mama)} が操作中
            </Text>
          </View>
        </View>
      </Card>

      {/* 7 — 習得したチーム育児スキル (link row → SkillTree) */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('SkillTree')}
      >
        <Card style={styles.skillRow}>
          <View
            style={[styles.sectionIconWrap, { backgroundColor: '#F3E8FF' }]}
          >
            <Sparkles size={20} color="#9333EA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>習得したチーム育児スキル</Text>
            <Muted style={styles.sectionSub}>
              ふたりで育てたスキルツリーを見る
            </Muted>
          </View>
          <ChevronRight size={20} color={palette.mutedForeground} />
        </Card>
      </TouchableOpacity>

      {/* 8 — Save */}
      <Button
        onPress={handleSave}
        disabled={updateMutation.isPending}
        style={styles.saveBtn}
      >
        <Save size={18} color={palette.primaryForeground} />
        <Text style={styles.saveBtnText}>
          {updateMutation.isPending ? '保存中...' : '保存する'}
        </Text>
      </Button>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  content: { padding: 16, paddingBottom: 40, gap: 16 },

  // Profile card — web: border-2 border-purple-200, rounded-[24px]
  profileCard: {
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#D8B4E2',
  },
  avatarBlock: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: 12,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  childName: { fontSize: 20, color: palette.foreground },
  childAge: {
    fontSize: 24,
    fontFamily: fonts.sans,
    fontWeight: '700',
    marginTop: 4,
  },

  formBlock: { gap: 16 },
  label: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.mutedForeground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
  },
  datePickerBtn: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 2,
    borderColor: palette.border,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  datePickerBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePickerBtnText: { fontFamily: fonts.body, fontSize: 15, color: palette.foreground },

  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: { flex: 1 },

  // gap 6 + swatch 36 lets all 6 colors fit on a single row on narrow phones
  // (previously 8+40 wrapped the 6th color onto a lonely second row).
  colorRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: { transform: [{ scale: 1.1 }], borderWidth: 2 },

  // Section card — web: border-2, rounded-[24px], p-6
  sectionCard: {
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#C7D2FE',
  },
  // ネントレ card — web: p-5
  sectionCardSm: {
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#C7D2FE',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.sans,
    fontWeight: '700',
    color: palette.foreground,
  },
  sectionSub: { fontSize: 11, color: palette.mutedForeground, marginTop: 1 },

  // 育児モード
  modeList: { gap: 12 },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  modeRowIdle: {
    backgroundColor: palette.card,
    borderColor: palette.border,
  },
  modeIconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  modeLabel: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  suggestBadge: { paddingVertical: 1 },
  modeAge: { fontSize: 12, color: palette.mutedForeground, marginTop: 2 },
  modeDesc: { fontSize: 12, color: palette.mutedForeground, marginTop: 4 },

  // ネントレ
  nentoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nentoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  nentoreHint: {
    fontSize: 12,
    color: '#6366F1',
    marginTop: 12,
    marginLeft: 52,
  },

  // ボタンカスタマイズ
  toggleList: { gap: 8, marginBottom: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  toggleRowOff: { backgroundColor: palette.muted, opacity: 0.6 },
  toggleIconTile: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodySemibold,
    fontWeight: '500',
    color: palette.foreground,
  },
  reorderGroup: { flexDirection: 'row', gap: 4 },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: { opacity: 0.3 },

  previewBox: {
    backgroundColor: palette.muted,
    borderRadius: radius.sm,
    padding: 16,
  },
  previewTitle: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.mutedForeground,
    marginBottom: 12,
  },
  previewWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  previewChipText: {
    fontSize: 12,
    fontFamily: fonts.bodySemibold,
    fontWeight: '500',
  },

  // We育ステータス
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pairCode: {
    flex: 1,
    backgroundColor: palette.muted,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pairCodeText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.primary,
    letterSpacing: 2,
  },
  copyBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGrid: { flexDirection: 'row', gap: 12 },
  statusCard: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 12,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusValue: { fontSize: 12, color: palette.foreground },
  statusEmpty: { fontSize: 12, color: palette.mutedForeground },
  caregiverValue: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },

  // Skill link row
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },

  saveBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.md,
  },
  saveBtnText: {
    color: palette.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
});
