/**
 * SettingsScreen — section-for-section visual + feature port of the canonical
 * web page client/src/pages/Settings.tsx (WeYu).
 *
 * WeYu Settings.tsx render order (Settings.tsx:1210-1447) — mirrored EXACTLY:
 *   0. Header  ("はじめまして！" / "アプリ設定")
 *   0b. First-setup banner (conditional)
 *   1. 赤ちゃんのプロフィール   (お名前 / 生年月日)            [form §1 — /api/settings]
 *   2. あなたの役割            (パパ / ママ / その他 radio)    [form §2 — userType]
 *   3. 呼び方の変更            (パパ側 / ママ側 inline入力)     [form §-, useUserLabels]
 *   4. わが家の必殺技          (specialTrick)                  [form §3 — /api/settings]
 *   5. 設定を保存 button                                        [form submit]
 *   6. お子様の管理            (children list / add / delete)  [<ChildrenSection>]
 *   7. カスタム育児項目        (list / delete; hidden if空)     [<CustomChildcareSection>]
 *   8. 表示するボタン          (phase button customization)    [<ButtonCustomizationSection>]
 *   9. ペアリング              (code / copy / partner-join)    [<PairingSection>]
 *  10. アプリとして使う        → native-equivalent note         [<InstallGuide>]
 *  11. 画面の明るさ            (light / dark / auto)           [<ThemeSection>]
 *  12. 表示設定                (Weボード / チーム育児スキル)    [<FeatureToggleSection>]
 *  13. 授乳アラーム            (目標間隔 / 有効 / 通知タイミング)[<FeedingNotificationSection>]
 *  14. 改善提案を送る          (feedback)                      [<FeedbackSection>]
 *  15. 使い方ヒント link                                        [/tips link]
 *  16. プライバシーポリシー・利用規約 link                       [/legal link]
 *  17. ログアウト (conditional)                                 [logout button]
 *  18. version footer
 *
 * Mobile-only behaviour PRESERVED (no web equivalent — kept intact, placed so
 * it does not break the WeYu order: a compact profile header above the WeYu
 * sections, and a "機能" navigation card after the WeYu sections):
 *   • profile header, ナビゲーションメニュー (機能),
 *     通知 settings, add-child sheet (matches ChildProfile).
 *
 * Render-loop fix PRESERVED: the settings useQuery has NO refetchInterval and
 * the form is hydrated ONCE via `hydratedRef` (see §"Settings query").
 *
 * Styling/components only from theme/tokens + theme/ui.
 * Icons from lucide-react-native — same icon vocabulary as the web's lucide-react.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Users,
  User,
  Baby,
  Cake,
  Crown,
  ArrowLeft,
  ChevronRight,
  Share2,
  Copy,
  Check,
  UserPlus,
  Moon,
  Sun,
  Clock,
  Bell,
  LayoutGrid,
  BellRing,
  Star,
  Trash2,
  LogOut,
  Utensils,
  Mic,
  MessagesSquare,
  MessageSquare,
  HelpCircle,
  Smartphone,
  Save,
  Plus,
  Info,
  BookOpen,
  Download,
  Heart,
  HandHeart,
  Scissors,
  Brush,
  Bike,
  Package,
  Lamp,
  Pill,
  Thermometer,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { createChild } from '../api/children';
import { joinFamily } from '../api/auth';
import { apiRequest } from '../api/client';
import type { RootStackParamList } from '../navigation';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Screen, Card, Button, Text, Title, Muted } from '../theme/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Storage keys & defaults ──────────────────────────────────────────────────
const NICKNAMES_KEY = '@weyu_nicknames';
const NOTIF_KEY     = '@weyu_notif_settings';
const DISPLAY_KEY   = '@weyu_display_settings';
// Feeding-alarm keys — same semantic contract as web localStorage keys in
// use-feeding-notification.ts ("feedingNotifyEnabled" / "feedingNotifyMinutes"
// / "feedingTargetIntervalMin"), namespaced with the mobile @weyu_ prefix.
const FEED_ENABLED_KEY  = '@weyu_feedingNotifyEnabled';
const FEED_MINUTES_KEY  = '@weyu_feedingNotifyMinutes';
const FEED_INTERVAL_KEY = '@weyu_feedingTargetIntervalMin';

interface Nicknames      { mama: string; papa: string }
interface NotifSettings  { reminders: boolean; partnerNotif: boolean; milestoneAlert: boolean }
interface DisplaySettings { showWeBoard: boolean; showSkillTree: boolean }

const DEFAULT_NICKNAMES: Nicknames       = { mama: 'ママ', papa: 'パパ' };
const DEFAULT_NOTIF: NotifSettings       = { reminders: true, partnerNotif: true, milestoneAlert: true };
const DEFAULT_DISPLAY: DisplaySettings   = { showWeBoard: true, showSkillTree: true };

// ─── Theme options (web Settings.tsx ThemeSection) ────────────────────────────
// Sun(amber)/Moon(indigo)/Clock(purple) tiles. Mobile ThemeContext fixes auto
// to 18時〜6時 (no per-hour selectors), so the auto description is that window.
const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  iconColor: string;
}[] = [
  { mode: 'light', label: 'ライト', desc: '常に明るい画面',   Icon: Sun,   iconColor: '#F59E0B' },
  { mode: 'dark',  label: 'ダーク',  desc: '常に暗い画面',     Icon: Moon,  iconColor: '#818CF8' },
  { mode: 'auto',  label: '自動',    desc: '18時〜6時はダーク', Icon: Clock, iconColor: '#A855F7' },
];

// web FeedingNotificationSection — 目標授乳間隔 chips
const INTERVAL_OPTIONS: { label: string; value: number }[] = [
  { label: '自動',    value: 0 },
  { label: '2時間',   value: 120 },
  { label: '2.5時間', value: 150 },
  { label: '3時間',   value: 180 },
  { label: '3.5時間', value: 210 },
  { label: '4時間',   value: 240 },
  { label: '5時間',   value: 300 },
  { label: '6時間',   value: 360 },
];
// web FeedingNotificationSection — 何分前 chips
const TIMING_OPTIONS = [5, 10, 15, 20, 30];

// ─── Settings shape (mirrors web /api/settings — shared/schema.ts `settings`) ──
interface AppSettings {
  familyId: string;
  babyName: string;
  babyBirthday?: string | null;
  specialTrick?: string | null;
  currentCaregiver: string;
}

// Web uses this exact sentinel to detect the first-setup state.
const FIRST_SETUP_NAME = '赤ちゃんのなまえ';

// Web's CustomChildcareSection icon map (same lucide names).
const SETTINGS_ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Star, Heart, HandHeart, Scissors, Brush, Bike, Package, Lamp, Pill, Thermometer,
};

function notify(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(message ? `${title}\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'キャンセル', style: 'cancel' },
    { text: 'OK', style: 'destructive', onPress: onConfirm },
  ]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, setUser, logout: storeLogout } = useAuthStore();
  const { children, activeChildId, setChildren, setActiveChildId } = useChildStore();
  const queryClient = useQueryClient();
  const { mode: themeMode, setMode: setThemeMode, isDark } = useTheme();

  const familyId = user?.familyId ?? '';

  // ── State ────────────────────────────────────────────────────────────────────
  const [showAddChild, setShowAddChild]   = useState(false);
  const [childName, setChildName]         = useState('');
  const [childBirthday, setChildBirthday] = useState('');
  const [childGender, setChildGender]     = useState<'male' | 'female' | 'other'>('male');
  const [childColor, setChildColor]       = useState('#805AAA');

  // Same options as ChildProfileScreen / web ChildProfile.tsx
  const GENDER_OPTIONS = [
    { label: '男の子', value: 'male' as const },
    { label: '女の子', value: 'female' as const },
    { label: 'その他', value: 'other' as const },
  ];
  const CHILD_COLORS = [
    { label: 'ぶどう', value: '#805AAA' },
    { label: 'さくら', value: '#E88B9C' },
    { label: 'そら', value: '#5B9BD5' },
    { label: 'みどり', value: '#6BBF6B' },
    { label: 'ひまわり', value: '#F5A623' },
    { label: 'うみ', value: '#3BBCB8' },
  ];

  const [nicknames, setNicknames]   = useState<Nicknames>(DEFAULT_NICKNAMES);
  const [notif, setNotif]           = useState<NotifSettings>(DEFAULT_NOTIF);
  const [display, setDisplay]       = useState<DisplaySettings>(DEFAULT_DISPLAY);

  // 呼び方の変更 — web Settings.tsx:1317-1342 keeps editable buffers, saved on blur.
  const [editPapaLabel, setEditPapaLabel] = useState('');
  const [editMamaLabel, setEditMamaLabel] = useState('');
  const labelsHydratedRef = React.useRef(false);

  // ── Profile form (web form §1–4 — backed by /api/settings) ───────────────────
  const [babyName, setBabyName]           = useState('');
  const [babyBirthday, setBabyBirthday]   = useState('');
  const [specialTrick, setSpecialTrick]   = useState('');
  // Role / caregiver — web uses useUserType ("papa"/"mama"/"other").
  const [userRole, setUserRole]           = useState<'papa' | 'mama' | 'other'>(
    user?.role === 'mama' ? 'mama' : user?.role === 'other' ? 'other' : 'papa',
  );

  // ── Settings query (web: useSettings(familyId)) ──────────────────────────────
  // RENDER-LOOP FIX: NO refetchInterval here. staleTime keeps it from
  // re-fetching on focus; the form is hydrated exactly once below.
  const {
    data: settings,
    isLoading: settingsLoading,
  } = useQuery<AppSettings>({
    queryKey: ['/api/settings', familyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/settings/${familyId}`);
      return res.json();
    },
    enabled: !!familyId,
    staleTime: 30000,
  });

  const isFirstSetup = settings?.babyName === FIRST_SETUP_NAME;

  // Hydrate the form ONCE when settings first arrive (web: form.reset on load).
  // Guarded with a ref so any refetch can't re-clobber what the user types
  // (the previous version reset state on every `settings` change → render loop).
  const hydratedRef = React.useRef(false);
  useEffect(() => {
    if (settings && !hydratedRef.current) {
      hydratedRef.current = true;
      setBabyName(settings.babyName === FIRST_SETUP_NAME ? '' : settings.babyName ?? '');
      setBabyBirthday(settings.babyBirthday ?? '');
      setSpecialTrick(settings.specialTrick ?? 'ビニール袋の音');
      if (settings.currentCaregiver === 'ママ') setUserRole('mama');
      else if (settings.currentCaregiver === 'パパ') setUserRole('papa');
      else if (settings.currentCaregiver === 'その他') setUserRole('other');
    }
  }, [settings]);

  // ── Pairing join state (web: PairingSection) ─────────────────────────────────
  const [copied, setCopied]     = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining]   = useState(false);

  // ── Feedback state (web: FeedbackSection) ────────────────────────────────────
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // ── Feeding-alarm state (web: FeedingNotificationSection) ────────────────────
  const [feedEnabled, setFeedEnabled]   = useState(false);
  const [feedMinutes, setFeedMinutes]   = useState(10);
  const [feedInterval, setFeedInterval] = useState(0);

  // Load AsyncStorage-backed prefs once.
  useEffect(() => {
    const load = async () => {
      try {
        const [nn, no, di, fe, fm, fi] = await Promise.all([
          AsyncStorage.getItem(NICKNAMES_KEY),
          AsyncStorage.getItem(NOTIF_KEY),
          AsyncStorage.getItem(DISPLAY_KEY),
          AsyncStorage.getItem(FEED_ENABLED_KEY),
          AsyncStorage.getItem(FEED_MINUTES_KEY),
          AsyncStorage.getItem(FEED_INTERVAL_KEY),
        ]);
        if (nn) {
          const parsed: Nicknames = JSON.parse(nn);
          setNicknames(parsed);
          if (!labelsHydratedRef.current) {
            labelsHydratedRef.current = true;
            setEditPapaLabel(parsed.papa);
            setEditMamaLabel(parsed.mama);
          }
        } else if (!labelsHydratedRef.current) {
          labelsHydratedRef.current = true;
          setEditPapaLabel(DEFAULT_NICKNAMES.papa);
          setEditMamaLabel(DEFAULT_NICKNAMES.mama);
        }
        if (no) setNotif(JSON.parse(no));
        if (di) setDisplay(JSON.parse(di));
        if (fe) setFeedEnabled(fe === 'true');
        if (fm) setFeedMinutes(parseInt(fm, 10) || 10);
        if (fi) setFeedInterval(parseInt(fi, 10) || 0);
      } catch {}
    };
    load();
  }, []);

  const saveNicknames = useCallback(async (val: Nicknames) => {
    setNicknames(val);
    await AsyncStorage.setItem(NICKNAMES_KEY, JSON.stringify(val));
  }, []);

  const saveNotif = useCallback(async (val: NotifSettings) => {
    setNotif(val);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(val));
  }, []);

  const saveDisplay = useCallback(async (val: DisplaySettings) => {
    setDisplay(val);
    await AsyncStorage.setItem(DISPLAY_KEY, JSON.stringify(val));
  }, []);

  // 呼び方の変更 — persist on blur (web: onBlur={() => save(value)}).
  const commitPapaLabel = useCallback(() => {
    const next = editPapaLabel.trim() || 'パパ';
    saveNicknames({ ...nicknames, papa: next });
    setEditPapaLabel(next);
  }, [editPapaLabel, nicknames, saveNicknames]);

  const commitMamaLabel = useCallback(() => {
    const next = editMamaLabel.trim() || 'ママ';
    saveNicknames({ ...nicknames, mama: next });
    setEditMamaLabel(next);
  }, [editMamaLabel, nicknames, saveNicknames]);

  // ── Feeding-alarm setters (web: handleToggle / handleMinutesChange / handleIntervalChange) ──
  const handleFeedToggle = useCallback(async (val: boolean) => {
    setFeedEnabled(val);
    await AsyncStorage.setItem(FEED_ENABLED_KEY, val ? 'true' : 'false');
    notify(val ? '授乳アラームを有効にしました' : '授乳アラームをオフにしました');
  }, []);

  const handleFeedMinutes = useCallback(async (val: number) => {
    setFeedMinutes(val);
    await AsyncStorage.setItem(FEED_MINUTES_KEY, String(val));
  }, []);

  const handleFeedInterval = useCallback(async (val: number) => {
    setFeedInterval(val);
    await AsyncStorage.setItem(FEED_INTERVAL_KEY, String(val));
  }, []);

  // ── Save settings (web: useUpdateSettings + form.onSubmit) ───────────────────
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: AppSettings) => {
      const res = await apiRequest('POST', '/api/settings', data);
      return res.json();
    },
    onSuccess: async (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      // Mirror web: persist familyId + role, then return home.
      await AsyncStorage.setItem('familyId', vars.familyId);
      const role =
        vars.currentCaregiver === 'ママ'
          ? 'mama'
          : vars.currentCaregiver === 'その他'
            ? 'other'
            : 'papa';
      if (user) setUser({ ...user, familyId: vars.familyId, role });
      notify('設定を保存しました');
      navigation.navigate('Main');
    },
    onError: () => notify('保存に失敗しました', 'もう一度お試しください'),
  });

  const handleSaveSettings = () => {
    if (!babyName.trim()) {
      notify('入力エラー', '名前を入力してください');
      return;
    }
    const caregiver =
      userRole === 'mama' ? 'ママ' : userRole === 'other' ? 'その他' : 'パパ';
    updateSettingsMutation.mutate({
      familyId: familyId,
      babyName: babyName.trim(),
      babyBirthday: babyBirthday.trim() || undefined,
      specialTrick: specialTrick.trim() || undefined,
      currentCaregiver: caregiver,
    });
  };

  // ── Add-child mutation (preserved mobile behaviour) ──────────────────────────
  const addChildMutation = useMutation({
    mutationFn: () =>
      createChild({
        name: childName.trim(),
        birthday: childBirthday.trim() || undefined,
        familyId: user?.familyId as any,
        gender: childGender,
        color: childColor,
      }),
    onSuccess: (newChild) => {
      const updated = [...children, newChild];
      setChildren(updated);
      setActiveChildId(newChild.id);
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setShowAddChild(false);
      setChildName('');
      setChildBirthday('');
      setChildGender('male');
      setChildColor('#805AAA');
    },
    onError: () => Alert.alert('エラー', '子どもの登録に失敗しました。'),
  });

  const handleAddChild = () => {
    if (!childName.trim()) { Alert.alert('入力エラー', '名前を入力してください。'); return; }
    addChildMutation.mutate();
  };

  // ── Delete child (web: ChildrenSection handleDelete — keeps ≥1 child) ────────
  const deleteChildMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/children/${id}`);
      return id;
    },
    onSuccess: (id) => {
      const remaining = children.filter((c) => c.id !== id);
      setChildren(remaining);
      if (activeChildId === id && remaining.length > 0) {
        setActiveChildId(remaining[0].id);
      }
      queryClient.invalidateQueries({ queryKey: ['children'] });
      notify('お子様を削除しました');
    },
    onError: () => notify('エラー', '削除に失敗しました'),
  });

  const handleDeleteChild = (id: number, name: string) => {
    if (children.length <= 1) {
      notify('最後のお子様は削除できません');
      return;
    }
    confirmAction('お子様を削除', `「${name}」を削除しますか？`, () =>
      deleteChildMutation.mutate(id),
    );
  };

  // ── Logout (preserved mobile behaviour) ──────────────────────────────────────
  const doLogout = async () => {
    await storeLogout();
    useChildStore.getState().setChildren([]);
    queryClient.clear();
  };

  const handleLogout = () => {
    confirmAction('ログアウト', 'ログアウトしますか？', doLogout);
  };

  // ── Copy / share pairing code (web: PairingSection.handleCopy) ───────────────
  const copyFamilyId = () => {
    const id = String(user?.familyId ?? '');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(id).catch(() => {});
    } else {
      try {
        const RN = require('react-native');
        RN.Clipboard?.setString(id);
      } catch {}
    }
    setCopied(true);
    notify('コピーしました', 'パートナーにこのコードを共有してください');
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Join partner family (web: PairingSection.handleJoin) ─────────────────────
  // Reuses the existing mobile contract: joinFamily() → POST /api/auth/join-family,
  // then persist familyId + update the auth store (same as InvitationScreen).
  const handleJoin = async () => {
    const code = joinCode.trim();
    if (code.length < 3) return;
    setJoining(true);
    try {
      const data = await joinFamily(code) as { familyId?: string };
      const newFamilyId = data?.familyId ?? code;
      await AsyncStorage.setItem('familyId', newFamilyId);
      if (user) setUser({ ...user, familyId: newFamilyId });
      queryClient.invalidateQueries();
      setJoinMode(false);
      setJoinCode('');
      notify('ペアリング完了', 'パートナーのデータと同期します');
    } catch {
      notify('参加に失敗しました', 'コードを確認してもう一度お試しください');
    } finally {
      setJoining(false);
    }
  };

  // ── Custom childcare items (web: useCustomChildcareItems + delete) ───────────
  // Real backend, same endpoint the web hook calls (server/routes.ts):
  //   GET    /api/families/:familyId/custom-childcare-items
  //   DELETE /api/families/:familyId/custom-childcare-items/:id
  const { data: customItems = [] } = useQuery<any[]>({
    queryKey: ['/api/families', familyId, 'custom-childcare-items'],
    queryFn: async () => {
      const res = await apiRequest(
        'GET',
        `/api/families/${familyId}/custom-childcare-items`,
      );
      return res.json();
    },
    enabled: !!familyId,
    staleTime: 30000,
  });

  const deleteCustomItemMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(
        'DELETE',
        `/api/families/${familyId}/custom-childcare-items/${id}`,
      );
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families'] });
    },
    onError: () => notify('エラー', '削除に失敗しました'),
  });

  const handleDeleteCustomItem = (id: number, name: string) => {
    confirmAction('カスタム項目を削除', `「${name}」を削除しますか？`, () =>
      deleteCustomItemMutation.mutate(id),
    );
  };

  // ── Feedback (web: FeedbackSection — POST /api/feedbacks) ─────────────────────
  const feedbackMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest('POST', '/api/feedbacks', {
        familyId: familyId || 'default',
        userId: userRole,
        message,
      });
      return res.json();
    },
    onSuccess: () => {
      setFeedbackMsg('');
      notify('ご意見をお送りしました', '改善のために活用させていただきます。ありがとうございます！');
    },
    onError: () => notify('送信に失敗しました', 'もう一度お試しください'),
  });

  const handleSendFeedback = () => {
    if (!feedbackMsg.trim()) return;
    feedbackMutation.mutate(feedbackMsg.trim());
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  // NOTE: per-child button customization / phase detection logic was removed
  // from Settings. It belongs ONLY to ChildProfileScreen (the full profile
  // page reached by tapping a child row → ChildProfile). Settings' child area
  // is registration + active-child switching only.

  // ── Menu items (mobile-only — preserved) ─────────────────────────────────────
  // Pruned: rows that duplicate features reachable elsewhere were removed —
  //   ダッシュボード / 健康記録 / スキルツリー / 睡眠トレーニング → Home feature cards,
  //   振り返り → Timeline 振り返り chip, 授乳アラーム → Home SOS レスキュー flow.
  const menuItems = [
    { Icon: Utensils,        label: '食品トラッカー',         onPress: () => navigation.navigate('FoodTracker') },
    { Icon: Download,        label: 'ぴよログからデータ移行',  onPress: () => navigation.navigate('Import') },
    { Icon: Mic,             label: '音声アシスタント連携',   onPress: () => navigation.navigate('Shortcuts') },
    { Icon: MessagesSquare,  label: 'コミュニティ',           onPress: () => navigation.navigate('Community') },
    { Icon: HelpCircle,      label: 'よくある質問',           onPress: () => navigation.navigate('FAQ') },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Screen contentStyle={styles.content}>

      {/* ── Header (web Settings.tsx:1213-1222) ──
          web: flex items-center gap-4 mb-8 — ghost back button + text-2xl font-black */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="戻る"
        >
          <ArrowLeft size={24} color={palette.foreground} />
        </TouchableOpacity>
        <Title style={styles.pageTitle}>
          {isFirstSetup ? 'はじめまして！' : 'アプリ設定'}
        </Title>
      </View>

      {/* WeYu Settings has NO profile banner here — header goes straight to
          the 赤ちゃんのプロフィール card. (Removed the mobile-only banner.) */}

      {/* ── First-setup notice (web: isFirstSetup banner) ── */}
      {isFirstSetup && (
        <View style={styles.firstSetupBox}>
          <Text style={styles.firstSetupText}>
            ようこそ、ぶどうの木へ。まずはお子様のお名前とお誕生日をお聞かせくださいませ。このアプリの大切な主役でございます。
          </Text>
        </View>
      )}

      {settingsLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <>
          {/* ── 1. 赤ちゃんのプロフィール (web form §1) ── */}
          <Card style={[styles.card, styles.cardPurple]}>
            <View style={styles.cardHead}>
              <View style={styles.iconCircle}>
                <Baby size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>赤ちゃんのプロフィール</Text>
                <Muted style={styles.cardHeadSub}>アプリの主役を登録しましょう</Muted>
              </View>
            </View>

            <View style={styles.formBlock}>
              <View>
                <Text style={styles.fieldLabelLg}>お名前</Text>
                <TextInput
                  style={styles.profileInput}
                  placeholder="例: はなちゃん、りくくん"
                  placeholderTextColor={palette.mutedForeground}
                  value={babyName}
                  onChangeText={setBabyName}
                />
              </View>
              <View>
                <View style={styles.labelRow}>
                  <Cake size={16} color="#C9A8E6" />
                  <Text style={styles.fieldLabelLg}>生年月日</Text>
                </View>
                <TextInput
                  style={styles.profileInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.mutedForeground}
                  value={babyBirthday}
                  onChangeText={setBabyBirthday}
                  keyboardType="numbers-and-punctuation"
                />
                <Muted style={styles.fieldHint}>生後4ヶ月でAIキャラが切り替わります</Muted>
              </View>
            </View>
          </Card>

          {/* ── 2. あなたの役割 (web form §2 — パパ/ママ/その他, grid-cols-3) ── */}
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <User size={16} color={palette.foreground} />
              <Text style={styles.sectionLabel}>あなたの役割</Text>
            </View>
            <View style={styles.roleGrid}>
              {([
                { id: 'papa' as const,  label: nicknames.papa, RoleIcon: User },
                { id: 'mama' as const,  label: nicknames.mama, RoleIcon: Crown },
                { id: 'other' as const, label: 'その他',        RoleIcon: Users },
              ]).map((u) => {
                const selected = userRole === u.id;
                const RoleIcon = u.RoleIcon;
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.roleCard, selected && styles.roleCardActive]}
                    onPress={() => setUserRole(u.id)}
                  >
                    <RoleIcon size={24} color={selected ? palette.primary : palette.mutedForeground} />
                    <Text style={[styles.roleLabel, selected && styles.roleLabelActive]}>{u.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* ── 3. 呼び方の変更 (web Settings.tsx:1317-1342 — inline入力) ── */}
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <MessageSquare size={16} color={palette.foreground} />
              <Text style={styles.sectionLabel}>呼び方の変更</Text>
            </View>
            <Muted style={styles.nicknameDesc}>
              「パパ」「ママ」の代わりに使う名前を設定できます。空欄の場合はデフォルトに戻ります。
            </Muted>
            <View style={{ gap: 12 }}>
              <View style={styles.labelInputRow}>
                <Text style={styles.labelSideTag}>パパ側</Text>
                <TextInput
                  style={[styles.labelInput, styles.labelInputPapa]}
                  value={editPapaLabel}
                  onChangeText={setEditPapaLabel}
                  onBlur={commitPapaLabel}
                  placeholder="パパ"
                  placeholderTextColor={palette.mutedForeground}
                  maxLength={6}
                />
              </View>
              <View style={styles.labelInputRow}>
                <Text style={styles.labelSideTag}>ママ側</Text>
                <TextInput
                  style={[styles.labelInput, styles.labelInputMama]}
                  value={editMamaLabel}
                  onChangeText={setEditMamaLabel}
                  onBlur={commitMamaLabel}
                  placeholder="ママ"
                  placeholderTextColor={palette.mutedForeground}
                  maxLength={6}
                />
              </View>
            </View>
          </Card>

          {/* ── 4. わが家の必殺技 (web form §3 — specialTrick) ── */}
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.sectionLabel}>わが家の必殺技</Text>
            </View>
            <TextInput
              style={styles.formInput}
              placeholder="例: ビニール袋の音"
              placeholderTextColor={palette.mutedForeground}
              value={specialTrick}
              onChangeText={setSpecialTrick}
            />
            <Muted style={styles.fieldHint}>レスキューのステップに組み込まれます</Muted>
          </Card>

          {/* ── 5. 設定を保存 (web form submit) ── */}
          <Button
            onPress={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            style={styles.saveBtn}
          >
            {updateSettingsMutation.isPending ? (
              <ActivityIndicator size="small" color={palette.primaryForeground} />
            ) : (
              <>
                <Save size={20} color={palette.primaryForeground} />
                <Text style={styles.saveBtnText}>
                  {isFirstSetup ? '登録してはじめる' : '設定を保存'}
                </Text>
              </>
            )}
          </Button>

          {/* ── 6. お子様の管理 (web: ChildrenSection) ── */}
          <Card style={[styles.card, styles.cardPurple]}>
            <View style={styles.cardHead}>
              <View style={styles.iconCircle}>
                <Users size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>お子様の管理</Text>
                <Muted style={styles.cardHeadSub}>きょうだいを追加して切り替えられます</Muted>
              </View>
            </View>

            {children.length > 0 && (
              <View style={styles.rowList}>
                {children.map((child) => {
                  const active = activeChildId === child.id;
                  return (
                    <View
                      key={child.id}
                      style={[styles.childRow, active && styles.childRowActive]}
                    >
                      <TouchableOpacity
                        style={styles.childRowMain}
                        onPress={() => {
                          setActiveChildId(child.id);
                          navigation.navigate('ChildProfile', { childId: child.id });
                        }}
                      >
                        <View
                          style={[
                            styles.childAvatar,
                            { backgroundColor: (child.color || '#805AAA') + '22', borderColor: child.color || '#805AAA' },
                          ]}
                        >
                          <Baby size={20} color={child.color || '#805AAA'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.childName}>{child.name}</Text>
                          {child.birthday && (
                            <View style={styles.childBirthdayRow}>
                              <Cake size={11} color={palette.mutedForeground} />
                              <Muted style={styles.childBirthday}>{child.birthday}</Muted>
                            </View>
                          )}
                        </View>
                        {active && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>選択中</Text>
                          </View>
                        )}
                        <ChevronRight size={16} color={palette.mutedForeground} />
                      </TouchableOpacity>
                      {children.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onPress={() => handleDeleteChild(child.id, child.name)}
                          style={styles.childDeleteBtn}
                        >
                          <Trash2 size={15} color={palette.mutedForeground} />
                        </Button>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* web: dashed "子どもを追加" button (opens the add-child sheet) */}
            <Button
              variant="outline"
              onPress={() => setShowAddChild(true)}
              style={styles.dashedBtn}
            >
              <Plus size={16} color={palette.primary} />
              <Text style={styles.dashedBtnText}>子どもを追加</Text>
            </Button>
          </Card>

          {/* ── 7. カスタム育児項目 (web: CustomChildcareSection — hidden if空) ── */}
          {(customItems as any[]).length > 0 && (
            <Card style={[styles.card, styles.cardPurple]}>
              <View style={styles.cardHead}>
                <View style={styles.iconCircle}>
                  <Star size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardHeadTitle}>カスタム育児項目</Text>
                  <Muted style={styles.cardHeadSub}>名もなき育児のカスタム項目を管理</Muted>
                </View>
              </View>
              <View style={styles.rowList}>
                {(customItems as any[]).map((item) => {
                  const IconComp = SETTINGS_ICON_MAP[item.icon] || Star;
                  return (
                    <View key={item.id} style={styles.customItemRow}>
                      <View style={styles.menuIconTile}>
                        <IconComp size={16} color={palette.primary} />
                      </View>
                      <Text style={styles.customItemLabel}>{item.itemName}</Text>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleteCustomItemMutation.isPending}
                        onPress={() => handleDeleteCustomItem(item.id, item.itemName)}
                      >
                        <Trash2 size={16} color={palette.mutedForeground} />
                      </Button>
                    </View>
                  );
                })}
              </View>
            </Card>
          )}

          {/* ── 8. ペアリング (web: PairingSection) ──
              NOTE: WeYu Settings.tsx also renders a <ButtonCustomizationSection>
              here, but per the screen-separation contract the detailed button
              customization (and all other per-child profile editing) lives
              ONLY in ChildProfileScreen. Settings' child area is registration
              + switch only (see §6 お子様の管理 → navigates to ChildProfile).
              The duplicated 表示するボタン section was therefore removed. */}
          <Card style={[styles.card, styles.cardGreen]}>
            <View style={styles.cardHead}>
              <View style={[styles.iconCircle, styles.iconCircleGreen]}>
                <Share2 size={20} color={palette.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>ペアリング</Text>
                <Muted style={styles.cardHeadSub}>パートナーとデータを共有</Muted>
              </View>
            </View>

            <Text style={styles.fieldLabel}>あなたのペアリングコード</Text>
            <View style={styles.codeRow}>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{user?.familyId ?? '—'}</Text>
              </View>
              <Button variant="outline" size="icon" onPress={copyFamilyId} style={styles.copyIconBtn}>
                {copied
                  ? <Check size={16} color={palette.secondary} />
                  : <Copy size={16} color={palette.foreground} />}
              </Button>
            </View>
            <Muted style={styles.fieldHint}>このコードをパートナーに共有してください</Muted>

            {!joinMode ? (
              <Button
                variant="outline"
                onPress={() => setJoinMode(true)}
                style={styles.fullOutlineBtn}
              >
                <Users size={16} color={palette.foreground} />
                <Text style={styles.outlineBtnText}>パートナーのコードで参加する</Text>
              </Button>
            ) : (
              <View style={{ gap: 8, marginTop: 12 }}>
                <TextInput
                  style={styles.joinInput}
                  placeholder="パートナーのコードを入力"
                  placeholderTextColor={palette.mutedForeground}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                />
                <View style={styles.joinBtnRow}>
                  <Button
                    variant="outline"
                    onPress={() => { setJoinMode(false); setJoinCode(''); }}
                    style={styles.joinBtn}
                  >
                    キャンセル
                  </Button>
                  <Button
                    onPress={handleJoin}
                    disabled={joinCode.trim().length < 3 || joining}
                    style={styles.joinBtn}
                  >
                    {joining ? '参加中...' : '参加する'}
                  </Button>
                </View>
              </View>
            )}

            {/* mobile extra: in-app invitation flow */}
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Invitation')}
              style={styles.fullOutlineBtn}
            >
              <UserPlus size={16} color={palette.foreground} />
              <Text style={styles.outlineBtnText}>招待コードを発行してパートナーを招待</Text>
            </Button>
          </Card>

          {/* ── 10. アプリとして使う ──
              Web's <InstallGuide> is PWA-specific ("Safariの共有→ホーム画面に追加" /
              Chrome "アプリをインストール"). On native this app is ALREADY an
              installed app, so the web install steps do not apply. We show the
              nearest sensible native equivalent (an info note) instead of
              fabricating native install steps. */}
          <Card style={[styles.card, styles.cardBlue]}>
            <View style={styles.cardHead}>
              <View style={[styles.iconCircle, styles.iconCircleBlue]}>
                <Smartphone size={20} color="#5B8DD5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>アプリとして使う</Text>
                <Muted style={styles.cardHeadSub}>ホーム画面に追加してネイティブアプリのように</Muted>
              </View>
            </View>
            <Muted style={styles.alarmDesc}>
              この画面はインストール済みのネイティブアプリとして動作しています。Web版でホーム画面に追加する手順は不要です。
            </Muted>
          </Card>

          {/* ── 11. 画面の明るさ (web: ThemeSection) ── */}
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.iconCircle, styles.iconCircleIndigo]}>
                <Moon size={20} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>画面の明るさ</Text>
                <Muted style={styles.cardHeadSub}>夜間の目への負担を軽減できます</Muted>
              </View>
            </View>
            <View style={styles.themeGrid}>
              {THEME_OPTIONS.map((opt) => {
                const selected = themeMode === opt.mode;
                const ThemeIcon = opt.Icon;
                return (
                  <TouchableOpacity
                    key={opt.mode}
                    style={[styles.themeTile, selected && styles.themeTileActive]}
                    onPress={() => setThemeMode(opt.mode)}
                  >
                    <ThemeIcon size={20} color={opt.iconColor} />
                    <Text style={[styles.themeTileLabel, selected && styles.themeTileLabelActive]}>
                      {opt.label}
                    </Text>
                    <Muted style={styles.themeTileDesc}>{opt.desc}</Muted>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* ── 12. 表示設定 (web: FeatureToggleSection) ── */}
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.iconCircle}>
                <LayoutGrid size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>表示設定</Text>
                <Muted style={styles.cardHeadSub}>ホーム画面に表示する機能を選べます</Muted>
              </View>
            </View>
            <View style={styles.rowList}>
              {(
                [
                  { key: 'showWeBoard'   as const, label: 'Weボード',        desc: 'パートナーへの一言ボード' },
                  { key: 'showSkillTree' as const, label: 'チーム育児スキル', desc: 'ふたりの経験値・スキルツリー' },
                ]
              ).map((item) => (
                <View key={item.key} style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    <Muted style={styles.optionDesc}>{item.desc}</Muted>
                  </View>
                  <Switch
                    value={display[item.key]}
                    onValueChange={(v) => saveDisplay({ ...display, [item.key]: v })}
                    trackColor={{ false: isDark ? '#3A3A55' : palette.border, true: isDark ? palette.primary : '#C5B0E8' }}
                    thumbColor={display[item.key] ? (isDark ? '#EFEFEF' : palette.primary) : (isDark ? '#888899' : '#f4f3f4')}
                  />
                </View>
              ))}
            </View>
          </Card>

          {/* ── 13. 授乳アラーム (web: FeedingNotificationSection) ── */}
          <Card style={[styles.card, styles.cardPink]}>
            <View style={styles.cardHead}>
              <View style={[styles.iconCircle, styles.iconCirclePink]}>
                <BellRing size={20} color="#EC4899" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>授乳アラーム</Text>
                <Muted style={styles.cardHeadSub}>次回授乳の予定時刻の前に通知</Muted>
              </View>
            </View>

            {/* 目標授乳間隔 */}
            <View style={{ marginBottom: 12, gap: 8 }}>
              <View>
                <Text style={styles.optionLabel}>目標授乳間隔</Text>
                <Muted style={styles.optionDesc}>「自動」は過去の授乳記録の平均から計算します</Muted>
              </View>
              <View style={styles.chipWrap}>
                {INTERVAL_OPTIONS.map((opt) => {
                  const sel = feedInterval === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => handleFeedInterval(opt.value)}
                      style={[styles.chip, sel && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* アラームを有効にする */}
            <View style={styles.switchRowPlain}>
              <Text style={styles.optionLabel}>アラームを有効にする</Text>
              <Switch
                value={feedEnabled}
                onValueChange={handleFeedToggle}
                trackColor={{ false: isDark ? '#3A3A55' : palette.border, true: '#F9A8C4' }}
                thumbColor={feedEnabled ? '#EC4899' : (isDark ? '#888899' : '#f4f3f4')}
              />
            </View>

            {feedEnabled && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={styles.fieldLabel}>何分前に通知しますか？</Text>
                <View style={styles.chipWrap}>
                  {TIMING_OPTIONS.map((min) => {
                    const sel = feedMinutes === min;
                    return (
                      <TouchableOpacity
                        key={min}
                        onPress={() => handleFeedMinutes(min)}
                        style={[styles.chip, sel && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, sel && styles.chipTextActive]}>{min}分前</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Muted style={styles.alarmDesc}>
                  アプリを開いている間のみ通知されます。過去の授乳間隔から次回授乳時刻を予測します。
                </Muted>
              </View>
            )}

            {/* mobile extra: full feeding-alarm screen */}
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Alarm')}
              style={styles.fullOutlineBtn}
            >
              <BellRing size={16} color={palette.foreground} />
              <Text style={styles.outlineBtnText}>授乳アラームの詳細設定を開く</Text>
            </Button>
          </Card>

          {/* ── 14. 改善提案を送る (web: FeedbackSection) ── */}
          <Card style={[styles.card, styles.cardAmber]}>
            <View style={styles.cardHead}>
              <View style={[styles.iconCircle, styles.iconCircleAmber]}>
                <MessageSquare size={20} color="#D9971F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>改善提案を送る</Text>
                <Muted style={styles.cardHeadSub}>開発チームに直接届きます</Muted>
              </View>
            </View>
            <TextInput
              style={styles.feedbackInput}
              placeholder="使いにくい点や欲しい機能など、何でもお聞かせください..."
              placeholderTextColor={palette.mutedForeground}
              value={feedbackMsg}
              onChangeText={setFeedbackMsg}
              multiline
            />
            <Button
              onPress={handleSendFeedback}
              disabled={!feedbackMsg.trim() || feedbackMutation.isPending}
              style={styles.feedbackBtn}
            >
              {feedbackMutation.isPending ? (
                <ActivityIndicator size="small" color={palette.primaryForeground} />
              ) : (
                <>
                  <MessageSquare size={16} color={palette.primaryForeground} />
                  <Text style={styles.saveBtnText}>送信する</Text>
                </>
              )}
            </Button>
          </Card>

          {/* ── ナビゲーションメニュー (機能) — mobile-only, preserved ── */}
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.iconCircle}>
                <LayoutGrid size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>機能</Text>
                <Muted style={styles.cardHeadSub}>各機能へのショートカット</Muted>
              </View>
            </View>
            <View style={styles.menuList}>
              {menuItems.map((item, i) => {
                const MenuIcon = item.Icon;
                const isLast = i === menuItems.length - 1;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.menuItem, isLast && styles.menuItemLast]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuIconTile}>
                      <MenuIcon size={20} color={palette.primary} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <ChevronRight size={18} color={palette.mutedForeground} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* ── 通知設定 — mobile-only, preserved ── */}
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.iconCircle}>
                <Bell size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>通知</Text>
                <Muted style={styles.cardHeadSub}>受け取る通知を選びます</Muted>
              </View>
            </View>
            <View style={styles.rowList}>
              {(
                [
                  { key: 'reminders'     as const, label: '記録リマインダー',      desc: '定期的に記録を促す通知' },
                  { key: 'partnerNotif'  as const, label: 'パートナーからの通知', desc: 'ログ追加・スキル申請など' },
                  { key: 'milestoneAlert'as const, label: 'マイルストーン通知',   desc: 'はじめての記録を通知' },
                ]
              ).map((item) => (
                <View key={item.key} style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    <Muted style={styles.optionDesc}>{item.desc}</Muted>
                  </View>
                  <Switch
                    value={notif[item.key]}
                    onValueChange={(v) => saveNotif({ ...notif, [item.key]: v })}
                    trackColor={{ false: isDark ? '#3A3A55' : palette.border, true: isDark ? palette.primary : '#C5B0E8' }}
                    thumbColor={notif[item.key] ? (isDark ? '#EFEFEF' : palette.primary) : (isDark ? '#888899' : '#f4f3f4')}
                  />
                </View>
              ))}
            </View>
          </Card>

          {/* ── 15. 使い方ヒント (web: /tips link → Tips.tsx) ──
              Routes to the dedicated TipsScreen (faithful port of
              WeYu/client/src/pages/Tips.tsx). Route registered by the
              navigator after this screen; cast keeps Settings tsc-clean. */}
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => (navigation as any).navigate('Tips')}
          >
            <View style={styles.iconCircle}>
              <BookOpen size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>使い方ヒント</Text>
              <Muted style={styles.cardHeadSub}>パートナー招待・ご褒美ショップなど</Muted>
            </View>
            <ChevronRight size={16} color={palette.mutedForeground} />
          </TouchableOpacity>

          {/* ── 16. プライバシーポリシー・利用規約 (web: /legal link → Legal.tsx) ──
              Routes to the dedicated LegalScreen (faithful port of
              WeYu/client/src/pages/Legal.tsx). Route registered by the
              navigator after this screen; cast keeps Settings tsc-clean. */}
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => (navigation as any).navigate('Legal')}
          >
            <View style={[styles.iconCircle, styles.iconCircleGray]}>
              <Info size={20} color={palette.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>プライバシーポリシー・利用規約</Text>
              <Muted style={styles.cardHeadSub}>個人情報の取り扱いについて</Muted>
            </View>
            <ChevronRight size={16} color={palette.mutedForeground} />
          </TouchableOpacity>

          {/* ── 17. ログアウト (web: logout button) ── */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={16} color={palette.destructive} />
            <Text style={styles.logoutText}>ログアウト</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── 18. version footer (web: text-center pt-4 pb-8) ── */}
      <View style={styles.versionWrap}>
        <Text style={styles.versionMain}>We育 Beta v1.0</Text>
        <Muted style={styles.versionSub}>by 産前産後ケアホテル ぶどうの木</Muted>
      </View>

      {/* ── Add Child Modal (mobile-only — preserved, matches ChildProfile) ── */}
      <Modal visible={showAddChild} transparent animationType="slide" onRequestClose={() => setShowAddChild(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddChild(false)}>
          <TouchableOpacity style={styles.sheetContainer} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Title style={styles.sheetTitle}>お子さまを追加</Title>

            <View style={styles.cpFormBlock}>
              <View>
                <Text style={styles.cpLabel}>なまえ</Text>
                <TextInput
                  style={styles.cpInput}
                  placeholder="お子さまの名前"
                  placeholderTextColor={palette.mutedForeground}
                  value={childName}
                  onChangeText={setChildName}
                  autoFocus
                />
              </View>

              <View>
                <Text style={styles.cpLabel}>たんじょうび</Text>
                <TextInput
                  style={styles.cpInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.mutedForeground}
                  value={childBirthday}
                  onChangeText={setChildBirthday}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View>
                <Text style={styles.cpLabel}>せいべつ</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={childGender === opt.value ? 'default' : 'outline'}
                      onPress={() => setChildGender(opt.value)}
                      style={styles.genderBtn}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.cpLabel}>イメージカラー</Text>
                <View style={styles.colorRow}>
                  {CHILD_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c.value}
                      onPress={() => setChildColor(c.value)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.value },
                        childColor === c.value && styles.colorSwatchActive,
                        childColor === c.value && { borderColor: c.value },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.modalBtns}>
              <Button
                variant="outline"
                onPress={() => {
                  setShowAddChild(false);
                  setChildName('');
                  setChildBirthday('');
                  setChildGender('male');
                  setChildColor('#805AAA');
                }}
                style={styles.modalBtn}
              >
                キャンセル
              </Button>
              <Button
                onPress={handleAddChild}
                disabled={!childName.trim() || addChildMutation.isPending}
                style={styles.modalBtn}
              >
                {addChildMutation.isPending ? '登録中...' : '登録する'}
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },

  // web Settings.tsx:1213 — flex items-center gap-4 mb-8
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  // web: ghost icon Button, rounded-full, hover:bg-white/50
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  // web Settings.tsx:1219 — text-2xl font-black text-gray-800
  pageTitle: { fontSize: 24, color: palette.foreground },

  // Compact profile header (web has none; mobile-only)
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: palette.primary,
    borderRadius: radius.lg,
    ...shadows.soft,
  },
  avatar: {
    width: 56, height: 56, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, color: palette.primaryForeground, fontFamily: fonts.sans, fontWeight: '700' },
  userName: { fontSize: 18, color: palette.primaryForeground },
  userRole: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontFamily: fonts.body },

  firstSetupBox: {
    backgroundColor: palette.accent,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E0D3F0',
    padding: 20,
  },
  firstSetupText: { fontSize: 14, color: palette.accentForeground, fontFamily: fonts.bodySemibold, lineHeight: 22 },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },

  // Card (web: bg-white/80 rounded-[24px] border-2)
  card: { padding: 24, borderRadius: radius.lg, gap: 8 },
  // web: border-2 border-purple-200
  cardPurple: { borderWidth: 2, borderColor: '#DDD0EE' },
  // web: border-2 border-green-200
  cardGreen: { borderWidth: 2, borderColor: '#BFE3CD' },
  // web: border border-blue-100
  cardBlue: { borderColor: '#C5D9F0' },
  // web: border-2 border-amber-200
  cardAmber: { borderWidth: 2, borderColor: '#F0DDB0' },
  // web FeedingNotificationSection: border-2 border-pink-100
  cardPink: { borderWidth: 2, borderColor: '#FCE7F3' },
  // web ButtonCustomizationSection: border-2 border-indigo-200
  cardIndigo: { borderWidth: 2, borderColor: '#C7D2FE' },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconCircle: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  iconCircleGreen: { backgroundColor: '#E3F3EA' },
  iconCircleBlue: { backgroundColor: '#E4EEFA' },
  iconCircleAmber: { backgroundColor: '#FBEFD6' },
  iconCircleGray: { backgroundColor: palette.muted },
  iconCircleIndigo: { backgroundColor: '#E0E7FF' },
  iconCirclePink: { backgroundColor: '#FCE7F3' },
  cardHeadTitle: { fontSize: 16, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground },
  cardHeadSub: { fontSize: 10, color: palette.mutedForeground, marginTop: 1 },
  // web: <Label className="text-base font-bold ... flex items-center gap-2">
  sectionLabel: { fontSize: 16, fontFamily: fonts.sans, fontWeight: '700', color: palette.foreground },

  rowList: { gap: 8 },

  // Profile form — web form §1 (Settings.tsx:1250-1280)
  formBlock: { gap: 16 },
  // web: <Label htmlFor> text-sm font-bold text-gray-600 mb-1.5
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fieldLabelLg: { fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground, marginBottom: 6 },
  formInput: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 17,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
  },
  // Profile §1 fields — web: rounded-xl border-2 border-gray-100 h-12 text-lg
  // on a light-gray fill (matches the provided design's soft lavender fields).
  profileInput: {
    backgroundColor: palette.muted,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 17,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
  },

  // Role selector — web Settings.tsx:1294-1313
  // grid grid-cols-3 gap-3; tile = flex-col items-center py-4 rounded-xl border-2 bg-white;
  // selected = border-primary bg-purple-50 text-primary (icon w-6 h-6 mb-1 + font-bold text-sm).
  roleGrid: { flexDirection: 'row', gap: 12 },
  roleCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 2, borderColor: palette.border,
    backgroundColor: palette.card,
    gap: 6,
  },
  roleCardActive: { borderColor: palette.primary, backgroundColor: palette.accent },
  roleLabel: { fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  roleLabelActive: { color: palette.primary },

  // 呼び方の変更 — web: flex items-center gap-3, w-14 tag + flex-1 input
  nicknameDesc: { fontSize: 12, color: palette.mutedForeground, fontFamily: fonts.body, marginBottom: 8 },
  labelInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  labelSideTag: { width: 48, fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  labelInput: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 2,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.foreground,
    backgroundColor: palette.card,
  },
  // web: border-blue-200 / border-pink-200
  labelInputPapa: { borderColor: '#BFDBFE' },
  labelInputMama: { borderColor: '#FBCFE8' },

  saveBtn: { width: '100%', minHeight: 56, borderRadius: radius.md },
  saveBtnText: { color: palette.primaryForeground, fontSize: 17, fontFamily: fonts.bodyBold, fontWeight: '700' },

  childRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2, borderColor: palette.border,
    backgroundColor: palette.muted,
  },
  childRowActive: { borderColor: '#C9B3E4', backgroundColor: palette.accent },
  childRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  childAvatar: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  childName: { fontSize: 15, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.foreground },
  childBirthdayRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  childBirthday: { fontSize: 12, color: palette.mutedForeground },
  childDeleteBtn: { marginRight: 8 },
  activeBadge: { backgroundColor: palette.accent, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { fontSize: 11, color: palette.primary, fontFamily: fonts.bodyBold, fontWeight: '700' },

  fieldLabel: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground, marginBottom: 6, marginTop: 4 },
  fieldHint: { fontSize: 12, color: palette.mutedForeground, marginTop: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBox: {
    flex: 1,
    backgroundColor: palette.muted,
    borderWidth: 2, borderColor: palette.border,
    borderRadius: radius.sm,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  codeText: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: palette.primary,
    letterSpacing: 2,
  },
  copyIconBtn: { borderWidth: 2, borderRadius: radius.sm, width: 44, height: 44 },

  joinInput: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
  },
  joinBtnRow: { flexDirection: 'row', gap: 8 },
  joinBtn: { flex: 1, minHeight: 44 },

  fullOutlineBtn: { width: '100%', borderWidth: 2, borderRadius: radius.sm, marginTop: 12, minHeight: 44 },
  outlineBtnText: { color: palette.foreground, fontSize: 14, fontFamily: fonts.bodySemibold },

  // Add-child dashed button (web ChildrenSection: border-dashed "子どもを追加")
  dashedBtn: {
    width: '100%', borderWidth: 2, borderStyle: 'dashed',
    borderColor: '#C9B3E4', borderRadius: radius.sm, marginTop: 12, minHeight: 44,
  },
  dashedBtnText: { color: palette.primary, fontSize: 14, fontFamily: fonts.bodySemibold },

  menuList: { marginTop: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIconTile: {
    width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, color: palette.foreground, fontFamily: fonts.bodyBold, fontWeight: '700' },

  optionLabel: { fontSize: 15, color: palette.foreground, fontFamily: fonts.bodySemibold, fontWeight: '500' },
  optionDesc: { fontSize: 12, color: palette.mutedForeground, marginTop: 2 },

  // Theme selector — web: grid grid-cols-3 gap-2, tiles p-3 rounded-2xl border-2
  themeGrid: { flexDirection: 'row', gap: 8 },
  themeTile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.muted,
  },
  themeTileActive: { borderColor: '#C084FC', backgroundColor: palette.accent },
  themeTileLabel: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  themeTileLabelActive: { color: palette.primary },
  themeTileDesc: { fontSize: 9, color: palette.mutedForeground, textAlign: 'center', lineHeight: 12 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: palette.border,
  },
  // web FeedingNotificationSection toggle row: flex justify-between py-2 (no border)
  switchRowPlain: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },

  // 授乳アラーム chips — web: px-3 py-2 rounded-xl text-xs font-bold border-2
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 2, borderColor: palette.border,
    backgroundColor: palette.card,
  },
  chipActive: { backgroundColor: '#EC4899', borderColor: '#EC4899' },
  chipText: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.mutedForeground },
  chipTextActive: { color: '#FFFFFF' },

  alarmDesc: { fontSize: 13, color: palette.mutedForeground, paddingTop: 4, lineHeight: 20 },

  customItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.card,
  },
  customItemLabel: { flex: 1, fontSize: 15, color: palette.foreground, fontFamily: fonts.bodySemibold, fontWeight: '500' },

  feedbackInput: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 14,
    minHeight: 100,
    fontSize: 14,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
    textAlignVertical: 'top',
  },
  feedbackBtn: { width: '100%', minHeight: 48, borderRadius: radius.sm, marginTop: 12 },

  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    borderWidth: 1, borderColor: palette.border,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  linkTitle: { fontSize: 15, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.foreground },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#F5C2C2',
    backgroundColor: '#FCEDED',
  },
  logoutText: { color: palette.destructive, fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700' },

  versionWrap: { alignItems: 'center', paddingVertical: 20 },
  versionMain: { fontSize: 11, color: '#C9C2D2', fontFamily: fonts.bodyBold, fontWeight: '700' },
  versionSub: { fontSize: 11, color: '#C9C2D2', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: palette.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: 24, gap: 12,
  },
  // Add-child form — identical to ChildProfileScreen / web ChildProfile.tsx
  cpFormBlock: { gap: 16 },
  cpLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.mutedForeground,
    marginBottom: 6,
  },
  cpInput: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
  },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: { flex: 1 },
  colorRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: { transform: [{ scale: 1.1 }], borderWidth: 2 },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: palette.border, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, color: palette.foreground, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, minHeight: 48 },
});
