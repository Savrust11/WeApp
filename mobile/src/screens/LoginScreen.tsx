import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Grape, MessageCircle, Globe, Apple, UserRound } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { loginWithGoogle, loginWithApple, getLineLoginUrl } from '../api/auth';
import { getBaseUrl } from '../api/client';
import { syncSharedData } from '../utils/sharedData';
import type { RootStackParamList } from '../navigation';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Button, Text, Title, Muted } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';

// Required for expo-auth-session to close the browser on redirect (native only).
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// ── Replace these with your actual Google OAuth client IDs ──
// Create them at: https://console.cloud.google.com/apis/credentials
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const { isDark, colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { setUser } = useAuthStore();
  const [lineLoading, setLineLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Google OAuth — native uses expo-auth-session popup; web uses direct redirect
  // to avoid Cross-Origin-Opener-Policy issues with Google's auth pages.
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_WEB_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
  });

  // Handle native Google OAuth response.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      if (authentication?.accessToken || authentication?.idToken) {
        handleGoogleToken(authentication.accessToken, authentication.idToken);
      } else {
        setGoogleLoading(false);
        Alert.alert('エラー', 'Googleトークンを取得できませんでした。');
      }
    } else if (googleResponse?.type === 'error') {
      setGoogleLoading(false);
      Alert.alert('エラー', 'Googleログインに失敗しました。');
    } else if (googleResponse?.type === 'dismiss') {
      setGoogleLoading(false);
    }
  }, [googleResponse]);

  // On web, check if we are returning from a Google OAuth redirect.
  // Google implicit flow puts the access_token in the URL hash fragment.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    if (accessToken) {
      // Clean the token out of the URL so it isn't leaked via Referer etc.
      window.history.replaceState(null, '', window.location.pathname);
      setGoogleLoading(true);
      handleGoogleToken(accessToken);
    }
  }, []);

  // Show Apple button on iOS regardless — isAvailableAsync() returns false in
  // Expo Go but works in development builds and production.
  useEffect(() => {
    if (Platform.OS === 'ios') {
      setAppleAvailable(true);
    }
  }, []);

  const saveAndLogin = async (token: string, user: any) => {
    await AsyncStorage.multiSet([
      ['sessionToken', token],
      ['familyId', String(user.familyId)],
      ['userRole', user.role ?? 'papa'],
      ['displayName', user.displayName ?? ''],
      ['pictureUrl', user.pictureUrl ?? ''],
    ]);
    setUser({
      id: user.id,
      lineUserId: '',
      displayName: user.displayName ?? '',
      pictureUrl: user.pictureUrl ?? undefined,
      familyId: String(user.familyId),
      role: user.role ?? 'papa',
      invitationVerified: user.invitationVerified ?? false,
    });
    syncSharedData(user.displayName);
  };

  // ── LINE ───────────────────────────────────────────────────────────────────
  const handleLineLogin = async () => {
    setLineLoading(true);
    try {
      const url = getLineLoginUrl(getBaseUrl());
      // Open in browser; the backend redirects to weyu://auth/callback,
      // which App.tsx intercepts and finishes the login.
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('エラー', 'LINEログインを開けませんでした。');
    } finally {
      setLineLoading(false);
    }
  };

  // ── Google ─────────────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert(
        'Google設定が必要',
        'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID を .env に設定してください。',
      );
      return;
    }
    setGoogleLoading(true);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // On web, use a full-page redirect instead of a popup to avoid
      // Google's Cross-Origin-Opener-Policy breaking the popup flow.
      const redirectUri = window.location.origin;
      const params = new URLSearchParams({
        client_id: GOOGLE_WEB_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: 'profile email',
        include_granted_scopes: 'true',
        prompt: 'select_account',
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return;
    }

    // On native, use server-side redirect flow (same as LINE login).
    // expo-auth-session's browser flow generates redirect URIs like
    // exp://ip:port that can't be registered in Google Console.
    try {
      const url = `${getBaseUrl()}/api/auth/google/native`;
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('エラー', 'Googleログインを開けませんでした。');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleToken = async (accessToken?: string, idToken?: string) => {
    try {
      const { token, user } = await loginWithGoogle({ accessToken, idToken });
      await saveAndLogin(token, user);
    } catch (err: any) {
      Alert.alert('エラー', `Googleログインに失敗しました: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Apple ──────────────────────────────────────────────────────────────────
  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      // Check real availability at call time (false in Expo Go, true in dev/prod builds).
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert(
          'Apple IDログイン',
          'Expo Goでは利用できません。開発ビルドまたは本番アプリでご利用ください。',
        );
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('エラー', 'Apple認証トークンを取得できませんでした。');
        return;
      }

      const { token, user } = await loginWithApple({
        identityToken: credential.identityToken,
        fullName: credential.fullName,
        email: credential.email,
      });
      await saveAndLogin(token, user);
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('エラー', `Apple IDログインに失敗しました: ${err.message}`);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // ── Guest ──────────────────────────────────────────────────────────────────
  const handleGuestLogin = () => navigation.navigate('Onboarding');

  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.background }]}>
      {/* Logo (web Onboarding: gradient circle + Grape, brand title + tagline) */}
      <View style={styles.logoArea}>
        <View style={styles.logoBadge}>
          <Grape size={48} color={palette.primary} strokeWidth={2} />
        </View>
        <Title style={styles.logo}>We育</Title>
        <Text style={styles.tagline}>パートナーと一緒に育児を楽しもう</Text>
      </View>

      {/* Login buttons */}
      <View style={styles.buttonArea}>
        {/* LINE */}
        <Button
          onPress={handleLineLogin}
          disabled={lineLoading}
          style={styles.lineButton}
        >
          {lineLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MessageCircle size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.lineButtonText}>LINEでログイン</Text>
            </>
          )}
        </Button>

        {/* Google */}
        <Button
          variant="outline"
          onPress={handleGoogleLogin}
          disabled={googleLoading}
          style={styles.googleButton}
        >
          {googleLoading ? (
            <ActivityIndicator color={palette.foreground} />
          ) : (
            <>
              <Globe size={20} color={palette.foreground} strokeWidth={2} />
              <Text style={styles.googleButtonText}>Googleでログイン</Text>
            </>
          )}
        </Button>

        {/* Apple (iOS only) */}
        {appleAvailable && (
          <Button
            onPress={handleAppleLogin}
            disabled={appleLoading}
            style={styles.appleButton}
          >
            {appleLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Apple size={20} color="#fff" strokeWidth={2} />
                <Text style={styles.appleButtonText}>Apple IDでログイン</Text>
              </>
            )}
          </Button>
        )}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Muted style={styles.dividerText}>または</Muted>
          <View style={styles.dividerLine} />
        </View>

        {/* Guest */}
        <Button
          variant="outline"
          onPress={handleGuestLogin}
          style={styles.guestButton}
        >
          <UserRound size={18} color={palette.primary} strokeWidth={2} />
          <Text style={styles.guestButtonText}>ゲストとして続ける</Text>
        </Button>
      </View>

      <Muted style={styles.terms}>
        ログインすることで、利用規約とプライバシーポリシーに同意したことになります。
      </Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBadge: {
    width: 104,
    height: 104,
    borderRadius: radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: palette.card,
    marginBottom: 16,
    ...shadows.soft,
  },
  logo: {
    fontFamily: fonts.sans,
    fontSize: 40,
    color: palette.accentForeground,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.primary,
    textAlign: 'center',
  },
  buttonArea: {
    width: '100%',
    gap: 12,
  },
  // LINE — matches web Onboarding LINE button (#06C755)
  lineButton: {
    backgroundColor: '#06C755',
    borderColor: '#06C755',
    borderRadius: radius.md,
    paddingVertical: 16,
    ...shadows.soft,
  },
  lineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.sans,
  },
  // Google
  googleButton: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  googleButtonText: {
    color: palette.foreground,
    fontSize: 16,
    fontFamily: fonts.bodySemibold,
  },
  // Apple
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.bodySemibold,
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
  },
  // Guest
  guestButton: {
    backgroundColor: 'transparent',
    borderColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  guestButtonText: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: fonts.bodySemibold,
  },
  terms: {
    marginTop: 36,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
