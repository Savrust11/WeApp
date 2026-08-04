import React, { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Gift,
  Gem,
  ShoppingBag,
  Ticket,
  Plus,
  Trash2,
  Pencil,
  Bath,
  Moon,
  UtensilsCrossed,
  Hand,
  Sparkles,
  Bell,
  X,
  Check,
  Zap,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { getLogs } from '../api/logs';
import {
  calcLogPoints,
  calcTeamPower,
  POINT_RULES,
  TEAM_POWER_DESC,
} from '../utils/pointsManager';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { useTheme } from '../contexts/ThemeContext';
import {
  Screen,
  Card,
  CardContent,
  Button,
  Badge,
  Text,
  Title,
  Muted,
} from '../theme/ui';

interface Coupon {
  id: number;
  familyId: string;
  title: string;
  cost: number;
  isCustom: boolean;
  createdBy: number;
}

interface UserCoupon {
  id: number;
  couponId: number;
  status: 'owned' | 'used';
  usedAt?: string;
  coupon?: Coupon;
}

interface SponsoredCoupon {
  id: number;
  sponsorId: number;
  title: string;
  description?: string;
  pointsCost: number;
  originalValue?: string;
  imageUrl?: string;
  externalUrl?: string;
  remainingStock?: number;
  sponsor?: { name: string; logoUrl?: string } | null;
}

interface Notification {
  id: number;
  familyId: string;
  targetUser: string;
  message: string;
  type: string;
  read: boolean;
  childId?: number | null;
  createdAt?: string;
}

// Web: COUPON_ICONS keyed by title substring → lucide icon (fallback Sparkles)
const COUPON_ICONS: { keyword: string; Icon: typeof Bath }[] = [
  { keyword: 'お風呂', Icon: Bath },
  { keyword: '眠れる', Icon: Moon },
  { keyword: 'ランチ', Icon: UtensilsCrossed },
  { keyword: 'マッサージ', Icon: Hand },
];

function getCouponIcon(title: string): typeof Bath {
  for (const { keyword, Icon } of COUPON_ICONS) {
    if (title.includes(keyword)) return Icon;
  }
  return Sparkles;
}

// Web: getLabel(userId) — "パパ" / "ママ" / "その他"
function getUserLabel(role: 'papa' | 'mama' | 'other'): string {
  if (role === 'papa') return 'パパ';
  if (role === 'mama') return 'ママ';
  return 'その他';
}

export default function ShopScreen() {
  const { isDark, colors } = useTheme();
  const { user } = useAuthStore();
  const { children, activeChildId } = useChildStore();
  const navigation = useNavigation<any>();
  const familyId = user?.familyId ?? '';
  const currentRole = user?.role === 'mama' ? 'mama' : 'papa';
  const userLabel = getUserLabel(user?.role ?? 'papa');
  const queryClient = useQueryClient();

  const activeChild = children.find((c) => c.id === activeChildId);

  const [activeTab, setActiveTab] = useState<'shop' | 'mycoupons'>('shop');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCost, setNewCost] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCost, setEditCost] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: coupons = [], isLoading: loadingCoupons } = useQuery({
    queryKey: ['coupons', familyId],
    queryFn: () => apiGet<Coupon[]>(`/api/coupons/${familyId}`),
    enabled: !!familyId,
  });

  const { data: userCoupons = [], isLoading: loadingUserCoupons } = useQuery({
    queryKey: ['userCoupons', familyId],
    queryFn: () => apiGet<UserCoupon[]>(`/api/user-coupons/${familyId}`),
    enabled: !!familyId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', familyId],
    queryFn: () => getLogs(familyId as any),
    enabled: !!familyId,
  });

  const { data: sponsoredCoupons = [] } = useQuery({
    queryKey: ['sponsoredCoupons'],
    queryFn: () => apiGet<SponsoredCoupon[]>('/api/sponsored-coupons'),
  });

  const { data: notifList = [] } = useQuery({
    queryKey: ['notifications', familyId, currentRole],
    queryFn: () =>
      apiGet<Notification[]>(`/api/notifications/${familyId}/${currentRole}`),
    enabled: !!familyId,
  });

  // ── Points calculation ─────────────────────────────────────────────────────

  const { points, totalEarned } = useMemo(() => {
    const earned = (logs as any[]).reduce((sum, l) => sum + calcLogPoints(l), 0);
    const spent  = userCoupons.reduce((sum, uc) => sum + (uc.coupon?.cost ?? 0), 0);
    return { points: Math.max(0, earned - spent), totalEarned: earned };
  }, [logs, userCoupons]);

  const teamPower = useMemo(() => calcTeamPower({
    totalEarned,
    thankYouCount: 0, // TODO: wire up actual thank-you count from API
    birthday: activeChild?.birthday,
  }), [totalEarned, activeChild?.birthday]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const exchangeMutation = useMutation({
    mutationFn: (coupon: Coupon) =>
      apiPost('/api/coupons/exchange', {
        couponId: coupon.id,
        familyId,
        ownerId: currentRole,
        couponTitle: coupon.title,
        cost: coupon.cost,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCoupons', familyId] });
      Alert.alert('クーポン獲得！', 'クーポンを獲得しました！\nパートナーに通知が届きます 📩');
    },
    onError: () => Alert.alert('ポイント不足', 'ポイントが足りません。'),
  });

  const redeemMutation = useMutation({
    mutationFn: (couponId: number) =>
      apiPost(`/api/user-coupons/${couponId}/redeem`, { userId: currentRole, familyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCoupons', familyId] });
      Alert.alert('使用しました', 'クーポンを使用しました！');
    },
    onError: () => Alert.alert('エラー', '使用に失敗しました。'),
  });

  const createCouponMutation = useMutation({
    mutationFn: () =>
      apiPost('/api/coupons', {
        familyId,
        title: newTitle.trim(),
        cost: parseInt(newCost) || 10,
        isCustom: true,
        createdBy: currentRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons', familyId] });
      setShowAddModal(false);
      setNewTitle('');
      setNewCost('');
    },
    onError: () => Alert.alert('エラー', 'クーポンの作成に失敗しました。'),
  });

  const updateCouponMutation = useMutation({
    mutationFn: (data: { id: number; title: string; cost: number }) =>
      apiPost(`/api/coupons/${data.id}/update`, {
        title: data.title,
        cost: data.cost,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons', familyId] });
      setEditingId(null);
    },
    onError: () => Alert.alert('エラー', 'クーポンの更新に失敗しました。'),
  });

  const sponsorExchangeMutation = useMutation({
    mutationFn: (sc: SponsoredCoupon) =>
      apiPost(`/api/sponsored-coupons/${sc.id}/exchange`, {
        familyId,
        ownerId: currentRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCoupons', familyId] });
      queryClient.invalidateQueries({ queryKey: ['sponsoredCoupons'] });
      Alert.alert('ありがとう！', 'スポンサークーポンを獲得しました！');
    },
    onError: () => Alert.alert('エラー', 'ポイントが足りないか、在庫切れです。'),
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/coupons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons', familyId] }),
    onError: () => Alert.alert('エラー', '削除に失敗しました。'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/notifications/${id}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications', familyId, currentRole] }),
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const ownedCoupons = userCoupons.filter((uc) => uc.status === 'owned');
  const usedCoupons = userCoupons.filter((uc) => uc.status === 'used');
  const unreadNotifs = notifList.filter((n) => !n.read);

  const handleExchange = (coupon: Coupon) => {
    if (points < coupon.cost) {
      Alert.alert('ポイント不足', `あと${coupon.cost - points}pt必要です。`);
      return;
    }
    Alert.alert('確認', `${coupon.cost}ptで「${coupon.title}」と交換しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '交換する', onPress: () => exchangeMutation.mutate(coupon) },
    ]);
  };

  const handleRedeem = (uc: UserCoupon) => {
    Alert.alert('確認', `「${uc.coupon?.title ?? 'クーポン'}」を使用しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '使用する', onPress: () => redeemMutation.mutate(uc.id) },
    ]);
  };

  const handleDelete = (coupon: Coupon) => {
    Alert.alert('削除', `「${coupon.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deleteCouponMutation.mutate(coupon.id) },
    ]);
  };

  const handleSponsorExchange = (sc: SponsoredCoupon) => {
    if (points < sc.pointsCost) {
      Alert.alert('ポイント不足', `あと${sc.pointsCost - points}pt必要です。`);
      return;
    }
    Alert.alert(
      'もらう',
      `${sc.pointsCost > 0 ? sc.pointsCost + 'ptで' : ''}「${sc.title}」をもらいますか？${sc.originalValue ? '\n元の価格: ' + sc.originalValue : ''}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'もらう！', onPress: () => sponsorExchangeMutation.mutate(sc) },
      ],
    );
  };

  const handleAddCoupon = () => {
    if (!newTitle.trim()) { Alert.alert('タイトルを入力してください'); return; }
    if (!newCost || parseInt(newCost) <= 0) { Alert.alert('有効なポイント数を入力してください'); return; }
    createCouponMutation.mutate();
  };

  const handleBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
  };

  if (loadingCoupons || loadingUserCoupons) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <Screen contentStyle={styles.screenContent}>
      {/* Header — web: back chevron + Gift + title + subtitle + bell */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={palette.foreground} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <Gift size={24} color={palette.primary} />
            <Title style={styles.headerTitle}>ご褒美ショップ</Title>
          </View>
          <Muted style={styles.headerSub}>{userLabel}のポイントでクーポンと交換</Muted>
          <TouchableOpacity
            style={styles.pointsInfoBtn}
            onPress={() => setShowPointsInfo(true)}
          >
            <Text style={styles.pointsInfoBtnText}>ポイントのしくみ ？</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => setShowNotifs((s) => !s)}
          activeOpacity={0.7}
        >
          <Bell size={20} color={palette.foreground} />
          {unreadNotifs.length > 0 && (
            <View style={styles.notifDot}>
              <Text style={styles.notifDotText}>{String(unreadNotifs.length)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Notifications panel — web: お知らせ Card dropdown */}
      {showNotifs && notifList.length > 0 && (
        <Card style={styles.notifCard}>
          <View style={styles.notifHeader}>
            <View style={styles.notifHeaderTitleRow}>
              <Bell size={16} color={palette.primary} />
              <Text style={styles.notifHeaderTitle}>お知らせ</Text>
            </View>
            <TouchableOpacity
              style={styles.notifCloseBtn}
              onPress={() => setShowNotifs(false)}
              activeOpacity={0.7}
            >
              <X size={14} color={palette.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={styles.notifList}>
            {notifList.slice(0, 10).map((n) => (
              <View
                key={n.id}
                style={[styles.notifItem, n.read ? styles.notifItemRead : styles.notifItemUnread]}
              >
                <Zap
                  size={14}
                  color={n.read ? palette.border : palette.primary}
                />
                <Text
                  style={[
                    styles.notifItemText,
                    { color: n.read ? palette.mutedForeground : palette.foreground },
                  ]}
                >
                  {n.message}
                </Text>
                {!n.read && (
                  <TouchableOpacity
                    style={styles.notifReadBtn}
                    onPress={() => markReadMutation.mutate(n.id)}
                    activeOpacity={0.7}
                  >
                    <Check size={12} color={palette.foreground} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Points hero card — web: purple→green gradient + Gem badge */}
      <Card style={styles.pointsCard}>
        <Svg style={StyleSheet.absoluteFill as any} width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="ptsGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={palette.primary} />
              <Stop offset="1" stopColor={palette.secondary} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={radius.lg} fill="url(#ptsGrad)" />
        </Svg>
        <CardContent style={styles.pointsCardContent}>
          <View>
            <Text style={styles.pointsLabel}>保有ポイント</Text>
            <Title style={styles.pointsValue}>{points}</Title>
            <Text style={styles.pointsUnit}>pt</Text>
          </View>
          <View style={styles.pointsGemCircle}>
            <Gem size={32} color={palette.primaryForeground} />
          </View>
        </CardContent>
        {activeChild?.birthday && (
          <View style={styles.teamPowerRow}>
            <Text style={styles.teamPowerLabel}>チームパワー</Text>
            <Text style={styles.teamPowerValue}>{teamPower.toFixed(1)}</Text>
          </View>
        )}
      </Card>

      {/* Tabs — web: two Buttons (default = solid purple / outline) */}
      <View style={styles.tabs}>
        <Button
          variant={activeTab === 'shop' ? 'default' : 'outline'}
          style={styles.tabBtn}
          onPress={() => setActiveTab('shop')}
        >
          <ShoppingBag
            size={16}
            color={activeTab === 'shop' ? palette.primaryForeground : palette.foreground}
          />
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === 'shop' ? palette.primaryForeground : palette.foreground },
            ]}
          >
            ショップ
          </Text>
        </Button>
        <Button
          variant={activeTab === 'mycoupons' ? 'default' : 'outline'}
          style={styles.tabBtn}
          onPress={() => setActiveTab('mycoupons')}
        >
          <Ticket
            size={16}
            color={activeTab === 'mycoupons' ? palette.primaryForeground : palette.foreground}
          />
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === 'mycoupons' ? palette.primaryForeground : palette.foreground },
            ]}
          >
            マイクーポン
          </Text>
          {ownedCoupons.length > 0 && (
            <Badge variant="secondary" style={styles.tabBadge} textStyle={styles.tabBadgeText}>
              {String(ownedCoupons.length)}
            </Badge>
          )}
        </Button>
      </View>

      {/* ── Shop tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'shop' && (
        <View style={styles.list}>
          {/* ── Family / default Coupons (web: couponList rows) ── */}
          {coupons.map((coupon) => {
            const Icon = getCouponIcon(coupon.title);
            const canAfford = points >= coupon.cost;
            const isEditing = editingId === coupon.id;
            return (
              <Card key={coupon.id} style={[styles.couponCard, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
                {isEditing ? (
                  <View style={styles.editForm}>
                    <TextInput
                      style={[styles.input, isDark && { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="クーポンの内容"
                      placeholderTextColor={palette.mutedForeground}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      maxLength={40}
                    />
                    <TextInput
                      style={[styles.input, isDark && { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      placeholder="必要ポイント"
                      placeholderTextColor={palette.mutedForeground}
                      value={editCost}
                      onChangeText={setEditCost}
                      keyboardType="numeric"
                    />
                    <View style={styles.editFormBtns}>
                      <Button
                        variant="outline"
                        style={styles.editFormBtn}
                        onPress={() => setEditingId(null)}
                      >
                        キャンセル
                      </Button>
                      <Button
                        style={styles.editFormBtn}
                        disabled={
                          updateCouponMutation.isPending ||
                          !editTitle.trim() ||
                          !editCost.trim()
                        }
                        onPress={() => {
                          const cost = parseInt(editCost);
                          if (isNaN(cost) || cost <= 0) return;
                          updateCouponMutation.mutate({
                            id: coupon.id,
                            title: editTitle.trim(),
                            cost,
                          });
                        }}
                      >
                        {updateCouponMutation.isPending ? '保存中...' : '保存'}
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View style={styles.couponRow}>
                    <View style={styles.couponIconBox}>
                      <Icon size={24} color={palette.primary} />
                    </View>
                    <View style={styles.couponInfo}>
                      <Text style={styles.couponTitle} numberOfLines={1}>{coupon.title}</Text>
                      <View style={styles.couponCostRow}>
                        <Gem size={12} color={palette.accentForeground} />
                        <Text style={styles.couponCost}>{coupon.cost} pt</Text>
                        {coupon.isCustom && (
                          <Badge variant="outline" style={styles.customBadge} textStyle={styles.customBadgeText}>
                            カスタム
                          </Badge>
                        )}
                      </View>
                    </View>
                    <View style={styles.couponActions}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => {
                          setEditingId(coupon.id);
                          setEditTitle(coupon.title);
                          setEditCost(String(coupon.cost));
                        }}
                      >
                        <Pencil size={14} color={palette.mutedForeground} />
                      </TouchableOpacity>
                      {coupon.isCustom && (
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleDelete(coupon)}
                        >
                          <Trash2 size={14} color={palette.mutedForeground} />
                        </TouchableOpacity>
                      )}
                      <Button
                        size="sm"
                        onPress={() => handleExchange(coupon)}
                        disabled={exchangeMutation.isPending}
                        style={!canAfford ? styles.disabledExchange : undefined}
                        textStyle={!canAfford ? styles.disabledExchangeText : undefined}
                      >
                        交換する
                      </Button>
                    </View>
                  </View>
                )}
              </Card>
            );
          })}

          {/* Custom coupon — web: dashed bordered card + add flow */}
          <Card style={styles.dashedCard}>
            <Button
              variant="ghost"
              style={styles.dashedBtn}
              onPress={() => { setNewTitle(''); setNewCost(''); setShowAddModal(true); }}
            >
              <Plus size={16} color={palette.primary} />
              <Text style={styles.dashedBtnText}>カスタムクーポンを追加</Text>
            </Button>
          </Card>

          {/* ── Sponsored Coupons (mobile-only: ご褒美スポンサーシップ) ── */}
          {sponsoredCoupons.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>スポンサーからのご褒美</Text>
              {sponsoredCoupons.map((sc) => (
                <Card key={`sp-${sc.id}`} style={styles.sponsorCard}>
                  <CardContent style={styles.sponsorContent}>
                    <View style={styles.sponsorHeader}>
                      <View style={styles.sponsorIconBox}>
                        <Gift size={24} color={palette.secondary} />
                      </View>
                      <View style={styles.couponInfo}>
                        <Text style={styles.couponTitle} numberOfLines={2}>{sc.title}</Text>
                        {sc.sponsor && (
                          <Muted style={styles.sponsorName}>from {sc.sponsor.name}</Muted>
                        )}
                      </View>
                    </View>
                    {sc.description && (
                      <Muted style={styles.sponsorDesc} numberOfLines={2}>{sc.description}</Muted>
                    )}
                    <View style={styles.sponsorFooter}>
                      <View>
                        <Text style={styles.sponsorCost}>
                          {sc.pointsCost > 0 ? `${sc.pointsCost} pt` : '無料'}
                        </Text>
                        {sc.originalValue && (
                          <Text style={styles.sponsorOriginal}>通常 {sc.originalValue}</Text>
                        )}
                      </View>
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => handleSponsorExchange(sc)}
                        disabled={sponsorExchangeMutation.isPending || (sc.remainingStock != null && sc.remainingStock <= 0)}
                      >
                        {sc.remainingStock != null && sc.remainingStock <= 0 ? '在庫切れ' : 'もらう'}
                      </Button>
                    </View>
                    {sc.remainingStock != null && sc.remainingStock > 0 && (
                      <Muted style={styles.stockText}>残り {sc.remainingStock} 個</Muted>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {coupons.length === 0 && sponsoredCoupons.length === 0 && (
            <Muted style={styles.emptyText}>クーポンがありません</Muted>
          )}
        </View>
      )}

      {/* ── My Coupons tab ───────────────────────────────────────────────────── */}
      {activeTab === 'mycoupons' && (
        <View style={styles.list}>
          {ownedCoupons.length === 0 && usedCoupons.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCircle}>
                <Ticket size={32} color={palette.border} />
              </View>
              <Muted style={styles.emptyText}>まだクーポンを持っていません</Muted>
              <Button
                variant="outline"
                size="sm"
                style={styles.emptyBtn}
                onPress={() => setActiveTab('shop')}
              >
                <ShoppingBag size={16} color={palette.foreground} />
                <Text style={styles.emptyBtnText}>ショップで交換する</Text>
              </Button>
            </View>
          ) : (
            <>
              {ownedCoupons.length > 0 && (
                <>
                  <View style={styles.sectionLabelRow}>
                    <Ticket size={16} color={palette.accentForeground} />
                    <Text style={styles.sectionLabel}>使えるクーポン</Text>
                  </View>
                  {ownedCoupons.map((uc) => {
                    const Icon = getCouponIcon(uc.coupon?.title ?? '');
                    return (
                      <Card key={uc.id} style={styles.myCard}>
                        <View style={styles.couponRow}>
                          <View style={styles.myIconBox}>
                            <Icon size={20} color={palette.primary} />
                          </View>
                          <View style={styles.couponInfo}>
                            <Text style={styles.couponTitle} numberOfLines={1}>
                              {uc.coupon?.title ?? 'クーポン'}
                            </Text>
                            <Muted style={styles.myCardSub}>{uc.coupon?.cost ?? 0}ptで交換</Muted>
                          </View>
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => handleRedeem(uc)}
                            disabled={redeemMutation.isPending}
                          >
                            使用する
                          </Button>
                        </View>
                      </Card>
                    );
                  })}
                </>
              )}

              {usedCoupons.length > 0 && (
                <>
                  <View style={[styles.sectionLabelRow, { marginTop: 16 }]}>
                    <Check size={16} color={palette.mutedForeground} />
                    <Text style={[styles.sectionLabel, { color: palette.mutedForeground }]}>使用済み</Text>
                  </View>
                  {usedCoupons.map((uc) => {
                    const Icon = getCouponIcon(uc.coupon?.title ?? '');
                    return (
                      <Card key={uc.id} style={[styles.myCard, styles.myCardUsed]}>
                        <View style={styles.couponRow}>
                          <View style={styles.usedIconBox}>
                            <Icon size={16} color={palette.mutedForeground} />
                          </View>
                          <View style={styles.couponInfo}>
                            <Text style={styles.usedTitle} numberOfLines={1}>
                              {uc.coupon?.title ?? 'クーポン'}
                            </Text>
                            {uc.usedAt && (
                              <Muted style={styles.usedAt}>
                                {new Date(uc.usedAt).toLocaleDateString('ja-JP')} 使用
                              </Muted>
                            )}
                          </View>
                          <Badge variant="secondary" style={styles.usedBadge} textStyle={styles.usedBadgeText}>
                            使用済み
                          </Badge>
                        </View>
                      </Card>
                    );
                  })}
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* ── Add Custom Coupon Modal ───────────────────────────────────────────── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowAddModal(false)}>
          <TouchableOpacity style={[styles.sheet, isDark && { backgroundColor: colors.card }]} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Title style={styles.sheetTitle}>カスタムクーポン作成</Title>

            <Text style={styles.inputLabel}>クーポンの内容</Text>
            <TextInput
              style={[styles.input, isDark && { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="例：映画デート券"
              placeholderTextColor={palette.mutedForeground}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              maxLength={40}
            />

            <Text style={styles.inputLabel}>必要ポイント</Text>
            <TextInput
              style={[styles.input, isDark && { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="例：500"
              placeholderTextColor={palette.mutedForeground}
              value={newCost}
              onChangeText={setNewCost}
              keyboardType="numeric"
            />

            <View style={styles.sheetBtns}>
              <Button
                variant="outline"
                style={styles.sheetBtn}
                onPress={() => { setShowAddModal(false); setNewTitle(''); setNewCost(''); }}
              >
                キャンセル
              </Button>
              <Button
                style={styles.sheetBtn}
                onPress={handleAddCoupon}
                disabled={createCouponMutation.isPending || !newTitle.trim() || !newCost}
              >
                {createCouponMutation.isPending ? '作成中...' : '追加する'}
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── ポイントのしくみ Modal ── */}
      <Modal visible={showPointsInfo} transparent animationType="slide" onRequestClose={() => setShowPointsInfo(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPointsInfo(false)}>
          <TouchableOpacity style={[styles.sheet, { paddingBottom: 32 }, isDark && { backgroundColor: colors.card }]} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Title style={styles.sheetTitle}>ポイントのしくみ</Title>

            {/* Point rules table */}
            <View style={styles.rulesTable}>
              {POINT_RULES.map((rule) => (
                <View key={rule.label} style={styles.ruleRow}>
                  <Text style={styles.ruleEmoji}>{rule.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleLabel}>{rule.label}</Text>
                    <Muted style={styles.ruleDesc}>{rule.desc}</Muted>
                  </View>
                  <Text style={styles.ruleValue}>{rule.value}</Text>
                </View>
              ))}
            </View>

            {/* Team power explanation */}
            <View style={styles.teamPowerInfo}>
              <View style={styles.teamPowerInfoTitleRow}>
                <Sparkles size={16} color={palette.accentForeground} />
                <Text style={styles.teamPowerInfoTitle}>チームパワーってなに？</Text>
              </View>
              <Text style={styles.teamPowerInfoDesc}>{TEAM_POWER_DESC}</Text>
              {activeChild?.birthday && (
                <View style={styles.teamPowerCurrent}>
                  <Text style={styles.teamPowerCurrentLabel}>現在のチームパワー</Text>
                  <Text style={styles.teamPowerCurrentValue}>{teamPower.toFixed(1)}</Text>
                </View>
              )}
            </View>

            <View style={styles.shopHint}>
              <Text style={styles.shopHintText}>
                貯まったポイントはご褒美ショップでクーポンと交換できます
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.background },

  screenContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 4 },
  headerLeft: { flex: 1 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, color: palette.foreground },
  headerSub: { fontSize: 12, marginTop: 2 },
  notifDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifDotText: { fontFamily: fonts.bodyBold, fontSize: 10, color: palette.destructiveForeground },
  pointsInfoBtn: {
    marginTop: 6,
    backgroundColor: palette.accent,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pointsInfoBtnText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: palette.accentForeground },

  // Notifications panel
  notifCard: {
    borderColor: '#E9D5FF',
    backgroundColor: palette.accent,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  notifHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifHeaderTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground },
  notifCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifList: { gap: 8 },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 8,
    borderRadius: radius.sm,
  },
  notifItemUnread: { backgroundColor: palette.card },
  notifItemRead: { backgroundColor: 'rgba(255,255,255,0.5)' },
  notifItemText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12 },
  notifReadBtn: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Points hero card (web gradient: purple → green via SVG LinearGradient)
  pointsCard: {
    borderColor: palette.primary,
    borderRadius: radius.lg,
    marginBottom: 20,
    overflow: 'hidden',
    ...shadows.soft,
  },
  pointsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  pointsLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
  },
  pointsValue: { fontSize: 36, color: palette.primaryForeground },
  pointsUnit: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  pointsGemCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamPowerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginTop: -8,
  },
  teamPowerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  teamPowerValue: { fontFamily: fonts.bodyBold, fontSize: 18, color: '#FFE08A' },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tabBtn: { flex: 1, borderRadius: radius.lg },
  tabBtnText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  tabBadge: { marginLeft: 4, paddingHorizontal: 6, paddingVertical: 0 },
  tabBadgeText: { fontSize: 10 },

  // Lists
  list: { gap: 12 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: palette.mutedForeground },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Coupon cards (web: p-4 rounded-2xl row layout)
  couponCard: { borderRadius: radius.lg, padding: 16, borderColor: palette.border },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  couponIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg, // web: rounded-2xl
    backgroundColor: '#FAF5FF', // web: bg-purple-50
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponInfo: { flex: 1, minWidth: 0 },
  couponTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground },
  couponCostRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  couponCost: { fontFamily: fonts.bodyBold, fontSize: 12, color: palette.accentForeground },
  couponActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBadge: { marginLeft: 4, paddingHorizontal: 6, paddingVertical: 0 },
  customBadgeText: { fontSize: 9 },
  disabledExchange: { backgroundColor: palette.muted, borderColor: palette.muted },
  disabledExchangeText: { color: palette.mutedForeground },

  // Inline edit form (web: isEditing branch)
  editForm: { gap: 12 },
  editFormBtns: { flexDirection: 'row', gap: 8 },
  editFormBtn: { flex: 1, borderRadius: radius.sm },

  // Dashed custom card
  dashedCard: {
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: palette.primary,
    backgroundColor: palette.accent,
    padding: 16,
  },
  dashedBtn: { width: '100%', borderRadius: radius.lg },
  dashedBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.primary },

  // Sponsor cards
  sponsorCard: { borderRadius: radius.lg, borderColor: palette.secondary },
  sponsorContent: { padding: 16, gap: 8 },
  sponsorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sponsorIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#E8F4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorName: { fontSize: 11, marginTop: 2 },
  sponsorDesc: { fontSize: 12, lineHeight: 18 },
  sponsorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sponsorCost: { fontFamily: fonts.bodyBold, fontSize: 16, color: palette.secondaryForeground },
  sponsorOriginal: { fontSize: 10, color: palette.mutedForeground, textDecorationLine: 'line-through' },
  stockText: { fontSize: 10, textAlign: 'right' },

  // My coupons
  myCard: { borderRadius: radius.lg, padding: 16, borderColor: '#E9D5FF' /* web: border-purple-100 */ },
  myIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md, // web: rounded-xl
    backgroundColor: '#F3E8FF', // web: bg-purple-100
    alignItems: 'center',
    justifyContent: 'center',
  },
  myCardSub: { fontSize: 10, marginTop: 2 },
  myCardUsed: { opacity: 0.6, backgroundColor: palette.muted },
  usedIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usedTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: palette.mutedForeground,
    textDecorationLine: 'line-through',
  },
  usedAt: { fontSize: 10, marginTop: 2 },
  usedBadge: { paddingHorizontal: 8 },
  usedBadgeText: { fontSize: 9 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', fontSize: 14, color: palette.mutedForeground },
  emptyBtn: { borderRadius: radius.lg },
  emptyBtnText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: palette.foreground },

  // Modals (mobile-only sheets, restyled with kit)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    gap: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: palette.border, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, color: palette.foreground, textAlign: 'center' },
  inputLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: palette.mutedForeground },
  input: {
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.foreground,
  },
  sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  sheetBtn: { flex: 1, borderRadius: radius.sm },

  // ポイントのしくみ modal
  rulesTable: { width: '100%', gap: 4, marginBottom: 12 },
  ruleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: palette.accent, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  ruleEmoji: { fontFamily: fonts.body, fontSize: 22, width: 28, textAlign: 'center' },
  ruleLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground },
  ruleDesc: { fontSize: 11, marginTop: 1 },
  ruleValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.primary },

  teamPowerInfo: {
    width: '100%',
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  teamPowerInfoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamPowerInfoTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: palette.accentForeground },
  teamPowerInfoDesc: { fontFamily: fonts.body, fontSize: 13, color: palette.foreground, lineHeight: 20 },
  teamPowerCurrent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: palette.card, borderRadius: radius.sm, padding: 12, marginTop: 4,
  },
  teamPowerCurrentLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: palette.mutedForeground },
  teamPowerCurrentValue: { fontFamily: fonts.bodyBold, fontSize: 22, color: palette.primary },

  shopHint: {
    width: '100%',
    backgroundColor: palette.muted,
    borderRadius: radius.sm,
    padding: 14,
  },
  shopHintText: { fontFamily: fonts.body, fontSize: 13, color: palette.mutedForeground, lineHeight: 20, textAlign: 'center' },
});
