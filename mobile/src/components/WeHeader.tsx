/**
 * WeHeader — pixel-port of web <Header> (client/src/components/Header.tsx).
 *
 * Layout it mirrors:
 *   pt-6 pb-3 px-6, subtle child-color accent wash (opacity .04, rounded-b 24)
 *   centered brand row: Grape + "Produced by 産前産後ケアホテル ぶどうの木"
 *   left  : "Baby" label  +  child name (2xl black) with Baby avatar + chevron
 *   right : settings ghost icon button  +  caregiver pill (Crown/User)
 *
 * Reads the same data the web header reads, via the existing mobile stores —
 * no logic/behaviour changes.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Grape, Baby, ChevronDown, Settings, Crown, User, Check } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import type { RootStackParamList } from '../navigation';
import { palette, fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PURPLE_400 = '#A480D0'; // web text-purple-400
const PURPLE_100 = '#EDE7F6'; // web bg-purple-100 / border-purple-100

export default function WeHeader() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const children = useChildStore((s) => s.children);
  const activeChildId = useChildStore((s) => s.activeChildId);
  const setActiveChildId = useChildStore((s) => s.setActiveChildId);

  const [showSwitcher, setShowSwitcher] = useState(false);

  const activeChild = children.find((c) => c.id === activeChildId) ?? children[0] ?? null;
  const hasMultiple = children.length > 1;
  const accent = (activeChild as any)?.color || '#805AAA';
  const displayName = activeChild?.name || '赤ちゃん';
  const caregiver = user?.role === 'mama' ? 'ママ' : 'パパ';

  return (
    <View style={styles.header}>
      {/* child-color accent wash */}
      <View style={[styles.accentWash, { backgroundColor: accent }]} pointerEvents="none" />

      {/* Brand row */}
      <View style={styles.brandRow}>
        <Grape size={12} color={PURPLE_400} strokeWidth={2} />
        <Text style={styles.brandText}>Produced by 産前産後ケアホテル ぶどうの木</Text>
      </View>

      <View style={styles.row}>
        {/* Left: Baby label + name + switcher */}
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.babyLabel}>Baby</Text>
          <Pressable
            style={styles.nameBtn}
            onPress={() => {
              if (hasMultiple) { setShowSwitcher((v) => !v); return; }
              if (activeChild) navigation.navigate('ChildProfile', { childId: activeChild.id });
              else (navigation as any).navigate('Main', { screen: 'Settings' });
            }}
          >
            <View style={[styles.avatar, { backgroundColor: accent + '22', borderColor: accent }]}>
              <Baby size={16} color={accent} strokeWidth={2} />
            </View>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            {hasMultiple && <ChevronDown size={16} color="#9AA0A6" strokeWidth={2} />}
          </Pressable>

          {showSwitcher && hasMultiple && (
            <View style={styles.dropdown}>
              {children.map((c) => {
                const isActive = activeChild?.id === c.id;
                const cColor = (c as any).color || '#805AAA';
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.ddItem, isActive && { backgroundColor: palette.accent }]}
                    onPress={() => {
                      setActiveChildId(c.id);
                      setShowSwitcher(false);
                    }}
                  >
                    <View style={[styles.ddAvatar, { backgroundColor: cColor + '22', borderColor: cColor }]}>
                      <Baby size={16} color={cColor} strokeWidth={2} />
                    </View>
                    <Text style={styles.ddName}>{c.name}</Text>
                    {isActive && <Check size={16} color={palette.primary} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.ddItem, styles.ddItemBorder]}
                onPress={() => {
                  setShowSwitcher(false);
                  if (activeChild) navigation.navigate('ChildProfile', { childId: activeChild.id });
                  else (navigation as any).navigate('Main', { screen: 'Settings' });
                }}
              >
                <Settings size={16} color="#9AA0A6" strokeWidth={2} />
                <Text style={styles.ddProfile}>プロフィール設定</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Right: settings + caregiver pill */}
        <View style={styles.right}>
          <Pressable
            style={styles.settingsBtn}
            onPress={() => (navigation as any).navigate('Main', { screen: 'Settings' })}
          >
            <Settings size={20} color="#7C7C85" strokeWidth={2} />
          </Pressable>
          <View style={styles.caregiverPill}>
            <View style={styles.caregiverAvatar}>
              {caregiver === 'ママ'
                ? <Crown size={16} color={palette.secondaryForeground} strokeWidth={2} />
                : <User size={16} color={palette.secondaryForeground} strokeWidth={2} />}
            </View>
            <View>
              <Text style={styles.caregiverLabel}>担当中</Text>
              <Text style={styles.caregiverName}>{caregiver}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 24, paddingBottom: 12, paddingHorizontal: 24, position: 'relative' },
  accentWash: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.04,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12 },
  brandText: { fontSize: 9, fontFamily: fonts.bodyBold, fontWeight: '700', color: PURPLE_400, letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  babyLabel: {
    fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700',
    color: palette.mutedForeground, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
  },
  nameBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 24, fontFamily: fonts.sans, fontWeight: '700', letterSpacing: -0.5, color: palette.foreground },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, marginTop: 8,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0',
    minWidth: 200, overflow: 'hidden', zIndex: 50,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  ddItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  ddItemBorder: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingVertical: 10 },
  ddAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ddName: { flex: 1, fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700', color: '#374151' },
  ddProfile: { fontSize: 12, fontFamily: fonts.bodyBold, fontWeight: '700', color: '#6B7280' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: '#F0F0F0',
  },
  caregiverPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#fff', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(237,231,246,0.5)',
    shadowColor: '#805AAA', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  caregiverAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: PURPLE_100, alignItems: 'center', justifyContent: 'center' },
  caregiverLabel: { fontSize: 10, fontFamily: fonts.bodySemibold, fontWeight: '600', color: palette.mutedForeground, lineHeight: 12 },
  caregiverName: { fontSize: 14, fontFamily: fonts.bodyBold, fontWeight: '700', color: palette.secondaryForeground, lineHeight: 16 },
});
