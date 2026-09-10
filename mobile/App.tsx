import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';

import { useFonts as useMPlus, MPLUSRounded1c_400Regular, MPLUSRounded1c_500Medium, MPLUSRounded1c_700Bold } from '@expo-google-fonts/m-plus-rounded-1c';
import { useFonts as useNunito, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';

import './src/i18n';
import AppNavigator from './src/navigation';
import { useAuthStore } from './src/store/authStore';
import { getBaseUrl } from './src/api/client';
import { scheduleNextFeedingAlarm } from './src/utils/alarmManager';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { ToastProvider } from './src/components/Toast';
import FamilyIdMigrationBanner from './src/components/FamilyIdMigrationBanner';

// Configure how push notifications are displayed when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

/** Register for Expo push notifications and save the token to the server. */
async function registerPushToken(sessionToken: string | null) {
  if (Platform.OS === 'web') return; // Push notifications not supported on web

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expoPushToken = tokenData.data;

    if (!sessionToken || !expoPushToken) return;

    await fetch(`${getBaseUrl()}/api/auth/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ token: expoPushToken }),
    });
  } catch {
    // Silently ignore — push token registration is best-effort.
  }
}

/** Check for OTA updates and reload if one is available. */
async function checkForOTAUpdate() {
  if (__DEV__) return; // Updates are only available in production/preview builds
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Running in a context where updates are unavailable (e.g. Expo Go) — ignore.
  }
}

/**
 * 音声コマンドのディープリンクハンドラー
 * weyu://log/TYPE → 認証済みならそのままサーバーにログを記録する
 * 例: weyu://log/breastfeed, weyu://log/formula, weyu://log/diaper_wet
 */
async function handleVoiceLogLink(url: string): Promise<boolean> {
  const match = url.match(/^weyu:\/\/log\/([a-z_]+)/);
  if (!match) return false;

  const type = match[1];
  const token = await AsyncStorage.getItem('sessionToken');
  const familyId = await AsyncStorage.getItem('familyId');
  if (!token || !familyId) return false;

  try {
    const res = await fetch(`${getBaseUrl()}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, familyId, userId: 'voice', points: 1 }),
    });

    if (res.ok) {
      const log = await res.json();
      const FEEDING = new Set(['breastfeed', 'formula', 'expressed']);
      if (FEEDING.has(type)) {
        scheduleNextFeedingAlarm(new Date(log.createdAt)).catch(() => {});
      }
    }
  } catch {
    // ベストエフォート — 音声ログ失敗はサイレントスキップ
  }
  return true;
}

function AppContent() {
  const { loadFromStorage, setUser } = useAuthStore();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Handle deep link callbacks (e.g. weyu://auth/callback?token=...&familyId=...)
  const handleDeepLink = async (url: string) => {
    // 音声コマンド: weyu://log/TYPE
    if (url.startsWith('weyu://log/') || url.startsWith('weyu://status')) {
      await handleVoiceLogLink(url);
      return;
    }

    if (!url.startsWith('weyu://auth/callback')) return;

    const queryString = url.split('?')[1];
    if (!queryString) return;

    const params = Object.fromEntries(
      queryString.split('&').map((pair) => {
        const [key, value] = pair.split('=');
        return [key, decodeURIComponent(value ?? '')];
      }),
    );

    const { token, familyId, role, displayName, pictureUrl, userId, invitationVerified } = params;
    if (!token || !familyId) return;

    await AsyncStorage.multiSet([
      ['sessionToken', token],
      ['familyId', familyId],
      ['userRole', role ?? 'papa'],
      ['displayName', displayName ?? ''],
      ['pictureUrl', pictureUrl ?? ''],
    ]);

    setUser({
      id: parseInt(userId ?? '0'),
      lineUserId: '',
      displayName: displayName ?? '',
      pictureUrl: pictureUrl ?? undefined,
      familyId: familyId,
      role: (role as 'papa' | 'mama') ?? 'papa',
      invitationVerified: invitationVerified === 'true',
    });

    // Register push token after login.
    registerPushToken(token);
  };

  useEffect(() => {
    // Check for OTA update on startup.
    checkForOTAUpdate();

    loadFromStorage().then(async () => {
      // Register push token after restoring session.
      const token = await AsyncStorage.getItem('sessionToken');
      registerPushToken(token);
    });

    // Handle the URL that launched the app (cold start from deep link).
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle deep links while the app is already running.
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // Listen for incoming push notifications (foreground).
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Notification received while app is open — the handler above already shows it.
    });

    // Listen for user tapping on a push notification.
    responseListener.current = Notifications.addNotificationResponseReceivedListener((_response) => {
      // Could navigate to a specific screen here if needed.
    });

    return () => {
      sub.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <>
      <AppNavigator />
      <FamilyIdMigrationBanner />
    </>
  );
}

export default function App() {
  const [mplusLoaded] = useMPlus({
    MPLUSRounded1c_400Regular,
    MPLUSRounded1c_500Medium,
    MPLUSRounded1c_700Bold,
  });
  const [nunitoLoaded] = useNunito({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  // Hold the splash until web fonts are ready so type doesn't flash/reflow.
  if (!mplusLoaded || !nunitoLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <StatusBar style="light" />
            <AppContent />
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
