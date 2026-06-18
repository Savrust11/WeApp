/**
 * WeTabBar — pixel-port of the web app's <BottomNav> (client/src/components/Navigation.tsx).
 *
 * Web markup it mirrors:
 *   nav  : bg-white/90 backdrop-blur, border-t border-purple-100, shadow
 *   row1 : Grape icon + "Produced by ぶどうの木"  (8px bold, purple-300, tracking-wider)
 *   row2 : 5 items — active = text-primary, lifted -4px, icon in bg-purple-50 pill,
 *          stroke 2.5; inactive = text-muted-foreground, stroke 2
 *   label: 9px bold, tracking-wide
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, CalendarDays, Clock, Gift, Settings, Grape } from 'lucide-react-native';
import { palette, fonts } from '../theme/tokens';

const ICONS: Record<string, React.ComponentType<any>> = {
  Home,
  Calendar: CalendarDays,
  Timeline: Clock,
  Shop: Gift,
  Settings,
};

const LABELS: Record<string, string> = {
  Home: 'ホーム',
  Calendar: 'カレンダー',
  Timeline: 'きろく',
  Shop: 'ご褒美',
  Settings: '設定',
};

// Web: text-purple-300 brand, bg-purple-50 active pill, border-purple-100
const PURPLE_300 = '#C9B3E3';
const PURPLE_50 = palette.accent;     // very light purple pill
const BORDER = '#EDE7F6';             // border-purple-100

export default function WeTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {/* Brand footer (web: data-testid="brand-footer") */}
      <View style={styles.brandRow}>
        <Grape size={10} color={PURPLE_300} strokeWidth={2} />
        <Text style={styles.brandText}>Produced by ぶどうの木</Text>
      </View>

      <View style={styles.itemsRow}>
        {state.routes.map((route, index) => {
          const isActive = state.index === index;
          const Icon = ICONS[route.name] ?? Home;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              accessibilityLabel={LABELS[route.name] ?? route.name}
            >
              <View style={[styles.itemInner, isActive && styles.itemInnerActive]}>
                <View style={[styles.iconPill, isActive && styles.iconPillActive]}>
                  <Icon
                    size={20}
                    color={isActive ? palette.primary : palette.mutedForeground}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </View>
                <Text
                  style={[
                    styles.label,
                    { color: isActive ? palette.primary : palette.mutedForeground },
                  ]}
                >
                  {LABELS[route.name] ?? route.name}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    // shadow-lg shadow-purple-900/5
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 4,
  },
  brandText: {
    fontSize: 8,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: PURPLE_300,
    letterSpacing: 1, // tracking-wider
  },
  itemsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    maxWidth: 448, // max-w-md
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 4,
    height: 64,
  },
  item: { flex: 1, alignItems: 'center' },
  itemInner: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16, // rounded-2xl
  },
  itemInnerActive: {
    transform: [{ translateY: -4 }], // -translate-y-1
  },
  iconPill: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  iconPillActive: {
    backgroundColor: PURPLE_50, // bg-purple-50
  },
  label: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    letterSpacing: 0.4, // tracking-wide
  },
});
