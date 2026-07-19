/**
 * 音声アシスタント連携画面（Siri / Google Assistant）
 *
 * Phase 1: Siri（iOS）・Google Assistant（Android）
 *   → weyu:// ディープリンクをショートカットに登録することで音声操作を実現。
 *
 * 仕組み:
 *   ① We育はすべての記録操作に weyu://log/TYPE という URL スキームを持つ
 *   ② Siri ショートカット → URL を開く → weyu://log/breast
 *   ③ Google Assistant → App Actions（shortcuts.xml）→ 同 URL
 *   ④ アプリが URL を受け取り自動でログ記録する
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  Alert,
  Share,
} from 'react-native';
import {
  Mic,
  Apple,
  Bot,
  ChevronRight,
  Milk,
  Droplet,
  Moon,
  ChartColumn,
  type LucideIcon,
} from 'lucide-react-native';
import { palette, fonts, radius } from '../theme/tokens';
import { Card, CardContent, Button, Badge, Text, Title, Muted } from '../theme/ui';

interface ShortcutDef {
  label: string;
  Icon: LucideIcon;
  url: string;
  voiceExample: string;
}

const SHORTCUTS: ShortcutDef[] = [
  {
    label: '母乳を記録',
    Icon: Milk,
    url: 'weyu://log/breastfeed',
    voiceExample: '「We育で母乳を記録して」',
  },
  {
    label: 'ミルクを記録',
    Icon: Milk,
    url: 'weyu://log/formula',
    voiceExample: '「We育でミルクを記録して」',
  },
  {
    label: 'おしっこを記録',
    Icon: Droplet,
    url: 'weyu://log/diaper_wet',
    voiceExample: '「We育でおしっこを記録して」',
  },
  {
    label: 'うんちを記録',
    Icon: Droplet,
    url: 'weyu://log/diaper_poop',
    voiceExample: '「We育でうんちを記録して」',
  },
  {
    label: '睡眠を記録',
    Icon: Moon,
    url: 'weyu://log/sleep',
    voiceExample: '「We育で寝た」',
  },
  {
    label: '今の状態を確認',
    Icon: ChartColumn,
    url: 'weyu://status',
    voiceExample: '「We育の今の状態は？」',
  },
];

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function ShortcutsScreen() {
  const [testResult, setTestResult] = useState<string | null>(null);

  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  const testShortcut = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      setTestResult(`${url} を開きました`);
    } else {
      setTestResult(`${url} を開けませんでした`);
    }
  };

  const handleShareURL = async (shortcut: ShortcutDef) => {
    const message = `We育 ショートカット: ${shortcut.label}\n${shortcut.url}`;
    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shortcut.url);
        showAlert('コピー完了', `${shortcut.url} をコピーしました。`);
      }
    } else {
      await Share.share({ message });
    }
  };

  const openSiriSettings = () => {
    if (isIOS) {
      Linking.openURL('App-Prefs:SIRI');
    }
  };

  const openAssistantSettings = () => {
    if (isAndroid) {
      Linking.openURL('android-app://com.google.android.googlequicksearchbox');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTitleRow}>
          <Mic size={20} color={palette.primary} strokeWidth={2} />
          <Text style={styles.headerTitle}>音声アシスタント連携</Text>
        </View>
        <Muted style={styles.headerText}>
          Siri や Google Assistant に We育 のショートカットを登録すると、
          声だけで育児を記録できます。
        </Muted>
      </View>

      {/* Phase badge */}
      <Badge style={styles.phaseBadge} textStyle={styles.phaseBadgeText}>
        Phase 1: Siri / Google Assistant 対応中
      </Badge>

      {/* iOS: Siri setup */}
      {(isIOS || Platform.OS === 'web') && (
        <Card style={styles.section}>
          <CardContent style={styles.sectionContent}>
            <View style={styles.sectionTitleRow}>
              <Apple size={18} color={palette.foreground} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Siri ショートカットの設定方法</Text>
            </View>
            <View style={styles.stepList}>
              <Muted style={styles.stepItem}>① 下の「URL をコピー」をタップ</Muted>
              <Muted style={styles.stepItem}>② iPhone の設定 → Siri と検索</Muted>
              <Muted style={styles.stepItem}>③「ショートカットを追加」→「URL を開く」</Muted>
              <Muted style={styles.stepItem}>④ コピーした URL を貼り付け</Muted>
              <Muted style={styles.stepItem}>⑤ 「"We育で母乳を記録して"」などと命名</Muted>
            </View>
            {isIOS && (
              <Button variant="ghost" style={styles.settingsBtn} onPress={openSiriSettings}>
                <Text style={styles.settingsBtnText}>Siri 設定を開く</Text>
                <ChevronRight size={16} color={palette.primary} strokeWidth={2.5} />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Android: Google Assistant setup */}
      {(isAndroid || Platform.OS === 'web') && (
        <Card style={styles.section}>
          <CardContent style={styles.sectionContent}>
            <View style={styles.sectionTitleRow}>
              <Bot size={18} color={palette.foreground} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Google Assistant の設定方法</Text>
            </View>
            <View style={styles.stepList}>
              <Muted style={styles.stepItem}>① Google アシスタントを起動</Muted>
              <Muted style={styles.stepItem}>② プロフィール → ルーティン → ショートカット</Muted>
              <Muted style={styles.stepItem}>③「新しいショートカットを追加」</Muted>
              <Muted style={styles.stepItem}>④ コマンド例: "We育で寝た"</Muted>
              <Muted style={styles.stepItem}>⑤ アクション: アプリを開く → We育 URL</Muted>
            </View>
            {isAndroid && (
              <Button variant="ghost" style={styles.settingsBtn} onPress={openAssistantSettings}>
                <Text style={styles.settingsBtnText}>Google アシスタントを開く</Text>
                <ChevronRight size={16} color={palette.primary} strokeWidth={2.5} />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shortcut list */}
      <Text style={styles.listTitle}>利用可能なショートカット</Text>
      {SHORTCUTS.map((s) => {
        const Icon = s.Icon;
        return (
          <Card key={s.url} style={styles.shortcutCard}>
            <CardContent style={styles.shortcutContent}>
              <View style={styles.shortcutLeft}>
                <View style={styles.shortcutIconWrap}>
                  <Icon size={22} color={palette.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shortcutLabel}>{s.label}</Text>
                  <Text style={styles.shortcutVoice}>{s.voiceExample}</Text>
                  <Muted style={styles.shortcutUrl}>{s.url}</Muted>
                </View>
              </View>
              <View style={styles.shortcutBtns}>
                <Button
                  variant="ghost"
                  style={styles.copyBtn}
                  onPress={() => handleShareURL(s)}
                >
                  <Text style={styles.copyBtnText}>
                    {Platform.OS === 'web' ? 'コピー' : 'シェア'}
                  </Text>
                </Button>
                {Platform.OS !== 'web' && (
                  <Button
                    variant="ghost"
                    style={styles.testBtn}
                    onPress={() => testShortcut(s.url)}
                  >
                    <Text style={styles.testBtnText}>テスト</Text>
                  </Button>
                )}
              </View>
            </CardContent>
          </Card>
        );
      })}

      {testResult && (
        <View style={styles.testResult}>
          <Muted style={styles.testResultText}>{testResult}</Muted>
        </View>
      )}

      {/* Phase 2 notice */}
      <View style={styles.phase2Card}>
        <Text style={styles.phase2Title}>Phase 2 予定: Amazon Alexa 対応</Text>
        <Muted style={styles.phase2Text}>
          Alexa スキルとして We育 を登録予定です。「アレクサ、We育で母乳を記録して」が使えるようになります。
        </Muted>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 60 },

  headerCard: {
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 16,
    marginBottom: 12,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  headerTitle: { fontFamily: fonts.sans, fontSize: 17, color: palette.accentForeground },
  headerText: { fontSize: 13, color: palette.foreground, lineHeight: 20 },

  phaseBadge: {
    backgroundColor: palette.primary,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  phaseBadgeText: { color: palette.primaryForeground, fontSize: 12, fontFamily: fonts.bodyBold },

  section: { marginBottom: 16 },
  sectionContent: { padding: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.sans, fontSize: 15, color: palette.foreground },
  stepList: { gap: 6, marginBottom: 12 },
  stepItem: { fontSize: 13, color: palette.foreground, lineHeight: 20 },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    minHeight: undefined,
  },
  settingsBtnText: { color: palette.primary, fontFamily: fonts.bodyBold, fontSize: 13 },

  listTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.foreground,
    marginBottom: 10,
    marginTop: 4,
  },
  shortcutCard: { marginBottom: 10 },
  shortcutContent: { padding: 14 },
  shortcutLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  shortcutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: { fontFamily: fonts.sans, fontSize: 15, color: palette.foreground },
  shortcutVoice: { fontFamily: fonts.bodySemibold, fontSize: 12, color: palette.primary, marginTop: 2 },
  shortcutUrl: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shortcutBtns: { flexDirection: 'row', gap: 8 },
  copyBtn: {
    flex: 1,
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    paddingVertical: 8,
    minHeight: undefined,
  },
  copyBtnText: { color: palette.primary, fontFamily: fonts.bodyBold, fontSize: 13 },
  testBtn: {
    flex: 1,
    backgroundColor: '#E7F3EC',
    borderRadius: radius.sm,
    paddingVertical: 8,
    minHeight: undefined,
  },
  testBtnText: { color: palette.secondary, fontFamily: fonts.bodyBold, fontSize: 13 },

  testResult: {
    backgroundColor: palette.muted,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
  },
  testResultText: {
    fontSize: 12,
    color: palette.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  phase2Card: {
    backgroundColor: '#FBF3DD',
    borderRadius: radius.sm,
    padding: 14,
    marginTop: 8,
  },
  phase2Title: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#8A6D1D', marginBottom: 6 },
  phase2Text: { fontSize: 12, color: '#7A5C30', lineHeight: 18 },
});
