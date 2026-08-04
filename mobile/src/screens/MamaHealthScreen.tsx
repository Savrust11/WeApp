import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HeartPulse, Pill, ChevronLeft, ChevronRight, Plus, Minus,
  Frown, Annoyed, Meh, Smile, Laugh,
} from 'lucide-react-native';
import { apiGet, apiPost } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { MamaHealthRecord, MamaMedicineRecord } from '@shared/schema';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Card, Button, Text, Title, Muted } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';

// ── Constants ──────────────────────────────────────────────────────────────

const LOCHIA_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'なし' },
  { value: 'light', label: '少量' },
  { value: 'medium', label: '中程度' },
  { value: 'heavy', label: '多め' },
];

const PAIN_LABELS = ['なし', '弱', '中', '強', '激'];

// Mood scale rendered with lucide face icons (matches the web app's icon style)
const MOOD_ICONS = [Frown, Annoyed, Meh, Smile, Laugh];

const SLEEP_MINUTES_OPTIONS = [0, 15, 30, 45];

const BREASTFEEDING_TROUBLES = [
  '乳首の痛み',
  '乳腺炎',
  '詰まり',
  '白斑',
  '陥没乳頭',
  'その他',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <Title style={styles.sectionTitle}>{title}</Title>
      {children}
    </Card>
  );
}

function ToggleRow({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[styles.toggleBtn, value === true && styles.toggleBtnActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.toggleLabel, value === true && styles.toggleLabelActive]}>
          あり
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, value === false && styles.toggleBtnActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.toggleLabel, value === false && styles.toggleLabelActive]}>
          なし
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function MamaHealthScreen() {
  const { isDark, colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const today = toDateString(new Date());

  // ── Date state ──────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(today);

  function changeDate(delta: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const next = toDateString(d);
    if (next > today) return; // no future dates
    setSelectedDate(next);
  }

  // ── Form state ──────────────────────────────────────────────────────────
  const [bowelMovement, setBowelMovement] = useState<boolean | null>(null);
  const [bowelNote, setBowelNote] = useState('');
  const [lochiaState, setLochiaState] = useState<string | null>(null);
  const [perineumPain, setPerineumPain] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState(6);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [selectedTroubles, setSelectedTroubles] = useState<string[]>([]);
  const [weightKg, setWeightKg] = useState('');
  const [hasEdema, setHasEdema] = useState<boolean | null>(null);
  const [holdingTime, setHoldingTime] = useState('');

  // ── Medicine modal state ─────────────────────────────────────────────────
  const [medicineModalVisible, setMedicineModalVisible] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [medicineDosage, setMedicineDosage] = useState('');
  const [medicineMemo, setMedicineMemo] = useState('');

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: medicines = [], isLoading: medicinesLoading } = useQuery<MamaMedicineRecord[]>({
    queryKey: ['mama-medicine', user?.familyId],
    queryFn: () => apiGet<MamaMedicineRecord[]>(`/api/mama-medicine/${user!.familyId}`),
    enabled: !!user?.familyId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveHealthMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<MamaHealthRecord>('/api/mama-health', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mama-health', user?.familyId] });
      Alert.alert('記録しました', '今日のからだの記録を保存しました。');
    },
    onError: () => {
      Alert.alert('エラー', '記録の保存に失敗しました。');
    },
  });

  const saveMedicineMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<MamaMedicineRecord>('/api/mama-medicine', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mama-medicine', user?.familyId] });
      setMedicineModalVisible(false);
      setMedicineName('');
      setMedicineDosage('');
      setMedicineMemo('');
    },
    onError: () => {
      Alert.alert('エラー', 'お薬の記録に失敗しました。');
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────
  function toggleTrouble(item: string) {
    setSelectedTroubles((prev) =>
      prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item],
    );
  }

  function handleSave() {
    if (!user) return;
    const payload: Record<string, unknown> = {
      familyId: user.familyId,
      userId: user.lineUserId || String(user.id),
      recordedDate: selectedDate,
      bowelMovement: bowelMovement,
      bowelNote: bowelNote.trim() || null,
      lochiaState: lochiaState,
      perineumPain: perineumPain,
      mood: mood,
      sleepHours,
      sleepMinutes,
      breastfeedingTrouble: selectedTroubles.length > 0 ? selectedTroubles.join(',') : null,
      weightKg: weightKg.trim() || null,
      hasEdema: hasEdema,
      holdingTime: holdingTime.trim() ? parseInt(holdingTime.trim(), 10) : null,
    };
    saveHealthMutation.mutate(payload);
  }

  function handleSaveMedicine() {
    if (!user) return;
    if (!medicineName.trim()) {
      Alert.alert('入力エラー', '薬の名前を入力してください。');
      return;
    }
    saveMedicineMutation.mutate({
      familyId: user.familyId,
      userId: user.lineUserId || String(user.id),
      medicineName: medicineName.trim(),
      dosage: medicineDosage.trim() || null,
      memo: medicineMemo.trim() || null,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <HeartPulse size={20} color={palette.primaryForeground} />
          <Text style={styles.headerTitle}>ママのからだ記録</Text>
        </View>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(-1)}>
            <ChevronLeft size={24} color={palette.primaryForeground} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{formatDisplayDate(selectedDate)}</Text>
          <TouchableOpacity
            style={[styles.dateArrow, selectedDate >= today && styles.dateArrowDisabled]}
            onPress={() => changeDate(1)}
            disabled={selectedDate >= today}
          >
            <ChevronRight
              size={24}
              color={selectedDate >= today ? 'rgba(255,255,255,0.4)' : palette.primaryForeground}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1: お通じ */}
        <SectionCard title="お通じ">
          <ToggleRow value={bowelMovement} onChange={setBowelMovement} />
          {bowelMovement === true && (
            <TextInput
              style={styles.textInput}
              placeholder="メモ（任意）"
              placeholderTextColor={palette.mutedForeground}
              value={bowelNote}
              onChangeText={setBowelNote}
              multiline
            />
          )}
        </SectionCard>

        {/* Section 2: 悪露 */}
        <SectionCard title="悪露">
          <View style={styles.radioRow}>
            {LOCHIA_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radioBtn, lochiaState === opt.value && styles.radioBtnActive]}
                onPress={() => setLochiaState(opt.value)}
              >
                <Text style={[styles.radioBtnText, lochiaState === opt.value && styles.radioBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Section 3: 会陰の痛み */}
        <SectionCard title="会陰の痛み">
          <View style={styles.scaleRow}>
            {PAIN_LABELS.map((label, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.scaleCircle, perineumPain === idx && styles.scaleCircleActive]}
                onPress={() => setPerineumPain(idx)}
              >
                <Text style={[styles.scaleLabel, perineumPain === idx && styles.scaleLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Section 4: 気分 */}
        <SectionCard title="気分">
          <View style={styles.moodRow}>
            {MOOD_ICONS.map((MoodIcon, idx) => {
              const active = mood === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.moodBtn, active && styles.moodBtnActive]}
                  onPress={() => setMood(idx)}
                >
                  <MoodIcon
                    size={26}
                    color={active ? palette.primary : palette.mutedForeground}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        {/* Section 5: 睡眠時間 */}
        <SectionCard title="睡眠時間">
          <View style={styles.sleepRow}>
            {/* Hours */}
            <View style={styles.stepperGroup}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setSleepHours((h) => Math.max(0, h - 1))}
              >
                <Minus size={18} color={palette.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{sleepHours}時間</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setSleepHours((h) => Math.min(24, h + 1))}
              >
                <Plus size={18} color={palette.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sleepSep}> </Text>

            {/* Minutes */}
            <View style={styles.stepperGroup}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => {
                  const idx = SLEEP_MINUTES_OPTIONS.indexOf(sleepMinutes);
                  setSleepMinutes(SLEEP_MINUTES_OPTIONS[Math.max(0, idx - 1)]);
                }}
              >
                <Minus size={18} color={palette.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{sleepMinutes}分</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => {
                  const idx = SLEEP_MINUTES_OPTIONS.indexOf(sleepMinutes);
                  setSleepMinutes(SLEEP_MINUTES_OPTIONS[Math.min(SLEEP_MINUTES_OPTIONS.length - 1, idx + 1)]);
                }}
              >
                <Plus size={18} color={palette.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </SectionCard>

        {/* Section 6: 授乳トラブル */}
        <SectionCard title="授乳トラブル">
          <View style={styles.chipWrap}>
            {BREASTFEEDING_TROUBLES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, selectedTroubles.includes(item) && styles.chipActive]}
                onPress={() => toggleTrouble(item)}
              >
                <Text style={[styles.chipText, selectedTroubles.includes(item) && styles.chipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Section 7: 体重 */}
        <SectionCard title="体重">
          <View style={styles.weightRow}>
            <TextInput
              style={styles.weightInput}
              placeholder="例: 55.5"
              placeholderTextColor={palette.mutedForeground}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
            />
            <Text style={styles.weightUnit}>kg</Text>
          </View>
        </SectionCard>

        {/* Section 8: むくみ */}
        <SectionCard title="むくみ">
          <ToggleRow value={hasEdema} onChange={setHasEdema} />
        </SectionCard>

        {/* Section 9: 抱っこ */}
        <SectionCard title="抱っこ時間">
          <View style={styles.weightRow}>
            <TextInput
              style={styles.weightInput}
              placeholder="例: 60"
              placeholderTextColor={palette.mutedForeground}
              value={holdingTime}
              onChangeText={setHoldingTime}
              keyboardType="number-pad"
            />
            <Text style={styles.weightUnit}>分</Text>
          </View>
        </SectionCard>

        {/* Medicine Card */}
        <Card style={styles.card}>
          <View style={styles.medicineTitleRow}>
            <Pill size={18} color={palette.primary} />
            <Title style={styles.sectionTitle}>自分のお薬を記録</Title>
          </View>

          {medicinesLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginVertical: 8 }} />
          ) : medicines.length === 0 ? (
            <Muted style={styles.emptyText}>お薬の記録がありません</Muted>
          ) : (
            medicines.slice(0, 5).map((m) => (
              <View key={m.id} style={styles.medicineItem}>
                <Text style={styles.medicineName}>{m.medicineName}</Text>
                {m.dosage ? <Muted style={styles.medicineSub}>{m.dosage}</Muted> : null}
                {m.memo ? <Muted style={styles.medicineSub}>{m.memo}</Muted> : null}
              </View>
            ))
          )}

          <Button
            variant="outline"
            onPress={() => setMedicineModalVisible(true)}
            style={styles.addMedicineBtn}
          >
            <Plus size={16} color={palette.primary} />
            <Text style={styles.addMedicineBtnText}>お薬を記録</Text>
          </Button>
        </Card>

        {/* Save button */}
        <Button
          onPress={handleSave}
          disabled={saveHealthMutation.isPending}
          style={[styles.saveBtn, saveHealthMutation.isPending && styles.saveBtnDisabled]}
        >
          {saveHealthMutation.isPending ? (
            <ActivityIndicator color={palette.primaryForeground} />
          ) : (
            <Text style={styles.saveBtnText}>記録する</Text>
          )}
        </Button>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Medicine Modal */}
      <Modal
        visible={medicineModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMedicineModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Title style={styles.modalTitle}>お薬を記録</Title>

            <Muted style={styles.modalLabel}>薬の名前 *</Muted>
            <TextInput
              style={styles.modalInput}
              placeholder="例: ロキソニン"
              placeholderTextColor={palette.mutedForeground}
              value={medicineName}
              onChangeText={setMedicineName}
            />

            <Muted style={styles.modalLabel}>用量（任意）</Muted>
            <TextInput
              style={styles.modalInput}
              placeholder="例: 1錠"
              placeholderTextColor={palette.mutedForeground}
              value={medicineDosage}
              onChangeText={setMedicineDosage}
            />

            <Muted style={styles.modalLabel}>メモ（任意）</Muted>
            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              placeholder="メモを入力"
              placeholderTextColor={palette.mutedForeground}
              value={medicineMemo}
              onChangeText={setMedicineMemo}
              multiline
            />

            <View style={styles.modalBtnRow}>
              <Button
                variant="outline"
                onPress={() => setMedicineModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Button>
              <Button
                onPress={handleSaveMedicine}
                disabled={saveMedicineMutation.isPending}
                style={[styles.modalSaveBtn, saveMedicineMutation.isPending && styles.saveBtnDisabled]}
              >
                {saveMedicineMutation.isPending ? (
                  <ActivityIndicator color={palette.primaryForeground} />
                ) : (
                  <Text style={styles.modalSaveText}>記録する</Text>
                )}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },

  // Header
  header: {
    backgroundColor: palette.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerTitle: {
    color: palette.primaryForeground,
    fontSize: 18,
    fontFamily: fonts.sans,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateArrow: {
    padding: 8,
  },
  dateArrowDisabled: {
    opacity: 0.3,
  },
  dateLabel: {
    color: palette.primaryForeground,
    fontSize: 15,
    fontFamily: fonts.bodySemibold,
    minWidth: 130,
    textAlign: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Card / Section
  card: {
    padding: 16,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    color: palette.primary,
    marginBottom: 12,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  toggleLabel: {
    fontSize: 14,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  toggleLabelActive: {
    color: palette.primaryForeground,
  },

  // TextInput inside card
  textInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 14,
    fontFamily: fonts.body,
    color: palette.foreground,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Horizontal radio
  radioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radioBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
  },
  radioBtnActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  radioBtnText: {
    fontSize: 13,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  radioBtnTextActive: {
    color: palette.primaryForeground,
  },

  // Scale row (pain circles)
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  scaleCircle: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleCircleActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  scaleLabel: {
    fontSize: 11,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  scaleLabelActive: {
    color: palette.primaryForeground,
  },

  // Mood row (lucide face icons)
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
  },
  moodBtnActive: {
    backgroundColor: palette.accent,
    borderColor: palette.primary,
  },

  // Stepper (sleep)
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  sleepSep: {
    width: 8,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
    minWidth: 52,
    textAlign: 'center',
  },

  // Chips
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.accent,
  },
  chipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipText: {
    fontSize: 13,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  chipTextActive: {
    color: palette.primaryForeground,
  },

  // Weight / holding row
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: palette.foreground,
  },
  weightUnit: {
    fontSize: 15,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },

  // Medicine list
  medicineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: palette.mutedForeground,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  medicineItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  medicineName: {
    fontSize: 14,
    fontFamily: fonts.bodySemibold,
    color: palette.foreground,
  },
  medicineSub: {
    fontSize: 12,
    color: palette.mutedForeground,
    marginTop: 2,
  },
  addMedicineBtn: {
    marginTop: 12,
    minHeight: 44,
    backgroundColor: 'transparent',
    borderColor: palette.primary,
  },
  addMedicineBtnText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },

  // Save button
  saveBtn: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    borderRadius: radius.sm,
    minHeight: 50,
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: palette.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.bodyBold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 17,
    color: palette.primary,
    marginBottom: 18,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
    marginBottom: 4,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    color: palette.foreground,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: 'transparent',
    borderColor: palette.border,
  },
  modalCancelText: {
    color: palette.mutedForeground,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  modalSaveBtn: {
    flex: 2,
    minHeight: 48,
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  modalSaveText: {
    color: palette.primaryForeground,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
