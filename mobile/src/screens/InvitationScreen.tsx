import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Grape, ShieldCheck, Users, Copy, Share2, RefreshCw } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { getBaseUrl } from '../api/client';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Screen, Card, Button, Text, Title, Muted } from '../theme/ui';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function InvitationScreen() {
  const navigation = useNavigation();
  const { user, setUser } = useAuthStore();

  const [tab, setTab] = useState<'enter' | 'generate'>('enter');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Enter invitation code (partner joins existing family) ──────────────────
  const handleVerify = async () => {
    if (!code.trim()) {
      showAlert('エラー', '招待コードを入力してください。');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('sessionToken');
      const res = await fetch(`${getBaseUrl()}/api/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        showAlert('エラー', data.message ?? '招待コードの確認に失敗しました。');
        return;
      }

      // Update familyId in AsyncStorage and store.
      if (data.familyId) {
        await AsyncStorage.setItem('familyId', data.familyId);
        if (user) {
          setUser({ ...user, familyId: data.familyId, invitationVerified: true });
        }
      }

      showAlert('完了', 'パートナーの家族に参加しました！');
      navigation.goBack();
    } catch {
      showAlert('エラー', 'ネットワークエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  // ── Generate invitation code (first user invites partner) ─────────────────
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('sessionToken');
      const res = await fetch(`${getBaseUrl()}/api/auth/generate-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        showAlert('エラー', data.message ?? '招待コードの生成に失敗しました。');
        return;
      }

      setGeneratedCode(data.code);
    } catch {
      showAlert('エラー', 'ネットワークエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!generatedCode) return;
    const message = `We育アプリの招待コードです: ${generatedCode}\nアプリをダウンロードして、このコードを入力してください！`;
    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(generatedCode);
        showAlert('コピー完了', '招待コードをコピーしました。');
      }
    } else {
      await Share.share({ message });
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      {/* Header — web InvitationCode: gradient circle + Grape icon + title */}
      <View style={styles.headerWrap}>
        <View style={styles.logoCircle}>
          <Grape size={36} color={palette.primary} />
        </View>
        <Title style={styles.title}>We育</Title>
        <Muted style={styles.subtitle}>
          ふたりで育てる、ふたりで楽しむ
        </Muted>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'enter' && styles.tabActive]}
          onPress={() => setTab('enter')}
        >
          <Text style={[styles.tabText, tab === 'enter' && styles.tabTextActive]}>
            コードを入力
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'generate' && styles.tabActive]}
          onPress={() => setTab('generate')}
        >
          <Text style={[styles.tabText, tab === 'generate' && styles.tabTextActive]}>
            コードを発行
          </Text>
        </TouchableOpacity>
      </View>

      {/* Enter code */}
      {tab === 'enter' && (
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <ShieldCheck size={20} color={palette.primary} />
            <Text style={styles.cardTitle}>招待コードを入力してください</Text>
          </View>
          <Muted style={styles.cardSubtitle}>
            パートナーから受け取ったコードを入力すると、同じ家族として繋がれます。
          </Muted>
          <TextInput
            style={styles.codeInput}
            placeholder="例: BUDOU-A3K9"
            placeholderTextColor={palette.mutedForeground}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
          />
          <Button
            onPress={handleVerify}
            disabled={!code.trim() || loading}
            style={styles.fullBtn}
          >
            {loading ? (
              <ActivityIndicator color={palette.primaryForeground} />
            ) : (
              <Text style={styles.primaryBtnText}>確認</Text>
            )}
          </Button>
        </Card>
      )}

      {/* Generate code */}
      {tab === 'generate' && (
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Users size={20} color={palette.primary} />
            <Text style={styles.cardTitle}>招待コードを発行する</Text>
          </View>
          <Muted style={styles.cardSubtitle}>
            コードをパートナーに送ってください。パートナーがコードを入力すると、あなたの家族に参加できます。
          </Muted>

          {generatedCode ? (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeBoxText}>{generatedCode}</Text>
              </View>
              <Button onPress={handleShare} style={styles.fullBtn}>
                {Platform.OS === 'web' ? (
                  <Copy size={18} color={palette.primaryForeground} />
                ) : (
                  <Share2 size={18} color={palette.primaryForeground} />
                )}
                <Text style={styles.primaryBtnText}>
                  {Platform.OS === 'web' ? 'コードをコピー' : 'シェアする'}
                </Text>
              </Button>
              <Button
                variant="outline"
                onPress={() => setGeneratedCode(null)}
                style={styles.fullBtn}
              >
                <RefreshCw size={16} color={palette.foreground} />
                <Text style={styles.secondaryBtnText}>別のコードを発行</Text>
              </Button>
            </>
          ) : (
            <Button
              onPress={handleGenerate}
              disabled={loading}
              style={styles.fullBtn}
            >
              {loading ? (
                <ActivityIndicator color={palette.primaryForeground} />
              ) : (
                <Text style={styles.primaryBtnText}>コードを発行する</Text>
              )}
            </Button>
          )}
        </Card>
      )}

      <Muted style={styles.helpText}>
        招待コードをお持ちでない方は、We育のLINE公式アカウントにお問い合わせください
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },

  // Header (web: gradient circle w-20 h-20, border-4 border-white)
  headerWrap: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: palette.card,
    marginBottom: 16,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // web: text-2xl font-black text-purple-700
  title: { fontSize: 24, color: '#6B21A8', marginBottom: 4, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: '#C084FC', // web: text-purple-400
    fontFamily: fonts.bodyBold,
    textAlign: 'center',
  },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 4,
    marginBottom: 24,
    width: '100%',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: palette.primary },
  tabText: { fontSize: 14, fontFamily: fonts.bodySemibold, color: palette.primary },
  tabTextActive: { color: palette.primaryForeground },

  // web: rounded-[24px] border border-purple-100
  card: { width: '100%', padding: 24, gap: 16, borderRadius: radius.lg, borderColor: '#E9D5FF' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.sans,
    fontWeight: '700',
    color: '#1F2937', // web: text-gray-800
    flex: 1,
  },
  cardSubtitle: { fontSize: 13, color: palette.mutedForeground, lineHeight: 20 },

  codeInput: {
    backgroundColor: palette.muted,
    borderRadius: radius.sm,
    padding: 16,
    fontSize: 20,
    fontFamily: fonts.bodyBold,
    letterSpacing: 4,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: palette.border,
    color: palette.foreground,
  },
  codeBox: {
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.primary,
    borderStyle: 'dashed',
  },
  codeBoxText: {
    fontSize: 28,
    fontFamily: fonts.bodyBold,
    letterSpacing: 6,
    color: palette.primary,
  },

  fullBtn: { width: '100%', minHeight: 48 },
  primaryBtnText: {
    color: palette.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.bodySemibold,
  },
  secondaryBtnText: {
    color: palette.foreground,
    fontSize: 14,
    fontFamily: fonts.bodySemibold,
  },

  helpText: {
    fontSize: 12,
    color: palette.mutedForeground,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 19,
    paddingHorizontal: 16,
  },
});
