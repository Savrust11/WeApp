/**
 * ぴよログデータ移行画面
 *
 * 手順:
 *  1. ぴよログアプリ → 設定 → バックアップ → テキスト形式でエクスポート
 *  2. 届いたメールからテキストをコピー
 *  3. この画面に貼り付け → プレビュー確認 → インポート
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { ClipboardList, ArrowRight, ArrowLeft, PartyPopper } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { getBaseUrl } from '../api/client';
import { palette, fonts, radius } from '../theme/tokens';
import { Card, CardContent, Button, Text, Title, Muted } from '../theme/ui';

interface PreviewEntry {
  dateTime: string;
  type: string;
  rawCategory: string;
  detail: string;
}

interface PreviewResult {
  preview: PreviewEntry[];
  totalEntries: number;
  skipped: number;
  errors: string[];
}

const TYPE_LABEL: Record<string, string> = {
  breastfeed: '🤱 母乳',
  formula: '🍼 ミルク',
  expressed: '🍶 搾乳',
  diaper_wet: '💧 おしっこ',
  diaper_poop: '💩 うんち',
  sleep: '😴 睡眠',
  temperature: '🌡️ 体温',
  food: '🥣 離乳食',
  medicine: '💊 薬',
  bath: '🛁 お風呂',
  growth: '📏 成長',
  symptoms: '🏥 症状',
};

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function ImportScreen() {
  const { user } = useAuthStore();
  const { activeChildId } = useChildStore();

  const [step, setStep] = useState<'paste' | 'preview' | 'done'>('paste');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  const getHeaders = async () => {
    const token = await AsyncStorage.getItem('sessionToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handlePreview = async () => {
    if (!text.trim()) {
      showAlert('エラー', 'テキストを貼り付けてください。');
      return;
    }
    if (!user?.familyId || !activeChildId) {
      showAlert('エラー', '子どもを選択してから実行してください。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/import/piyolog`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          text,
          familyId: user.familyId,
          childId: activeChildId,
          userId: String(user.id),
          dryRun: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        showAlert('エラー', err.message ?? 'プレビューに失敗しました。');
        return;
      }

      const data: PreviewResult = await res.json();
      if (data.totalEntries === 0) {
        showAlert('データなし', '読み取れる記録が見つかりませんでした。\nぴよログのエクスポートテキストをそのまま貼り付けてください。');
        return;
      }

      setPreview(data);
      setStep('preview');
    } catch {
      showAlert('エラー', 'ネットワークエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !user?.familyId || !activeChildId) return;

    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/import/piyolog`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          text,
          familyId: user.familyId,
          childId: activeChildId,
          userId: String(user.id),
          dryRun: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        showAlert('エラー', err.message ?? 'インポートに失敗しました。');
        return;
      }

      const data = await res.json();
      setStep('done');
      showAlert(
        'インポート完了 🎉',
        `${data.imported}件の記録をインポートしました。\n（スキップ: ${data.skipped}件）`,
      );
    } catch {
      showAlert('エラー', 'ネットワークエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Step 1: Paste */}
      {step === 'paste' && (
        <>
          <View style={styles.stepCard}>
            <View style={styles.stepTitleRow}>
              <ClipboardList size={18} color={palette.primary} strokeWidth={2} />
              <Text style={styles.stepTitle}>ぴよログからエクスポートする方法</Text>
            </View>
            <View style={styles.stepList}>
              <Muted style={styles.stepItem}>① ぴよログアプリを開く</Muted>
              <Muted style={styles.stepItem}>② 設定 → バックアップ・引継ぎ</Muted>
              <Muted style={styles.stepItem}>③「テキスト形式でバックアップ」を選択</Muted>
              <Muted style={styles.stepItem}>④ メールで送信 → テキストをコピー</Muted>
              <Muted style={styles.stepItem}>⑤ 下のボックスに貼り付け</Muted>
            </View>
          </View>

          <Text style={styles.label}>ぴよログのテキストを貼り付けてください</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={12}
            placeholder="ここに貼り付け..."
            placeholderTextColor={palette.mutedForeground}
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
          <Muted style={styles.charCount}>{text.length.toLocaleString()} 文字</Muted>

          <Button
            onPress={handlePreview}
            disabled={!text.trim() || loading}
            style={styles.primaryBtn}
          >
            {loading ? (
              <ActivityIndicator color={palette.primaryForeground} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>内容を確認する</Text>
                <ArrowRight size={18} color={palette.primaryForeground} strokeWidth={2.5} />
              </>
            )}
          </Button>
        </>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <>
          <Card style={styles.summaryCard}>
            <CardContent style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>インポート内容の確認</Text>
              <View style={styles.summaryRow}>
                <Muted style={styles.summaryLabel}>取り込み件数</Muted>
                <Text style={styles.summaryValue}>{preview.totalEntries}件</Text>
              </View>
              <View style={styles.summaryRow}>
                <Muted style={styles.summaryLabel}>スキップ</Muted>
                <Text style={styles.summaryValue}>{preview.skipped}件</Text>
              </View>
              {preview.errors.length > 0 && (
                <View style={styles.summaryRow}>
                  <Muted style={[styles.summaryLabel, { color: palette.destructive }]}>エラー</Muted>
                  <Text style={[styles.summaryValue, { color: palette.destructive }]}>
                    {preview.errors.length}件
                  </Text>
                </View>
              )}
            </CardContent>
          </Card>

          <Muted style={styles.previewSubtitle}>
            最初の{Math.min(preview.preview.length, 20)}件のプレビュー
          </Muted>
          {preview.preview.map((entry, i) => (
            <View key={i} style={styles.previewRow}>
              <Muted style={styles.previewDate}>{formatDate(entry.dateTime)}</Muted>
              <Text style={styles.previewType}>
                {TYPE_LABEL[entry.type] ?? entry.type}
              </Text>
              {entry.detail ? (
                <Muted style={styles.previewDetail}>{entry.detail}</Muted>
              ) : null}
            </View>
          ))}

          <View style={styles.btnRow}>
            <Button
              variant="outline"
              style={styles.secondaryBtn}
              onPress={() => { setStep('paste'); setPreview(null); }}
            >
              <ArrowLeft size={16} color={palette.primary} strokeWidth={2.5} />
              <Text style={styles.secondaryBtnText}>戻る</Text>
            </Button>
            <Button
              style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }]}
              onPress={handleImport}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={palette.primaryForeground} />
              ) : (
                <Text style={styles.primaryBtnText}>インポートする</Text>
              )}
            </Button>
          </View>
        </>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <View style={styles.doneCard}>
          <View style={styles.doneIconWrap}>
            <PartyPopper size={48} color={palette.primary} strokeWidth={2} />
          </View>
          <Title style={styles.doneTitle}>インポート完了！</Title>
          <Muted style={styles.doneSub}>
            ぴよログのデータが We育 に取り込まれました。{'\n'}
            ホーム画面でタイムラインを確認してください。
          </Muted>
          <Button
            style={[styles.primaryBtn, { marginTop: 24 }]}
            onPress={() => { setStep('paste'); setText(''); setPreview(null); }}
          >
            <Text style={styles.primaryBtnText}>別のデータをインポート</Text>
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 60 },

  stepCard: {
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 16,
    marginBottom: 20,
  },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stepTitle: { fontFamily: fonts.sans, fontSize: 15, color: palette.accentForeground },
  stepList: { gap: 6 },
  stepItem: { fontSize: 13, color: palette.foreground, lineHeight: 20 },

  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground, marginBottom: 8 },
  textArea: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 13,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 200,
    color: palette.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },

  summaryCard: { marginBottom: 16 },
  summaryContent: { padding: 16 },
  summaryTitle: { fontFamily: fonts.sans, fontSize: 15, color: palette.foreground, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 14, color: palette.mutedForeground },
  summaryValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground },

  previewSubtitle: { fontSize: 13, marginBottom: 10 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 6,
    gap: 8,
  },
  previewDate: { fontSize: 12, color: palette.mutedForeground, width: 72 },
  previewType: { fontFamily: fonts.bodySemibold, fontSize: 13, color: palette.foreground, flex: 1 },
  previewDetail: { fontSize: 12 },

  btnRow: { flexDirection: 'row', marginTop: 20, marginBottom: 20, alignItems: 'center' },
  primaryBtn: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    borderRadius: radius.sm,
    paddingVertical: 16,
    marginTop: 8,
  },
  primaryBtnText: { color: palette.primaryForeground, fontSize: 16, fontFamily: fonts.sans },
  secondaryBtn: {
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderColor: palette.primary,
  },
  secondaryBtnText: { color: palette.primary, fontSize: 14, fontFamily: fonts.bodySemibold },

  doneCard: { alignItems: 'center', paddingTop: 40 },
  doneIconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  doneTitle: { fontFamily: fonts.sans, fontSize: 24, color: palette.accentForeground, marginBottom: 8 },
  doneSub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
