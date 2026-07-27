/**
 * Team parenting skill tree — ported verbatim from web
 * (client/src/pages/SkillTree.tsx) so mobile and web show identical
 * levels / titles / conditions / mio messages.
 *
 * Source of truth: web SkillTree.tsx TEAM_SKILL_LEVELS + TEAM_TITLES
 * + getSkillIcon + getRelevantLevels.
 */
import {
  Users, Handshake, Brain, CalendarClock, Award,
  Zap, Heart, Bath, ShieldCheck, Moon, Package, Sparkles,
  ClipboardList, Droplets, Utensils, Trees, Stethoscope,
  RefreshCw, MessageCircle, Scale, ThumbsUp, HandHeart,
  Coins, Compass, Home, Baby,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface TeamSkillDef {
  id: string;
  title: string;
  condition: string;
  mioMessage: string;
}

export interface SkillLevelDef {
  id: string;
  level: number;
  title: string;
  subtitle: string;
  ageRange: string;
  minMonths: number;
  maxMonths: number;
  icon: LucideIcon;
  /** hex — mirrors web Tailwind text-{color}-600 */
  color: string;
  /** hex — mirrors web Tailwind bg-{color}-50 */
  bgColor: string;
  /** hex — mirrors web Tailwind border-{color}-200 */
  borderColor: string;
  skills: TeamSkillDef[];
}

export const TEAM_SKILL_LEVELS: SkillLevelDef[] = [
  {
    id: 'level0',
    level: 0,
    title: 'はじめての共同オペスキル',
    subtitle: 'ふたりで赤ちゃんを迎える基礎力',
    ageRange: '0〜1歳',
    minMonths: 0,
    maxMonths: 11,
    icon: Baby,
    color: '#DB2777',      // pink-600
    bgColor: '#FDF2F8',    // pink-50
    borderColor: '#FBCFE8',// pink-200
    skills: [
      { id: 'fast_diaper',       title: '爆速おむつ替え',          condition: '横漏れ・背中漏れさせずに、二人で連携してスムーズに完了できた',                       mioMessage: '息ぴったりのおむつ替え、赤ちゃんもご機嫌ですね。' },
      { id: 'burp_master',       title: 'ゲップの魔術師',          condition: '授乳後のゲップ出しを、二人で交代しながらスムーズにできた',                             mioMessage: '赤ちゃんもスッキリしましたね。魔法の手ですね。' },
      { id: 'solo_bath',         title: '沐浴・バスタイム連携',   condition: 'お風呂の準備から洗い、保湿、着替えまで二人で分担して完遂できた',                       mioMessage: 'お風呂タイムの連携プレー、お見事です。赤ちゃんもぽかぽかですね。' },
      { id: 'cry_stopper',       title: 'ギャン泣き鎮火リレー',    condition: '泣き止まない赤ちゃんを、交代（バトンタッチ）しながら落ち着かせた',                   mioMessage: 'バトンタッチで乗り越えるのが、チーム育児の真骨頂ですね。' },
      { id: 'night_shift',       title: '深夜シフトの交代制',      condition: '夜間の授乳・おむつ替えを、交代制で回して睡眠を確保できた',                             mioMessage: 'お互いの睡眠を守る。それが長く続ける秘訣ですね。' },
      { id: 'perfect_packing',   title: '忘れ物ゼロ・パッキング',  condition: 'おむつ・着替え・ミルクセット等、外出準備を二人で完璧にできた',                         mioMessage: '完璧な準備力。お出かけの安心感が違いますね。' },
      { id: 'invisible_backup',  title: '見えないバックアップ',    condition: '言われる前に哺乳瓶洗い・ゴミ出し・洗濯等のサポートを完了した',                         mioMessage: '気づいて動ける。最高のチームプレーですね。' },
      { id: 'doctor_report',     title: 'ドクター報告マスター',    condition: '病院で体温・便の状態・症状をログを見せながら正確に報告できた',                         mioMessage: '記録の力が、お子さまの健康を守りましたね。素晴らしい連携です。' },
    ],
  },
  {
    id: 'level1',
    level: 1,
    title: '生活自立の伴走スキル',
    subtitle: 'ふたりで基本の生活をサポート',
    ageRange: '1〜2歳',
    minMonths: 12,
    maxMonths: 35,
    icon: Handshake,
    color: '#2563EB',      // blue-600
    bgColor: '#EFF6FF',    // blue-50
    borderColor: '#BFDBFE',// blue-200
    skills: [
      { id: 'toilet_navigate',   title: 'トイトレ・ナビゲート',    condition: '子供のサインを見逃さず、二人で連携してトイレに誘導できた',                             mioMessage: 'お二人の息がぴったりですね。お子さまも安心してチャレンジできましたね。' },
      { id: 'meal_produce',      title: '食事のプロデュース',      condition: '好き嫌いや遊び食べに対し、二人で一貫した態度で楽しく食事を完結させた',                 mioMessage: '食卓の空気を二人で整えられるのは、素晴らしいチームワークですね。' },
      { id: 'outing_relay',      title: '公園・お出かけリレー',    condition: '走り回る子を二人で交代しながら見守り、安全に外遊びを終えられた',                       mioMessage: '目線を切らさないリレー、お見事です。お子さまも思い切り遊べましたね。' },
      { id: 'sleep_routine',     title: 'ねんねルーティン構築',    condition: 'お風呂→歯みがき→絵本→ねんねの流れを二人で一貫して回せた',                           mioMessage: '毎日の小さな積み重ねが、ぐっすり眠る力に育ちますね。' },
      { id: 'sick_team',         title: '病気のときのチーム対応',  condition: '発熱や体調不良時に役割分担（看病・受診・連絡）して乗り切った',                         mioMessage: '片方が崩れない仕組みづくりが、家族を守る一番の力ですね。' },
    ],
  },
  {
    id: 'level2',
    level: 2,
    title: 'メンタル・コーチングスキル',
    subtitle: '子供の心に寄り添う連携力',
    ageRange: '2〜4歳',
    minMonths: 24,
    maxMonths: 59,
    icon: Brain,
    color: '#9333EA',      // purple-600
    bgColor: '#FAF5FF',    // purple-50
    borderColor: '#E9D5FF',// purple-200
    skills: [
      { id: 'tantrum_handling',  title: 'イヤイヤ期・ハンドリング', condition: '爆発した子供の感情を、二人で交代（バトンタッチ）しながら冷静に鎮められた',            mioMessage: 'バトンタッチで乗り越える。それが『チーム育児』の真価ですね。' },
      { id: 'word_empathy',      title: '言葉の共感ビルド',        condition: '子供の拙い言葉を二人が同じ解釈で受け止め、語彙を広げてあげられた',                     mioMessage: 'お二人が同じ目線で言葉を受け止める。お子さまの言葉がぐんと伸びますね。' },
      { id: 'rule_consistency',  title: 'ルール・統一戦線',        condition: 'おやつ・テレビ・寝る時間など、二人で同じルールを守って伝えられた',                     mioMessage: 'ふたりの軸が揃うと、子どもは安心してルールを学べますね。' },
      { id: 'praise_relay',      title: 'ほめ言葉のリレー',        condition: '片方が見つけた『できた！』を、もう片方にも共有して二重に褒められた',                   mioMessage: '二度褒められる嬉しさは、自己肯定感の最高の栄養ですね。' },
      { id: 'social_support',    title: 'お友達トラブル・サポート',condition: '園や公園での子供同士のトラブルを、二人で同じ方針で受け止められた',                     mioMessage: 'ふたりで方針を決めて関わる姿勢、お子さまにとって何よりの安心です。' },
    ],
  },
  {
    id: 'level3',
    level: 3,
    title: 'チーム・マネジメントスキル',
    subtitle: '家族の運営を二人で完璧に',
    ageRange: '4〜6歳',
    minMonths: 48,
    maxMonths: 72,
    icon: CalendarClock,
    color: '#059669',      // emerald-600
    bgColor: '#ECFDF5',    // emerald-50
    borderColor: '#A7F3D0',// emerald-200
    skills: [
      { id: 'schedule_sync',        title: 'スケジュール・同期',    condition: '園の行事や習い事を、どちらかが不在でも完璧に回せる情報共有ができた',                mioMessage: '情報の共有力は、チームの信頼そのもの。素晴らしい連携です。' },
      { id: 'independence_support', title: '自立支援・スタンプ',    condition: '子供の『自分でやりたい』を引き出し、先回りせずに見守れた',                          mioMessage: '見守る勇気こそ、親の最高のスキルですね。お子さまの自信が育っています。' },
      { id: 'money_lesson',         title: 'おこづかい・お金の学び', condition: 'おこづかいやお買い物体験を通じて、二人で『お金の使い方』を伝えられた',              mioMessage: 'お金との付き合い方は、生きる力の土台ですね。素敵な学びをありがとう。' },
      { id: 'future_dialogue',      title: '未来の対話・進路相談',  condition: '小学校・習い事・将来の話を二人でフラットに話し合えた',                              mioMessage: 'ふたりで未来を描く時間こそ、家族の財産ですね。' },
      { id: 'family_council',       title: '家族会議・運営術',      condition: '週末や月初に家族で予定・気持ちを共有する時間を持てた',                              mioMessage: '話し合える家族は、どんなことも乗り越えられますね。' },
    ],
  },
];

export const TEAM_TITLES: { min: number; title: string; emoji: string }[] = [
  { min: 0,  title: '新米チーム',       emoji: '🌱' },
  { min: 3,  title: 'ビギナーチーム',   emoji: '🌿' },
  { min: 7,  title: '中堅チーム',       emoji: '🌳' },
  { min: 12, title: '達人チーム',       emoji: '✨' },
  { min: 18, title: 'マスターチーム',   emoji: '👑' },
  { min: 24, title: 'レジェンドチーム', emoji: '🏆' },
];

export function getTeamTitle(completed: number) {
  let current = TEAM_TITLES[0];
  for (const t of TEAM_TITLES) if (completed >= t.min) current = t;
  const next = TEAM_TITLES.find((t) => t.min > completed);
  return { current, next };
}

export function getSkillIcon(skillId: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    fast_diaper: Zap,
    burp_master: Heart,
    solo_bath: Bath,
    cry_stopper: ShieldCheck,
    night_shift: Moon,
    perfect_packing: Package,
    invisible_backup: Sparkles,
    doctor_report: ClipboardList,
    toilet_navigate: Droplets,
    meal_produce: Utensils,
    tantrum_handling: RefreshCw,
    word_empathy: MessageCircle,
    schedule_sync: CalendarClock,
    independence_support: HandHeart,
    outing_relay: Trees,
    sleep_routine: Moon,
    sick_team: Stethoscope,
    rule_consistency: Scale,
    praise_relay: ThumbsUp,
    social_support: Users,
    money_lesson: Coins,
    future_dialogue: Compass,
    family_council: Home,
  };
  return iconMap[skillId] ?? Award;
}

export function getRelevantLevels(ageMonths: number | null): SkillLevelDef[] {
  if (ageMonths === null) return TEAM_SKILL_LEVELS;
  return TEAM_SKILL_LEVELS.filter(
    (l) => ageMonths >= l.minMonths && ageMonths <= l.maxMonths,
  );
}

export const TOTAL_SKILLS = TEAM_SKILL_LEVELS.reduce(
  (sum, l) => sum + l.skills.length,
  0,
);
