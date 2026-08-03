/**
 * SkillTreeScreen — parity with the web version at
 * client/src/pages/SkillTree.tsx.
 *
 * A "team parenting skill tree" that users tap to mark as complete /
 * uncomplete (no auto-detection from log counts). Grouped by 4 levels
 * bracketed by child age; the current-age level is auto-expanded.
 *
 * Data source of truth: mobile/src/data/teamSkills.ts (ported verbatim
 * from web TEAM_SKILL_LEVELS / TEAM_TITLES / getSkillIcon).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import {
  ArrowLeft, Users, ChevronDown, ChevronUp,
  Award, X, Sparkles, Trophy, Lock,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInMonths, parseISO } from 'date-fns';

import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import type { RootStackParamList } from '../navigation';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Card, Text, Title, Muted } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import {
  TEAM_SKILL_LEVELS,
  TOTAL_SKILLS,
  getRelevantLevels,
  getSkillIcon,
  getTeamTitle,
  type SkillLevelDef,
  type TeamSkillDef,
} from '../data/teamSkills';
import {
  listSkillCompletions,
  completeSkill,
  uncompleteSkill,
  type SkillCompletion,
} from '../api/skills';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SkillTreeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { isDark, colors } = useTheme();
  const familyId = user?.familyId ?? 'default';
  const userId = user?.role ?? 'papa';
  const activeChild = useChildStore((s) => s.activeChild)();

  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: completions = [] } = useQuery<SkillCompletion[]>({
    queryKey: ['skill-completions', familyId],
    queryFn: () => listSkillCompletions(familyId),
    enabled: !!familyId,
    refetchInterval: 5000,
  });

  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<TeamSkillDef | null>(null);

  // Age in whole months — derived from the active child's birthday.
  const ageMonths = useMemo(() => {
    if (!activeChild?.birthday) return null;
    return differenceInMonths(new Date(), parseISO(activeChild.birthday));
  }, [activeChild?.birthday]);

  const relevantLevels = useMemo(() => getRelevantLevels(ageMonths), [ageMonths]);

  // Auto-expand the level that matches the child's current age. Falls
  // back to level 0 when the age is unknown or falls outside every band.
  useEffect(() => {
    if (relevantLevels.length > 0) {
      setExpandedLevel(relevantLevels[0].id);
    } else {
      setExpandedLevel(TEAM_SKILL_LEVELS[0].id);
    }
  }, [ageMonths]);

  const completedIds = useMemo(
    () => new Set(completions.map((c) => c.skillId)),
    [completions],
  );

  const totalCompleted = useMemo(() => {
    let n = 0;
    for (const lv of TEAM_SKILL_LEVELS) {
      for (const s of lv.skills) if (completedIds.has(s.id)) n++;
    }
    return n;
  }, [completedIds]);

  const teamTitle = useMemo(() => getTeamTitle(totalCompleted), [totalCompleted]);

  const completeMut = useMutation({
    mutationFn: (skillId: string) =>
      completeSkill({ familyId, userId, skillId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-completions', familyId] });
      toast.show({
        title: 'スキル習得おめでとうございます！',
        duration: 2000,
      });
    },
  });

  const uncompleteMut = useMutation({
    mutationFn: (skillId: string) =>
      uncompleteSkill({ familyId, userId, skillId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-completions', familyId] });
    },
  });

  const onToggleSkill = (skill: TeamSkillDef) => {
    if (completedIds.has(skill.id)) {
      uncompleteMut.mutate(skill.id);
    } else {
      completeMut.mutate(skill.id);
      setCelebration(skill);
    }
  };

  return (
    <View style={[styles.screen, isDark && { backgroundColor: colors.background }]}>
      {/* ── Header (sticky-ish; sits at top of the ScrollView on mobile) ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <ArrowLeft size={20} color={palette.foreground} />
        </TouchableOpacity>
        <View>
          <Title style={styles.headerTitle}>チーム育児スキル</Title>
          <Muted style={styles.headerSub}>二人の経験値の蓄積</Muted>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Team-summary card ─────────────────────────────────────────── */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIconBox}>
              <Users size={26} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Trophy size={14} color="#F59E0B" />
                <Text style={styles.teamTitleText}>{teamTitle.current.title}</Text>
                <Text style={styles.teamEmoji}>{teamTitle.current.emoji}</Text>
              </View>
              <Muted style={styles.progressLabel}>
                {totalCompleted}/{TOTAL_SKILLS} スキル習得済み
              </Muted>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${TOTAL_SKILLS > 0 ? (totalCompleted / TOTAL_SKILLS) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              {teamTitle.next && (
                <Muted style={styles.nextTitleText}>
                  次の称号「{teamTitle.next.title}」まで あと {teamTitle.next.min - totalCompleted} スキル
                </Muted>
              )}
            </View>
          </View>

          {/* Earned skills badges (only shown once at least one is complete) */}
          {totalCompleted > 0 && (
            <View style={styles.badgeWrap}>
              {TEAM_SKILL_LEVELS.flatMap((lv) =>
                lv.skills
                  .filter((s) => completedIds.has(s.id))
                  .map((skill) => {
                    const SkillIcon = getSkillIcon(skill.id);
                    return (
                      <View key={skill.id} style={styles.miniBadge}>
                        <SkillIcon size={11} color={palette.foreground} />
                        <Text style={styles.miniBadgeText}>{skill.title}</Text>
                      </View>
                    );
                  }),
              )}
            </View>
          )}
        </Card>

        {/* ── Level cards ───────────────────────────────────────────────── */}
        {TEAM_SKILL_LEVELS.map((level) => (
          <LevelCard
            key={level.id}
            level={level}
            isExpanded={expandedLevel === level.id}
            onToggleExpand={() =>
              setExpandedLevel(expandedLevel === level.id ? null : level.id)
            }
            ageMonths={ageMonths}
            completedIds={completedIds}
            onToggleSkill={onToggleSkill}
          />
        ))}

        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 24 }}>
          <Muted style={styles.footerHint}>
            スキルは、ログや{'\n'}パートナーと確認しあいながら習得できます
          </Muted>
        </View>
      </ScrollView>

      {/* ── Celebration modal (shown once a new skill is toggled on) ────── */}
      <Modal
        visible={celebration !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCelebration(null)}
      >
        <Pressable
          style={styles.celebrationBackdrop}
          onPress={() => setCelebration(null)}
        >
          <Pressable style={styles.celebrationCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.celebrationCloseRow}>
              <TouchableOpacity
                onPress={() => setCelebration(null)}
                hitSlop={12}
              >
                <X size={18} color={palette.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.celebrationIconWrap}>
              <Users size={36} color="#9333EA" />
            </View>

            <Text style={styles.celebrationHeadline}>チームスキル Lv.UP!</Text>
            <Text style={styles.celebrationSkill}>{celebration?.title}</Text>

            <View style={styles.celebrationMsgBox}>
              <View style={styles.celebrationMsgIcon}>
                <Sparkles size={18} color="#9333EA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.celebrationMsgLabel}>お祝いメッセージ</Text>
                <Text style={styles.celebrationMsgText}>{celebration?.mioMessage}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.celebrationBtn}
              onPress={() => setCelebration(null)}
            >
              <Text style={styles.celebrationBtnText}>ふたりの力だね！</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-component: single collapsible level card
// ───────────────────────────────────────────────────────────────────────────

interface LevelCardProps {
  level: SkillLevelDef;
  isExpanded: boolean;
  onToggleExpand: () => void;
  ageMonths: number | null;
  completedIds: Set<string>;
  onToggleSkill: (s: TeamSkillDef) => void;
}

function LevelCard({
  level,
  isExpanded,
  onToggleExpand,
  ageMonths,
  completedIds,
  onToggleSkill,
}: LevelCardProps) {
  const LevelIcon = level.icon;
  const levelCompleted = level.skills.filter((s) => completedIds.has(s.id)).length;
  const isCurrent = ageMonths !== null && ageMonths >= level.minMonths && ageMonths <= level.maxMonths;
  const isFuture = ageMonths !== null && ageMonths < level.minMonths;
  const isPast = ageMonths !== null && ageMonths > level.maxMonths;

  return (
    <Card
      style={[
        styles.levelCard,
        isCurrent && { borderColor: level.borderColor, borderWidth: 1.5 },
        isFuture && { opacity: 0.75 },
      ]}
    >
      <TouchableOpacity
        style={styles.levelHead}
        onPress={onToggleExpand}
        activeOpacity={0.7}
      >
        <View style={[styles.levelIconBox, { backgroundColor: level.bgColor }]}>
          <LevelIcon size={22} color={level.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.levelTitleRow}>
            <Text style={styles.levelTitle}>
              Lv.{level.level + 1} {level.title}
            </Text>
            {isCurrent && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>いまここ</Text>
              </View>
            )}
            {isFuture && (
              <View style={styles.futureBadge}>
                <Lock size={10} color="#6B7280" />
                <Text style={styles.futureBadgeText}>これから</Text>
              </View>
            )}
            {isPast && levelCompleted < level.skills.length && (
              <View style={styles.pastBadge}>
                <Text style={styles.pastBadgeText}>振り返り可</Text>
              </View>
            )}
          </View>
          <Muted style={styles.levelSubtitle}>
            {level.ageRange} | {level.subtitle}
          </Muted>
          <View style={styles.levelProgressTrack}>
            <View
              style={[
                styles.levelProgressFill,
                {
                  width: `${level.skills.length > 0 ? (levelCompleted / level.skills.length) * 100 : 0}%`,
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

      {isExpanded && (
        <View style={styles.skillList}>
          {level.skills.map((skill) => {
            const isCompleted = completedIds.has(skill.id);
            const SkillIcon = getSkillIcon(skill.id);
            return (
              <TouchableOpacity
                key={skill.id}
                style={[
                  styles.skillItem,
                  isCompleted
                    ? { borderColor: level.borderColor, backgroundColor: level.bgColor }
                    : { borderColor: '#F3F4F6', backgroundColor: palette.card },
                ]}
                onPress={() => onToggleSkill(skill)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.skillIconBox,
                    isCompleted
                      ? { backgroundColor: '#9333EA' }
                      : { backgroundColor: '#F3F4F6' },
                  ]}
                >
                  {isCompleted ? (
                    <Award size={20} color="#FFFFFF" />
                  ) : (
                    <SkillIcon size={20} color="#9CA3AF" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.skillTitle,
                      isCompleted && { color: '#6B21A8' },
                    ]}
                  >
                    {skill.title}
                  </Text>
                  <Muted style={styles.skillCondition}>{skill.condition}</Muted>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8FF',
    backgroundColor: palette.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  headerTitle: { fontSize: 18, color: '#1F2937', fontFamily: fonts.bodyBold },
  headerSub: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  scrollContent: { padding: 16, gap: 16, paddingBottom: 80 },

  // ── Summary card ──
  summaryCard: {
    padding: 18,
    borderRadius: radius.lg,
    borderColor: '#F3E8FF',
    backgroundColor: '#FAF5FF',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  summaryIconBox: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  teamTitleText: { fontSize: 14, color: '#6B21A8', fontFamily: fonts.bodyBold },
  teamEmoji: { fontSize: 15 },
  progressLabel: { fontSize: 11, color: '#7C3AED', marginTop: 4 },
  progressTrack: {
    height: 8,
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9333EA',
    borderRadius: 999,
  },
  nextTitleText: { fontSize: 10, color: '#A78BFA', marginTop: 6 },

  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  miniBadgeText: { fontSize: 10, color: palette.foreground, fontFamily: fonts.body },

  // ── Level card ──
  levelCard: {
    padding: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  levelHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  levelIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  levelTitle: { fontSize: 13, color: '#1F2937', fontFamily: fonts.bodyBold },
  levelSubtitle: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  levelProgressTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 999,
  },

  currentBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  currentBadgeText: { fontSize: 10, color: '#7E22CE', fontFamily: fonts.bodyBold },
  futureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  futureBadgeText: { fontSize: 10, color: '#6B7280', fontFamily: fonts.bodyBold },
  pastBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pastBadgeText: { fontSize: 10, color: '#B45309', fontFamily: fonts.bodyBold },

  // ── Skill items ──
  skillList: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  skillIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  skillTitle: { fontSize: 13, color: '#1F2937', fontFamily: fonts.bodyBold },
  skillCondition: { fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 16 },

  footerHint: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },

  // ── Celebration modal ──
  celebrationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  celebrationCard: {
    backgroundColor: palette.card,
    borderRadius: 32,
    padding: 22,
    ...shadows.soft,
  },
  celebrationCloseRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  celebrationIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 40,
    backgroundColor: '#EDE9FE',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  celebrationHeadline: {
    fontSize: 17,
    color: '#6B21A8',
    fontFamily: fonts.bodyBold,
    textAlign: 'center',
  },
  celebrationSkill: {
    fontSize: 15,
    color: '#9333EA',
    fontFamily: fonts.bodyBold,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  celebrationMsgBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: '#FAF5FF',
  },
  celebrationMsgIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationMsgLabel: { fontSize: 10, color: '#9333EA', fontFamily: fonts.bodyBold, marginBottom: 3 },
  celebrationMsgText: { fontSize: 12, color: '#6B21A8', lineHeight: 18 },
  celebrationBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#9333EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bodyBold },
});
