/**
 * Lightweight in-app toast for mobile — mirrors the web app's
 * `toast({ title, description })` shown after actions like recording a log.
 *
 * Web reference: client/src/hooks/use-app-data.ts:139-144 uses
 *   toast({ title: `ナイス連携！${points}pt獲得！`,
 *           description: `${typeLabel}を記録しました。お疲れ様です！`,
 *           className: 'bg-purple-50 border-purple-100 text-purple-900',
 *           duration: 2000 })
 *
 * Usage:
 *   1. Wrap the app root in <ToastProvider>{...}</ToastProvider>
 *   2. In any screen: const toast = useToast(); toast.show({ title, description });
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius } from '../theme/tokens';

type ToastPayload = {
  title: string;
  description?: string;
  duration?: number;
};

type ToastContextValue = {
  show: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -16, duration: 250, useNativeDriver: true }),
    ]).start(() => setPayload(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (p: ToastPayload) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPayload(p);
      opacity.setValue(0);
      translateY.setValue(-16);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      timeoutRef.current = setTimeout(dismiss, p.duration ?? 2000);
    },
    [dismiss, opacity, translateY],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {payload && (
        <SafeAreaView
          edges={['top']}
          style={styles.overlay}
          pointerEvents="none"
        >
          <Animated.View
            style={[styles.toast, { opacity, transform: [{ translateY }] }]}
          >
            <Text style={styles.title} numberOfLines={2}>
              {payload.title}
            </Text>
            {payload.description ? (
              <Text style={styles.description} numberOfLines={3}>
                {payload.description}
              </Text>
            ) : null}
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

// Colors mirror web `bg-purple-50 border-purple-100 text-purple-900`.
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    marginTop: 8,
    marginHorizontal: 16,
    maxWidth: '92%',
    backgroundColor: '#FAF5FF',
    borderColor: '#F3E8FF',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#581C87',
    marginBottom: 2,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#6B21A8',
  },
});
