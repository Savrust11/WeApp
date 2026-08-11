/**
 * DatePickerModal — pure-JS calendar picker (no native deps).
 *
 * Replaces manual "2024-03-15" text entry with a proper month-grid picker.
 * Ships via OTA (no rebuild required).
 *
 * Public API:
 *   <DatePickerModal
 *     visible={showDatePicker}
 *     initialDate={birthday}         // "YYYY-MM-DD" or empty
 *     maxDate={new Date()}           // block future dates
 *     onConfirm={(iso) => setBirthday(iso)}
 *     onClose={() => setShowDatePicker(false)}
 *   />
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { palette, fonts, radius } from '../theme/tokens';
import { useTheme } from '../contexts/ThemeContext';

const PURPLE_500 = '#A855F7';
const PURPLE_100 = '#F3E8FF';
const PURPLE_600 = '#9333EA';
const GRAY_400 = '#9CA3AF';
const GRAY_300 = '#D1D5DB';
const GRAY_100 = '#F3F4F6';

const MONTH_LABELS_JP = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEK_LABELS_JP  = ['日', '月', '火', '水', '木', '金', '土'];

function toIso(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseIso(s: string | undefined | null): { y: number; m0: number; d: number } | null {
  if (!s) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m0 = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  if (isNaN(y) || isNaN(m0) || isNaN(d)) return null;
  return { y, m0, d };
}

interface Props {
  visible: boolean;
  initialDate?: string;
  minDate?: Date;
  maxDate?: Date;
  onConfirm: (iso: string) => void;
  onClose: () => void;
  title?: string;
}

export default function DatePickerModal({
  visible, initialDate, minDate, maxDate,
  onConfirm, onClose, title = '日付を選ぶ',
}: Props) {
  const { isDark, colors } = useTheme();
  // Anchor: parse initial; otherwise default to CURRENT month (client
  // feedback 2026-08-11 — was showing "1 year ago" which felt confusing).
  const nowRef = useMemo(() => new Date(), []);

  const parsed = parseIso(initialDate);
  const [year, setYear] = useState<number>(parsed?.y ?? nowRef.getFullYear());
  const [month0, setMonth0] = useState<number>(parsed?.m0 ?? nowRef.getMonth());
  const [day, setDay] = useState<number | null>(parsed?.d ?? null);
  const [showYearGrid, setShowYearGrid] = useState(false);

  const firstDayOfMonth = new Date(year, month0, 1).getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();

  const goPrev = () => {
    if (month0 === 0) { setMonth0(11); setYear(y => y - 1); }
    else setMonth0(m => m - 1);
  };
  const goNext = () => {
    if (month0 === 11) { setMonth0(0); setYear(y => y + 1); }
    else setMonth0(m => m + 1);
  };

  // Year picker: last 100 years + 5 future (in case someone's entering a due date)
  const YEAR_MIN = nowRef.getFullYear() - 100;
  const YEAR_MAX = nowRef.getFullYear() + 5;
  const years: number[] = [];
  for (let y = YEAR_MAX; y >= YEAR_MIN; y--) years.push(y);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isBeforeMin = (d: number) => {
    if (!minDate) return false;
    return new Date(year, month0, d) < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  };
  const isAfterMax = (d: number) => {
    if (!maxDate) return false;
    return new Date(year, month0, d) > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
  };

  const handleConfirm = () => {
    if (day) {
      onConfirm(toIso(year, month0, day));
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.card, isDark && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} activeOpacity={1} onPress={() => { /* swallow */ }}>
          <Text style={styles.title}>{title}</Text>

          {/* Month nav bar */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={goPrev} style={styles.navBtn}>
              <ChevronLeft size={18} color={PURPLE_600} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowYearGrid(v => !v)} style={styles.monthPill}>
              <Text style={styles.monthPillText}>{year}年 {MONTH_LABELS_JP[month0]}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goNext} style={styles.navBtn}>
              <ChevronRight size={18} color={PURPLE_600} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {showYearGrid ? (
            <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid}>
              {years.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearCell, y === year && styles.yearCellActive]}
                  onPress={() => { setYear(y); setShowYearGrid(false); }}
                >
                  <Text style={[styles.yearText, y === year && styles.yearTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <>
              <View style={styles.weekRow}>
                {WEEK_LABELS_JP.map((w, i) => (
                  <Text key={w} style={[styles.weekLabel, i === 0 && styles.weekLabelSun, i === 6 && styles.weekLabelSat]}>{w}</Text>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((d, idx) => {
                  if (d === null) return <View key={idx} style={styles.dayCell} />;
                  const disabled = isBeforeMin(d) || isAfterMax(d);
                  const active = d === day;
                  const dow = idx % 7;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dayCell,
                        active && styles.dayCellActive,
                        disabled && styles.dayCellDisabled,
                      ]}
                      disabled={disabled}
                      onPress={() => setDay(d)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          dow === 0 && styles.dayTextSun,
                          dow === 6 && styles.dayTextSat,
                          active && styles.dayTextActive,
                          disabled && styles.dayTextDisabled,
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={onClose}>
              <Text style={styles.buttonCancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonConfirm, !day && styles.buttonDisabled]}
              disabled={!day}
              onPress={handleConfirm}
            >
              <Text style={styles.buttonConfirmText}>決定</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    padding: 16,
    width: '100%',
    maxWidth: 380,
  },
  title: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '900', color: palette.foreground, textAlign: 'center', marginBottom: 12 },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { padding: 8, borderRadius: radius.sm, backgroundColor: PURPLE_100 },
  monthPill: { flex: 1, alignItems: 'center', paddingVertical: 8, marginHorizontal: 8, borderRadius: radius.sm, backgroundColor: GRAY_100 },
  monthPillText: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground },

  yearScroll: { maxHeight: 240 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
  yearCell: { width: '22%', paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm, backgroundColor: GRAY_100 },
  yearCellActive: { backgroundColor: PURPLE_500 },
  yearText: { fontFamily: fonts.body, fontSize: 13, color: palette.foreground },
  yearTextActive: { color: '#fff', fontWeight: '800' },

  weekRow: { flexDirection: 'row', paddingVertical: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: GRAY_400, fontWeight: '700' },
  weekLabelSun: { color: '#EF4444' },
  weekLabelSat: { color: '#3B82F6' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  dayCellActive: { backgroundColor: PURPLE_500 },
  dayCellDisabled: { opacity: 0.35 },
  dayText: { fontFamily: fonts.body, fontSize: 14, color: palette.foreground },
  dayTextSun: { color: '#EF4444' },
  dayTextSat: { color: '#3B82F6' },
  dayTextActive: { color: '#fff', fontWeight: '900' },
  dayTextDisabled: { color: GRAY_300 },

  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1, paddingVertical: 12, borderRadius: radius.sm, alignItems: 'center' },
  buttonCancel: { backgroundColor: GRAY_100 },
  buttonCancelText: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.mutedForeground },
  buttonConfirm: { backgroundColor: PURPLE_500 },
  buttonConfirmText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#fff' },
  buttonDisabled: { opacity: 0.4 },
});
