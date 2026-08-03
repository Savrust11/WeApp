/**
 * Web-parity UI kit — React Native ports of the web app's shadcn/ui primitives
 * (client/src/components/ui/*). Sizing/radii/typography are taken verbatim from
 * the web Tailwind classes so screens that use these render identically to web.
 *
 *   Card    : rounded-xl(12) border bg-card shadow-sm
 *   Button  : rounded-md(6) text-sm font-medium; default min-h-9 px-4 py-2
 *   Badge   : rounded-md(6) px-2.5 py-0.5 text-xs font-semibold
 *   Screen  : page background = web --background (#FAF9FB)
 *   Text/Title/Muted : M PLUS Rounded 1c (headings) / Nunito (body)
 */
import React from 'react';
import {
  View,
  Text as RNText,
  Pressable,
  StyleSheet,
  ScrollView,
  ViewProps,
  TextProps,
  PressableProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { palette, fonts, radius, shadows } from './tokens';
import { useTheme } from '../contexts/ThemeContext';

// ── Text ─────────────────────────────────────────────────────────────────────
// Web: body uses Nunito (--font-body); headings use M PLUS Rounded 1c (--font-sans)
// All text primitives pick their color from useTheme() so screens in dark mode
// get near-white text without every caller having to override manually.

export function Text({ style, ...p }: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[styles.body, { color: colors.text }, style]} {...p} />;
}

export function Title({
  style,
  ...p
}: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[styles.title, { color: colors.text }, style]} {...p} />;
}

export function Muted({ style, ...p }: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[styles.muted, { color: colors.textMuted }, style]} {...p} />;
}

// ── Screen container ─────────────────────────────────────────────────────────

export function Screen({
  children,
  scroll = true,
  contentStyle,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }, style]}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, styles.screenContent, { backgroundColor: colors.background }, style]}>{children}</View>;
}

// ── Card (web: shadcn Card) ──────────────────────────────────────────────────

export function Card({ style, children, ...p }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]} {...p}>
      {children}
    </View>
  );
}
export function CardHeader({ style, ...p }: ViewProps) {
  return <View style={[styles.cardHeader, style]} {...p} />;
}
export function CardTitle({ style, ...p }: TextProps) {
  return <RNText style={[styles.cardTitle, style]} {...p} />;
}
export function CardDescription({ style, ...p }: TextProps) {
  return <RNText style={[styles.cardDescription, style]} {...p} />;
}
export function CardContent({ style, ...p }: ViewProps) {
  return <View style={[styles.cardContent, style]} {...p} />;
}

// ── Button (web: shadcn Button cva) ──────────────────────────────────────────

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export function Button({
  variant = 'default',
  size = 'default',
  style,
  textStyle,
  children,
  disabled,
  ...p
}: PressableProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  textStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}) {
  const v = BTN_VARIANT[variant];
  const s = BTN_SIZE[size];
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btnBase,
        v.container,
        s.container,
        disabled && styles.btnDisabled,
        pressed && styles.btnPressed,
        style as any,
      ]}
      disabled={disabled}
      {...p}
    >
      {typeof children === 'string' ? (
        <RNText style={[styles.btnText, v.text, s.text, textStyle]}>{children}</RNText>
      ) : (
        children
      )}
    </Pressable>
  );
}

// ── Badge (web: shadcn Badge cva) ────────────────────────────────────────────

export function Badge({
  variant = 'default',
  style,
  textStyle,
  children,
}: {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
}) {
  const v = BADGE_VARIANT[variant];
  return (
    <View style={[styles.badge, v.container, style]}>
      <RNText style={[styles.badgeText, v.text, textStyle]}>{children}</RNText>
    </View>
  );
}

// ── Variant tables ───────────────────────────────────────────────────────────

const BTN_VARIANT: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  default: {
    container: { backgroundColor: palette.primary, borderColor: palette.primary },
    text: { color: palette.primaryForeground },
  },
  destructive: {
    container: { backgroundColor: palette.destructive, borderColor: palette.destructive },
    text: { color: palette.destructiveForeground },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderColor: palette.border },
    text: { color: palette.foreground },
  },
  secondary: {
    container: { backgroundColor: palette.secondary, borderColor: palette.secondary },
    text: { color: palette.secondaryForeground },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: 'transparent' },
    text: { color: palette.foreground },
  },
};

const BTN_SIZE: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  default: { container: { minHeight: 36, paddingHorizontal: 16, paddingVertical: 8 }, text: { fontSize: 14 } },
  sm: { container: { minHeight: 32, paddingHorizontal: 12 }, text: { fontSize: 12 } },
  lg: { container: { minHeight: 40, paddingHorizontal: 32 }, text: { fontSize: 14 } },
  icon: { container: { height: 36, width: 36, paddingHorizontal: 0 }, text: { fontSize: 14 } },
};

const BADGE_VARIANT = {
  default: { container: { backgroundColor: palette.primary }, text: { color: palette.primaryForeground } },
  secondary: { container: { backgroundColor: palette.secondary }, text: { color: palette.secondaryForeground } },
  destructive: { container: { backgroundColor: palette.destructive }, text: { color: palette.destructiveForeground } },
  outline: { container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }, text: { color: palette.foreground } },
} as const;

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 14, color: palette.foreground },
  title: {
    fontFamily: fonts.sans,
    fontWeight: '700',
    letterSpacing: -0.3, // tracking-tight
    color: palette.foreground,
  },
  muted: { fontFamily: fonts.body, fontSize: 13, color: palette.mutedForeground },

  screen: { flex: 1, backgroundColor: palette.background },
  screenContent: { paddingBottom: 24 },

  card: {
    borderRadius: 12, // rounded-xl
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    ...shadows.soft,
    shadowOpacity: 0.06, // shadow-sm (lighter than shadow-soft)
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { padding: 24, gap: 6 },
  cardTitle: { fontFamily: fonts.sans, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: palette.cardForeground },
  cardDescription: { fontFamily: fonts.body, fontSize: 14, color: palette.mutedForeground },
  cardContent: { padding: 24, paddingTop: 0 },

  btnBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 6, // rounded-md (web config md = 6px)
    borderWidth: 1,
  },
  btnText: { fontFamily: fonts.bodySemibold, fontWeight: '500' },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },

  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 10, // px-2.5
    paddingVertical: 2,    // py-0.5
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '600' },
});

export { palette, fonts, radius, shadows };
