/**
 * SkillTreeScreen — Spec §11
 *
 * Skill tree that unlocks as the couple completes childcare tasks.
 * • Level 0-3, gated by child age in months
 * • Skills unlock when log-count conditions are met
 * • Partner-approval skills go through申請 → 承認 flow
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Baby,
  Milk,
  Moon,
  Bath,
  Handshake,
  Zap,
  Brain,
  ClipboardList,
  Utensils,
  Sparkles,
  Award,
  Clock,
  ShieldCheck,
  Lock,
  LockKeyhole,
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { getLogs } from '../api/logs';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Screen, Card, Button, Badge, Text, Title, Muted } from '../theme/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillDef {
  key: string;
  emoji: string;
  name: string;
  desc: string;
  conditionDesc: string;
  requiresApproval: boolean;
  xp: number;
}

interface LevelDef {
  level: number;
  title: string;
  subtitle: string;
  color: string;
  minAgeMonths: number;
  skills: SkillDef[];
}

// ─── Skill tree data ──────────────────────────────────────────────────────────

const SKILL_TREE: LevelDef[] = [
  {
    level: 0,
    title: 'レベル 0',
    subtitle: '基本的な育児スキルの習得',
    color: palette.primary,
    minAgeMonths: 0,
    skills: [
      {
        key: 'diaper_master',
        emoji: '👶',
        name: 'おむつ替えマスター',
        desc: 'おむつ替えを10回以上記録しました',
        conditionDesc: 'おむつ記録 10回以上',
        requiresApproval: false,
        xp: 50,
      },
      {
        key: 'feeding_pro',
        emoji: '🍼',
        name: '授乳の達人',
        desc: '授乳・ミルクを20回以上記録しました',
        conditionDesc: '授乳記録 20回以上',
        requiresApproval: false,
        xp: 50,
      },
      {
        key: 'sleep_logger',
        emoji: '😴',
        name: 'ねんね記録士',
        desc: '睡眠を10回以上記録しました',
        conditionDesc: 'ねんね記録 10回以上',
        requiresApproval: false,
        xp: 50,
      },
      {
        key: 'bath_master',
        emoji: '🛁',
        name: 'お風呂の達人',
        desc: 'お風呂を5回以上記録しました',
        conditionDesc: 'お風呂記録 5回以上',
        requiresApproval: false,
        xp: 30,
      },
    ],
  },
  {
    level: 1,
    title: 'レベル 1',
    subtitle: '夜間交代ローテーションなど、連携スキルの解放',
    color: '#3B82F6',
    minAgeMonths: 2,
    skills: [
      {
        key: 'night_shift',
        emoji: '🌙',
        name: '夜間交代ローテーション',
        desc: 'ふたりで夜間育児の分担を決めました',
        conditionDesc: 'パートナーの承認が必要',
        requiresApproval: true,
        xp: 100,
      },
      {
        key: 'team_log',
        emoji: '🤝',
        name: 'チームログ達成',
        desc: '合計30件以上の育児記録が揃いました',
        conditionDesc: '総記録 30件以上',
        requiresApproval: false,
        xp: 80,
      },
      {
        key: 'parallel_care',
        emoji: '⚡',
        name: '同時タスクマスター',
        desc: '育児記録が50件を超えました',
        conditionDesc: '総記録 50件以上',
        requiresApproval: false,
        xp: 80,
      },
    ],
  },
  {
    level: 2,
    title: 'レベル 2',
    subtitle: 'かかりつけ医レポートマスターなど、専門スキルの解放',
    color: palette.secondary,
    minAgeMonths: 6,
    skills: [
      {
        key: 'doctor_report',
        emoji: '🏥',
        name: 'かかりつけ医レポートマスター',
        desc: '体温・症状の記録を5件以上まとめました',
        conditionDesc: '受診記録 5件以上',
        requiresApproval: false,
        xp: 120,
      },
      {
        key: 'baby_food_dev',
        emoji: '🥣',
        name: '離乳食開発者',
        desc: '離乳食を20回以上記録しました',
        conditionDesc: '離乳食記録 20回以上',
        requiresApproval: false,
        xp: 120,
      },
      {
        key: 'milestone_expert',
        emoji: '⭐',
        name: '発達記録エキスパート',
        desc: 'はじめてや成長のマイルストーンを10件以上記録しました',
        conditionDesc: 'マイルストーン 10件以上 ＋ 承認',
        requiresApproval: true,
        xp: 150,
      },
    ],
  },
  {
    level: 3,
    title: 'レベル 3',
    subtitle: '実際の育児に即した上級スキルの解放',
    color: palette.destructive,
    minAgeMonths: 12,
    skills: [
      {
        key: 'time_master',
        emoji: '⏰',
        name: '育児タイムマネジメント',
        desc: '記録が100件を超えました。育児のプロです',
        conditionDesc: '総記録 100件以上',
        requiresApproval: false,
        xp: 200,
      },
      {
        key: 'expert_collab',
        emoji: '👨‍👩‍👧',
        name: '専門家チーム連携',
        desc: 'ふたりで高度な育児連携を実現しました',
        conditionDesc: 'パートナーの承認が必要',
        requiresApproval: true,
        xp: 200,
      },
      {
        key: 'parenting_pro',
        emoji: '🏆',
        name: '育児プロフェッショナル',
        desc: '全レベルのスキルをコンプリートしました',
        conditionDesc: 'レベル 0〜2 の全スキル解放',
        requiresApproval: false,
        xp: 300,
      },
    ],
  },
];

// Web SkillTree maps skill ids → lucide icons; mirror that here per skill key.
function getSkillIcon(key: string): typeof Users {
  const map: Record<string, typeof Users> = {
    diaper_master: Baby,
    feeding_pro: Milk,
    sleep_logger: Moon,
    bath_master: Bath,
    night_shift: Moon,
    team_log: Handshake,
    parallel_care: Zap,
    doctor_report: ClipboardList,
    baby_food_dev: Utensils,
    milestone_expert: Sparkles,
    time_master: Clock,
    expert_collab: Brain,
    parenting_pro: Award,
  };
  return map[key] ?? Award;
}

// Level header icon (web: per-level icon)
function getLevelIcon(level: number): typeof Users {
  const map: Record<number, typeof Users> = {
    0: Baby,
    1: Handshake,
    2: Brain,
    3: ShieldCheck,
  };
  return map[level] ?? Users;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getChildAgeMonths(birthday?: string): number {
  if (!birthday) return 99;
  const birth = new Date(birthday);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

function countByTypes(logs: any[], types: string[]): number {
  return logs.filter((l) => types.includes(l.type)).length;
}

const RANK_THRESHOLDS = [
  { min: 600, label: 'マスター', emoji: '👑' },
  { min: 300, label: 'エキスパート', emoji: '🔥' },
  { min: 100, label: 'スタンダード', emoji: '⭐' },
  { min: 0,   label: 'ルーキー',      emoji: '🌱' },
];

function getRank(xp: number) {
  return RANK_THRESHOLDS.find((r) => xp >= r.min) ?? RANK_THRESHOLDS[3];
}

// Web SkillTree: title progression by # of unlocked skills (TEAM_TITLES / getTeamTitle)
const TEAM_TITLES: { min: number; title: string; emoji: string }[] = [
  { min: 0, title: '新米チーム', emoji: '🌱' },
  { min: 3, title: 'ビギナーチーム', emoji: '🌿' },
  { min: 7, title: '中堅チーム', emoji: '🌳' },
  { min: 12, title: '達人チーム', emoji: '✨' },
  { min: 18, title: 'マスターチーム', emoji: '👑' },
  { min: 24, title: 'レジェンドチーム', emoji: '🏆' },
];

function getTeamTitle(completed: number) {
  let current = TEAM_TITLES[0];
  for (const t of TEAM_TITLES) {
    if (completed >= t.min) current = t;
  }
  const next = TEAM_TITLES.find((t) => t.min > completed);
  return { current, next };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillTreeScreen() {
  const { user } = useAuthStore();
  const { children, activeChildId } = useChildStore();
  const familyId = user?.familyId ?? '';

  const activeChild = children.find((c) => c.id === activeChildId);
  const childAgeMonths = getChildAgeMonths(activeChild?.birthday);

  const STORAGE_KEY = `@weyu_skills_${familyId}`;

  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [totalXP, setTotalXP] = useState(0);
  const [selected, setSelected] = useState<SkillDef | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Web SkillTree: levels are collapsible; the current level starts expanded.
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', familyId],
    queryFn: () => getLogs(familyId as any),
    enabled: !!familyId,
  });

  // Load persisted state
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        setUnlocked(new Set(data.unlocked ?? []));
        setPending(new Set(data.pending ?? []));
        setTotalXP(data.totalXP ?? 0);
      } catch {}
    });
  }, [STORAGE_KEY]);

  const persist = useCallback(
    async (u: Set<string>, p: Set<string>, xp: number) => {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ unlocked: Array.from(u), pending: Array.from(p), totalXP: xp }),
      );
    },
    [STORAGE_KEY],
  );

  // Compute conditions met per skill key
  const conditionsMet = useMemo<Record<string, boolean>>(() => {
    const diaper   = countByTypes(logs, ['diaper_wet', 'diaper_poop']);
    const feeding  = countByTypes(logs, ['breastfeed', 'formula', 'milk']);
    const sleep    = countByTypes(logs, ['sleep']);
    const bath     = countByTypes(logs, ['bath']);
    const total    = logs.length;
    const doctor   = countByTypes(logs, ['temperature', 'symptoms']);
    const food     = countByTypes(logs, ['food', 'meal', 'snack']);
    const milest   = countByTypes(logs, ['milestone', 'word', 'achievement']);

    // Level 0-2 all unlocked → parenting_pro condition
    const allLower = SKILL_TREE.slice(0, 3).every((lv) =>
      lv.skills.every((s) => unlocked.has(s.key)),
    );

    return {
      diaper_master:    diaper  >= 10,
      feeding_pro:      feeding >= 20,
      sleep_logger:     sleep   >= 10,
      bath_master:      bath    >= 5,
      night_shift:      true,             // manual / partner approval
      team_log:         total   >= 30,
      parallel_care:    total   >= 50,
      doctor_report:    doctor  >= 5,
      baby_food_dev:    food    >= 20,
      milestone_expert: milest  >= 10,    // + requiresApproval
      time_master:      total   >= 100,
      expert_collab:    true,             // manual / partner approval
      parenting_pro:    allLower,
    };
  }, [logs, unlocked]);

  // Unlock a skill directly (no approval needed)
  const unlockSkill = useCallback(
    (skill: SkillDef) => {
      const next = new Set(unlocked);
      next.add(skill.key);
      const xp = totalXP + skill.xp;
      setUnlocked(next);
      setTotalXP(xp);
      persist(next, pending, xp);
    },
    [unlocked, pending, totalXP, persist],
  );

  // Request partner approval
  const requestApproval = useCallback(
    (skill: SkillDef) => {
      const next = new Set(pending);
      next.add(skill.key);
      setPending(next);
      persist(unlocked, next, totalXP);
      setShowModal(false);
      Alert.alert('申請しました', 'パートナーに通知しました。パートナーが「承認する」を押すとスキルが解放されます。');
    },
    [unlocked, pending, totalXP, persist],
  );

  // Partner taps "承認する"
  const approveSkill = useCallback(
    (skill: SkillDef) => {
      const confirmApprove = () => {
        const nextU = new Set(unlocked);
        nextU.add(skill.key);
        const nextP = new Set(pending);
        nextP.delete(skill.key);
        const xp = totalXP + skill.xp;
        setUnlocked(nextU);
        setPending(nextP);
        setTotalXP(xp);
        persist(nextU, nextP, xp);
      };
      if (Platform.OS === 'web') {
        if (window.confirm(`「${skill.name}」を承認しますか？`)) confirmApprove();
      } else {
        Alert.alert('承認する', `「${skill.name}」を承認しますか？`, [
          { text: 'キャンセル', style: 'cancel' },
          { text: '承認する', onPress: confirmApprove },
        ]);
      }
    },
    [unlocked, pending, totalXP, persist],
  );

  const handleSkillPress = useCallback(
    (skill: SkillDef, levelUnlocked: boolean) => {
      if (!levelUnlocked || unlocked.has(skill.key) || pending.has(skill.key)) return;
      if (!conditionsMet[skill.key]) {
        Alert.alert('条件未達成', `「${skill.conditionDesc}」を達成するとスキルが解放できます。`);
        return;
      }
      if (skill.requiresApproval) {
        setSelected(skill);
        setShowModal(true);
      } else {
        unlockSkill(skill);
      }
    },
    [unlocked, pending, conditionsMet, unlockSkill],
  );

  const rank = getRank(totalXP);

  // Progress across all skills
  const totalSkills = SKILL_TREE.reduce((s, l) => s + l.skills.length, 0);
  const totalUnlocked = unlocked.size;
  const teamTitle = useMemo(() => getTeamTitle(totalUnlocked), [totalUnlocked]);

  // Web SkillTree: auto-expand the level that matches the child's current age
  useEffect(() => {
    const current = SKILL_TREE.find(
      (lv, i) =>
        childAgeMonths >= lv.minAgeMonths &&
        (i === SKILL_TREE.length - 1 || childAgeMonths < SKILL_TREE[i + 1].minAgeMonths),
    );
    setExpandedLevel(current ? current.level : SKILL_TREE[0].level);
  }, [childAgeMonths]);

  return (
    <Screen contentStyle={styles.screenContent}>
      {/* ── Header (web SkillTree: title + 二人の経験値の蓄積) ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Title style={styles.headerTitle}>チーム育児スキル</Title>
          <Muted style={styles.headerSub}>
            {activeChild
              ? `${activeChild.name} · ${childAgeMonths}ヶ月 ｜ 二人の経験値の蓄積`
              : '二人の経験値の蓄積'}
          </Muted>
        </View>
      </View>

      {/* ── Team summary card (web SkillTree: gradient summary, Trophy + team title) ── */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryIconBox}>
            <Users size={28} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.summaryTitleRow}>
              <Trophy size={16} color="#D97706" />
              <Text style={styles.summaryTitle}>
                {teamTitle.current.emoji} {teamTitle.current.title}
              </Text>
            </View>
            <Text style={styles.summarySub}>
              {totalUnlocked}/{totalSkills} スキル習得済み
            </Text>
            <View style={styles.summaryBar}>
              <View
                style={[
                  styles.summaryFill,
                  { width: `${totalSkills > 0 ? (totalUnlocked / totalSkills) * 100 : 0}%` as any },
                ]}
              />
            </View>
            {teamTitle.next && (
              <Text style={styles.nextTitleHint}>
                次の称号「{teamTitle.next.title}」まで あと{' '}
                {teamTitle.next.min - totalUnlocked} スキル
              </Text>
            )}
            <View style={styles.rankRow}>
              <Text style={styles.rankEmoji}>{rank.emoji}</Text>
              <Text style={styles.rankLabel}>{rank.label}</Text>
              <Text style={styles.xpText}>{totalXP} XP</Text>
            </View>
          </View>
        </View>

        {totalUnlocked > 0 && (
          <View style={styles.badgeWrap}>
            {SKILL_TREE.flatMap((level) =>
              level.skills
                .filter((s) => unlocked.has(s.key))
                .map((skill) => {
                  const SkillIcon = getSkillIcon(skill.key);
                  return (
                    <Badge
                      key={skill.key}
                      variant="secondary"
                      style={styles.skillBadge}
                      textStyle={styles.skillBadgeText}
                    >
                      <View style={styles.skillBadgeInner}>
                        <SkillIcon size={12} color={palette.secondaryForeground} />
                        <Text style={styles.skillBadgeText}> {skill.name}</Text>
                      </View>
                    </Badge>
                  );
                }),
            )}
          </View>
        )}
      </Card>

      {/* ── Level sections (web SkillTree: collapsible cards) ── */}
      {SKILL_TREE.map((levelDef, idx) => {
        const levelUnlocked = childAgeMonths >= levelDef.minAgeMonths;
        const levelUnlockedCount = levelDef.skills.filter((s) => unlocked.has(s.key)).length;
        const levelTotal = levelDef.skills.length;
        const LevelIcon = getLevelIcon(levelDef.level);
        const isExpanded = expandedLevel === levelDef.level;
        const nextMin =
          idx < SKILL_TREE.length - 1 ? SKILL_TREE[idx + 1].minAgeMonths : Infinity;
        const isCurrent = levelUnlocked && childAgeMonths < nextMin;
        const isFuture = !levelUnlocked;
        const isPast = levelUnlocked && !isCurrent;

        return (
          <Card
            key={levelDef.level}
            style={[
              styles.levelCard,
              { borderColor: isCurrent ? levelDef.color : palette.border },
              isFuture && styles.levelCardFuture,
            ]}
          >
            {/* Level header — tap to expand/collapse */}
            <TouchableOpacity
              style={styles.levelHeader}
              activeOpacity={0.7}
              onPress={() =>
                setExpandedLevel(isExpanded ? null : levelDef.level)
              }
            >
              <View
                style={[
                  styles.levelIconBox,
                  { backgroundColor: levelUnlocked ? `${levelDef.color}22` : palette.muted },
                ]}
              >
                <LevelIcon size={22} color={levelUnlocked ? levelDef.color : palette.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.levelTitleRow}>
                  <Text style={styles.levelTitle}>
                    Lv.{levelDef.level + 1} {levelDef.title}
                  </Text>
                  {isCurrent && (
                    <Badge variant="secondary" style={styles.nowBadge} textStyle={styles.nowBadgeText}>
                      いまここ
                    </Badge>
                  )}
                  {isFuture && (
                    <Badge variant="secondary" style={styles.futureBadge} textStyle={styles.futureBadgeText}>
                      これから
                    </Badge>
                  )}
                  {isPast && levelUnlockedCount < levelTotal && (
                    <Badge variant="secondary" style={styles.pastBadge} textStyle={styles.pastBadgeText}>
                      振り返り可
                    </Badge>
                  )}
                </View>
                <Muted style={styles.levelSubtitle} numberOfLines={2}>
                  {levelDef.minAgeMonths === 0
                    ? '0ヶ月〜'
                    : `${levelDef.minAgeMonths}ヶ月〜`}
                  {' ｜ '}
                  {levelDef.subtitle}
                </Muted>
                <View style={styles.levelBar}>
                  <View
                    style={[
                      styles.levelFill,
                      {
                        width: `${levelTotal > 0 ? (levelUnlockedCount / levelTotal) * 100 : 0}%` as any,
                        backgroundColor: levelUnlocked ? levelDef.color : palette.mutedForeground,
                      },
                    ]}
                  />
                </View>
              </View>
              {isExpanded ? (
                <ChevronUp size={16} color={palette.mutedForeground} />
              ) : (
                <ChevronDown size={16} color={palette.mutedForeground} />
              )}
            </TouchableOpacity>

            {/* Skills — only when expanded (web: AnimatePresence) */}
            {isExpanded && (
            <View style={styles.skillList}>
              {levelDef.skills.map((skill) => {
                const isUnlocked = unlocked.has(skill.key);
                const isPending  = pending.has(skill.key);
                const metCond    = conditionsMet[skill.key];
                const canAct     = levelUnlocked && !isUnlocked && !isPending;
                const SkillIcon  = getSkillIcon(skill.key);

                return (
                  <TouchableOpacity
                    key={skill.key}
                    style={[
                      styles.skillRow,
                      isUnlocked
                        ? { borderColor: levelDef.color, backgroundColor: `${levelDef.color}14` }
                        : { borderColor: palette.border, backgroundColor: palette.card },
                      !levelUnlocked && styles.skillRowDimmed,
                    ]}
                    onPress={() => handleSkillPress(skill, levelUnlocked)}
                    activeOpacity={isUnlocked ? 1 : 0.7}
                  >
                    <View
                      style={[
                        styles.skillIconBox,
                        isUnlocked
                          ? { backgroundColor: palette.primary }
                          : { backgroundColor: palette.muted },
                      ]}
                    >
                      {isUnlocked ? (
                        <Award size={20} color={palette.primaryForeground} />
                      ) : (
                        <SkillIcon size={20} color={palette.mutedForeground} />
                      )}
                    </View>

                    <View style={styles.skillInfo}>
                      <View style={styles.skillNameRow}>
                        <Text
                          style={[
                            styles.skillName,
                            isUnlocked && { color: levelDef.color },
                          ]}
                        >
                          {skill.name}
                        </Text>
                        {skill.requiresApproval && !isUnlocked && (
                          <Users size={13} color={palette.accentForeground} />
                        )}
                      </View>
                      <Muted style={styles.skillCondDesc}>{skill.conditionDesc}</Muted>
                      {isUnlocked && (
                        <Text style={[styles.skillXP, { color: levelDef.color }]}>
                          ＋{skill.xp} XP 獲得！
                        </Text>
                      )}
                      {canAct && metCond && <View style={styles.readyDot} />}
                    </View>

                    {/* Status badge */}
                    {isUnlocked ? (
                      <Badge style={[styles.statusBadge, { backgroundColor: levelDef.color }]} textStyle={styles.statusBadgeText}>
                        解放済
                      </Badge>
                    ) : isPending ? (
                      <TouchableOpacity
                        style={styles.approveBadge}
                        onPress={() => approveSkill(skill)}
                      >
                        <Text style={styles.approveBadgeText}>承認する</Text>
                      </TouchableOpacity>
                    ) : canAct && metCond ? (
                      <Badge variant="secondary" style={styles.readyBadge} textStyle={styles.readyBadgeText}>
                        {skill.requiresApproval ? '申請' : '解放'}
                      </Badge>
                    ) : (
                      <View style={styles.lockBox}>
                        {levelUnlocked ? (
                          <LockKeyhole size={18} color={palette.mutedForeground} />
                        ) : (
                          <Lock size={18} color={palette.mutedForeground} />
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            )}
          </Card>
        );
      })}

      <View style={styles.footerNote}>
        <Muted style={styles.footerNoteText}>
          スキルは、ログやWeボードで{'\n'}パートナーと確認しあいながら習得できます
        </Muted>
      </View>

      {/* ── Partner Approval Modal ── */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetIconCircle}>
              {selected && React.createElement(getSkillIcon(selected.key), {
                size: 36,
                color: palette.primary,
              })}
            </View>
            <Title style={styles.sheetTitle}>{selected?.name}</Title>
            <Text style={styles.sheetDesc}>{selected?.desc}</Text>
            <View style={styles.approvalNote}>
              <View style={styles.approvalNoteRow}>
                <Users size={18} color={palette.accentForeground} />
                <Text style={styles.approvalNoteText}>
                  このスキルはパートナーの承認が必要です。{'\n'}
                  申請するとパートナーに通知が届き、パートナーが「承認する」を押すとスキルが解放されます。
                </Text>
              </View>
            </View>
            <View style={styles.sheetBtns}>
              <Button variant="outline" style={styles.sheetBtn} onPress={() => setShowModal(false)}>
                キャンセル
              </Button>
              <Button
                style={styles.sheetBtn}
                onPress={() => selected && requestApproval(selected)}
              >
                承認を申請する
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center' },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, color: palette.foreground },
  headerSub: { fontSize: 12, marginTop: 2 },

  // Summary card (web gradient → accent surface)
  summaryCard: {
    borderRadius: radius.lg,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    padding: 20,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  summaryIconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: '#E2D6F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  summaryTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.accentForeground },
  summarySub: { fontFamily: fonts.body, fontSize: 12, color: palette.primary, marginTop: 4 },
  nextTitleHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: palette.primary,
    opacity: 0.8,
    marginTop: 6,
  },
  summaryBar: {
    height: 8,
    backgroundColor: '#E2D6F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  summaryFill: { height: '100%', backgroundColor: palette.primary, borderRadius: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  rankEmoji: { fontFamily: fonts.body, fontSize: 14 },
  rankLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: palette.accentForeground },
  xpText: { fontFamily: fonts.body, fontSize: 11, color: palette.primary },

  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  skillBadge: { paddingHorizontal: 8, paddingVertical: 2 },
  skillBadgeInner: { flexDirection: 'row', alignItems: 'center' },
  skillBadgeText: { fontSize: 10, color: palette.secondaryForeground },

  // Level cards
  levelCard: {
    borderRadius: radius.lg,
    padding: 16,
    ...shadows.soft,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  levelCardFuture: { opacity: 0.7 },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  levelTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground },
  nowBadge: { paddingHorizontal: 8, paddingVertical: 1, backgroundColor: palette.accent },
  nowBadgeText: { fontSize: 10, color: palette.accentForeground },
  futureBadge: { paddingHorizontal: 8, paddingVertical: 1, backgroundColor: palette.muted },
  futureBadgeText: { fontSize: 10, color: palette.mutedForeground },
  pastBadge: { paddingHorizontal: 8, paddingVertical: 1, backgroundColor: '#FEF3C7' },
  pastBadgeText: { fontSize: 10, color: '#B45309' },
  levelSubtitle: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  levelAgeHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  levelAgeHint: { fontSize: 11 },
  levelBar: {
    height: 6,
    backgroundColor: palette.muted,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  levelFill: { height: '100%', borderRadius: 3 },
  levelProgressBadge: {
    backgroundColor: palette.muted,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  levelProgressText: { fontFamily: fonts.bodyBold, fontSize: 13, color: palette.foreground },

  // Skill rows (web: rounded-2xl border-2)
  skillList: { gap: 12, marginTop: 12 },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    gap: 12,
  },
  skillRowDimmed: { opacity: 0.55 },
  skillIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillInfo: { flex: 1 },
  skillNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skillName: { fontFamily: fonts.bodyBold, fontSize: 14, color: palette.foreground },
  skillCondDesc: { fontSize: 11, marginTop: 2 },
  skillXP: { fontFamily: fonts.bodyBold, fontSize: 11, marginTop: 2 },
  readyDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: palette.secondary, marginTop: 4,
  },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 11, color: palette.primaryForeground },
  approveBadge: {
    backgroundColor: palette.muted,
    borderWidth: 1,
    borderColor: palette.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  approveBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: palette.secondary },
  readyBadge: { backgroundColor: palette.secondary, paddingHorizontal: 10, paddingVertical: 5 },
  readyBadgeText: { fontSize: 11, color: palette.secondaryForeground },
  lockBox: { width: 28, alignItems: 'center', justifyContent: 'center' },

  footerNote: { alignItems: 'center', paddingVertical: 8 },
  footerNoteText: { fontSize: 11, textAlign: 'center', lineHeight: 18 },

  // Modal (mobile-only sheet, restyled with kit)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: palette.border, marginBottom: 4,
  },
  sheetIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 20, color: palette.foreground, textAlign: 'center' },
  sheetDesc: { fontSize: 14, color: palette.mutedForeground, textAlign: 'center', lineHeight: 22 },
  approvalNote: {
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    padding: 14,
    width: '100%',
  },
  approvalNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  approvalNoteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.accentForeground,
    lineHeight: 20,
  },
  sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 4, width: '100%' },
  sheetBtn: { flex: 1, borderRadius: radius.sm },
});
