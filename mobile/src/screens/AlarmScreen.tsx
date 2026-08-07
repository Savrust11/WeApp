/**
 * 泣き止みレスキュー（WeYu Rescue 完全移植）
 *
 * ホームの「泣き止みレスキュー」SOS ボタン（route: "Alarm"）から遷移する画面。
 * Web の canonical 実装 `WeYu/client/src/pages/Rescue.tsx` を、この 1 画面に
 * そのまま移植したもの:
 *   1. 起動時の確認モーダル（🚨 レスキューを開始しますか？）
 *   2. 7 ステップの消去法ナビ（ステップ N / 7・白カード・解決!/次へ）
 *   3. 「解決!」→ sos ログ記録 → ホームへ
 *   4. ステップ 7 の「リレー要請 ›」→ 抱っこリレー（MM:SS カウントダウン）
 *
 * Web と同じく、月齢（settings.babyBirthday）で乳児/幼児ステップを切替え、
 * 「お腹の確認」では直近の授乳・ミルク記録（mobile の logs）を表示する。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Timer,
  AlertCircle,
  Info,
  Baby,
  Milk,
  Apple,
} from 'lucide-react-native';
import {
  differenceInMonths,
  differenceInMinutes,
  format,
  parseISO,
} from 'date-fns';

import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { apiRequest } from '../api/client';
import { getLogs, createLog, type Log } from '../api/logs';
import { useToast } from '../components/Toast';
import { logRecordedToast } from '../utils/logToast';
import type { RootStackParamList } from '../navigation';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Text } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Web Rescue.tsx visual language (bg #F8F5FF, ink #805AAA, white cards).
const RESCUE_BG = '#F8F5FF';
const RESCUE_INK = '#805AAA';
const RESCUE_BORDER = '#E5D8F5'; // border-purple-200 on lavender

// Settings shape (mirrors web /api/settings — only the fields Rescue uses).
interface RescueSettings {
  babyBirthday?: string | null;
  specialTrick?: string | null;
}

// Mobile feeding log types → display label / icon (mirrors TimelineScreen).
const FEEDING_LABEL: Record<string, string> = {
  breastfeed: '母乳',
  formula: 'ミルク',
  milk: 'ミルク',
  expressed: '搾乳',
  food: '離乳食',
};
const FEEDING_TYPES = new Set(Object.keys(FEEDING_LABEL));

export default function AlarmScreen() {
  const { isDark, colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const familyId = user?.familyId ?? 'default';
  const queryClient = useQueryClient();
  const toast = useToast();
  const activeChildId = useChildStore((s) => s.activeChildId);

  // Wizard / flow state — matches web (step, showTimer, timeLeft) plus the
  // confirmed entry modal.
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  // settings (web: useSettings(familyId)) — only need babyBirthday/specialTrick.
  const { data: settings } = useQuery<RescueSettings>({
    queryKey: ['/api/settings', familyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/settings/${familyId}`);
      return res.json();
    },
    enabled: !!familyId,
    staleTime: 30000,
  });

  // logs (web: useLogs(familyId)) — for the 「お腹の確認」 feeding card.
  const { data: allLogs = [] } = useQuery<Log[]>({
    queryKey: ['logs', familyId],
    queryFn: () => getLogs(familyId),
  });

  // web: useCreateLog() — record the SOS outcome.
  const createSosLog = useMutation({
    mutationFn: (data: { type: string; message: string }) =>
      createLog({ ...data, familyId: String(familyId) }),
    onSuccess: (newLog) => {
      queryClient.invalidateQueries({ queryKey: ['logs', familyId] });
      toast.show(logRecordedToast(newLog.type, newLog.points ?? 10));
    },
  });

  const months = settings?.babyBirthday
    ? differenceInMonths(new Date(), parseISO(settings.babyBirthday))
    : 0;

  // web: recentFeedingLogs — last 4 feeding logs for the active child.
  const recentFeedingLogs = useMemo(() => {
    const childId = activeChildId;
    return (allLogs as Log[])
      .filter((l) => {
        const isFeeding = FEEDING_TYPES.has(l.type);
        const matchesChild = !childId || !l.childId || l.childId === childId;
        return isFeeding && matchesChild;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 4);
  }, [allLogs, activeChildId]);

  // EXACT copy from WeYu Rescue.tsx (infantSteps).
  const infantSteps = [
    {
      title: 'おむつ確認',
      desc: 'まずは一番多い理由から確認しましょう。おむつは濡れていませんか？',
    },
    {
      title: 'お腹の確認',
      desc: '前回のミルクや授乳から時間が空いていませんか？お腹が空いているかもしれません。',
    },
    {
      title: 'ゲップ・ガス',
      desc: 'お腹に空気が溜まって苦しいのかもしれません。やさしく縦抱きにしてみましょう。',
    },
    {
      title: '刺激のリセット',
      desc: 'テレビを消して、お部屋を少し暗くして、静かな環境を整えてみましょう。',
    },
    {
      title: '睡眠スケジュール',
      desc: '最後に起きてから1.5時間以上経っていませんか？疲れすぎて眠れないのかもしれません。',
    },
    {
      title: '温度・環境',
      desc: '暑すぎたり寒すぎたりしていませんか？背中にそっと手を入れて確認してみましょう。',
    },
    {
      title: '全身チェック',
      desc: 'お洋服のタグが肌に当たっていたり、小さな指に髪の毛が絡まったりしていませんか？',
    },
  ];

  // EXACT copy from WeYu Rescue.tsx (toddlerSteps).
  const toddlerSteps = [
    {
      title: '環境チェンジ',
      desc: 'お部屋の景色を変えてみましょう。窓の外を見せたり、ベランダでお外の空気を感じさせてあげましょう。',
    },
    {
      title: 'おもちゃ・音',
      desc: `少し退屈しているのかもしれません。${
        settings?.specialTrick || 'ビニール袋の音'
      }を聞かせてみましょう。`,
    },
    {
      title: 'ふれあい遊び',
      desc: 'やさしく体を使って遊んでみましょう。そっとこちょこちょしたり、お歌を歌ってあげましょう。',
    },
    {
      title: '歯ぐずりの確認',
      desc: 'よだれが増えていませんか？歯が生え始めてむずがゆいのかもしれません。',
    },
    {
      title: '悔しさへの共感',
      desc: '何かやりたいことがあるのかもしれません。そっと手を添えてお手伝いしてあげましょう。',
    },
    {
      title: 'メンタルリープ',
      desc: '今は大きく成長している時期かもしれません。そばに寄り添うだけで十分です。',
    },
    {
      title: '担当交代',
      desc: 'パートナーにバトンタッチするのも大事な作戦です。おふたりの連携で乗り越えましょう。',
    },
  ];

  const steps = months >= 4 ? toddlerSteps : infantSteps;
  const currentStep = steps[step] ?? steps[0];

  // web: countdown effect — tick every second while the relay timer is shown.
  useEffect(() => {
    if (!showTimer || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [showTimer, timeLeft]);

  // web: handleComplete — record success, go home.
  const handleComplete = () => {
    createSosLog.mutate({ type: 'sos', message: 'レスキュー成功！' });
    navigation.navigate('Main');
  };

  // web: handleNext — advance, or trigger the relay timer on the last step.
  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setShowTimer(true);
      createSosLog.mutate({
        type: 'sos',
        message: '抱っこリレー開始！応援要請！',
      });
    }
  };

  const goHome = () => navigation.navigate('Main');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Entry confirm modal (confirmed from screenshots) ───────────────────────
  if (!started) {
    return (
      <View style={styles.modalRoot}>
        <View style={[styles.modalCard, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalIconWrap}>
            <Text style={styles.modalIconEmoji}>🚨</Text>
          </View>
          <Text style={styles.modalTitle}>レスキューを開始しますか？</Text>
          <Text style={styles.modalBody}>
            消去法ナビでお子様のご様子をひとつずつ確認してまいりましょう。おそばにおりますよ。
          </Text>
          <View style={styles.modalBtnRow}>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnCancel,
                pressed && styles.pressed,
              ]}
              onPress={() => navigation.goBack()}
            >
              <Text
                style={styles.modalBtnCancelText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                キャンセル
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnStart,
                pressed && styles.pressed,
              ]}
              onPress={() => setStarted(true)}
            >
              <Text
                style={styles.modalBtnStartText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                レスキュー開始！
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.background }]}>
      {/* Header — web: ← + 泣き止みレスキュー */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <ArrowLeft size={24} color={RESCUE_INK} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>泣き止みレスキュー</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!showTimer ? (
          <View style={styles.stepWrap}>
            {/* Step indicator — web: circled (!) + ステップ N / 7 */}
            <View style={styles.stepHeaderRow}>
              <View style={styles.stepIconCircle}>
                <AlertCircle size={24} color="#A855F7" strokeWidth={2.5} />
              </View>
              <Text style={styles.stepCount}>
                ステップ {step + 1} / {steps.length}
              </Text>
            </View>

            {/* White rounded card — web: rounded-[32px] border-2 border-purple-200 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{currentStep.title}</Text>
              <Text style={styles.cardBody}>{currentStep.desc}</Text>

              {currentStep.title === 'お腹の確認' && (
                <View style={styles.feedBlock}>
                  <Text style={styles.feedHeading}>直近の授乳・ミルク記録</Text>
                  {recentFeedingLogs.length === 0 ? (
                    <Text style={styles.feedEmpty}>記録がありません</Text>
                  ) : (
                    recentFeedingLogs.map((log, i) => {
                      const logDate = new Date(log.createdAt);
                      const minsAgo = differenceInMinutes(new Date(), logDate);
                      const hoursAgo = Math.floor(minsAgo / 60);
                      const remainMins = minsAgo % 60;
                      const elapsed =
                        hoursAgo > 0
                          ? `${hoursAgo}時間${
                              remainMins > 0 ? remainMins + '分' : ''
                            }前`
                          : `${minsAgo}分前`;
                      const urgency =
                        minsAgo >= 180
                          ? styles.feedRowRose
                          : minsAgo >= 120
                          ? styles.feedRowAmber
                          : styles.feedRowGreen;
                      const urgencyText =
                        minsAgo >= 180
                          ? styles.feedTextRose
                          : minsAgo >= 120
                          ? styles.feedTextAmber
                          : styles.feedTextGreen;
                      const label = FEEDING_LABEL[log.type] ?? '授乳';
                      const Icon =
                        log.type === 'food'
                          ? Apple
                          : log.type === 'breastfeed'
                          ? Baby
                          : Milk;
                      const iconColor =
                        minsAgo >= 180
                          ? '#F43F5E'
                          : minsAgo >= 120
                          ? '#D97706'
                          : '#16A34A';
                      return (
                        <View
                          key={log.id ?? i}
                          style={[styles.feedRow, urgency]}
                        >
                          <Icon size={16} color={iconColor} strokeWidth={2.5} />
                          <View style={styles.feedRowMain}>
                            <Text style={[styles.feedLabel, urgencyText]}>
                              {label}
                            </Text>
                            <Text style={[styles.feedTime, urgencyText]}>
                              {format(logDate, 'HH:mm')}
                            </Text>
                          </View>
                          <Text style={[styles.feedElapsed, urgencyText]}>
                            {elapsed}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            {/* Action buttons — web: 解決! (green outline) / 次へ|リレー要請 */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.solveBtn,
                  pressed && styles.pressed,
                ]}
                onPress={handleComplete}
              >
                <CheckCircle2 size={20} color="#16A34A" strokeWidth={2.5} />
                <Text style={styles.solveBtnText}>解決！</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.nextBtn,
                  pressed && styles.pressed,
                ]}
                onPress={handleNext}
              >
                <Text style={styles.nextBtnText}>
                  {step === steps.length - 1 ? 'リレー要請' : '次へ'}
                </Text>
                <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Yellow caution note — web verbatim */}
            <View style={styles.cautionBox}>
              <Info size={20} color="#CA8A04" strokeWidth={2.5} />
              <Text style={styles.cautionText}>
                全ての項目を確認しても泣き止まず、「熱がある」「ぐったりしている」「異常な泣き方」の場合は、すみやかに医療機関に相談してください。
              </Text>
            </View>
          </View>
        ) : (
          /* Relay timer screen — web: bg-red-50, timer icon, MM:SS */
          <View style={styles.timerWrap}>
            <View style={styles.timerCard}>
              <View style={styles.timerIconCircle}>
                <Timer size={48} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <Text style={styles.timerTitle}>抱っこリレー開始！</Text>
              <Text style={styles.timerBody}>
                パートナーの画面に「応援要請」を表示しました。{'\n'}
                あと少し、交代して乗り切りましょう！
              </Text>
              <Text style={styles.timerCountdown}>{formatTime(timeLeft)}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.homeBtn,
                pressed && styles.pressed,
              ]}
              onPress={goHome}
            >
              <Text style={styles.homeBtnText}>ホームに戻る</Text>
            </Pressable>
          </View>
        )}

        {/* Step progress dots — web bottom dots */}
        {!showTimer && (
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step ? styles.dotActive : styles.dotIdle]}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  // ── Entry confirm modal ────────────────────────────────────────────────────
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(46,41,50,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    padding: 20,
    alignItems: 'center',
    ...shadows.soft,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconEmoji: { fontSize: 36, lineHeight: 44 },
  modalTitle: {
    fontFamily: fonts.sans,
    fontSize: 20,
    color: RESCUE_INK,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 22,
    color: RESCUE_INK,
    opacity: 0.85,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  modalBtnCancel: {
    backgroundColor: palette.card,
    borderColor: RESCUE_BORDER,
  },
  modalBtnCancelText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: RESCUE_INK,
  },
  modalBtnStart: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  modalBtnStartText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.primaryForeground,
  },

  // ── Wizard ─────────────────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: RESCUE_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.sans, fontSize: 20, color: RESCUE_INK },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },

  stepWrap: { gap: 24 },
  stepHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stepCount: { fontFamily: fonts.bodyBold, fontSize: 14, color: RESCUE_INK },

  card: {
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    borderTopLeftRadius: 0,
    borderWidth: 2,
    borderColor: RESCUE_BORDER,
    padding: 28,
    ...shadows.soft,
  },
  cardTitle: {
    fontFamily: fonts.sans,
    fontSize: 24,
    color: '#581C87',
    marginBottom: 14,
  },
  cardBody: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    lineHeight: 27,
    color: '#581C87',
    opacity: 0.9,
  },

  // 「お腹の確認」 feeding sub-card
  feedBlock: { marginTop: 20, gap: 8 },
  feedHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#A855F7',
    marginBottom: 4,
  },
  feedEmpty: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 8,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedRowGreen: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  feedRowAmber: { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' },
  feedRowRose: { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' },
  feedRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedLabel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  feedTime: { fontFamily: fonts.bodyBold, fontSize: 12, opacity: 0.7 },
  feedElapsed: { fontFamily: fonts.bodyBold, fontSize: 12 },
  feedTextGreen: { color: '#16A34A' },
  feedTextAmber: { color: '#D97706' },
  feedTextRose: { color: '#F43F5E' },

  actionRow: { flexDirection: 'row', gap: 16 },
  actionBtn: {
    flex: 1,
    height: 64,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
  },
  solveBtn: { backgroundColor: palette.card, borderColor: '#22C55E' },
  solveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#16A34A',
  },
  nextBtn: { backgroundColor: palette.primary, borderColor: palette.primary },
  nextBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.primaryForeground,
  },

  cautionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEFCE8',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FEF9C3',
    padding: 16,
  },
  cautionText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    color: '#854D0E',
  },

  // ── Relay timer ────────────────────────────────────────────────────────────
  timerWrap: { alignItems: 'center', gap: 32 },
  timerCard: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FECACA',
    padding: 32,
    alignItems: 'center',
    ...shadows.soft,
  },
  timerIconCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  timerTitle: {
    fontFamily: fonts.sans,
    fontSize: 28,
    color: '#DC2626',
    marginBottom: 10,
  },
  timerBody: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 22,
    color: '#7F1D1D',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
  },
  timerCountdown: {
    fontFamily: fonts.sans,
    fontSize: 64,
    color: '#DC2626',
    letterSpacing: -2,
  },
  homeBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: palette.mutedForeground,
  },

  // ── Progress dots ──────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  dot: { height: 8, borderRadius: radius.full },
  dotActive: { width: 32, backgroundColor: RESCUE_INK },
  dotIdle: { width: 8, backgroundColor: 'rgba(128,90,170,0.2)' },
});
