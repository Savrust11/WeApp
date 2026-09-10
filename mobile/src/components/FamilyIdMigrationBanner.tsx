/**
 * Detects a legacy (guessable) familyId and either:
 *  - silently follows an already-performed rotation (partner's device
 *    rotated first): updates AsyncStorage + authStore and reloads data, or
 *  - shows a banner prompting the user to rotate to a secure code.
 * Mobile port of client/src/components/FamilyIdMigrationBanner.tsx
 * (originwebapp 2026-09-10, adapted from localStorage to AsyncStorage).
 * See server/familyIdMigration.ts for the server side and security notes.
 */
import { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShieldAlert, Loader2 } from 'lucide-react-native';
import { Text } from '../theme/ui';
import { palette, radius, shadows } from '../theme/tokens';
import { useAuthStore } from '../store/authStore';
import { useToast } from './Toast';
import { apiGet, apiPost } from '../api/client';

const LEGACY_FAMILY_ID_RE = /^family-[0-9a-z]{1,10}$/;

type Status = 'hidden' | 'prompt' | 'expired';

// Resets on app restart (matches web's sessionStorage-scoped dismiss).
let dismissedThisSession = false;

export default function FamilyIdMigrationBanner() {
  const { user, setUser } = useAuthStore();
  const [status, setStatus] = useState<Status>('hidden');
  const [rotating, setRotating] = useState(false);
  const [dismissed, setDismissed] = useState(dismissedThisSession);
  const toast = useToast();

  useEffect(() => {
    const familyId = user?.familyId;
    if (!familyId || !LEGACY_FAMILY_ID_RE.test(familyId)) { setStatus('hidden'); return; }

    (async () => {
      try {
        const data = await apiGet<{ legacy: boolean; migrated: boolean; migratedTo: string | null }>(
          `/api/family/id-status?familyId=${encodeURIComponent(familyId)}`,
        );
        if (data.migrated && data.migratedTo) {
          await AsyncStorage.setItem('familyId', data.migratedTo);
          setUser({ ...user, familyId: data.migratedTo });
          return;
        }
        if (data.migrated && !data.migratedTo) {
          setStatus('expired');
          return;
        }
        if (data.legacy) setStatus('prompt');
      } catch {
        // Network error: stay hidden, try again next load.
      }
    })();
  }, [user?.familyId]);

  const handleRotate = async () => {
    const familyId = user?.familyId;
    if (!familyId) return;
    setRotating(true);
    try {
      const data = await apiPost<{ newFamilyId: string }>('/api/family/rotate-id', { familyId });
      await AsyncStorage.setItem('familyId', data.newFamilyId);
      setUser({ ...user, familyId: data.newFamilyId });
      toast.show({
        title: '家族コードを更新しました',
        description: 'パートナーの端末は3日以内にアプリを開くと自動で切り替わります。新しいコードは設定画面で確認できます。',
      });
      setStatus('hidden');
    } catch {
      toast.show({ title: '更新に失敗しました', description: 'しばらくしてからもう一度お試しください' });
    } finally {
      setRotating(false);
    }
  };

  if (status === 'hidden' || dismissed) return null;

  const dismiss = () => {
    dismissedThisSession = true;
    setDismissed(true);
  };

  return (
    <View
      style={{
        position: 'absolute', bottom: 84, left: 12, right: 12,
        borderRadius: radius.lg, borderWidth: 2, borderColor: '#FDE68A',
        backgroundColor: '#FFFBEB', padding: 16, ...shadows.soft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <ShieldAlert size={18} color="#D97706" style={{ marginTop: 2 }} />
        {status === 'prompt' ? (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#78350F' }}>家族コードの更新をおすすめします</Text>
            <Text style={{ fontSize: 12, color: '#92400E', marginTop: 4, lineHeight: 17 }}>
              現在の家族コードは古い形式で、第三者に推測されやすい可能性があります。安全な新しいコードに更新しましょう。データはそのまま引き継がれます。
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={handleRotate}
                disabled={rotating}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: '#D97706', borderRadius: radius.md,
                  paddingVertical: 8, paddingHorizontal: 14,
                }}
              >
                {rotating ? <Loader2 size={14} color="#fff" /> : null}
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>今すぐ更新する</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={dismiss} style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>あとで</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#78350F' }}>家族コードが更新されています</Text>
            <Text style={{ fontSize: 12, color: '#92400E', marginTop: 4, lineHeight: 17 }}>
              パートナーが家族コードを新しくしました。設定画面の「ペアリング」でパートナーの新しいコードを入力してください。
            </Text>
            <TouchableOpacity onPress={dismiss} style={{ marginTop: 8, paddingVertical: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>閉じる</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
