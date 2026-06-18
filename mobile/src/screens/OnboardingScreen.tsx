import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  Grape,
  User,
  Crown,
  ChevronRight,
  ChevronLeft,
  Link2,
  Baby,
  FileText,
  Share2,
  ChartColumn,
  NotebookPen,
  CalendarDays,
  X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { createChild } from '../api/children';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Button, Text, Title, Muted } from '../theme/ui';

type Step = 'role' | 'family' | 'child' | 'tutorial';
type Role = 'papa' | 'mama';
type FamilyAction = 'create' | 'join';
type Gender = 'male' | 'female' | 'other';

const STEPS: Step[] = ['role', 'family', 'child', 'tutorial'];

// Web Onboarding role accents: papa = purple, mama = pink (tailwind pink-400/50/200/700)
const PINK = '#F472B6';
const PINK_SOFT = '#FDF2F8';
const PINK_TINT = '#FBCFE8';

function generateFamilyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function showAlert(title: string, msg: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

// ─── Date picker (calendar grid + month/year navigation) ─────────────────────
// Self-contained: no extra dependency required. On web, the native HTML5
// <input type="date"> is used (browser-native calendar). On iOS/Android,
// a Modal-based calendar grid is rendered.

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatYMD(year: number, month0: number, day: number) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function parseYMD(s: string): { year: number; month0: number; day: number } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: +m[1], month0: +m[2] - 1, day: +m[3] };
}

interface DatePickerFieldProps {
  value: string;          // 'YYYY-MM-DD' or ''
  onChange: (v: string) => void;
  placeholder?: string;
}

function DatePickerField({ value, onChange, placeholder = '誕生日を選択' }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const today = new Date();
  const parsed = parseYMD(value) ?? {
    year: today.getFullYear(),
    month0: today.getMonth(),
    day: today.getDate(),
  };
  const [year, setYear] = useState(parsed.year);
  const [month0, setMonth0] = useState(parsed.month0);

  const cells = useMemo(() => {
    const firstWd = new Date(year, month0, 1).getDay();
    const dim = daysInMonth(year, month0);
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstWd; i++) arr.push(null);
    for (let d = 1; d <= dim; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month0]);

  const display = value ? value.replace(/-/g, '/') : '';

  // Web → native HTML5 date input (browser-native calendar UI).
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      onChange: (e: any) => onChange(e.target.value || ''),
      style: {
        width: '100%',
        boxSizing: 'border-box',
        background: palette.card,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: '14px',
        fontSize: 15,
        color: palette.foreground,
        fontFamily: fonts.body,
        outline: 'none',
      },
      placeholder,
    } as any);
  }

  // Native: tappable field that opens a calendar modal.
  return (
    <>
      <TouchableOpacity
        style={dpStyles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <CalendarDays size={18} color={palette.primary} />
        <Text style={[dpStyles.fieldText, !display && dpStyles.placeholderText]}>
          {display || placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={dpStyles.backdrop}>
          <View style={dpStyles.sheet}>
            <View style={dpStyles.sheetHead}>
              <Text style={dpStyles.sheetTitle}>誕生日を選択</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <X size={20} color={palette.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={dpStyles.navRow}>
              <TouchableOpacity
                onPress={() => {
                  if (month0 === 0) { setYear(year - 1); setMonth0(11); }
                  else setMonth0(month0 - 1);
                }}
                style={dpStyles.navBtn}
              >
                <ChevronLeft size={20} color={palette.foreground} />
              </TouchableOpacity>
              <Text style={dpStyles.navLabel}>{year}年 {month0 + 1}月</Text>
              <TouchableOpacity
                onPress={() => {
                  if (month0 === 11) { setYear(year + 1); setMonth0(0); }
                  else setMonth0(month0 + 1);
                }}
                style={dpStyles.navBtn}
              >
                <ChevronRight size={20} color={palette.foreground} />
              </TouchableOpacity>
            </View>

            <View style={dpStyles.yearJumpRow}>
              {[year - 4, year - 2, year, year + 1].map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[dpStyles.yearChip, y === year && dpStyles.yearChipActive]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[dpStyles.yearChipText, y === year && dpStyles.yearChipTextActive]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={dpStyles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <Text
                  key={w}
                  style={[
                    dpStyles.weekLabel,
                    i === 0 && { color: '#E57373' },
                    i === 6 && { color: '#64B5F6' },
                  ]}
                >
                  {w}
                </Text>
              ))}
            </View>

            <FlatList
              data={cells}
              keyExtractor={(_, i) => String(i)}
              numColumns={7}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                if (item === null) return <View style={dpStyles.cell} />;
                const isSelected =
                  parsed.year === year && parsed.month0 === month0 && parsed.day === item;
                const wd = index % 7;
                return (
                  <TouchableOpacity
                    style={[dpStyles.cell, isSelected && dpStyles.cellActive]}
                    onPress={() => {
                      onChange(formatYMD(year, month0, item));
                      setOpen(false);
                    }}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        dpStyles.cellText,
                        wd === 0 && { color: '#E57373' },
                        wd === 6 && { color: '#64B5F6' },
                        isSelected && dpStyles.cellTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={dpStyles.footerRow}>
              <TouchableOpacity
                style={dpStyles.todayBtn}
                onPress={() => {
                  const n = new Date();
                  setYear(n.getFullYear());
                  setMonth0(n.getMonth());
                }}
              >
                <Text style={dpStyles.todayBtnText}>今月へ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dpStyles.clearBtn}
                onPress={() => { onChange(''); setOpen(false); }}
              >
                <Text style={dpStyles.clearBtnText}>クリア</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const dpStyles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: palette.card, borderRadius: 12,
    borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  fieldText: { fontSize: 15, color: palette.foreground, fontFamily: fonts.body },
  placeholderText: { color: palette.mutedForeground },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  sheet: {
    backgroundColor: palette.card, borderRadius: 20,
    width: '100%', maxWidth: 360, padding: 18, gap: 12,
    ...shadows.soft,
  },
  sheetHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sheetTitle: { fontSize: 16, color: palette.foreground, fontFamily: fonts.sans, fontWeight: '700' },

  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  navBtn: { padding: 8, borderRadius: 12 },
  navLabel: { fontSize: 16, fontFamily: fonts.bodyBold, color: palette.foreground },

  yearJumpRow: {
    flexDirection: 'row', justifyContent: 'space-around', gap: 8,
  },
  yearChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: palette.background,
    borderWidth: 1, borderColor: palette.border,
  },
  yearChipActive: {
    backgroundColor: palette.accent, borderColor: palette.primary,
  },
  yearChipText: { fontSize: 12, color: palette.mutedForeground, fontFamily: fonts.body },
  yearChipTextActive: { color: palette.primary, fontFamily: fonts.bodyBold },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekLabel: {
    flex: 1, textAlign: 'center', fontSize: 11,
    color: palette.mutedForeground, fontFamily: fonts.bodyBold,
  },
  cell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    margin: 2, borderRadius: 999,
  },
  cellActive: { backgroundColor: palette.primary },
  cellText: { fontSize: 14, color: palette.foreground, fontFamily: fonts.body },
  cellTextActive: { color: palette.primaryForeground, fontFamily: fonts.bodyBold },

  footerRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
  },
  todayBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  todayBtnText: { fontSize: 13, color: palette.primary, fontFamily: fonts.bodyBold },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  clearBtnText: { fontSize: 13, color: palette.mutedForeground, fontFamily: fonts.body },
});

export default function OnboardingScreen() {
  const { setUser } = useAuthStore();
  const { setChildren } = useChildStore();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role>('papa');
  const [displayName, setDisplayName] = useState('');

  const [familyAction, setFamilyAction] = useState<FamilyAction>('create');
  const [generatedCode] = useState(generateFamilyCode);
  const [joinCode, setJoinCode] = useState('');

  const [childName, setChildName] = useState('');
  const [childBirthday, setChildBirthday] = useState('');
  const [childGender, setChildGender] = useState<Gender>('other');

  const [loading, setLoading] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const familyId = familyAction === 'create' ? generatedCode : joinCode.trim().toUpperCase();

  // ── Step handlers ────────────────────────────────────────────────────────────

  const goStep1ToStep2 = () => {
    if (!displayName.trim()) {
      showAlert('入力エラー', '名前を入力してください。');
      return;
    }
    setStep('family');
  };

  const goStep2ToStep3 = () => {
    if (familyAction === 'join' && joinCode.trim().length < 4) {
      showAlert('入力エラー', '家族IDを入力してください。');
      return;
    }
    setStep('child');
  };

  const goStep3ToStep4 = () => {
    if (!childName.trim()) {
      showAlert('入力エラー', 'お子さんの名前を入力してください。');
      return;
    }
    setStep('tutorial');
  };

  const handleFinish = async (skip = false) => {
    setLoading(true);
    try {
      // Save session data (token = 'guest' for persistence via loadFromStorage)
      await AsyncStorage.multiSet([
        ['sessionToken', 'guest'],
        ['familyId', familyId],
        ['userRole', role],
        ['displayName', displayName.trim()],
        ['pictureUrl', ''],
      ]);

      // Set auth user
      setUser({
        id: 0,
        lineUserId: 'guest',
        displayName: displayName.trim(),
        familyId,
        role,
      });

      // Create child via API (only if name was provided and not skipping child step)
      if (childName.trim() && !skip) {
        try {
          const newChild = await createChild({
            name: childName.trim(),
            birthday: childBirthday.trim() || undefined,
            gender: childGender,
            familyId: familyId as any,
            color: palette.primary,
          });
          setChildren([newChild]);
        } catch {
          // Child creation failed silently — user can add from Settings
        }
      }
    } catch {
      showAlert('エラー', '設定の保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Brand mark — web Onboarding: circular gradient badge + Grape, black
          title, purple tagline, "Produced by ぶどうの木" credit */}
      <View style={styles.logoBadge}>
        <Grape size={42} color={palette.primary} strokeWidth={2} />
      </View>
      <Title style={styles.logo}>We育</Title>
      <Text style={styles.tagline}>ふたりで育てる、ふたりで楽しむ</Text>
      <View style={styles.brandDivider} />
      <Text style={styles.producedBy}>PRODUCED BY</Text>
      <Text style={styles.producedByName}>産前産後ケアホテル ぶどうの木</Text>

      {/* Progress dots */}
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              i === stepIndex && styles.progressDotActive,
              i < stepIndex && styles.progressDotDone,
            ]}
          />
        ))}
      </View>

      {/* ── Step 1: ロールを選ぶ ───────────────────────────────────────────── */}
      {step === 'role' && (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}>
            <User size={32} color={palette.primary} strokeWidth={2} />
          </View>
          <Title style={styles.stepTitle}>ロールを選ぶ</Title>
          <Muted style={styles.stepSubtitle}>あなたはどちらですか？</Muted>

          {/* Web Onboarding welcome card: 最強のチーム作りをサポート */}
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeCardTitle}>
              最強のチーム作りを{'\n'}サポートします
            </Text>
            <Muted style={styles.welcomeCardDesc}>
              育児の記録・共有・振り返りを通じて、パパとママが最高のチームになるためのアプリです。
            </Muted>
          </View>

          {/* Web Onboarding: papa = purple card, mama = pink card */}
          <View style={styles.roleRow}>
            {(['papa', 'mama'] as Role[]).map((r) => {
              const active = role === r;
              const RoleIcon = r === 'mama' ? Crown : User;
              const tint = r === 'mama' ? PINK : palette.primary;
              return (
                <Button
                  key={r}
                  variant="ghost"
                  onPress={() => setRole(r)}
                  style={[
                    styles.roleCard,
                    active && {
                      borderColor: tint,
                      backgroundColor: r === 'mama' ? PINK_SOFT : palette.accent,
                      ...shadows.soft,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.roleIconWrap,
                      active && {
                        backgroundColor: r === 'mama' ? PINK_TINT : '#E2D4F0',
                      },
                    ]}
                  >
                    <RoleIcon
                      size={28}
                      color={active ? tint : palette.mutedForeground}
                      strokeWidth={2}
                    />
                  </View>
                  <Text
                    style={[
                      styles.roleLabel,
                      active && { color: tint, fontFamily: fonts.sans },
                    ]}
                  >
                    {r === 'mama' ? 'ママ' : 'パパ'}
                  </Text>
                </Button>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>あなたの名前</Text>
          <TextInput
            style={styles.input}
            placeholder="例：山田 花子"
            placeholderTextColor={palette.mutedForeground}
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Button
            onPress={goStep1ToStep2}
            disabled={!displayName.trim()}
            style={styles.nextButton}
            textStyle={styles.nextButtonText}
          >
            <Text style={styles.nextButtonText}>次へ</Text>
            <ChevronRight size={18} color={palette.primaryForeground} strokeWidth={2.5} />
          </Button>
        </View>
      )}

      {/* ── Step 2: 家族IDの設定 ──────────────────────────────────────────── */}
      {step === 'family' && (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}>
            <Link2 size={32} color={palette.primary} strokeWidth={2} />
          </View>
          <Title style={styles.stepTitle}>家族IDの設定</Title>
          <Muted style={styles.stepSubtitle}>新規作成 or パートナーのIDで参加</Muted>

          <View style={styles.familyTabRow}>
            <Button
              variant="ghost"
              onPress={() => setFamilyAction('create')}
              style={[styles.familyTab, familyAction === 'create' && styles.familyTabActive]}
            >
              <Text style={[styles.familyTabText, familyAction === 'create' && styles.familyTabTextActive]}>
                新規作成
              </Text>
            </Button>
            <Button
              variant="ghost"
              onPress={() => setFamilyAction('join')}
              style={[styles.familyTab, familyAction === 'join' && styles.familyTabActive]}
            >
              <Text style={[styles.familyTabText, familyAction === 'join' && styles.familyTabTextActive]}>
                IDで参加
              </Text>
            </Button>
          </View>

          {familyAction === 'create' ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>あなたの家族ID</Text>
              <Title style={styles.codeValue}>{generatedCode}</Title>
              <Muted style={styles.codeHint}>パートナーにこのIDを伝えてください</Muted>
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>パートナーの家族ID</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="例：ABC123"
                placeholderTextColor={palette.mutedForeground}
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
              />
            </>
          )}

          <Button
            onPress={goStep2ToStep3}
            style={styles.nextButton}
            textStyle={styles.nextButtonText}
          >
            <Text style={styles.nextButtonText}>次へ</Text>
            <ChevronRight size={18} color={palette.primaryForeground} strokeWidth={2.5} />
          </Button>
          <Button variant="ghost" onPress={() => setStep('role')} style={styles.linkBtn}>
            <Text style={styles.backText}>戻る</Text>
          </Button>
        </View>
      )}

      {/* ── Step 3: お子さんの情報を登録 ─────────────────────────────────── */}
      {step === 'child' && (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}>
            <Baby size={32} color={palette.primary} strokeWidth={2} />
          </View>
          <Title style={styles.stepTitle}>お子さんの情報を登録</Title>
          <Muted style={styles.stepSubtitle}>後からでも変更できます</Muted>

          <Text style={styles.inputLabel}>
            お子さんの名前 <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="例：太郎"
            placeholderTextColor={palette.mutedForeground}
            value={childName}
            onChangeText={setChildName}
            autoFocus
          />

          <Text style={styles.inputLabel}>誕生日（任意）</Text>
          <DatePickerField
            value={childBirthday}
            onChange={setChildBirthday}
            placeholder="カレンダーから選択"
          />

          <Text style={styles.inputLabel}>性別</Text>
          <View style={styles.genderRow}>
            {([['male', '男の子'], ['female', '女の子'], ['other', 'その他']] as [Gender, string][]).map(([g, label]) => {
              const active = childGender === g;
              return (
                <Button
                  key={g}
                  variant="ghost"
                  onPress={() => setChildGender(g)}
                  style={[styles.genderChip, active && styles.genderChipActive]}
                >
                  <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                    {label}
                  </Text>
                </Button>
              );
            })}
          </View>

          <Button
            onPress={goStep3ToStep4}
            disabled={!childName.trim()}
            style={styles.nextButton}
            textStyle={styles.nextButtonText}
          >
            <Text style={styles.nextButtonText}>次へ</Text>
            <ChevronRight size={18} color={palette.primaryForeground} strokeWidth={2.5} />
          </Button>
          <Button
            variant="ghost"
            onPress={() => { setStep('tutorial'); }}
            disabled={loading}
            style={styles.linkBtn}
          >
            <Muted style={styles.skipText}>後で設定する</Muted>
          </Button>
          <Button variant="ghost" onPress={() => setStep('family')} style={styles.linkBtn}>
            <Text style={styles.backText}>戻る</Text>
          </Button>
        </View>
      )}

      {/* ── Step 4: チュートリアル ────────────────────────────────────────── */}
      {step === 'tutorial' && (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}>
            <Grape size={32} color={palette.primary} strokeWidth={2} />
          </View>
          <Title style={styles.stepTitle}>チュートリアル</Title>
          <Muted style={styles.stepSubtitle}>We育でできること</Muted>

          <View style={styles.tutorialCards}>
            {[
              { Icon: NotebookPen, title: '記録する', desc: '授乳・おむつ・睡眠をワンタップで記録' },
              { Icon: Share2, title: 'シェアする', desc: 'パートナーとリアルタイムで情報共有' },
              { Icon: ChartColumn, title: '振り返る', desc: '月ごとに記録をまとめて確認できます' },
              { Icon: FileText, title: '思い出PDF', desc: 'お子さんの成長を1冊にまとめて保存' },
            ].map(({ Icon, title, desc }) => (
              <View key={title} style={styles.tutorialCard}>
                <View style={styles.tutorialIconWrap}>
                  <Icon size={22} color={palette.primary} strokeWidth={2} />
                </View>
                <View style={styles.tutorialCardBody}>
                  <Text style={styles.tutorialCardTitle}>{title}</Text>
                  <Muted style={styles.tutorialCardDesc}>{desc}</Muted>
                </View>
              </View>
            ))}
          </View>

          <Button
            onPress={() => handleFinish(false)}
            disabled={loading}
            style={styles.nextButton}
            textStyle={styles.nextButtonText}
          >
            {loading ? (
              <ActivityIndicator color={palette.primaryForeground} />
            ) : (
              <Text style={styles.nextButtonText}>はじめる！</Text>
            )}
          </Button>
          <Button
            variant="ghost"
            onPress={() => handleFinish(true)}
            disabled={loading}
            style={styles.linkBtn}
          >
            <Muted style={styles.skipText}>スキップ</Muted>
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },

  // Brand (web: gradient circle + Grape, black title, purple tagline)
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: palette.card,
    marginBottom: 16,
    ...shadows.soft,
  },
  logo: { fontFamily: fonts.sans, fontSize: 30, color: palette.accentForeground, marginBottom: 4 },
  tagline: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: palette.primary,
    marginBottom: 16,
  },
  brandDivider: {
    width: 48,
    height: 1,
    backgroundColor: '#E2D4F0',
    marginBottom: 12,
  },
  producedBy: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#C4B5DB',
    marginBottom: 2,
  },
  producedByName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: palette.primary,
    marginBottom: 24,
  },
  welcomeCard: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: palette.accent,
    padding: 20,
    marginVertical: 4,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  welcomeCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.accentForeground,
    lineHeight: 24,
  },
  welcomeCardDesc: {
    fontSize: 12,
    color: palette.mutedForeground,
    marginTop: 12,
    lineHeight: 19,
  },

  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  progressDot: { width: 9, height: 9, borderRadius: radius.full, backgroundColor: palette.border },
  progressDotActive: { backgroundColor: palette.primary, transform: [{ scale: 1.25 }] },
  progressDotDone: { backgroundColor: palette.accentForeground },

  stepContainer: { width: '100%', alignItems: 'center', gap: 14 },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepTitle: { fontSize: 22, textAlign: 'center', color: palette.foreground },
  stepSubtitle: { fontSize: 14, textAlign: 'center', marginTop: -4 },

  inputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: palette.foreground,
    alignSelf: 'flex-start',
  },
  required: { color: palette.destructive, fontFamily: fonts.bodyBold },
  input: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
  },

  // Role step
  roleRow: { flexDirection: 'row', gap: 16, marginVertical: 8, justifyContent: 'center' },
  roleCard: {
    width: 130,
    flexDirection: 'column',
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: palette.border,
    minHeight: undefined,
  },
  roleCardActive: { borderColor: palette.primary, backgroundColor: palette.accent, ...shadows.soft },
  roleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: { backgroundColor: '#E2D4F0' },
  roleLabel: { fontFamily: fonts.sans, fontSize: 16, color: palette.mutedForeground },
  roleLabelActive: { color: palette.accentForeground },

  // Family step
  familyTabRow: {
    flexDirection: 'row',
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 4,
    width: '100%',
    gap: 4,
  },
  familyTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
    backgroundColor: 'transparent',
  },
  familyTabActive: { backgroundColor: palette.primary },
  familyTabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.accentForeground },
  familyTabTextActive: { color: palette.primaryForeground },

  codeBox: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.primary,
    gap: 6,
    ...shadows.soft,
  },
  codeLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: palette.mutedForeground },
  codeValue: { fontFamily: fonts.sans, fontSize: 32, color: palette.primary, letterSpacing: 6 },
  codeHint: { fontSize: 12, textAlign: 'center' },
  codeInput: { textAlign: 'center', fontSize: 22, fontFamily: fonts.sans, letterSpacing: 4 },

  // Child step
  genderRow: { flexDirection: 'row', gap: 10, alignSelf: 'flex-start', flexWrap: 'wrap' },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: palette.primary,
    backgroundColor: palette.card,
    minHeight: undefined,
  },
  genderChipActive: { backgroundColor: palette.primary },
  genderChipText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: palette.primary },
  genderChipTextActive: { color: palette.primaryForeground, fontFamily: fonts.bodyBold },

  // Tutorial step
  tutorialCards: { width: '100%', gap: 10 },
  tutorialCard: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tutorialIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialCardBody: { flex: 1 },
  tutorialCardTitle: { fontFamily: fonts.sans, fontSize: 15, color: palette.foreground },
  tutorialCardDesc: { fontSize: 12, marginTop: 2 },

  // Shared
  nextButton: {
    width: '100%',
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginTop: 6,
    ...shadows.soft,
  },
  nextButtonText: {
    color: palette.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.sans,
  },
  linkBtn: { backgroundColor: 'transparent', minHeight: undefined, paddingVertical: 2 },
  skipText: { fontSize: 14, marginTop: 2 },
  backText: { color: palette.primary, fontSize: 14, fontFamily: fonts.bodyBold, marginTop: 2 },
});
