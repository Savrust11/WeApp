/**
 * TipsScreen — faithful 1:1 port of the canonical web page
 * `WeYu/client/src/pages/Tips.tsx` (使い方ヒント).
 *
 * Reproduces ALL of the web content verbatim:
 *  • Purple header banner ("We育" eyebrow + 使い方ヒント title) — web: bg-purple-900
 *  • Sticky 4-tab bar (新機能 / パートナー招待 / ご褒美ショップ / 泣き止みレスキュー)
 *  • Per-tab content built from Step / FeatureCard / Hero / UpdateCard blocks
 *    – WhatsNew      → web WhatsNew()
 *    – PartnerInvite → web PartnerInvite()
 *    – RewardShop    → web RewardShop()
 *    – CryingRescue  → web CryingRescue()
 *  • LINE で質問する footer + ぶどうの木 credit
 *
 * Styling sourced ONLY from ../theme/tokens + ../theme/ui; icons from
 * lucide-react-native (same icons WeYu Tips.tsx imports). The screen is
 * registered by the navigator with headerShown: true (back header), so the
 * in-content header here mirrors WeYu's own in-page header banner.
 */
import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import {
  Users,
  Gift,
  BellRing,
  Lightbulb,
  CheckCircle2,
  MessageSquare,
  BarChart3,
  Heart,
  Send,
  ShoppingBag,
  Baby,
  Droplets,
  Moon,
  Thermometer,
  AlertTriangle,
  Handshake,
  ExternalLink,
  Sparkles,
  Trophy,
  Sun,
  Clock,
  NotebookPen,
  Utensils,
  BarChart,
  CalendarX,
  FolderOpen,
  Sprout,
  CalendarDays,
  Edit3,
  Milk,
  HeartPulse,
} from 'lucide-react-native';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Card, Text, Title } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';

// ─── Step / FeatureCard / Hero (web: Tips.tsx Step + FeatureCard + hero block) ──

function Step({
  num,
  title,
  desc,
  tip,
}: {
  num: number;
  title: string;
  desc: React.ReactNode;
  tip?: string;
}) {
  return (
    <Card style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNum}>
          <Text style={styles.stepNumText}>{num}</Text>
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      <View style={styles.stepDescWrap}>
        {typeof desc === 'string' ? <Text style={styles.stepDesc}>{desc}</Text> : desc}
      </View>
      {tip ? (
        <View style={styles.tipBox}>
          <Lightbulb size={16} color={palette.primary} style={styles.tipIcon} />
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function FeatureCard({
  Icon,
  title,
  desc,
}: {
  Icon: typeof Baby;
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconBox}>
        <Icon size={20} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function Hero({
  Icon,
  title,
  sub,
}: {
  Icon: typeof Baby;
  title: string;
  sub: string;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroIconBox}>
        <Icon size={24} color={palette.primaryForeground} />
      </View>
      <Title style={styles.heroTitle}>{title}</Title>
      <Text style={styles.heroSub}>{sub}</Text>
    </View>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

// ─── Tab: 新機能 (web: WhatsNew) ─────────────────────────────────────────────────

function UpdateCard({
  Icon,
  iconColor,
  iconBg,
  title,
  desc,
  hint,
  note,
  noteBg,
  noteColor,
}: {
  Icon: typeof Baby;
  iconColor: string;
  iconBg: string;
  title: string;
  desc: string;
  hint?: string;
  note?: string;
  noteBg?: string;
  noteColor?: string;
}) {
  return (
    <Card style={styles.updateCard}>
      <View style={styles.updateHeader}>
        <View style={[styles.updateIconBox, { backgroundColor: iconBg }]}>
          <Icon size={18} color={iconColor} />
        </View>
        <Text style={styles.updateTitle}>{title}</Text>
      </View>
      <Text style={styles.updateDesc}>{desc}</Text>
      {hint ? <Text style={styles.updateHint}>{hint}</Text> : null}
      {note ? (
        <View style={[styles.updateNote, noteBg ? { backgroundColor: noteBg } : null]}>
          <Text style={[styles.updateNoteText, noteColor ? { color: noteColor } : null]}>
            {note}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function WhatsNew() {
  return (
    <View>
      <Hero
        Icon={Sparkles}
        title="最新アップデート"
        sub="We育がもっと使いやすくなりました。新機能をご紹介します。"
      />

      <Text style={styles.eyebrowLabel}>2026年4月21日のアップデート</Text>

      <UpdateCard
        Icon={Clock}
        iconColor="#7C3AED"
        iconBg="#EDE9FE"
        title="抱っこに「終了時刻」を追加"
        desc="抱っこの記録で、開始時刻だけでなく「何時まで抱っこしたか」も入力できるようになりました。所要時間が自動計算されます。"
      />
      <UpdateCard
        Icon={Sun}
        iconColor="#6366F1"
        iconBg="#E0E7FF"
        title="画面の明るさを自分で時間設定"
        desc="自動ダークモードの切り替え時間を、自分のライフスタイルに合わせて自由に設定できるようになりました。日をまたぐ設定（例：22時〜7時）も可能です。"
        hint="設定 → 画面の明るさ → 自動"
      />
      <UpdateCard
        Icon={Trophy}
        iconColor="#D97706"
        iconBg="#FEF3C7"
        title="チーム育児スキルが大進化"
        desc="全レベルが常に表示され、先のレベルを先取りで見られるようになりました。スキル数も大幅に増え、達成数に応じて「新米→ビギナー→中堅→達人→マスター→レジェンド」と称号が進化します。"
        note="追加スキル例：公園リレー、ねんねルーティン、病気のチーム対応、ルール統一、ほめ言葉リレー、おこづかい、家族会議 など"
        noteBg="#FEF3C7"
        noteColor="#92400E"
      />
      <UpdateCard
        Icon={NotebookPen}
        iconColor="#3B82F6"
        iconBg="#DBEAFE"
        title="ねんね記録にコメント欄"
        desc="ねんねログに「メモ」を残せるようになりました。寝かしつけの様子や夜泣きの内容など、後から振り返れます。タイムラインの編集ダイアログからも編集できます。"
      />
      <UpdateCard
        Icon={Sparkles}
        iconColor="#EA580C"
        iconBg="#FFEDD5"
        title="おやつ記録がもっと簡単に"
        desc="内容入力が任意になりました。空欄のまま「サッと記録」を押すだけで「おやつを食べました」と記録できます。"
      />

      <Text style={[styles.eyebrowLabel, { marginTop: 24 }]}>これまでのアップデート</Text>

      <UpdateCard
        Icon={HeartPulse}
        iconColor="#F43F5E"
        iconBg="#FFE4E6"
        title="ママのからだ記録"
        desc="産後のからだを、あなただけのために記録できます。お通じ・悪露・会陰の痛み・気分・睡眠・授乳トラブル・体重むくみまで。"
        note="この記録はパートナーには見えません。記録が2件以上たまると「過去の記録 ▼ 見る」ボタンで全件まとめて確認・編集できます。けんこう画面の一番下から入力できます。"
        noteBg="#FFE4E6"
        noteColor="#9F1239"
      />
      <UpdateCard
        Icon={Baby}
        iconColor="#7C3AED"
        iconBg="#EDE9FE"
        title="「抱っこ」記録ボタンが新登場"
        desc="「ずっと抱っこしていたことをパートナーに知ってほしい」というご要望にお応えしました。0〜6歳全フェーズで使えます。開始・終了時刻を入力すると「パパが抱っこしました（30分間）」のように記録されます。"
      />
      <UpdateCard
        Icon={Milk}
        iconColor="#3B82F6"
        iconBg="#DBEAFE"
        title="分析にミルク量(ml)グラフ"
        desc="分析ページにミルク量(ml)の表示を追加。7日間のグラフと先週比の比較ができます。"
      />
      <UpdateCard
        Icon={Edit3}
        iconColor="#EA580C"
        iconBg="#FFEDD5"
        title="症状・体温ログを編集可能に"
        desc="「嘔吐」などの症状ログをタップすると、時刻・症状・メモを後から編集できるようになりました。"
      />
      <UpdateCard
        Icon={CalendarDays}
        iconColor="#0891B2"
        iconBg="#CFFAFE"
        title="健康ログに日付を表示"
        desc="体温・症状・予防接種のログに「今日」「4月9日」のような日付が追加されました。いつの記録かひと目でわかります。"
      />
      <UpdateCard
        Icon={Sprout}
        iconColor="#EC4899"
        iconBg="#FCE7F3"
        title="寝かしつけの言葉をやさしく"
        desc="「ねんね予測がすぎた時の言葉が強くて焦った」というご意見を受け、寝かしつけにまつわるすべての言葉と色合いをやさしいトーンに見直しました。予測時刻が過ぎても、焦らせず、責めず、あなたのペースで大丈夫という気持ちが伝わる表現に。"
      />
      <UpdateCard
        Icon={FolderOpen}
        iconColor="#059669"
        iconBg="#D1FAE5"
        title="振り返りに「園・予定」タブ"
        desc="振り返りページに「園・予定」タブを追加。園の記録・入学準備・しつけ・よていの4つがひとまとめで確認できます。当月に記録があるとタブに件数バッジも表示されます。「全部」タブでも一緒に見られます。"
      />
      <UpdateCard
        Icon={CalendarX}
        iconColor="#A16207"
        iconBg="#FEF9C3"
        title="分析から「あの日」を除外できる"
        desc="「おばあちゃんちに預けた日、記録ゼロで平均が崩れてる…」そんな日を除外できます。分析ページの最上部「分析から除外する日」パネルから、除外したい日をタップするだけ。"
      />
      <UpdateCard
        Icon={BarChart}
        iconColor="#6366F1"
        iconBg="#E0E7FF"
        title="睡眠の合計 → 1日の平均に"
        desc="大きく表示していた夜間・昼間の合計を「1日あたりの平均時間」に変更。「夜は平均◯時間寝てくれている」がひと目でわかります。時間帯別ランキング(上位3位)はこれまでどおり14日間の合計で表示します。"
      />
      <UpdateCard
        Icon={Utensils}
        iconColor="#D97706"
        iconBg="#FEF3C7"
        title="離乳食の食べ具合が7段階に"
        desc="より細かく食べ具合を記録できるようになりました。"
        note="イヤイヤ → 少し → 1/3 → 半分 → 2/3 → 8割 → 完食"
        noteBg="#FEF3C7"
        noteColor="#92400E"
      />

      <View style={styles.calloutBox}>
        <Lightbulb size={16} color={palette.primary} style={styles.tipIcon} />
        <Text style={styles.calloutText}>
          ご要望・ご感想はLINEからお気軽にお寄せください。皆さまの声がWe育を育てます。
        </Text>
      </View>
    </View>
  );
}

// ─── Tab: パートナー招待 (web: PartnerInvite) ───────────────────────────────────

function PartnerInvite() {
  return (
    <View>
      <Hero
        Icon={Users}
        title="パートナーを招待しよう"
        sub="We育は「ふたり」で使ってこそ本領発揮。招待は3分で完了します。"
      />

      <Paragraph>
        パートナーを招待すると、育児記録・貢献度ダッシュボード・Weボードのすべてがリアルタイムで共有されます。
      </Paragraph>

      <SectionHeading>招待の手順</SectionHeading>

      <Step
        num={1}
        title="パートナー用の招待コードを取得"
        desc="モニター登録時に、パートナー用の招待コードが必要な旨をWe育のLINE公式アカウントにメッセージしてください。パートナー専用のコードをお送りします。"
      />
      <Step
        num={2}
        title="パートナーにコードとURLを共有"
        desc={
          <Text style={styles.stepDesc}>
            招待コードとアプリのURL（
            <Text style={styles.inlineAccent}>we-iku.com</Text>
            ）をパートナーに伝えてください。LINEでそのまま転送するのが簡単です。
          </Text>
        }
      />
      <Step
        num={3}
        title="パートナーがログイン＋コード入力"
        desc="パートナーもLINEでログインし、招待コードを入力すればアカウント作成完了です。"
        tip="パートナーもホーム画面への追加をお忘れなく！設定ガイドをシェアしてあげてください。"
      />
      <Step
        num={4}
        title="アプリ内でパートナー連携"
        desc="設定画面 →「パートナー設定」からパートナーを連携します。連携が完了すると、すべての育児データがリアルタイムで同期されます。"
      />

      <View style={styles.accentPanel}>
        <Text style={styles.accentPanelTitle}>連携するとできること</Text>
        <View style={styles.accentRow}>
          <CheckCircle2 size={16} color={palette.primary} />
          <Text style={styles.accentRowText}>育児記録がリアルタイム同期</Text>
        </View>
        <View style={styles.accentRow}>
          <BarChart3 size={16} color={palette.primary} />
          <Text style={styles.accentRowText}>貢献度ダッシュボードで分担を可視化</Text>
        </View>
        <View style={styles.accentRow}>
          <Heart size={16} color={palette.primary} />
          <Text style={styles.accentRowText}>「ありがとう」を送り合える</Text>
        </View>
        <View style={styles.accentRow}>
          <MessageSquare size={16} color={palette.primary} />
          <Text style={styles.accentRowText}>Weボードでクイックメッセージ</Text>
        </View>
        <View style={styles.accentRow}>
          <Gift size={16} color={palette.primary} />
          <Text style={styles.accentRowText}>ご褒美ショップのポイントを共有</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Tab: ご褒美ショップ (web: RewardShop) ──────────────────────────────────────

function RewardShop() {
  return (
    <View>
      <Hero
        Icon={Gift}
        title="ご褒美ショップを設定しよう"
        sub="「ありがとう」で貯まるWeポイント。ふたりだけのご褒美を設定しましょう。"
      />

      <Paragraph>
        育児の頑張りが「ありがとう」→ ポイント → ご褒美、という形で報われる仕組みです。最初からいくつかのクーポンが用意されていますが、ふたりに合ったオリジナルクーポンを追加するのがおすすめです。
      </Paragraph>

      <SectionHeading>最初から入っているクーポン</SectionHeading>

      <FeatureCard Icon={Handshake} title="30分のマッサージ" desc="200ポイントで交換。パートナーからの至福の30分。" />
      <FeatureCard Icon={ExternalLink} title="1時間の一人おでかけ" desc="300ポイント。カフェでも散歩でも、自分だけの時間。" />
      <FeatureCard Icon={ShoppingBag} title="好きなランチ出前" desc="500ポイント。頑張った自分に好きなものを。" />
      <FeatureCard Icon={Moon} title="朝までぐっすり睡眠" desc="1000ポイント。夜泣き対応をパートナーにお任せ。最高のご褒美。" />

      <SectionHeading>カスタムクーポンを追加する</SectionHeading>

      <Step num={1} title="ご褒美タブを開く" desc="ナビゲーションの「ご褒美」アイコンをタップします。" />
      <Step num={2} title="「カスタムクーポンを追加」をタップ" desc="画面下部にある点線のボタンをタップします。" />
      <Step
        num={3}
        title="クーポンの内容を設定"
        desc="クーポン名（例：「映画に行く権利」）と必要ポイント数を入力します。"
        tip="ふたりで相談してポイント数を決めるのがおすすめ。お互いが納得できる「レート」にしましょう。"
      />

      <View style={styles.ideaBox}>
        <View style={styles.ideaHeader}>
          <Lightbulb size={16} color="#D97706" />
          <Text style={styles.ideaTitle}>クーポンのアイデア集</Text>
        </View>
        <Text style={styles.ideaText}>
          ・ 30分のゲーム時間（150pt）{'\n'}
          ・ 好きなスイーツを買ってきてもらう（200pt）{'\n'}
          ・ 半日のフリータイム（800pt）{'\n'}
          ・ 二人でディナー（デート）（1500pt）{'\n'}
          ・ 推しのライブに行く（2000pt）
        </Text>
      </View>
    </View>
  );
}

// ─── Tab: 泣き止みレスキュー (web: CryingRescue) ────────────────────────────────

function CryingRescue() {
  return (
    <View>
      <Hero
        Icon={BellRing}
        title="泣き止みレスキューの使い方"
        sub="深夜3時、赤ちゃんが泣き止まない。そんな時の頼れる味方です。"
      />

      <Paragraph>
        ホーム画面の大きな紫色のボタン「泣き止みレスキュー」。SOSボタンを押すだけで、お子さまの状況に合わせた対処法を順番にガイドします。
      </Paragraph>

      <SectionHeading>使い方</SectionHeading>

      <Step
        num={1}
        title="SOSボタンをタップ"
        desc="ホーム画面の泣き止みレスキューにある「SOS」ボタンを押します。パニックの時でもワンタップで起動できます。"
      />
      <Step
        num={2}
        title="消去法ナビがスタート"
        desc="直近の育児ログ（最後の授乳時間、おむつ交換、睡眠時間など）をもとに、泣いている原因を一つずつ確認していきます。"
      />
      <Step
        num={3}
        title="対処法リストが表示"
        desc="可能性の高い順に対処法が表示されます。一つずつ試してみてください。"
        tip="「解決！」をタップすると記録に残ります。次回以降の参考にもなります。"
      />

      <SectionHeading>ガイドの内容例</SectionHeading>

      <FeatureCard Icon={Baby} title="おなかが空いているかも" desc="前回の授乳から3時間経っています。ミルクを試してみましょう。" />
      <FeatureCard Icon={Droplets} title="おむつの確認" desc="最後のおむつ交換から2時間。チェックしてみてください。" />
      <FeatureCard Icon={Moon} title="眠いのかもしれません" desc="起きてから4時間。抱っこやスワドルで寝かしつけを試してみましょう。" />
      <FeatureCard Icon={Thermometer} title="体調の確認" desc="いつもと泣き方が違うと感じたら、体温を測ってみましょう。" />

      <View style={styles.warnBox}>
        <View style={styles.ideaHeader}>
          <AlertTriangle size={16} color={palette.destructive} />
          <Text style={styles.warnTitle}>大切なお知らせ</Text>
        </View>
        <Text style={styles.warnText}>
          泣き止みレスキューは育児のサポートツールであり、医療上のアドバイスではありません。お子さまの体調に不安がある場合は、必ず医療機関にご相談ください。
        </Text>
      </View>

      <View style={styles.partnerBox}>
        <View style={styles.ideaHeader}>
          <Users size={16} color={palette.primary} />
          <Text style={styles.partnerTitle}>パートナーとの連携</Text>
        </View>
        <Text style={styles.partnerText}>
          泣き止みレスキューを使うと、パートナーの画面にも通知が届きます。「今、赤ちゃんが泣いていて対応中」ということが伝わるので、駆けつけてバトンタッチしやすくなります。
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'whatsnew', label: '新機能', Icon: Sparkles },
  { id: 'partner', label: 'パートナー招待', Icon: Users },
  { id: 'reward', label: 'ご褒美ショップ', Icon: Gift },
  { id: 'rescue', label: '泣き止みレスキュー', Icon: BellRing },
] as const;

export default function TipsScreen() {
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('whatsnew');

  const ActiveComponent =
    activeTab === 'whatsnew'
      ? WhatsNew
      : activeTab === 'partner'
        ? PartnerInvite
        : activeTab === 'reward'
          ? RewardShop
          : CryingRescue;

  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.background }]}>
      {/* Header banner — web Tips: bg-purple-900 centered header */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>We育</Text>
        <Title style={styles.headerTitle}>使い方ヒント</Title>
      </View>

      {/* Sticky 4-tab bar — web Tips: flex row, border-bottom highlight on active */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const TabIcon = tab.Icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <TabIcon size={20} color={isActive ? palette.primary : palette.mutedForeground} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ActiveComponent />

        {/* Footer — web Tips: LINE で質問する + ぶどうの木 credit */}
        <View style={styles.footer}>
          <Text style={styles.footerNote}>ご不明な点はお気軽にどうぞ</Text>
          <TouchableOpacity
            style={styles.lineBtn}
            onPress={() => Linking.openURL('https://line.me')}
            activeOpacity={0.85}
          >
            <Send size={16} color="#FFFFFF" />
            <Text style={styles.lineBtnText}>LINE で質問する</Text>
          </TouchableOpacity>
          <Text style={styles.footerCredit}>We育（ウィーイク）| Produced by ぶどうの木</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },

  // Header (web Tips: bg-purple-900 centered)
  header: {
    backgroundColor: palette.primary,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerEyebrow: {
    fontSize: 13,
    color: palette.primaryForeground,
    opacity: 0.7,
    marginBottom: 2,
    fontFamily: fonts.body,
  },
  headerTitle: { fontSize: 19, color: palette.primaryForeground },

  // Tab bar — web Tips: flex row, border-bottom highlight on active
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
    ...shadows.soft,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: palette.primary },
  tabLabel: {
    fontSize: 10,
    color: palette.mutedForeground,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  tabLabelActive: { color: palette.primary, fontFamily: fonts.bodyBold, fontWeight: '700' },

  content: { padding: 16, paddingBottom: 48 },

  // Hero gradient block (web: bg-gradient-to-br rounded-[20px] p-6)
  hero: {
    backgroundColor: palette.primary,
    borderRadius: radius.lg,
    padding: 24,
    marginBottom: 20,
    ...shadows.soft,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, color: palette.primaryForeground, marginBottom: 6 },
  heroSub: {
    fontSize: 13,
    color: palette.primaryForeground,
    opacity: 0.88,
    lineHeight: 20,
  },

  paragraph: {
    fontSize: 13.5,
    color: palette.mutedForeground,
    lineHeight: 21,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.accentForeground,
    marginBottom: 12,
    marginTop: 8,
  },
  eyebrowLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.mutedForeground,
    marginBottom: 12,
  },
  inlineAccent: { color: palette.accentForeground, fontFamily: fonts.bodyBold, fontWeight: '700' },

  // Step card (web: Card p-4 rounded-[20px] mb-3)
  stepCard: { padding: 16, borderRadius: radius.md, marginBottom: 12 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: palette.primaryForeground,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  stepTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.foreground,
  },
  stepDescWrap: { paddingLeft: 44 },
  stepDesc: { fontSize: 13.5, lineHeight: 21, color: palette.mutedForeground },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 12,
    marginLeft: 44,
  },
  tipIcon: { marginTop: 2 },
  tipText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: palette.accentForeground },

  // Feature card (web: bg-white rounded-[16px] p-4 flex gap-3.5)
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: palette.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 10,
    ...shadows.soft,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.foreground,
    marginBottom: 4,
  },
  featureDesc: { fontSize: 13, lineHeight: 20, color: palette.mutedForeground },

  // Update card (web WhatsNew: Card with small icon box + title + desc)
  updateCard: { padding: 16, borderRadius: radius.md, marginBottom: 12 },
  updateHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  updateIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.foreground,
  },
  updateDesc: { fontSize: 13, lineHeight: 21, color: palette.mutedForeground, paddingLeft: 48 },
  updateHint: { fontSize: 11, color: palette.primary, marginTop: 8, paddingLeft: 48 },
  updateNote: {
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 12,
    marginLeft: 48,
    marginTop: 8,
  },
  updateNoteText: { fontSize: 12, lineHeight: 19, color: palette.accentForeground },

  // Accent panel (web PartnerInvite: gradient purple panel)
  accentPanel: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 16,
    gap: 8,
  },
  accentPanelTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 4,
  },
  accentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentRowText: { fontSize: 13, color: palette.primary },

  // Idea box (web RewardShop: bg-amber-50 border-amber-200)
  ideaBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: 16,
    marginTop: 16,
  },
  ideaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ideaTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: '#B45309',
  },
  ideaText: { fontSize: 13, lineHeight: 22, color: '#92400E' },

  // Warning box (web CryingRescue: bg-red-50 border-red-200)
  warnBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: 16,
    marginTop: 16,
  },
  warnTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: '#B91C1C',
  },
  warnText: { fontSize: 13, lineHeight: 21, color: '#991B1B' },

  // Partner box (web CryingRescue: bg-purple-50)
  partnerBox: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 12,
  },
  partnerTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: palette.primary,
  },
  partnerText: { fontSize: 13, lineHeight: 21, color: palette.primary },

  // Generic callout (web: bg-purple-50 rounded-[18px] p-4)
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 20,
  },
  calloutText: { flex: 1, fontSize: 12.5, lineHeight: 20, color: palette.primary },

  // Footer (web Tips: LINE で質問する + ぶどうの木 credit)
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.accent,
  },
  footerNote: { fontSize: 12, color: palette.mutedForeground, marginBottom: 12 },
  lineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#06C755',
    borderRadius: radius.full,
    paddingHorizontal: 28,
    paddingVertical: 12,
    ...shadows.soft,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  lineBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  footerCredit: { fontSize: 11, color: palette.mutedForeground, marginTop: 16 },
});
