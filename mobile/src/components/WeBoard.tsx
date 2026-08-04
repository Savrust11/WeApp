import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, ChevronUp, ChevronDown } from 'lucide-react-native';
import { apiGet, apiPost } from '../api/client';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Text } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';

interface WeBoardMessage {
  id: number;
  familyId: string;
  userId: string;
  message: string;
  createdAt: string;
}

interface WeBoardProps {
  familyId: string;
  userId: string;
}

// Exact preset set from WeYu/client/src/components/WeBoard.tsx (QUICK_MESSAGES)
const QUICK_PRESETS = [
  'おつかれさま！',
  'ありがとう',
  'まかせて！',
  '帰るよ〜',
  'お風呂わかした',
  '寝かしつけ完了！',
];

// Web tailwind colors used as accents in client/src/components/WeBoard.tsx
const PURPLE_50 = '#F5F1FB'; // bg-purple-50
const PURPLE_100 = '#EDE7F6'; // bg-purple-100 / border-purple-100
const PURPLE_400 = '#A480D0'; // text-purple-400
const PURPLE_600 = '#7C5CBF'; // text-purple-600
const PURPLE_800 = '#5B3B86'; // text-purple-800
const GREEN_50 = '#ECFDF3'; // bg-green-50
const GREEN_100 = '#D1FADF'; // border-green-100
const GREEN_500 = '#22C55E'; // text-green-500
const GREEN_800 = '#166534'; // text-green-800
const GRAY_300 = '#D1D5DB'; // text-gray-300
const GRAY_400 = '#9CA3AF'; // text-gray-400
const GRAY_800 = '#1F2937'; // text-gray-800

function formatTime(iso: string): string {
  const d = new Date(iso);
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${M}/${D} ${hh}:${mm}`;
}

export default function WeBoard({ familyId, userId }: WeBoardProps) {
  const { isDark, colors } = useTheme();
  const [inputText, setInputText] = useState('');
  // Web parity (WeBoard.tsx:26): collapsed shows the 3 most recent,
  // expanded shows up to 10. The toggle button only renders when there
  // are more than 3 messages.
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<WeBoardMessage[]>({
    queryKey: ['weBoard', familyId],
    queryFn: () => apiGet<WeBoardMessage[]>(`/api/we-board/${familyId}`),
    enabled: !!familyId,
    refetchInterval: 30_000,
  });

  // Sorted oldest-first for display; slice from the end so the most recent
  // messages are always in view. Server returns up to 10 (storage.ts limit).
  const recent = [...messages]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(expanded ? -10 : -3);

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      // Server POST is /api/we-board (no familyId in the URL path — the id
      // travels in the body). GET is /api/we-board/:familyId which is why
      // the two callsites look asymmetric. See server/routes.ts:788-795.
      apiPost<WeBoardMessage>(`/api/we-board`, {
        familyId,
        userId,
        message,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weBoard', familyId] });
      setInputText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    },
    onError: () => {
      Alert.alert('送信に失敗しました', 'ネットワーク接続をご確認ください。');
    },
  });

  const handleSend = (override?: string) => {
    const trimmed = (override ?? inputText).trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  // Preset chips send immediately — matches web (WeBoard.tsx handleSend(qm)).
  // Previously this only filled the input, requiring another tap; users
  // typed "the bot didn't reply" because their preset never posted.
  const handlePreset = (preset: string) => {
    handleSend(preset);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={[styles.card, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Card header — web: icon box + title/subtitle + optional expand
            toggle on the right. Toggle only appears when > 3 messages,
            same as web (WeBoard.tsx:68). */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBox}>
              <MessageSquare size={16} color={PURPLE_600} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={[styles.cardTitle, isDark && { color: colors.text }]}>Weボード</Text>
              <Text style={styles.cardSubtitle}>パートナーへのひとこと</Text>
            </View>
          </View>
          {messages.length > 3 && (
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.expandBtnText}>
                {expanded ? '閉じる' : 'もっと見る'}
              </Text>
              {expanded ? (
                <ChevronUp size={12} color={PURPLE_600} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={12} color={PURPLE_600} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Messages area — height grows when expanded so the extra
            messages have room to scroll within the card. */}
        <View style={[styles.messagesContainer, expanded && styles.messagesContainerExpanded]}>
          {isLoading ? (
            <ActivityIndicator color={palette.primary} style={styles.loader} />
          ) : recent.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>まだメッセージがありません</Text>
              <Text style={styles.emptySub}>パートナーにひとこと送ってみましょう</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.messageScroll}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              {recent.map((msg) => {
                const isOwn = msg.userId === userId;
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageRow,
                      isOwn ? styles.messageRowOwn : styles.messageRowPartner,
                    ]}
                  >
                    <Text
                      style={[
                        styles.senderLabel,
                        isOwn ? styles.senderLabelOwn : styles.senderLabelPartner,
                      ]}
                    >
                      {msg.userId === 'papa' ? 'パパ' : 'ママ'}
                    </Text>
                    <View
                      style={[
                        styles.messageBubble,
                        isOwn ? styles.bubbleOwn : styles.bubblePartner,
                      ]}
                    >
                      <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextPartner]}>
                        {msg.message}
                      </Text>
                    </View>
                    <Text style={[styles.messageTime, isOwn ? styles.timeOwn : styles.timePartner]}>
                      {formatTime(msg.createdAt)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Quick preset buttons */}
        <View style={styles.footer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.presetsScroll}
            contentContainerStyle={styles.presetsContent}
          >
            {QUICK_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={styles.presetChip}
                onPress={() => handlePreset(preset)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>{preset}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, isDark && { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="メッセージを入力..."
              placeholderTextColor={PURPLE_400}
              value={inputText}
              onChangeText={setInputText}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sendMutation.isPending) && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={!inputText.trim() || sendMutation.isPending}
              activeOpacity={0.8}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Send size={16} color="#fff" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // web: bg-white/80 rounded-3xl border-2 border-purple-100 shadow-sm
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.lg, // rounded-3xl ≈ 24
    borderWidth: 2,
    borderColor: PURPLE_100,
    marginHorizontal: 16,
    // marginTop 16 gives visual breathing room from the feature card
    // above (貢献度ダッシュボード) — previously they visually touched.
    marginTop: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // web: px-4 pt-4 pb-2 flex items-center justify-between
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  // Left cluster: icon + title/subtitle
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  // Right cluster: expand/collapse toggle — matches web
  // (button-we-board-expand). Purple pill, small chevron.
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  expandBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: PURPLE_600,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.sm, // rounded-xl
    backgroundColor: PURPLE_100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.sans,
    fontSize: 14, // text-sm
    fontWeight: '900',
    color: GRAY_800,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: GRAY_400,
  },

  // Messages — web: px-4 max-h-36 collapsed / max-h-64 expanded
  messagesContainer: {
    minHeight: 120,
    maxHeight: 220,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Expanded state — tall enough to show ~7-10 messages before scrolling.
  // Matches web's max-h-64 (256px) roughly.
  messagesContainerExpanded: {
    maxHeight: 360,
  },
  loader: { marginVertical: 20 },
  emptyWrap: { paddingVertical: 16, alignItems: 'center' },
  emptyText: { fontSize: 12, color: GRAY_400, textAlign: 'center' },
  emptySub: { fontSize: 10, color: GRAY_300, textAlign: 'center', marginTop: 4 },
  messageScroll: { flex: 1 },

  // web: flex justify-(end|start), max-w-[75%], space-y-1.5
  messageRow: {
    marginBottom: 6,
    maxWidth: '75%',
  },
  messageRowOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowPartner: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  // web: text-[9px] font-bold mb-0.5 px-1
  senderLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  senderLabelOwn: { color: PURPLE_400, textAlign: 'right' },
  senderLabelPartner: { color: GREEN_500, textAlign: 'left' },
  // web: px-3 py-2 rounded-2xl text-sm
  messageBubble: {
    borderRadius: radius.md, // rounded-2xl
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOwn: {
    backgroundColor: PURPLE_100,
    borderBottomRightRadius: 6, // rounded-br-md
  },
  bubblePartner: {
    backgroundColor: GREEN_50,
    borderWidth: 1,
    borderColor: GREEN_100,
    borderBottomLeftRadius: 6, // rounded-bl-md
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextOwn: { color: PURPLE_800 },
  messageTextPartner: { color: GREEN_800 },
  // web: text-[8px] text-gray-300 mt-0.5 px-1
  messageTime: {
    fontSize: 8,
    color: GRAY_300,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  timeOwn: { textAlign: 'right' },
  timePartner: { textAlign: 'left' },

  // web: px-3 py-2 border-t border-purple-50
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: PURPLE_50,
  },
  // Presets — web: flex gap-1.5 mb-2 overflow-x-auto
  presetsScroll: { marginBottom: 8 },
  // paddingRight leaves a visible "there's more" gap and prevents chips
  // from being cut mid-character at the right edge on narrow phones.
  presetsContent: { gap: 6, paddingVertical: 2, paddingRight: 24 },
  // web: px-3 py-1.5 bg-purple-50 text-purple-600 rounded-xl text-[11px] font-bold
  presetChip: {
    backgroundColor: PURPLE_50,
    borderRadius: radius.sm, // rounded-xl
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetText: {
    fontSize: 11,
    color: PURPLE_600,
    fontWeight: '700',
  },

  // Input — web: flex gap-2
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // web: Input rounded-xl border-purple-100 text-sm h-9
  textInput: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: fonts.body,
    color: palette.foreground,
    borderWidth: 1,
    borderColor: PURPLE_100,
    height: 36,
  },
  // web: rounded-xl bg-purple-500 h-9 w-10 (size icon)
  sendButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.sm,
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
