/**
 * pointsManager — Spec §13
 *
 * Calculates points for each log entry and derives チームパワー.
 *
 * Rules:
 *  • Base points per log type (10–30 pt)
 *  • Night bonus (22:00–6:00): +10 pt
 *  • Milestone / word / achievement: 30 pt flat
 *  • Points spent on coupons are subtracted for available balance
 *  • チームパワー = (totalEarned + thankYouCount × 5) ÷ daysSinceBirth
 */

// ─── Base point table ─────────────────────────────────────────────────────────

const BASE_POINTS: Record<string, number> = {
  breastfeed:   15,
  expressed:    15,
  formula:      15,
  milk:         15,
  diaper_wet:   10,
  diaper_poop:  10,
  sleep:        20,
  bath:         20,
  medicine:     20,
  temperature:  15,
  food:         15,
  meal:         15,
  snack:        10,
  symptoms:     15,
  milestone:    30,
  word:         30,
  achievement:  30,
  play:         10,
  school:       10,
  schedule:     10,
  appointment:  15,
};

const DEFAULT_BASE = 10;
const NIGHT_BONUS  = 10; // added when hour is 22–23 or 0–5

// ─── Per-log point calculation ────────────────────────────────────────────────

export interface LogForPoints {
  type: string;
  createdAt: string;
  points?: number | null; // server-provided value (used as override if present)
}

/**
 * Returns the point value for a single log entry.
 * If the server has already assigned a non-zero `points` field, that wins.
 */
export function calcLogPoints(log: LogForPoints): number {
  // Server override
  if (log.points != null && log.points > 0) return log.points;

  const base = BASE_POINTS[log.type] ?? DEFAULT_BASE;
  const hour = new Date(log.createdAt).getHours();
  const nightBonus = (hour >= 22 || hour < 6) ? NIGHT_BONUS : 0;
  return base + nightBonus;
}

/**
 * Sums earned points across all logs.
 * Optionally deducts coupon costs to return the spendable balance.
 */
export function calcTotalPoints(
  logs: LogForPoints[],
  couponCosts: number[] = [],
): { earned: number; spent: number; available: number } {
  const earned = logs.reduce((sum, l) => sum + calcLogPoints(l), 0);
  const spent  = couponCosts.reduce((s, c) => s + c, 0);
  return { earned, spent, available: Math.max(0, earned - spent) };
}

/**
 * チームパワー = (totalEarned + thankYouCount × 5) ÷ daysSinceBirth
 * Returns 0 if daysSinceBirth is 0 or unknown.
 */
export function calcTeamPower(params: {
  totalEarned: number;
  thankYouCount: number;
  birthday?: string;
}): number {
  const { totalEarned, thankYouCount, birthday } = params;
  if (!birthday) return 0;
  const birth = new Date(birthday);
  const now   = new Date();
  const days  = Math.max(1, Math.floor((now.getTime() - birth.getTime()) / 86_400_000));
  return Math.round(((totalEarned + thankYouCount * 5) / days) * 10) / 10;
}

// ─── Point-rate table (for display in ポイントのしくみ screen) ─────────────────

export interface PointRule {
  emoji: string;
  label: string;
  value: string;
  desc: string;
}

export const POINT_RULES: PointRule[] = [
  { emoji: '📝', label: '通常ログ',       value: '10〜30 pt', desc: '1回の記録で獲得できるポイント数' },
  { emoji: '🌙', label: '深夜ボーナス',   value: '+10 pt',    desc: '22時〜6時の記録に追加ボーナス' },
  { emoji: '⭐', label: 'マイルストーン', value: '30 pt',     desc: 'はじめての記録・成長記念' },
  { emoji: '🎯', label: 'ミッション完了', value: '×3倍',      desc: 'ルーティンミッションを完了したとき' },
];

export const TEAM_POWER_DESC =
  '（累計ポイント＋ありがとう数×5）÷ 生後日数\n毎日コツコツ記録するほど高くなります！';
