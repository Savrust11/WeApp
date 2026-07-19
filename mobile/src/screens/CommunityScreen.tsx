import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Ellipsis, Send, ChevronRight,
  Home as HomeIcon, CalendarDays, Clock, Gift, Settings as SettingsIcon, Grape,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Card, CardContent, Button, Badge, Text, Title, Muted } from '../theme/ui';
import type { RootStackParamList } from '../navigation';

// Soft purple tones used by the main WeTabBar — kept identical so the
// Community screen's bottom nav blends with the rest of the app.
const TAB_PURPLE_300 = '#C9B3E3';
const TAB_PURPLE_50 = palette.accent;
const TAB_BORDER = '#EDE7F6';

type MainTab = 'Home' | 'Calendar' | 'Timeline' | 'Shop' | 'Settings';

const TAB_ITEMS: { name: MainTab; label: string; Icon: React.ComponentType<any> }[] = [
  { name: 'Home',     label: 'ホーム',     Icon: HomeIcon },
  { name: 'Calendar', label: 'カレンダー', Icon: CalendarDays },
  { name: 'Timeline', label: 'きろく',     Icon: Clock },
  { name: 'Shop',     label: 'ご褒美',     Icon: Gift },
  { name: 'Settings', label: '設定',       Icon: SettingsIcon },
];

// Mirror of WeTabBar's design, usable inside a Stack screen (no tab navigator props).
function BottomTabBar() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.bottomBrandRow}>
        <Grape size={10} color={TAB_PURPLE_300} strokeWidth={2} />
        <Text style={styles.bottomBrandText}>Produced by ぶどうの木</Text>
      </View>

      <View style={styles.bottomItemsRow}>
        {TAB_ITEMS.map(({ name, label, Icon }) => (
          <TouchableOpacity
            key={name}
            style={styles.bottomItem}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => navigation.navigate('Main', { screen: name } as any)}
          >
            <View style={styles.bottomItemInner}>
              <View style={styles.bottomIconPill}>
                <Icon
                  size={20}
                  color={palette.mutedForeground}
                  strokeWidth={2}
                />
              </View>
              <Text style={[styles.bottomItemLabel, { color: palette.mutedForeground }]}>
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const AVATAR_MAP: Record<string, string> = {
  bear: '🐻', rabbit: '🐰', cat: '🐱', dog: '🐶',
  panda: '🐼', penguin: '🐧', koala: '🐨', hamster: '🐹',
};

const REACTION_LABELS: Record<string, string> = {
  wakaru: '🤝 わかる',
  ganbare: '💪 がんばれ',
};

interface CommunityProfile {
  id: number;
  userId: string;
  nickname: string;
  avatarIcon: string;
  childAgeMonths?: number;
  showChildAge: boolean;
}

interface Room {
  id: number;
  type: string;
  slug: string;
  name: string;
  description?: string;
  icon: string;
  currentMembers: number;
  maxMembers: number;
  score?: number;
}

interface Post {
  id: number;
  roomId: number;
  profileId: number;
  body: string;
  createdAt: string;
  profile?: { nickname: string; avatarIcon: string; childAgeMonths?: number | null };
  reactions: { wakaru: number; ganbare: number };
  myReaction: string | null;
}

type Tab = 'rooms' | 'joined' | 'recommended';

export default function CommunityScreen() {
  const { user } = useAuthStore();
  const uniqueUserId = user ? `${user.familyId}_${user.role}` : '';
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('rooms');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('bear');
  const [childAge, setChildAge] = useState('');
  const [showAge, setShowAge] = useState(true);
  const [postText, setPostText] = useState('');

  // ── Profile ────────────────────────────────────────────────────────────────

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['communityProfile', uniqueUserId],
    queryFn: () => apiGet<CommunityProfile | null>(`/api/community/profile/${uniqueUserId}`),
    enabled: !!uniqueUserId,
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      apiPost('/api/community/profile', {
        userId: uniqueUserId,
        nickname: newNickname.trim(),
        avatarIcon: selectedAvatar,
        childAgeMonths: childAge ? parseInt(childAge) : null,
        showChildAge: showAge,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityProfile', uniqueUserId] });
      setShowSetup(false);
    },
    onError: (err: any) => Alert.alert('エラー', err?.message ?? 'プロフィールの保存に失敗しました'),
  });

  // ── Rooms ──────────────────────────────────────────────────────────────────

  const { data: allRooms = [] } = useQuery({
    queryKey: ['communityRooms'],
    queryFn: () => apiGet<Room[]>('/api/community/rooms'),
  });

  const { data: joinedRooms = [] } = useQuery({
    queryKey: ['communityJoined', profile?.id],
    queryFn: () => apiGet<Room[]>(`/api/community/memberships/${profile!.id}`),
    enabled: !!profile?.id,
  });

  const { data: recommended = [] } = useQuery({
    queryKey: ['communityRecommend', uniqueUserId],
    queryFn: () => apiGet<Room[]>(`/api/community/rooms/recommend/${uniqueUserId}`),
    enabled: !!uniqueUserId,
  });

  const joinMutation = useMutation({
    mutationFn: (roomId: number) =>
      apiPost(`/api/community/rooms/${roomId}/join`, { profileId: profile!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityJoined'] });
      queryClient.invalidateQueries({ queryKey: ['communityRooms'] });
    },
    onError: (err: any) => Alert.alert('エラー', err?.message ?? '参加に失敗しました'),
  });

  const leaveMutation = useMutation({
    mutationFn: (roomId: number) =>
      apiPost(`/api/community/rooms/${roomId}/leave`, { profileId: profile!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityJoined'] });
      queryClient.invalidateQueries({ queryKey: ['communityRooms'] });
      setSelectedRoom(null);
    },
  });

  // ── Posts ───────────────────────────────────────────────────────────────────

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['communityPosts', selectedRoom?.id],
    queryFn: () =>
      apiGet<Post[]>(`/api/community/rooms/${selectedRoom!.id}/posts?profileId=${profile?.id ?? ''}`),
    enabled: !!selectedRoom && !!profile,
    refetchInterval: 15000,
  });

  const postMutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/community/rooms/${selectedRoom!.id}/posts`, {
        profileId: profile!.id,
        body: postText.trim(),
      }),
    onSuccess: () => {
      setPostText('');
      queryClient.invalidateQueries({ queryKey: ['communityPosts', selectedRoom?.id] });
    },
    onError: (err: any) => Alert.alert('エラー', err?.message ?? '投稿に失敗しました'),
  });

  const reactMutation = useMutation({
    mutationFn: ({ postId, type }: { postId: number; type: string }) =>
      apiPost(`/api/community/posts/${postId}/react`, { profileId: profile!.id, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityPosts', selectedRoom?.id] });
    },
  });

  const reportPost = useCallback((postId: number, targetProfileId: number) => {
    const doReport = async () => {
      await apiPost('/api/community/report', {
        postId,
        reporterProfileId: profile!.id,
        targetProfileId,
        reason: '不適切な投稿',
      });
      Alert.alert('通報しました', '運営が確認いたします。');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('この投稿を通報しますか？')) doReport();
    } else {
      Alert.alert('通報', 'この投稿を通報しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '通報する', style: 'destructive', onPress: doReport },
      ]);
    }
  }, [profile]);

  const blockUser = useCallback((blockedProfileId: number) => {
    const doBlock = async () => {
      await apiPost('/api/community/block', {
        blockerProfileId: profile!.id,
        blockedProfileId,
      });
      queryClient.invalidateQueries({ queryKey: ['communityPosts', selectedRoom?.id] });
      Alert.alert('ブロックしました', 'このユーザーの投稿は表示されなくなります。');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('このユーザーをブロックしますか？')) doBlock();
    } else {
      Alert.alert('ブロック', 'このユーザーをブロックしますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ブロック', style: 'destructive', onPress: doBlock },
      ]);
    }
  }, [profile, selectedRoom]);

  // ── Profile Setup ──────────────────────────────────────────────────────────

  if (profileLoading) {
    return <View style={styles.centered}><ActivityIndicator color={palette.primary} size="large" /></View>;
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.setupContainer} keyboardShouldPersistTaps="handled">
          <Title style={styles.setupTitle}>コミュニティに参加しよう</Title>
          <Muted style={styles.setupDesc}>
            匿名のニックネームで参加できます。{'\n'}
            実名・顔写真の投稿はご遠慮ください。
          </Muted>

          <Text style={styles.inputLabel}>ニックネーム <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="例: がんばるパパ"
            placeholderTextColor={palette.mutedForeground}
            value={newNickname}
            onChangeText={setNewNickname}
            maxLength={20}
          />

          <Text style={styles.inputLabel}>アイコン</Text>
          <View style={styles.avatarGrid}>
            {Object.entries(AVATAR_MAP).map(([key, emoji]) => (
              <TouchableOpacity
                key={key}
                style={[styles.avatarOption, selectedAvatar === key && styles.avatarSelected]}
                onPress={() => setSelectedAvatar(key)}
              >
                <Text style={styles.avatarEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>お子さまの月齢（任意）</Text>
          <View style={styles.ageRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="例: 8"
              placeholderTextColor={palette.mutedForeground}
              value={childAge}
              onChangeText={setChildAge}
              keyboardType="numeric"
            />
            <Text style={styles.ageUnit}>ヶ月</Text>
          </View>

          <TouchableOpacity style={styles.ageToggle} onPress={() => setShowAge(!showAge)}>
            <Text style={styles.ageToggleIcon}>{showAge ? '☑' : '☐'}</Text>
            <Muted style={styles.ageToggleText}>月齢を他のメンバーに表示する</Muted>
          </TouchableOpacity>

          <Button
            style={styles.setupBtn}
            onPress={() => profileMutation.mutate()}
            disabled={!newNickname.trim() || profileMutation.isPending}
          >
            <Text style={styles.setupBtnText}>
              {profileMutation.isPending ? '登録中...' : 'はじめる'}
            </Text>
          </Button>
        </ScrollView>
        <BottomTabBar />
      </View>
    );
  }

  // ── Room Detail (Posts) ────────────────────────────────────────────────────

  if (selectedRoom) {
    const isJoined = joinedRooms.some((r) => r.id === selectedRoom.id);
    return (
      <View style={styles.container}>
        <View style={styles.roomHeader}>
          <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.backBtnWrap}>
            <ArrowLeft size={20} color={palette.primary} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.roomHeaderInfo}>
            <Text style={styles.roomHeaderIcon}>{selectedRoom.icon}</Text>
            <Text style={styles.roomHeaderName} numberOfLines={1}>{selectedRoom.name}</Text>
            <Text style={styles.roomHeaderCount}>{selectedRoom.currentMembers}人</Text>
          </View>
          {isJoined ? (
            <TouchableOpacity onPress={() => leaveMutation.mutate(selectedRoom.id)}>
              <Text style={styles.leaveBtn}>退出</Text>
            </TouchableOpacity>
          ) : (
            <Button
              style={styles.joinBtnSmall}
              onPress={() => joinMutation.mutate(selectedRoom.id)}
            >
              <Text style={styles.joinBtnSmallText}>参加</Text>
            </Button>
          )}
        </View>

        {selectedRoom.description && (
          <View style={styles.roomDescBar}>
            <Text style={styles.roomDescText}>{selectedRoom.description}</Text>
            <Muted style={styles.privacyNotice}>実名・顔写真の投稿は禁止です</Muted>
          </View>
        )}

        {postsLoading ? (
          <View style={styles.centered}><ActivityIndicator color={palette.primary} /></View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(p) => String(p.id)}
            inverted
            contentContainerStyle={{ padding: 12, gap: 10 }}
            ListEmptyComponent={
              <Muted style={styles.emptyPosts}>まだ投稿がありません。{'\n'}最初の投稿をしてみましょう！</Muted>
            }
            renderItem={({ item: post }) => (
              <Card style={styles.postCard}>
                <CardContent style={styles.postCardContent}>
                  <View style={styles.postHeader}>
                    <Text style={styles.postAvatar}>{AVATAR_MAP[post.profile?.avatarIcon ?? 'bear']}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postNickname}>{post.profile?.nickname ?? '匿名'}</Text>
                      {post.profile?.childAgeMonths != null && (
                        <Muted style={styles.postAge}>{post.profile.childAgeMonths}ヶ月</Muted>
                      )}
                    </View>
                    <Muted style={styles.postTime}>
                      {new Date(post.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </Muted>
                    {post.profileId !== profile.id && (
                      <TouchableOpacity
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            const action = window.prompt('操作を選択:\n1: 通報\n2: ブロック');
                            if (action === '1') reportPost(post.id, post.profileId);
                            if (action === '2') blockUser(post.profileId);
                          } else {
                            Alert.alert('操作', '', [
                              { text: 'キャンセル', style: 'cancel' },
                              { text: '通報する', onPress: () => reportPost(post.id, post.profileId) },
                              { text: 'ブロックする', style: 'destructive', onPress: () => blockUser(post.profileId) },
                            ]);
                          }
                        }}
                        style={styles.moreBtn}
                      >
                        <Ellipsis size={18} color={palette.mutedForeground} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.postBody}>{post.body}</Text>
                  <View style={styles.reactionRow}>
                    {(['wakaru', 'ganbare'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.reactionBtn, post.myReaction === type && styles.reactionBtnActive]}
                        onPress={() => reactMutation.mutate({ postId: post.id, type })}
                      >
                        <Text style={[styles.reactionText, post.myReaction === type && styles.reactionTextActive]}>
                          {REACTION_LABELS[type]} {post.reactions[type] > 0 ? post.reactions[type] : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </CardContent>
              </Card>
            )}
          />
        )}

        {isJoined && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.postInput}
              placeholder="みんなに共有しよう（140文字まで）"
              placeholderTextColor={palette.mutedForeground}
              value={postText}
              onChangeText={setPostText}
              maxLength={140}
              multiline
            />
            <Button
              style={styles.sendBtn}
              onPress={() => postMutation.mutate()}
              disabled={!postText.trim() || postMutation.isPending}
            >
              <Send size={18} color={palette.primaryForeground} strokeWidth={2.5} />
            </Button>
          </View>
        )}
        <BottomTabBar />
      </View>
    );
  }

  // ── Room List ──────────────────────────────────────────────────────────────

  const challengeRooms = allRooms.filter((r) => r.type === 'challenge');
  const ageRooms = allRooms.filter((r) => r.type === 'age');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>コミュニティ</Title>
        <TouchableOpacity onPress={() => {
          setNewNickname(profile.nickname);
          setSelectedAvatar(profile.avatarIcon);
          setChildAge(profile.childAgeMonths?.toString() ?? '');
          setShowAge(profile.showChildAge);
          setShowSetup(true);
        }}>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>
              {AVATAR_MAP[profile.avatarIcon]} {profile.nickname}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'recommended' as Tab, label: 'おすすめ' },
          { key: 'rooms' as Tab, label: '全ルーム' },
          { key: 'joined' as Tab, label: '参加中' },
        ]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
              {t.key === 'joined' && joinedRooms.length > 0 ? ` (${joinedRooms.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {tab === 'recommended' && (
          <>
            <Text style={styles.sectionLabel}>あなたへのおすすめ</Text>
            <Muted style={styles.sectionSub}>育児ログのデータから、今のあなたに合うルームを提案します</Muted>
            {recommended.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isJoined={joinedRooms.some((r) => r.id === room.id)}
                onPress={() => setSelectedRoom(room)}
                onJoin={() => joinMutation.mutate(room.id)}
              />
            ))}
            {recommended.length === 0 && (
              <Muted style={styles.emptyText}>記録を増やすとおすすめが表示されます</Muted>
            )}
          </>
        )}

        {tab === 'rooms' && (
          <>
            <Text style={styles.sectionLabel}>課題軸ルーム</Text>
            <Muted style={styles.sectionSub}>同じ悩みを持つパパ・ママと繋がろう</Muted>
            {challengeRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isJoined={joinedRooms.some((r) => r.id === room.id)}
                onPress={() => setSelectedRoom(room)}
                onJoin={() => joinMutation.mutate(room.id)}
              />
            ))}

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>月齢ルーム</Text>
            <Muted style={styles.sectionSub}>同じ月齢のお子さまを持つ仲間と交流</Muted>
            {ageRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isJoined={joinedRooms.some((r) => r.id === room.id)}
                onPress={() => setSelectedRoom(room)}
                onJoin={() => joinMutation.mutate(room.id)}
              />
            ))}
          </>
        )}

        {tab === 'joined' && (
          <>
            {joinedRooms.length === 0 ? (
              <Muted style={styles.emptyText}>
                まだどのルームにも参加していません。{'\n'}「おすすめ」タブからルームを探してみましょう！
              </Muted>
            ) : (
              joinedRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isJoined={true}
                  onPress={() => setSelectedRoom(room)}
                  onJoin={() => {}}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showSetup} transparent animationType="slide" onRequestClose={() => setShowSetup(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSetup(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Title style={styles.sheetTitle}>プロフィール編集</Title>

            <Text style={styles.inputLabel}>ニックネーム</Text>
            <TextInput
              style={styles.input}
              value={newNickname}
              onChangeText={setNewNickname}
              maxLength={20}
              placeholderTextColor={palette.mutedForeground}
            />

            <Text style={styles.inputLabel}>アイコン</Text>
            <View style={styles.avatarGrid}>
              {Object.entries(AVATAR_MAP).map(([key, emoji]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.avatarOption, selectedAvatar === key && styles.avatarSelected]}
                  onPress={() => setSelectedAvatar(key)}
                >
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>お子さまの月齢</Text>
            <View style={styles.ageRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={childAge}
                onChangeText={setChildAge}
                keyboardType="numeric"
                placeholderTextColor={palette.mutedForeground}
              />
              <Text style={styles.ageUnit}>ヶ月</Text>
            </View>

            <TouchableOpacity style={styles.ageToggle} onPress={() => setShowAge(!showAge)}>
              <Text style={styles.ageToggleIcon}>{showAge ? '☑' : '☐'}</Text>
              <Muted style={styles.ageToggleText}>月齢を表示する</Muted>
            </TouchableOpacity>

            <Button
              style={styles.setupBtn}
              onPress={() => profileMutation.mutate()}
              disabled={!newNickname.trim() || profileMutation.isPending}
            >
              <Text style={styles.setupBtnText}>保存</Text>
            </Button>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <BottomTabBar />
    </View>
  );
}

function RoomCard({ room, isJoined, onPress, onJoin }: {
  room: Room;
  isJoined: boolean;
  onPress: () => void;
  onJoin: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.roomCard}>
        <CardContent style={styles.roomCardContent}>
          <Text style={styles.roomIcon}>{room.icon}</Text>
          <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{room.name}</Text>
            {room.description && (
              <Muted style={styles.roomDesc} numberOfLines={1}>{room.description}</Muted>
            )}
            <Muted style={styles.roomMembers}>{room.currentMembers}/{room.maxMembers} 人</Muted>
          </View>
          {isJoined ? (
            <Badge variant="secondary" style={styles.joinedBadge} textStyle={styles.joinedBadgeText}>
              参加中
            </Badge>
          ) : (
            <Button style={styles.joinBtn} onPress={onJoin}>
              <Text style={styles.joinBtnText}>参加</Text>
            </Button>
          )}
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.background },

  header: {
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1, borderBottomColor: TAB_BORDER,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontFamily: fonts.sans, fontSize: 22, color: palette.foreground },
  profileBadge: {
    backgroundColor: TAB_PURPLE_50, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  profileBadgeText: { fontSize: 13, color: palette.primary, fontFamily: fonts.bodySemibold },

  tabs: {
    flexDirection: 'row', backgroundColor: 'transparent',
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 8,
  },
  tab: {
    flex: 1, paddingVertical: 9, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    borderWidth: 1, borderColor: TAB_BORDER,
  },
  tabActive: { backgroundColor: TAB_PURPLE_50, borderColor: 'transparent' },
  tabText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: palette.mutedForeground },
  tabTextActive: { color: palette.primary, fontFamily: fonts.bodyBold },

  listContent: { padding: 16, paddingBottom: 40 },

  sectionLabel: { fontFamily: fonts.sans, fontSize: 15, color: palette.foreground, marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 12 },

  roomCard: { marginBottom: 10 },
  roomCardContent: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  roomIcon: { fontSize: 32 },
  roomInfo: { flex: 1 },
  roomName: { fontFamily: fonts.sans, fontSize: 15, color: palette.foreground },
  roomDesc: { fontSize: 12, marginTop: 2 },
  roomMembers: { fontSize: 11, color: palette.secondary, marginTop: 3 },

  joinBtn: {
    backgroundColor: palette.primary, borderColor: palette.primary, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 7, minHeight: undefined,
  },
  joinBtnText: { color: palette.primaryForeground, fontSize: 13, fontFamily: fonts.bodySemibold },
  joinedBadge: {
    backgroundColor: palette.accent, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  joinedBadgeText: { fontSize: 11, color: palette.accentForeground, fontFamily: fonts.bodyBold },

  // Setup
  setupContainer: {
    flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12,
  },
  setupTitle: { fontFamily: fonts.sans, fontSize: 22, color: palette.foreground, textAlign: 'center' },
  setupDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  inputLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: palette.foreground },
  required: { color: palette.destructive, fontFamily: fonts.bodyBold },
  input: {
    backgroundColor: palette.card, borderRadius: radius.sm, padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: palette.border, color: palette.foreground,
    fontFamily: fonts.body,
  },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: {
    width: 48, height: 48, borderRadius: radius.full, backgroundColor: palette.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSelected: { backgroundColor: palette.accent, borderWidth: 2, borderColor: palette.primary },
  avatarEmoji: { fontSize: 24 },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ageUnit: { fontFamily: fonts.body, fontSize: 15, color: palette.foreground },
  ageToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ageToggleIcon: { fontSize: 18, color: palette.primary },
  ageToggleText: { fontSize: 13 },
  setupBtn: {
    backgroundColor: palette.primary, borderColor: palette.primary, borderRadius: radius.sm,
    paddingVertical: 16, marginTop: 8,
  },
  setupBtnText: { color: palette.primaryForeground, fontSize: 16, fontFamily: fonts.sans },

  // Room Detail
  roomHeader: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1, borderBottomColor: TAB_BORDER,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtnWrap: { paddingVertical: 4, paddingRight: 4 },
  roomHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomHeaderIcon: { fontSize: 20 },
  roomHeaderName: { fontFamily: fonts.sans, fontSize: 16, color: palette.foreground, flexShrink: 1 },
  roomHeaderCount: { fontFamily: fonts.body, fontSize: 12, color: palette.mutedForeground },
  leaveBtn: { fontFamily: fonts.bodySemibold, color: palette.mutedForeground, fontSize: 13 },
  joinBtnSmall: {
    backgroundColor: TAB_PURPLE_50, borderColor: 'transparent', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, minHeight: undefined,
  },
  joinBtnSmallText: { color: palette.primary, fontSize: 13, fontFamily: fonts.bodySemibold },

  roomDescBar: {
    backgroundColor: palette.accent, paddingHorizontal: 16, paddingVertical: 8,
  },
  roomDescText: { fontFamily: fonts.body, fontSize: 12, color: palette.accentForeground },
  privacyNotice: { fontSize: 10, color: palette.primary, marginTop: 3 },

  // Posts
  emptyPosts: {
    textAlign: 'center', fontSize: 14, lineHeight: 22,
    transform: [{ scaleY: -1 }],
  },
  postCard: {},
  postCardContent: { padding: 14, gap: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAvatar: { fontSize: 24 },
  postNickname: { fontFamily: fonts.bodyBold, fontSize: 13, color: palette.foreground },
  postAge: { fontSize: 10, color: palette.secondary },
  postTime: { fontSize: 11, color: palette.mutedForeground },
  moreBtn: { paddingHorizontal: 4 },
  postBody: { fontFamily: fonts.body, fontSize: 14, color: palette.foreground, lineHeight: 21 },
  reactionRow: { flexDirection: 'row', gap: 8 },
  reactionBtn: {
    backgroundColor: palette.muted, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  reactionBtnActive: { backgroundColor: palette.accent },
  reactionText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: palette.mutedForeground },
  reactionTextActive: { color: palette.accentForeground, fontFamily: fonts.bodyBold },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, backgroundColor: palette.card,
    borderTopWidth: 1, borderTopColor: palette.border,
  },
  postInput: {
    flex: 1, backgroundColor: palette.background, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, maxHeight: 80, color: palette.foreground,
    fontFamily: fonts.body, borderWidth: 1, borderColor: palette.border,
  },
  sendBtn: {
    backgroundColor: palette.primary, borderColor: palette.primary, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: undefined,
  },

  emptyText: {
    textAlign: 'center', fontSize: 14, lineHeight: 22, marginTop: 40,
  },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: 24, gap: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: palette.border, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontFamily: fonts.sans, fontSize: 18, color: palette.foreground, textAlign: 'center' },

  // Bottom navigation tab bar — mirror of WeTabBar's soft design
  bottomNav: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 1,
    borderTopColor: TAB_BORDER,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 12,
  },
  bottomBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 4,
  },
  bottomBrandText: {
    fontSize: 8,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: TAB_PURPLE_300,
    letterSpacing: 1,
  },
  bottomItemsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    maxWidth: 448,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 4,
    height: 64,
  },
  bottomItem: { flex: 1, alignItems: 'center' },
  bottomItemInner: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  bottomIconPill: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  bottomItemLabel: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
